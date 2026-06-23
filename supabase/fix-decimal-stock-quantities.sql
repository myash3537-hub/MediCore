begin;

drop view if exists public.expiry_alerts;
drop view if exists public.inventory_snapshot;

alter table public.medicine_batches
  alter column stock_quantity type numeric(12, 2)
  using stock_quantity::numeric(12, 2);

alter table public.purchase_items
  alter column quantity type numeric(12, 2)
  using quantity::numeric(12, 2);

alter table public.sale_items
  alter column quantity type numeric(12, 2)
  using quantity::numeric(12, 2);

alter table public.sale_return_items
  alter column quantity type numeric(12, 2)
  using quantity::numeric(12, 2);

alter table public.stock_movements
  alter column quantity type numeric(12, 2)
  using quantity::numeric(12, 2);

create or replace function public.record_sale(
  p_customer_name text,
  p_discount_amount numeric,
  p_tax_amount numeric,
  p_payment_method public.payment_method,
  p_notes text,
  p_items jsonb,
  p_cash_amount numeric default null,
  p_online_amount numeric default null,
  p_online_payment_method text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale_id uuid;
  v_item jsonb;
  v_line_total numeric(12, 2);
  v_subtotal numeric(12, 2) := 0;
  v_batch_stock numeric(12, 2);
  v_total_amount numeric(12, 2);
  v_cash_amount numeric(12, 2) := 0;
  v_online_amount numeric(12, 2) := 0;
  v_online_payment_method text;
begin
  perform public.ensure_staff_access();

  insert into public.sales (customer_name, discount_amount, tax_amount, payment_method, notes, recorded_by)
  values (
    nullif(trim(p_customer_name), ''),
    coalesce(p_discount_amount, 0),
    coalesce(p_tax_amount, 0),
    coalesce(p_payment_method, 'Cash'),
    p_notes,
    auth.uid()
  )
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    select stock_quantity
    into v_batch_stock
    from public.medicine_batches
    where id = (v_item ->> 'batch_id')::uuid
    for update;

    if v_batch_stock is null then
      raise exception 'Batch not found';
    end if;

    if v_batch_stock < (v_item ->> 'quantity')::numeric(12, 2) then
      raise exception 'Insufficient stock for selected batch';
    end if;

    v_line_total := ((v_item ->> 'quantity')::numeric(12, 2) * (v_item ->> 'unit_price')::numeric(12, 2));
    v_subtotal := v_subtotal + v_line_total;

    update public.medicine_batches
    set stock_quantity = stock_quantity - (v_item ->> 'quantity')::numeric(12, 2)
    where id = (v_item ->> 'batch_id')::uuid;

    insert into public.sale_items (
      sale_id,
      medicine_id,
      batch_id,
      quantity,
      unit_price,
      line_total
    )
    values (
      v_sale_id,
      (v_item ->> 'medicine_id')::uuid,
      (v_item ->> 'batch_id')::uuid,
      (v_item ->> 'quantity')::numeric(12, 2),
      (v_item ->> 'unit_price')::numeric(12, 2),
      v_line_total
    );

    insert into public.stock_movements (medicine_id, batch_id, movement_type, quantity, reference_id, notes, created_by)
    values (
      (v_item ->> 'medicine_id')::uuid,
      (v_item ->> 'batch_id')::uuid,
      'sale',
      -1 * (v_item ->> 'quantity')::numeric(12, 2),
      v_sale_id,
      'POS sale',
      auth.uid()
    );
  end loop;

  update public.sales
  set subtotal = v_subtotal,
      total_amount = greatest(v_subtotal - coalesce(p_discount_amount, 0) + coalesce(p_tax_amount, 0), 0)
  where id = v_sale_id;

  select total_amount into v_total_amount
  from public.sales
  where id = v_sale_id;

  if coalesce(p_payment_method, 'Cash') = 'Cash' then
    v_cash_amount := coalesce(v_total_amount, 0);
    v_online_amount := 0;
    v_online_payment_method := null;
  elsif p_payment_method in ('UPI', 'Card') then
    v_cash_amount := 0;
    v_online_amount := coalesce(v_total_amount, 0);
    v_online_payment_method := p_payment_method::text;
  elsif p_payment_method = 'Split' then
    v_cash_amount := coalesce(p_cash_amount, 0);
    v_online_amount := coalesce(p_online_amount, 0);
    v_online_payment_method := nullif(trim(coalesce(p_online_payment_method, '')), '');

    if v_online_payment_method not in ('UPI', 'Card') then
      raise exception 'Select an online payment type for split payments';
    end if;

    if coalesce(v_total_amount, 0) > 0 and (v_cash_amount <= 0 or v_online_amount <= 0) then
      raise exception 'Split payment requires both cash and online amounts';
    end if;

    if abs((v_cash_amount + v_online_amount) - coalesce(v_total_amount, 0)) > 0.01 then
      raise exception 'Split payment amounts must add up to the amount due';
    end if;
  end if;

  update public.sales
  set cash_amount = v_cash_amount,
      online_amount = v_online_amount,
      online_payment_method = v_online_payment_method
  where id = v_sale_id;

  perform public.record_audit('sales', v_sale_id, 'created', jsonb_build_object('customer_name', p_customer_name));
  return v_sale_id;
end;
$$;

create or replace function public.record_purchase(
  p_supplier_id uuid,
  p_invoice_number text,
  p_purchase_date timestamptz,
  p_notes text,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase_id uuid;
  v_item jsonb;
  v_batch_id uuid;3 
  v_line_total numeric(12, 2);
  v_subtotal numeric(12, 2) := 0;
begin
  perform public.ensure_staff_access();

  insert into public.purchases (supplier_id, invoice_number, purchase_date, notes, recorded_by)
  values (p_supplier_id, p_invoice_number, coalesce(p_purchase_date, timezone('utc', now())), p_notes, auth.uid())
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    insert into public.medicine_batches (
      medicine_id,
      supplier_id,
      batch_number,
      expiry_date,
      stock_quantity,
      purchase_price,
      selling_price,
      low_stock_threshold
    )
    values (
      (v_item ->> 'medicine_id')::uuid,
      coalesce((v_item ->> 'supplier_id')::uuid, p_supplier_id),
      v_item ->> 'batch_number',
      (v_item ->> 'expiry_date')::date,
      greatest((v_item ->> 'quantity')::numeric(12, 2), 0),
      (v_item ->> 'purchase_price')::numeric(12, 2),
      (v_item ->> 'selling_price')::numeric(12, 2),
      coalesce((v_item ->> 'low_stock_threshold')::integer, (select default_low_stock_threshold from public.store_settings limit 1), 10)
    )
    on conflict (medicine_id, batch_number)
    do update set
      stock_quantity = public.medicine_batches.stock_quantity + excluded.stock_quantity,
      expiry_date = excluded.expiry_date,
      purchase_price = excluded.purchase_price,
      selling_price = excluded.selling_price,
      supplier_id = excluded.supplier_id,
      low_stock_threshold = excluded.low_stock_threshold
    returning id into v_batch_id;

    v_line_total := ((v_item ->> 'quantity')::numeric(12, 2) * (v_item ->> 'purchase_price')::numeric(12, 2));
    v_subtotal := v_subtotal + v_line_total;

    insert into public.purchase_items (
      purchase_id,
      medicine_id,
      batch_id,
      quantity,
      purchase_price,
      selling_price,
      line_total
    )
    values (
      v_purchase_id,
      (v_item ->> 'medicine_id')::uuid,
      v_batch_id,
      (v_item ->> 'quantity')::numeric(12, 2),
      (v_item ->> 'purchase_price')::numeric(12, 2),
      (v_item ->> 'selling_price')::numeric(12, 2),
      v_line_total
    );

    insert into public.stock_movements (medicine_id, batch_id, movement_type, quantity, reference_id, notes, created_by)
    values (
      (v_item ->> 'medicine_id')::uuid,
      v_batch_id,
      'purchase',
      (v_item ->> 'quantity')::numeric(12, 2),
      v_purchase_id,
      concat('Purchase invoice ', coalesce(p_invoice_number, 'manual')),
      auth.uid()
    );
  end loop;

  update public.purchases
  set subtotal = v_subtotal,
      total_amount = v_subtotal
  where id = v_purchase_id;

  perform public.record_audit('purchases', v_purchase_id, 'created', jsonb_build_object('invoice_number', p_invoice_number));
  return v_purchase_id;
end;
$$;

create or replace function public.process_sale_return(
  p_sale_id uuid,
  p_reason text,
  p_refund_amount numeric,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_return_id uuid;
  v_item jsonb;
  v_sold_quantity numeric(12, 2);
  v_returned_quantity numeric(12, 2);
  v_batch_id uuid;
begin
  perform public.ensure_staff_access();

  insert into public.sales_returns (sale_id, refund_amount, reason, recorded_by)
  values (p_sale_id, coalesce(p_refund_amount, 0), p_reason, auth.uid())
  returning id into v_return_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    select quantity, batch_id
    into v_sold_quantity, v_batch_id
    from public.sale_items
    where id = (v_item ->> 'sale_item_id')::uuid
    for update;

    if v_sold_quantity is null then
      raise exception 'Sale item not found';
    end if;

    select coalesce(sum(quantity), 0)
    into v_returned_quantity
    from public.sale_return_items
    where sale_item_id = (v_item ->> 'sale_item_id')::uuid;

    if v_returned_quantity + (v_item ->> 'quantity')::numeric(12, 2) > v_sold_quantity then
      raise exception 'Return quantity exceeds sold quantity';
    end if;

    update public.medicine_batches
    set stock_quantity = stock_quantity + (v_item ->> 'quantity')::numeric(12, 2)
    where id = v_batch_id;

    insert into public.sale_return_items (
      sale_return_id,
      sale_item_id,
      batch_id,
      quantity,
      refund_amount
    )
    values (
      v_return_id,
      (v_item ->> 'sale_item_id')::uuid,
      v_batch_id,
      (v_item ->> 'quantity')::numeric(12, 2),
      (v_item ->> 'refund_amount')::numeric(12, 2)
    );

    insert into public.stock_movements (medicine_id, batch_id, movement_type, quantity, reference_id, notes, created_by)
    select medicine_id, batch_id, 'return', (v_item ->> 'quantity')::numeric(12, 2), v_return_id, p_reason, auth.uid()
    from public.sale_items
    where id = (v_item ->> 'sale_item_id')::uuid;
  end loop;

  perform public.record_audit('sales_returns', v_return_id, 'created', jsonb_build_object('sale_id', p_sale_id));
  return v_return_id;
end;
$$;

create or replace view public.inventory_snapshot as
select
  b.id as batch_id,
  m.id as medicine_id,
  m.name as medicine_name,
  m.category,
  m.rx_required,
  b.batch_number,
  b.expiry_date,
  b.stock_quantity,
  b.purchase_price,
  b.selling_price,
  b.low_stock_threshold,
  s.name as supplier_name,
  (b.stock_quantity <= b.low_stock_threshold) as is_low_stock
from public.medicine_batches b
join public.medicines m on m.id = b.medicine_id
left join public.suppliers s on s.id = b.supplier_id
where m.is_active = true;

create or replace view public.expiry_alerts as
select *
from public.inventory_snapshot
where expiry_date <= current_date + coalesce((select expiry_alert_days from public.store_settings limit 1), 45);

commit;

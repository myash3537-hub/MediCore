alter table public.sales
  add column if not exists due_amount numeric(12, 2) not null default 0;

update public.sales
set due_amount = 0
where due_amount is null;

create or replace function public.record_sale(
  p_customer_name text,
  p_discount_amount numeric,
  p_tax_amount numeric,
  p_payment_method public.payment_method,
  p_notes text,
  p_items jsonb,
  p_cash_amount numeric default null,
  p_online_amount numeric default null,
  p_online_payment_method text default null,
  p_due_amount numeric default 0
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
  v_batch_stock numeric;
  v_requested_quantity numeric;
  v_total_amount numeric(12, 2);
  v_due_amount numeric(12, 2);
  v_collect_amount numeric(12, 2);
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
    v_requested_quantity := (v_item ->> 'quantity')::numeric;

    select stock_quantity
    into v_batch_stock
    from public.medicine_batches
    where id = (v_item ->> 'batch_id')::uuid
    for update;

    if v_batch_stock is null then
      raise exception 'Batch not found';
    end if;

    if v_batch_stock < v_requested_quantity then
      raise exception 'Insufficient stock for selected batch';
    end if;

    v_line_total := v_requested_quantity * (v_item ->> 'unit_price')::numeric(12, 2);
    v_subtotal := v_subtotal + v_line_total;

    update public.medicine_batches
    set stock_quantity = stock_quantity - v_requested_quantity
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
      v_requested_quantity,
      (v_item ->> 'unit_price')::numeric(12, 2),
      v_line_total
    );

    insert into public.stock_movements (medicine_id, batch_id, movement_type, quantity, reference_id, notes, created_by)
    values (
      (v_item ->> 'medicine_id')::uuid,
      (v_item ->> 'batch_id')::uuid,
      'sale',
      -1 * v_requested_quantity,
      v_sale_id,
      'POS sale',
      auth.uid()
    );
  end loop;

  v_total_amount := greatest(v_subtotal - coalesce(p_discount_amount, 0) + coalesce(p_tax_amount, 0), 0);
  v_due_amount := least(greatest(coalesce(p_due_amount, 0), 0), v_total_amount);
  v_collect_amount := greatest(v_total_amount - v_due_amount, 0);

  if coalesce(p_payment_method, 'Cash') = 'Cash' then
    v_cash_amount := v_collect_amount;
    v_online_amount := 0;
    v_online_payment_method := null;
  elsif p_payment_method in ('UPI', 'Card') then
    v_cash_amount := 0;
    v_online_amount := v_collect_amount;
    v_online_payment_method := p_payment_method::text;
  elsif p_payment_method = 'Split' then
    v_cash_amount := coalesce(p_cash_amount, 0);
    v_online_amount := coalesce(p_online_amount, 0);
    v_online_payment_method := nullif(trim(coalesce(p_online_payment_method, '')), '');

    if v_online_payment_method not in ('UPI', 'Card') then
      raise exception 'Select an online payment type for split payments';
    end if;

    if v_collect_amount > 0 and (v_cash_amount <= 0 or v_online_amount <= 0) then
      raise exception 'Split payment requires both cash and online amounts';
    end if;

    if abs((v_cash_amount + v_online_amount) - v_collect_amount) > 0.01 then
      raise exception 'Split payment amounts must add up to the collect-now amount';
    end if;
  end if;

  update public.sales
  set subtotal = v_subtotal,
      total_amount = v_total_amount,
      due_amount = v_due_amount,
      cash_amount = v_cash_amount,
      online_amount = v_online_amount,
      online_payment_method = v_online_payment_method
  where id = v_sale_id;

  perform public.record_audit('sales', v_sale_id, 'created', jsonb_build_object('customer_name', p_customer_name, 'due_amount', v_due_amount));
  return v_sale_id;
end;
$$;

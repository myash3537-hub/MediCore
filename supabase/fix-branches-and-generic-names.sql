create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

insert into public.branches (name, code, is_active)
values
  ('Mukundpur', 'MUKUNDPUR', true),
  ('Karawal Nagar', 'KARAWAL_NAGAR', true)
on conflict (code) do update
set name = excluded.name,
    is_active = true;

alter table public.medicines add column if not exists branch_id uuid references public.branches(id);
alter table public.medicines add column if not exists generic_name text;
alter table public.medicine_batches add column if not exists branch_id uuid references public.branches(id);
alter table public.suppliers add column if not exists branch_id uuid references public.branches(id);
alter table public.sales add column if not exists branch_id uuid references public.branches(id);
alter table public.purchases add column if not exists branch_id uuid references public.branches(id);
alter table public.sales_returns add column if not exists branch_id uuid references public.branches(id);
alter table public.stock_movements add column if not exists branch_id uuid references public.branches(id);
alter table public.notifications add column if not exists branch_id uuid references public.branches(id);
alter table public.store_settings add column if not exists branch_id uuid references public.branches(id);

do $$
declare
  v_mukundpur uuid;
begin
  select id into v_mukundpur from public.branches where code = 'MUKUNDPUR';

  update public.medicines set branch_id = v_mukundpur where branch_id is null;
  update public.medicine_batches set branch_id = v_mukundpur where branch_id is null;
  update public.suppliers set branch_id = v_mukundpur where branch_id is null;
  update public.sales set branch_id = v_mukundpur where branch_id is null;
  update public.purchases set branch_id = v_mukundpur where branch_id is null;
  update public.sales_returns set branch_id = v_mukundpur where branch_id is null;
  update public.stock_movements set branch_id = v_mukundpur where branch_id is null;
  update public.notifications set branch_id = v_mukundpur where branch_id is null;
  update public.store_settings set branch_id = v_mukundpur where branch_id is null;

  insert into public.store_settings (
    branch_id,
    store_name,
    store_address,
    store_contact,
    tax_enabled,
    tax_rate,
    currency_code,
    expiry_alert_days,
    default_low_stock_threshold
  )
  select
    b.id,
    'THE SR''S PHARMACY - ' || b.name,
    null,
    null,
    false,
    0,
    'INR',
    45,
    10
  from public.branches b
  where not exists (
    select 1 from public.store_settings s where s.branch_id = b.id
  );
end $$;

alter table public.medicines drop constraint if exists medicines_name_key;
alter table public.medicines drop constraint if exists medicines_name_unique;
drop index if exists medicines_name_key;
drop index if exists medicines_name_unique;
alter table public.suppliers drop constraint if exists suppliers_name_key;
drop index if exists suppliers_name_key;

create unique index if not exists medicines_branch_name_unique
  on public.medicines (branch_id, lower(name));

create unique index if not exists suppliers_branch_name_unique
  on public.suppliers (branch_id, name);

create index if not exists medicines_branch_generic_idx
  on public.medicines (branch_id, lower(coalesce(generic_name, '')));

drop view if exists public.expiry_alerts;
drop view if exists public.inventory_snapshot;

create or replace view public.inventory_snapshot as
select
  b.branch_id,
  b.id as batch_id,
  m.id as medicine_id,
  m.name as medicine_name,
  m.generic_name,
  m.category,
  m.rx_required,
  b.batch_number,
  b.expiry_date,
  b.stock_quantity,
  b.purchase_price,
  b.selling_price,
  b.tablets_per_strip,
  b.low_stock_threshold,
  m.low_stock_alert_enabled,
  s.name as supplier_name,
  (m.low_stock_alert_enabled and b.stock_quantity <= b.low_stock_threshold) as is_low_stock
from public.medicine_batches b
join public.medicines m on m.id = b.medicine_id
left join public.suppliers s on s.id = b.supplier_id
where m.is_active = true;

create or replace view public.expiry_alerts as
select i.*
from public.inventory_snapshot i
join public.store_settings st on st.branch_id = i.branch_id
where i.expiry_date <= (current_date + st.expiry_alert_days);

create or replace function public.record_sale(
  p_branch_id uuid,
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

  insert into public.sales (branch_id, customer_name, discount_amount, tax_amount, payment_method, notes, recorded_by)
  values (p_branch_id, nullif(trim(p_customer_name), ''), coalesce(p_discount_amount, 0), coalesce(p_tax_amount, 0), coalesce(p_payment_method, 'Cash'), p_notes, auth.uid())
  returning id into v_sale_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_requested_quantity := (v_item ->> 'quantity')::numeric;

    select stock_quantity
    into v_batch_stock
    from public.medicine_batches
    where id = (v_item ->> 'batch_id')::uuid
      and branch_id = p_branch_id
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
    where id = (v_item ->> 'batch_id')::uuid
      and branch_id = p_branch_id;

    insert into public.sale_items (sale_id, medicine_id, batch_id, quantity, unit_price, line_total)
    values (v_sale_id, (v_item ->> 'medicine_id')::uuid, (v_item ->> 'batch_id')::uuid, v_requested_quantity, (v_item ->> 'unit_price')::numeric(12, 2), v_line_total);

    insert into public.stock_movements (branch_id, medicine_id, batch_id, movement_type, quantity, reference_id, notes, created_by)
    values (p_branch_id, (v_item ->> 'medicine_id')::uuid, (v_item ->> 'batch_id')::uuid, 'sale', -1 * v_requested_quantity, v_sale_id, 'POS sale', auth.uid());
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

  perform public.record_audit('sales', v_sale_id, 'created', jsonb_build_object('customer_name', p_customer_name, 'branch_id', p_branch_id));
  return v_sale_id;
end;
$$;

create or replace function public.record_purchase(
  p_branch_id uuid,
  p_supplier_id uuid,
  p_invoice_number text,
  p_purchase_date date,
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
  v_batch_id uuid;
  v_quantity numeric;
  v_purchase_price numeric(12, 2);
  v_selling_price numeric(12, 2);
  v_line_total numeric(12, 2);
  v_subtotal numeric(12, 2) := 0;
begin
  perform public.ensure_admin_access();

  insert into public.purchases (branch_id, supplier_id, invoice_number, purchase_date, notes, created_by)
  values (p_branch_id, p_supplier_id, nullif(trim(p_invoice_number), ''), coalesce(p_purchase_date, current_date), p_notes, auth.uid())
  returning id into v_purchase_id;

  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  loop
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_purchase_price := (v_item ->> 'purchase_price')::numeric(12, 2);
    v_selling_price := (v_item ->> 'selling_price')::numeric(12, 2);
    v_line_total := v_quantity * v_purchase_price;
    v_subtotal := v_subtotal + v_line_total;

    insert into public.medicine_batches (
      branch_id,
      medicine_id,
      supplier_id,
      batch_number,
      expiry_date,
      stock_quantity,
      purchase_price,
      selling_price,
      tablets_per_strip,
      low_stock_threshold
    )
    values (
      p_branch_id,
      (v_item ->> 'medicine_id')::uuid,
      p_supplier_id,
      trim(v_item ->> 'batch_number'),
      (v_item ->> 'expiry_date')::date,
      v_quantity,
      v_purchase_price,
      v_selling_price,
      greatest(coalesce((v_item ->> 'tablets_per_strip')::integer, 1), 1),
      coalesce((v_item ->> 'low_stock_threshold')::integer, 10)
    )
    on conflict (medicine_id, batch_number) do update
    set stock_quantity = public.medicine_batches.stock_quantity + excluded.stock_quantity,
        purchase_price = excluded.purchase_price,
        selling_price = excluded.selling_price,
        supplier_id = excluded.supplier_id,
        expiry_date = excluded.expiry_date,
        tablets_per_strip = excluded.tablets_per_strip,
        low_stock_threshold = excluded.low_stock_threshold
    returning id into v_batch_id;

    insert into public.purchase_items (purchase_id, medicine_id, batch_id, quantity, purchase_price, selling_price, line_total)
    values (v_purchase_id, (v_item ->> 'medicine_id')::uuid, v_batch_id, v_quantity, v_purchase_price, v_selling_price, v_line_total);

    insert into public.stock_movements (branch_id, medicine_id, batch_id, movement_type, quantity, reference_id, notes, created_by)
    values (p_branch_id, (v_item ->> 'medicine_id')::uuid, v_batch_id, 'purchase', v_quantity, v_purchase_id, 'Purchase receipt', auth.uid());
  end loop;

  update public.purchases
  set subtotal = v_subtotal,
      total_amount = v_subtotal
  where id = v_purchase_id;

  perform public.record_audit('purchases', v_purchase_id, 'created', jsonb_build_object('supplier_id', p_supplier_id, 'branch_id', p_branch_id));
  return v_purchase_id;
end;
$$;

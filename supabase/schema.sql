create extension if not exists pgcrypto;
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
  v_batch_stock numeric(12, 4);
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

    if v_batch_stock < (v_item ->> 'quantity')::numeric(12, 4) then
      raise exception 'Insufficient stock for selected batch';
    end if;

    v_line_total := ((v_item ->> 'quantity')::numeric(12, 4) * (v_item ->> 'unit_price')::numeric(12, 2));
    v_subtotal := v_subtotal + v_line_total;

    update public.medicine_batches
    set stock_quantity = stock_quantity - (v_item ->> 'quantity')::numeric(12, 4)
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
      (v_item ->> 'quantity')::numeric(12, 4),
      (v_item ->> 'unit_price')::numeric(12, 2),
      v_line_total
    );

    insert into public.stock_movements (medicine_id, batch_id, movement_type, quantity, reference_id, notes, created_by)
    values (
      (v_item ->> 'medicine_id')::uuid,
      (v_item ->> 'batch_id')::uuid,
      'sale',
      -1 * (v_item ->> 'quantity')::numeric(12, 4),
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
);

create unique index if not exists medicines_name_unique on public.medicines (lower(name));
alter table public.medicines add column if not exists low_stock_alert_enabled boolean not null default true;

create table if not exists public.medicine_batches (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references public.medicines(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  batch_number text not null,
  expiry_date date not null,
  stock_quantity numeric(12, 4) not null default 0 check (stock_quantity >= 0),
  purchase_price numeric(12, 2) not null check (purchase_price >= 0),
  selling_price numeric(12, 2) not null check (selling_price >= 0),
  tablets_per_strip integer not null default 10 check (tablets_per_strip >= 1),
  low_stock_threshold integer not null default 10 check (low_stock_threshold >= 0),
  manufactured_on date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (medicine_id, batch_number)
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete set null,
  invoice_number text,
  purchase_date timestamptz not null default timezone('utc', now()),
  subtotal numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id) on delete restrict,
  batch_id uuid not null references public.medicine_batches(id) on delete restrict,
  quantity numeric(12, 4) not null check (quantity > 0),
  purchase_price numeric(12, 2) not null check (purchase_price >= 0),
  selling_price numeric(12, 2) not null check (selling_price >= 0),
  line_total numeric(12, 2) not null default 0
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique default concat('INV-', to_char(now(), 'YYYYMMDDHH24MISS')),
  sale_date timestamptz not null default timezone('utc', now()),
  customer_name text,
  subtotal numeric(12, 2) not null default 0,
  discount_amount numeric(12, 2) not null default 0,
  tax_amount numeric(12, 2) not null default 0,
  total_amount numeric(12, 2) not null default 0,
  payment_method public.payment_method not null default 'Cash',
  cash_amount numeric(12, 2) not null default 0 check (cash_amount >= 0),
  online_amount numeric(12, 2) not null default 0 check (online_amount >= 0),
  online_payment_method text check (online_payment_method in ('UPI', 'Card') or online_payment_method is null),
  notes text,
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.sales add column if not exists cash_amount numeric(12, 2) not null default 0;
alter table public.sales add column if not exists online_amount numeric(12, 2) not null default 0;
alter table public.sales add column if not exists online_payment_method text;
alter table public.sales drop constraint if exists sales_online_payment_method_check;
alter table public.sales
  add constraint sales_online_payment_method_check
  check (online_payment_method in ('UPI', 'Card') or online_payment_method is null);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  medicine_id uuid not null references public.medicines(id) on delete restrict,
  batch_id uuid not null references public.medicine_batches(id) on delete restrict,
  quantity numeric(12, 4) not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(12, 2) not null default 0
);

create table if not exists public.sales_returns (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete restrict,
  refund_amount numeric(12, 2) not null default 0,
  reason text,
  return_date timestamptz not null default timezone('utc', now()),
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sale_return_items (
  id uuid primary key default gen_random_uuid(),
  sale_return_id uuid not null references public.sales_returns(id) on delete cascade,
  sale_item_id uuid not null references public.sale_items(id) on delete restrict,
  batch_id uuid not null references public.medicine_batches(id) on delete restrict,
  quantity numeric(12, 4) not null check (quantity > 0),
  refund_amount numeric(12, 2) not null default 0
);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  medicine_id uuid not null references public.medicines(id) on delete restrict,
  batch_id uuid not null references public.medicine_batches(id) on delete restrict,
  movement_type public.stock_movement_type not null,
  quantity numeric(12, 4) not null,
  reference_id uuid,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  severity text not null default 'info',
  is_read boolean not null default false,
  target_role public.user_role,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.store_settings (
  id uuid primary key default gen_random_uuid(),
  store_name text not null default 'THE SR''S PHARMACY',
  store_address text,
  store_contact text,
  tax_enabled boolean not null default true,
  tax_rate numeric(5, 2) not null default 0,
  currency_code text not null default 'INR',
  expiry_alert_days integer not null default 45,
  default_low_stock_threshold integer not null default 10,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  compact_mode boolean not null default false,
  default_pos_payment_method public.payment_method not null default 'Cash',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  entity_name text not null,
  entity_id uuid,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_batches_expiry on public.medicine_batches (expiry_date);
create index if not exists idx_batches_stock on public.medicine_batches (stock_quantity);
create index if not exists idx_sales_sale_date on public.sales (sale_date desc);
create index if not exists idx_purchases_purchase_date on public.purchases (purchase_date desc);
create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger suppliers_set_updated_at before update on public.suppliers for each row execute function public.set_updated_at();
create trigger medicines_set_updated_at before update on public.medicines for each row execute function public.set_updated_at();
create trigger batches_set_updated_at before update on public.medicine_batches for each row execute function public.set_updated_at();
create trigger settings_set_updated_at before update on public.store_settings for each row execute function public.set_updated_at();
create trigger preferences_set_updated_at before update on public.user_preferences for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do update
  set email = excluded.email;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.suppliers enable row level security;
alter table public.medicines enable row level security;
alter table public.medicine_batches enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.sales_returns enable row level security;
alter table public.sale_return_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.notifications enable row level security;
alter table public.store_settings enable row level security;
alter table public.user_preferences enable row level security;
alter table public.audit_logs enable row level security;

create policy "profiles_select_self_or_admin" on public.profiles for select using (auth.uid() = id or public.is_admin());
create policy "profiles_admin_manage" on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy "suppliers_staff_access" on public.suppliers for all using (public.is_staff()) with check (public.is_staff());
create policy "medicines_staff_access" on public.medicines for all using (public.is_staff()) with check (public.is_staff());
create policy "batches_staff_access" on public.medicine_batches for all using (public.is_staff()) with check (public.is_staff());
create policy "purchases_staff_access" on public.purchases for select using (public.is_staff());
create policy "purchase_items_staff_access" on public.purchase_items for select using (public.is_staff());
create policy "sales_staff_access" on public.sales for select using (public.is_staff());
create policy "sale_items_staff_access" on public.sale_items for select using (public.is_staff());
create policy "sales_returns_staff_access" on public.sales_returns for select using (public.is_staff());
create policy "sale_return_items_staff_access" on public.sale_return_items for select using (public.is_staff());
create policy "stock_movements_staff_access" on public.stock_movements for select using (public.is_staff());
create policy "notifications_staff_access" on public.notifications for select using (public.is_staff());
create policy "settings_staff_select" on public.store_settings for select using (public.is_staff());
create policy "settings_admin_write" on public.store_settings for update using (public.is_admin()) with check (public.is_admin());
create policy "preferences_select_own" on public.user_preferences for select using (auth.uid() = user_id or public.is_admin());
create policy "preferences_mutate_own" on public.user_preferences for all using (auth.uid() = user_id or public.is_admin()) with check (auth.uid() = user_id or public.is_admin());
create policy "audit_logs_admin_select" on public.audit_logs for select using (public.is_admin());
create policy "audit_logs_staff_insert" on public.audit_logs for insert with check (public.is_staff());

insert into public.store_settings (id, store_name, tax_enabled, tax_rate, expiry_alert_days, default_low_stock_threshold)
select gen_random_uuid(), 'THE SR''S PHARMACY', true, 5, 45, 10
where not exists (select 1 from public.store_settings);

create or replace view public.inventory_snapshot as
select
  b.id as batch_id,
  m.id as medicine_id,
  m.name as medicine_name,
  m.category,
  m.rx_required,
  m.low_stock_alert_enabled,
  b.batch_number,
  b.expiry_date,
  b.stock_quantity,
  b.purchase_price,
  b.selling_price,
  b.tablets_per_strip,
  b.low_stock_threshold,
  s.name as supplier_name,
  (m.low_stock_alert_enabled and b.stock_quantity <= b.low_stock_threshold) as is_low_stock
from public.medicine_batches b
join public.medicines m on m.id = b.medicine_id
left join public.suppliers s on s.id = b.supplier_id
where m.is_active = true;

create or replace view public.expiry_alerts as
select *
from public.inventory_snapshot
where expiry_date <= current_date + coalesce((select expiry_alert_days from public.store_settings limit 1), 45);

create or replace function public.record_audit(
  p_entity_name text,
  p_entity_id uuid,
  p_action text,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into public.audit_logs (user_id, entity_name, entity_id, action, details)
  values (auth.uid(), p_entity_name, p_entity_id, p_action, p_details);
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
  v_batch_id uuid;
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
      tablets_per_strip,
      low_stock_threshold
    )
    values (
      (v_item ->> 'medicine_id')::uuid,
      coalesce((v_item ->> 'supplier_id')::uuid, p_supplier_id),
      v_item ->> 'batch_number',
      (v_item ->> 'expiry_date')::date,
      greatest((v_item ->> 'quantity')::numeric(12, 4), 0),
      (v_item ->> 'purchase_price')::numeric(12, 2),
      (v_item ->> 'selling_price')::numeric(12, 2),
      coalesce((v_item ->> 'tablets_per_strip')::integer, 10),
      coalesce((v_item ->> 'low_stock_threshold')::integer, (select default_low_stock_threshold from public.store_settings limit 1), 10)
    )
    on conflict (medicine_id, batch_number)
    do update set
      stock_quantity = public.medicine_batches.stock_quantity + excluded.stock_quantity,
      expiry_date = excluded.expiry_date,
      purchase_price = excluded.purchase_price,
      selling_price = excluded.selling_price,
      tablets_per_strip = excluded.tablets_per_strip,
      supplier_id = excluded.supplier_id,
      low_stock_threshold = excluded.low_stock_threshold
    returning id into v_batch_id;

    v_line_total := ((v_item ->> 'quantity')::numeric(12, 4) * (v_item ->> 'purchase_price')::numeric(12, 2));
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
      (v_item ->> 'quantity')::numeric(12, 4),
      (v_item ->> 'purchase_price')::numeric(12, 2),
      (v_item ->> 'selling_price')::numeric(12, 2),
      v_line_total
    );

    insert into public.stock_movements (medicine_id, batch_id, movement_type, quantity, reference_id, notes, created_by)
    values (
      (v_item ->> 'medicine_id')::uuid,
      v_batch_id,
      'purchase',
      (v_item ->> 'quantity')::numeric(12, 4),
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
  v_sold_quantity numeric(12, 4);
  v_returned_quantity numeric(12, 4);
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

    if v_returned_quantity + (v_item ->> 'quantity')::numeric(12, 4) > v_sold_quantity then
      raise exception 'Return quantity exceeds sold quantity';
    end if;

    update public.medicine_batches
    set stock_quantity = stock_quantity + (v_item ->> 'quantity')::numeric(12, 4)
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
      (v_item ->> 'quantity')::numeric(12, 4),
      (v_item ->> 'refund_amount')::numeric(12, 2)
    );
    insert into public.stock_movements (medicine_id, batch_id, movement_type, quantity, reference_id, notes, created_by)
    select medicine_id, batch_id, 'return', (v_item ->> 'quantity')::numeric(12, 4), v_return_id, p_reason, auth.uid()
    from public.sale_items
    where id = (v_item ->> 'sale_item_id')::uuid;
  end loop;

  perform public.record_audit('sales_returns', v_return_id, 'created', jsonb_build_object('sale_id', p_sale_id));
  return v_return_id;
end;
$$;

drop view if exists public.expiry_alerts;
drop view if exists public.inventory_snapshot;

alter table public.medicines
  add column if not exists low_stock_alert_enabled boolean not null default true;

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

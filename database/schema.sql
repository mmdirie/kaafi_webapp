-- Kaafi Business: initial Supabase/PostgreSQL schema.
-- Apply once to a new Supabase project using the SQL Editor as postgres.

begin;

create extension if not exists pgcrypto with schema extensions;

create type public.member_role as enum ('admin', 'manager', 'cashier', 'inventory_staff');
create type public.member_status as enum ('invited', 'active', 'disabled');
create type public.sale_status as enum ('completed', 'partially_refunded', 'refunded', 'cancelled');
create type public.payment_method as enum ('cash', 'card', 'mobile_money');
create type public.purchase_payment_method as enum ('cash', 'card', 'bank_transfer', 'mobile_money');
create type public.purchase_status as enum ('draft', 'ordered', 'partially_received', 'received', 'cancelled');
create type public.payment_status as enum ('unpaid', 'partially_paid', 'paid');
create type public.inventory_movement_type as enum ('sale', 'refund', 'purchase_receipt', 'adjustment', 'cancellation');

create table public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  business_id uuid not null references public.businesses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  status public.member_status not null default 'active',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create index business_members_user_status_idx on public.business_members (user_id, status);

create table public.business_settings (
  business_id uuid primary key references public.businesses (id) on delete cascade,
  logo_url text,
  address text,
  contact_email text,
  contact_phone text,
  currency_code text not null default 'USD' check (currency_code ~ '^[A-Z]{3}$'),
  tax_rate numeric(7, 4) not null default 0 check (tax_rate between 0 and 1),
  max_discount_percent numeric(5, 2) not null default 0 check (max_discount_percent between 0 and 100),
  receipt_footer text,
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, name)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  contact_name text,
  email text,
  phone text,
  address text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);

create index suppliers_business_name_idx on public.suppliers (business_id, name);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  category_id uuid,
  supplier_id uuid,
  name text not null check (length(trim(name)) between 1 and 200),
  sku text not null check (length(trim(sku)) between 1 and 100),
  description text,
  cost_price numeric(12, 2) not null default 0 check (cost_price >= 0),
  selling_price numeric(12, 2) not null check (selling_price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  stock_threshold integer not null default 0 check (stock_threshold >= 0),
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, sku),
  foreign key (business_id, category_id)
    references public.categories (business_id, id) on delete restrict,
  foreign key (business_id, supplier_id)
    references public.suppliers (business_id, id) on delete restrict
);

create index products_business_name_idx on public.products (business_id, name);
create index products_business_category_idx on public.products (business_id, category_id);
create index products_low_stock_idx on public.products (business_id, stock_quantity)
  where is_active;

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  supplier_id uuid not null,
  purchase_number text not null,
  status public.purchase_status not null default 'draft',
  payment_status public.payment_status not null default 'unpaid',
  subtotal numeric(12, 2) not null default 0 check (subtotal >= 0),
  notes text,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, purchase_number),
  foreign key (business_id, supplier_id)
    references public.suppliers (business_id, id) on delete restrict
);

create index purchases_business_created_idx on public.purchases (business_id, created_at desc);
create index purchases_supplier_idx on public.purchases (business_id, supplier_id, created_at desc);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  purchase_id uuid not null,
  product_id uuid not null,
  quantity_ordered integer not null check (quantity_ordered > 0),
  quantity_received integer not null default 0
    check (quantity_received >= 0 and quantity_received <= quantity_ordered),
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  created_at timestamptz not null default now(),
  unique (purchase_id, product_id),
  foreign key (business_id, purchase_id)
    references public.purchases (business_id, id) on delete cascade,
  foreign key (business_id, product_id)
    references public.products (business_id, id) on delete restrict
);

create index purchase_items_purchase_idx on public.purchase_items (business_id, purchase_id);

create table public.purchase_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  purchase_id uuid not null,
  amount numeric(12, 2) not null check (amount > 0),
  payment_method public.purchase_payment_method not null,
  reference text,
  paid_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (business_id, purchase_id)
    references public.purchases (business_id, id) on delete restrict
);

create index purchase_payments_purchase_idx
  on public.purchase_payments (business_id, purchase_id, created_at desc);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  receipt_number text not null,
  idempotency_key text not null check (length(idempotency_key) between 1 and 200),
  request_payload jsonb not null,
  status public.sale_status not null default 'completed',
  payment_method public.payment_method not null,
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  discount_total numeric(12, 2) not null default 0 check (discount_total >= 0),
  tax_total numeric(12, 2) not null default 0 check (tax_total >= 0),
  total numeric(12, 2) not null check (total >= 0),
  amount_paid numeric(12, 2) not null check (amount_paid >= 0),
  change_due numeric(12, 2) not null default 0 check (change_due >= 0),
  cashier_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, receipt_number),
  unique (business_id, idempotency_key)
);

create index sales_business_created_idx on public.sales (business_id, created_at desc);
create index sales_business_status_idx on public.sales (business_id, status, created_at desc);
create index sales_cashier_idx on public.sales (business_id, cashier_id, created_at desc);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  sale_id uuid not null,
  product_id uuid not null,
  product_name text not null,
  sku text not null,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_total numeric(12, 2) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, sale_id)
    references public.sales (business_id, id) on delete restrict,
  foreign key (business_id, product_id)
    references public.products (business_id, id) on delete restrict
);

create index sale_items_sale_idx on public.sale_items (business_id, sale_id);
create index sale_items_product_idx on public.sale_items (business_id, product_id);

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  sale_id uuid not null,
  idempotency_key text not null check (length(idempotency_key) between 1 and 200),
  reason text not null check (length(trim(reason)) between 1 and 500),
  total numeric(12, 2) not null check (total > 0),
  refunded_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, idempotency_key),
  foreign key (business_id, sale_id)
    references public.sales (business_id, id) on delete restrict
);

create index refunds_sale_idx on public.refunds (business_id, sale_id, created_at desc);

create table public.refund_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  refund_id uuid not null,
  sale_item_id uuid not null,
  quantity integer not null check (quantity > 0),
  amount numeric(12, 2) not null check (amount >= 0),
  foreign key (business_id, refund_id)
    references public.refunds (business_id, id) on delete restrict,
  foreign key (business_id, sale_item_id)
    references public.sale_items (business_id, id) on delete restrict
);

create index refund_items_refund_idx on public.refund_items (business_id, refund_id);

create table public.purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  purchase_id uuid not null,
  idempotency_key text not null check (length(idempotency_key) between 1 and 200),
  received_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, idempotency_key),
  foreign key (business_id, purchase_id)
    references public.purchases (business_id, id) on delete restrict
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  product_id uuid not null,
  movement_type public.inventory_movement_type not null,
  quantity_delta integer not null check (quantity_delta <> 0),
  quantity_after integer not null check (quantity_after >= 0),
  reason text,
  sale_id uuid,
  purchase_receipt_id uuid,
  refund_id uuid,
  actor_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  foreign key (business_id, product_id)
    references public.products (business_id, id) on delete restrict,
  foreign key (business_id, sale_id)
    references public.sales (business_id, id) on delete restrict,
  foreign key (business_id, purchase_receipt_id)
    references public.purchase_receipts (business_id, id) on delete restrict,
  foreign key (business_id, refund_id)
    references public.refunds (business_id, id) on delete restrict
);

create index inventory_movements_product_idx
  on public.inventory_movements (business_id, product_id, created_at desc);
create index inventory_movements_actor_idx
  on public.inventory_movements (business_id, actor_id, created_at desc);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  category text not null check (length(trim(category)) between 1 and 100),
  description text not null check (length(trim(description)) between 1 and 500),
  amount numeric(12, 2) not null check (amount > 0),
  expense_date date not null default current_date,
  recorded_by uuid not null default auth.uid() references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_business_date_idx on public.expenses (business_id, expense_date desc);
create index expenses_business_category_idx on public.expenses (business_id, category, expense_date desc);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (length(action) between 1 and 100),
  entity_type text not null check (length(entity_type) between 1 and 100),
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_business_created_idx on public.audit_logs (business_id, created_at desc);

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated;

create or replace function app_private.is_business_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.business_members m
    where m.business_id = p_business_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function app_private.has_business_role(
  p_business_id uuid,
  p_roles public.member_role[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.business_members m
    where m.business_id = p_business_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = any (p_roles)
  );
$$;

revoke all on function app_private.is_business_member(uuid) from public, anon;
revoke all on function app_private.has_business_role(uuid, public.member_role[]) from public, anon;
grant execute on function app_private.is_business_member(uuid) to authenticated;
grant execute on function app_private.has_business_role(uuid, public.member_role[]) to authenticated;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function app_private.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.user_profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app_private.create_profile_for_auth_user();

create or replace function app_private.initialize_business()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.business_members (business_id, user_id, role, status)
  values (new.id, new.created_by, 'admin', 'active');
  insert into public.business_settings (business_id) values (new.id);
  return new;
end;
$$;

create trigger on_business_created
  after insert on public.businesses
  for each row execute function app_private.initialize_business();

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'user_profiles', 'businesses', 'business_members', 'categories',
    'suppliers', 'products', 'purchases', 'business_settings', 'expenses'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function app_private.set_updated_at()',
      table_name
    );
  end loop;
end;
$$;

alter table public.user_profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.business_settings enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.purchase_payments enable row level security;
alter table public.purchase_receipts enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.refunds enable row level security;
alter table public.refund_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.expenses enable row level security;
alter table public.audit_logs enable row level security;

create policy "Profiles are visible to self or business colleagues"
  on public.user_profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.business_members mine
      join public.business_members colleague on colleague.business_id = mine.business_id
      where mine.user_id = (select auth.uid())
        and mine.status = 'active'
        and colleague.user_id = user_profiles.id
        and colleague.status = 'active'
    )
  );
create policy "Users update their own profile"
  on public.user_profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Members read their businesses"
  on public.businesses for select to authenticated
  using ((select app_private.is_business_member(id)));
create policy "Authenticated users create a business for themselves"
  on public.businesses for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "Business admins update their business"
  on public.businesses for update to authenticated
  using ((select app_private.has_business_role(id, array['admin']::public.member_role[])))
  with check ((select app_private.has_business_role(id, array['admin']::public.member_role[])));

create policy "Members read business memberships"
  on public.business_members for select to authenticated
  using ((select app_private.is_business_member(business_id)));
create policy "Admins manage business memberships"
  on public.business_members for all to authenticated
  using ((select app_private.has_business_role(business_id, array['admin']::public.member_role[])))
  with check ((select app_private.has_business_role(business_id, array['admin']::public.member_role[])));

create policy "Members read business settings"
  on public.business_settings for select to authenticated
  using ((select app_private.is_business_member(business_id)));
create policy "Admins and managers update settings"
  on public.business_settings for update to authenticated
  using ((select app_private.has_business_role(business_id, array['admin', 'manager']::public.member_role[])))
  with check ((select app_private.has_business_role(business_id, array['admin', 'manager']::public.member_role[])));

create policy "Members read categories"
  on public.categories for select to authenticated
  using ((select app_private.is_business_member(business_id)));
create policy "Admins and managers manage categories"
  on public.categories for all to authenticated
  using ((select app_private.has_business_role(business_id, array['admin', 'manager']::public.member_role[])))
  with check ((select app_private.has_business_role(business_id, array['admin', 'manager']::public.member_role[])));

create policy "Authorized staff read suppliers"
  on public.suppliers for select to authenticated
  using ((select app_private.has_business_role(business_id, array['admin', 'manager', 'inventory_staff']::public.member_role[])));
create policy "Authorized staff manage suppliers"
  on public.suppliers for all to authenticated
  using ((select app_private.has_business_role(business_id, array['admin', 'manager', 'inventory_staff']::public.member_role[])))
  with check ((select app_private.has_business_role(business_id, array['admin', 'manager', 'inventory_staff']::public.member_role[])));

create policy "Members read products"
  on public.products for select to authenticated
  using ((select app_private.is_business_member(business_id)));
create policy "Authorized staff create products"
  on public.products for insert to authenticated
  with check ((select app_private.has_business_role(business_id, array['admin', 'manager', 'inventory_staff']::public.member_role[])));
create policy "Authorized staff update products"
  on public.products for update to authenticated
  using ((select app_private.has_business_role(business_id, array['admin', 'manager', 'inventory_staff']::public.member_role[])))
  with check ((select app_private.has_business_role(business_id, array['admin', 'manager', 'inventory_staff']::public.member_role[])));
create policy "Admins and managers remove products"
  on public.products for delete to authenticated
  using ((select app_private.has_business_role(business_id, array['admin', 'manager']::public.member_role[])));

create policy "Authorized staff read purchases"
  on public.purchases for select to authenticated
  using ((select app_private.has_business_role(business_id, array['admin', 'manager', 'inventory_staff']::public.member_role[])));
create policy "Authorized staff read purchase items"
  on public.purchase_items for select to authenticated
  using ((select app_private.has_business_role(business_id, array['admin', 'manager', 'inventory_staff']::public.member_role[])));
create policy "Authorized staff read purchase payments"
  on public.purchase_payments for select to authenticated
  using ((select app_private.has_business_role(business_id, array['admin', 'manager', 'inventory_staff']::public.member_role[])));
create policy "Authorized staff read purchase receipts"
  on public.purchase_receipts for select to authenticated
  using ((select app_private.has_business_role(business_id, array['admin', 'manager', 'inventory_staff']::public.member_role[])));

create policy "Members read sales"
  on public.sales for select to authenticated
  using ((select app_private.is_business_member(business_id)));
create policy "Members read sale items"
  on public.sale_items for select to authenticated
  using ((select app_private.is_business_member(business_id)));
create policy "Managers read refunds"
  on public.refunds for select to authenticated
  using ((select app_private.has_business_role(business_id, array['admin', 'manager']::public.member_role[])));
create policy "Managers read refund items"
  on public.refund_items for select to authenticated
  using ((select app_private.has_business_role(business_id, array['admin', 'manager']::public.member_role[])));
create policy "Members read inventory movements"
  on public.inventory_movements for select to authenticated
  using ((select app_private.is_business_member(business_id)));

create policy "Managers read expenses"
  on public.expenses for select to authenticated
  using ((select app_private.has_business_role(business_id, array['admin', 'manager']::public.member_role[])));
create policy "Managers manage expenses"
  on public.expenses for all to authenticated
  using ((select app_private.has_business_role(business_id, array['admin', 'manager']::public.member_role[])))
  with check ((select app_private.has_business_role(business_id, array['admin', 'manager']::public.member_role[])));

create policy "Admins and managers read audit logs"
  on public.audit_logs for select to authenticated
  using ((select app_private.has_business_role(business_id, array['admin', 'manager']::public.member_role[])));

-- Start with no table privileges, then grant only the API operations needed.
revoke all on all tables in schema public from anon, authenticated;
grant select, update on public.user_profiles to authenticated;
grant select, insert on public.businesses to authenticated;
grant update (name) on public.businesses to authenticated;
grant select, insert, update, delete on public.business_members to authenticated;
grant select on public.business_settings to authenticated;
grant update (logo_url, address, contact_email, contact_phone, currency_code,
              tax_rate, max_discount_percent, receipt_footer)
  on public.business_settings to authenticated;
grant select, insert, delete on public.categories to authenticated;
grant update (name, description) on public.categories to authenticated;
grant select, insert, delete on public.suppliers to authenticated;
grant update (name, contact_name, email, phone, address, notes, is_active)
  on public.suppliers to authenticated;
grant select, delete on public.products to authenticated;
grant insert (business_id, category_id, supplier_id, name, sku, description, cost_price,
              selling_price, stock_threshold, image_url, is_active)
  on public.products to authenticated;
grant update (category_id, supplier_id, name, sku, description, cost_price,
              selling_price, stock_threshold, image_url, is_active)
  on public.products to authenticated;
grant select on public.purchases, public.purchase_items, public.purchase_receipts,
  public.purchase_payments, public.sales, public.sale_items, public.refunds, public.refund_items,
  public.inventory_movements, public.audit_logs to authenticated;
grant select, delete on public.expenses to authenticated;
grant insert (business_id, category, description, amount, expense_date)
  on public.expenses to authenticated;
grant update (category, description, amount, expense_date) on public.expenses to authenticated;

-- ============================================================================
-- STORED FUNCTIONS: ATOMIC INVENTORY, POS CHECKOUT, REFUND & REPORTING
-- ============================================================================

-- Transactional checkout: validates inventory, verifies prices server-side,
-- decrements stock, inserts sale + items + movements + audit log, and checks idempotency.
create or replace function public.perform_checkout(
  p_business_id uuid,
  p_payment_method public.payment_method,
  p_amount_paid numeric,
  p_discount_total numeric,
  p_tax_rate numeric,
  p_idempotency_key text,
  p_items jsonb,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid;
  v_existing_sale public.sales%rowtype;
  v_settings public.business_settings%rowtype;
  v_subtotal numeric(12, 2) := 0;
  v_total_cost numeric(12, 2) := 0;
  v_max_discount numeric(12, 2);
  v_discount numeric(12, 2) := 0;
  v_taxable numeric(12, 2);
  v_tax_rate numeric(7, 4);
  v_tax_total numeric(12, 2) := 0;
  v_final_total numeric(12, 2);
  v_change_due numeric(12, 2) := 0;
  v_receipt_no text;
  v_sale_id uuid;
  v_item record;
  v_prod record;
  v_line_total numeric(12, 2);
  v_line_cost numeric(12, 2);
  v_items_count integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED: Authentication is required';
  end if;

  if not app_private.has_business_role(p_business_id, array['admin', 'manager', 'cashier']::public.member_role[]) then
    raise exception 'FORBIDDEN: You do not have permission to process sales for this business';
  end if;

  -- 1. Check idempotency
  select * into v_existing_sale
  from public.sales
  where business_id = p_business_id and idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'success', true,
      'is_duplicate', true,
      'sale_id', v_existing_sale.id,
      'receipt_number', v_existing_sale.receipt_number,
      'total', v_existing_sale.total,
      'payment_method', v_existing_sale.payment_method
    );
  end if;

  -- 2. Validate items array
  v_items_count := jsonb_array_length(p_items);
  if v_items_count is null or v_items_count = 0 then
    raise exception 'VALIDATION_ERROR: At least one item is required in the cart';
  end if;

  -- 3. Load business settings
  select * into v_settings from public.business_settings where business_id = p_business_id;

  -- 4. Pass 1: Lock products and validate stock and calculate authoritative prices
  for v_item in select * from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
  loop
    if v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'VALIDATION_ERROR: Item quantity must be greater than zero';
    end if;

    select id, name, sku, cost_price, selling_price, stock_quantity, is_active
    into v_prod
    from public.products
    where id = v_item.product_id and business_id = p_business_id
    for update;

    if not found then
      raise exception 'PRODUCT_NOT_FOUND: Product % not found in this business', v_item.product_id;
    end if;

    if not v_prod.is_active then
      raise exception 'PRODUCT_INACTIVE: Product "%" (SKU: %) is inactive and cannot be sold', v_prod.name, v_prod.sku;
    end if;

    if v_prod.stock_quantity < v_item.quantity then
      raise exception 'INSUFFICIENT_STOCK: Product "%" (SKU: %) has only % in stock, but % requested',
        v_prod.name, v_prod.sku, v_prod.stock_quantity, v_item.quantity;
    end if;

    v_line_total := round(v_prod.selling_price * v_item.quantity, 2);
    v_line_cost := round(v_prod.cost_price * v_item.quantity, 2);
    v_subtotal := v_subtotal + v_line_total;
    v_total_cost := v_total_cost + v_line_cost;
  end loop;

  -- 5. Calculate discounts and taxes
  if v_settings.max_discount_percent is not null and v_settings.max_discount_percent > 0 then
    v_max_discount := round(v_subtotal * (v_settings.max_discount_percent / 100.0), 2);
  else
    v_max_discount := v_subtotal;
  end if;

  v_discount := least(coalesce(p_discount_total, 0), v_max_discount);
  if v_discount < 0 then
    v_discount := 0;
  end if;

  v_taxable := greatest(0, v_subtotal - v_discount);
  v_tax_rate := coalesce(v_settings.tax_rate, p_tax_rate, 0);
  v_tax_total := round(v_taxable * v_tax_rate, 2);
  v_final_total := v_taxable + v_tax_total;

  -- 6. Validate payment amounts
  if p_payment_method in ('card', 'mobile_money') then
    if p_amount_paid < v_final_total then
      raise exception 'INVALID_PAYMENT: Electronic payments must cover the exact total amount';
    end if;
    v_change_due := 0;
  else
    if p_amount_paid < v_final_total then
      raise exception 'INSUFFICIENT_PAYMENT: Amount paid (%) is less than total due (%)', p_amount_paid, v_final_total;
    end if;
    v_change_due := round(p_amount_paid - v_final_total, 2);
  end if;

  -- 7. Generate receipt number: REC-YYYYMMDD-XXXX
  v_receipt_no := 'REC-' || to_char(now(), 'YYYYMMDD') || '-' || lpad((floor(random() * 9000 + 1000))::text, 4, '0');

  -- 8. Insert into sales
  insert into public.sales (
    business_id, receipt_number, idempotency_key, request_payload,
    status, payment_method, subtotal, discount_total, tax_total, total,
    amount_paid, change_due, cashier_id
  ) values (
    p_business_id, v_receipt_no, p_idempotency_key, p_items,
    'completed', p_payment_method, v_subtotal, v_discount, v_tax_total, v_final_total,
    p_amount_paid, v_change_due, v_user_id
  ) returning id into v_sale_id;

  -- 9. Insert sale items, decrement stock, and record inventory movements
  for v_item in select * from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
  loop
    select id, name, sku, cost_price, selling_price, stock_quantity
    into v_prod
    from public.products
    where id = v_item.product_id;

    v_line_total := round(v_prod.selling_price * v_item.quantity, 2);

    insert into public.sale_items (
      business_id, sale_id, product_id, product_name, sku, quantity,
      unit_cost, unit_price, line_total
    ) values (
      p_business_id, v_sale_id, v_prod.id, v_prod.name, v_prod.sku, v_item.quantity,
      v_prod.cost_price, v_prod.selling_price, v_line_total
    );

    update public.products
    set stock_quantity = stock_quantity - v_item.quantity,
        updated_at = now()
    where id = v_prod.id;

    insert into public.inventory_movements (
      business_id, product_id, movement_type, quantity_delta, quantity_after,
      reason, sale_id, actor_id
    ) values (
      p_business_id, v_prod.id, 'sale', -v_item.quantity,
      v_prod.stock_quantity - v_item.quantity,
      'POS Sale ' || v_receipt_no, v_sale_id, v_user_id
    );
  end loop;

  -- 10. Audit log
  insert into public.audit_logs (
    business_id, actor_id, action, entity_type, entity_id, details
  ) values (
    p_business_id, v_user_id, 'SALE_COMPLETED', 'sales', v_sale_id,
    jsonb_build_object(
      'receipt_number', v_receipt_no,
      'total', v_final_total,
      'items_count', v_items_count,
      'payment_method', p_payment_method
    )
  );

  return jsonb_build_object(
    'success', true,
    'is_duplicate', false,
    'sale_id', v_sale_id,
    'receipt_number', v_receipt_no,
    'subtotal', v_subtotal,
    'discount_total', v_discount,
    'tax_total', v_tax_total,
    'total', v_final_total,
    'amount_paid', p_amount_paid,
    'change_due', v_change_due,
    'payment_method', p_payment_method
  );
end;
$$;

-- Transactional refund: restores product inventory, calculates refund line amounts,
-- checks item return limits, updates sale status to partially_refunded or refunded,
-- records inventory movements and audit logs.
create or replace function public.perform_refund(
  p_business_id uuid,
  p_sale_id uuid,
  p_idempotency_key text,
  p_reason text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid;
  v_existing_refund public.refunds%rowtype;
  v_sale public.sales%rowtype;
  v_item record;
  v_sale_item record;
  v_prod record;
  v_refund_id uuid;
  v_total_refund numeric(12, 2) := 0;
  v_item_refund numeric(12, 2);
  v_already_refunded integer;
  v_remaining_qty integer;
  v_all_items_refunded boolean := true;
  v_cur_item record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED: Authentication is required';
  end if;

  if not app_private.has_business_role(p_business_id, array['admin', 'manager']::public.member_role[]) then
    raise exception 'FORBIDDEN: Only admins and managers can process refunds';
  end if;

  -- 1. Check idempotency
  select * into v_existing_refund
  from public.refunds
  where business_id = p_business_id and idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'success', true,
      'is_duplicate', true,
      'refund_id', v_existing_refund.id,
      'total', v_existing_refund.total
    );
  end if;

  -- 2. Validate sale
  select * into v_sale
  from public.sales
  where id = p_sale_id and business_id = p_business_id
  for update;

  if not found then
    raise exception 'SALE_NOT_FOUND: Sale % does not exist in this business', p_sale_id;
  end if;

  if v_sale.status in ('refunded', 'cancelled') then
    raise exception 'INVALID_SALE_STATUS: Sale is already %', v_sale.status;
  end if;

  -- 3. Calculate refund total and validate quantities
  for v_item in select * from jsonb_to_recordset(p_items) as x(sale_item_id uuid, quantity integer)
  loop
    if v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'VALIDATION_ERROR: Refund quantity must be greater than zero';
    end if;

    select * into v_sale_item
    from public.sale_items
    where id = v_item.sale_item_id and sale_id = p_sale_id;

    if not found then
      raise exception 'SALE_ITEM_NOT_FOUND: Item % does not belong to sale %', v_item.sale_item_id, p_sale_id;
    end if;

    select coalesce(sum(quantity), 0) into v_already_refunded
    from public.refund_items
    where sale_item_id = v_item.sale_item_id;

    v_remaining_qty := v_sale_item.quantity - v_already_refunded;
    if v_item.quantity > v_remaining_qty then
      raise exception 'EXCESSIVE_REFUND: Cannot refund % units for "%". Only % units remaining refundable',
        v_item.quantity, v_sale_item.product_name, v_remaining_qty;
    end if;

    v_item_refund := round(v_sale_item.unit_price * v_item.quantity, 2);
    v_total_refund := v_total_refund + v_item_refund;
  end loop;

  -- 4. Create refund record
  insert into public.refunds (
    business_id, sale_id, idempotency_key, reason, total, refunded_by
  ) values (
    p_business_id, p_sale_id, p_idempotency_key, trim(p_reason), v_total_refund, v_user_id
  ) returning id into v_refund_id;

  -- 5. Process items: restore stock, record refund_items, record inventory movements
  for v_item in select * from jsonb_to_recordset(p_items) as x(sale_item_id uuid, quantity integer)
  loop
    select * into v_sale_item from public.sale_items where id = v_item.sale_item_id;

    select id, stock_quantity into v_prod
    from public.products
    where id = v_sale_item.product_id
    for update;

    v_item_refund := round(v_sale_item.unit_price * v_item.quantity, 2);

    insert into public.refund_items (
      business_id, refund_id, sale_item_id, quantity, amount
    ) values (
      p_business_id, v_refund_id, v_sale_item.id, v_item.quantity, v_item_refund
    );

    update public.products
    set stock_quantity = stock_quantity + v_item.quantity,
        updated_at = now()
    where id = v_prod.id;

    insert into public.inventory_movements (
      business_id, product_id, movement_type, quantity_delta, quantity_after,
      reason, sale_id, refund_id, actor_id
    ) values (
      p_business_id, v_prod.id, 'refund', v_item.quantity,
      v_prod.stock_quantity + v_item.quantity,
      'Refund for Sale ' || v_sale.receipt_number || ': ' || trim(p_reason),
      p_sale_id, v_refund_id, v_user_id
    );
  end loop;

  -- 6. Check if sale is fully refunded or partially refunded
  for v_cur_item in select id, quantity from public.sale_items where sale_id = p_sale_id
  loop
    select coalesce(sum(quantity), 0) into v_already_refunded
    from public.refund_items
    where sale_item_id = v_cur_item.id;

    if v_already_refunded < v_cur_item.quantity then
      v_all_items_refunded := false;
      exit;
    end if;
  end loop;

  update public.sales
  set status = case when v_all_items_refunded then 'refunded'::public.sale_status else 'partially_refunded'::public.sale_status end
  where id = p_sale_id;

  -- 7. Audit log
  insert into public.audit_logs (
    business_id, actor_id, action, entity_type, entity_id, details
  ) values (
    p_business_id, v_user_id, 'SALE_REFUNDED', 'sales', p_sale_id,
    jsonb_build_object(
      'refund_id', v_refund_id,
      'refund_total', v_total_refund,
      'reason', trim(p_reason),
      'all_refunded', v_all_items_refunded
    )
  );

  return jsonb_build_object(
    'success', true,
    'is_duplicate', false,
    'refund_id', v_refund_id,
    'total_refunded', v_total_refund,
    'new_sale_status', case when v_all_items_refunded then 'refunded' else 'partially_refunded' end
  );
end;
$$;

-- Transactional stock adjustment (stock-in, stock-out, audit delta)
create or replace function public.perform_stock_adjustment(
  p_business_id uuid,
  p_product_id uuid,
  p_quantity_delta integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid;
  v_prod record;
  v_new_stock integer;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED: Authentication is required';
  end if;

  if not app_private.has_business_role(p_business_id, array['admin', 'manager', 'inventory_staff']::public.member_role[]) then
    raise exception 'FORBIDDEN: You do not have permission to adjust inventory';
  end if;

  if p_quantity_delta = 0 then
    raise exception 'VALIDATION_ERROR: Stock adjustment delta cannot be zero';
  end if;

  select id, name, sku, stock_quantity into v_prod
  from public.products
  where id = p_product_id and business_id = p_business_id
  for update;

  if not found then
    raise exception 'PRODUCT_NOT_FOUND: Product % not found in this business', p_product_id;
  end if;

  v_new_stock := v_prod.stock_quantity + p_quantity_delta;
  if v_new_stock < 0 then
    raise exception 'INVALID_STOCK: Cannot reduce stock below zero. Current stock: %, Delta: %',
      v_prod.stock_quantity, p_quantity_delta;
  end if;

  update public.products
  set stock_quantity = v_new_stock,
      updated_at = now()
  where id = v_prod.id;

  insert into public.inventory_movements (
    business_id, product_id, movement_type, quantity_delta, quantity_after,
    reason, actor_id
  ) values (
    p_business_id, v_prod.id, 'adjustment', p_quantity_delta, v_new_stock,
    coalesce(trim(p_reason), 'Manual stock adjustment'), v_user_id
  );

  insert into public.audit_logs (
    business_id, actor_id, action, entity_type, entity_id, details
  ) values (
    p_business_id, v_user_id, 'STOCK_ADJUSTED', 'products', v_prod.id,
    jsonb_build_object(
      'product_name', v_prod.name,
      'sku', v_prod.sku,
      'previous_stock', v_prod.stock_quantity,
      'delta', p_quantity_delta,
      'new_stock', v_new_stock,
      'reason', trim(p_reason)
    )
  );

  return jsonb_build_object(
    'success', true,
    'product_id', v_prod.id,
    'previous_stock', v_prod.stock_quantity,
    'delta', p_quantity_delta,
    'new_stock', v_new_stock
  );
end;
$$;

-- Transactional purchase receiving: increases product inventory, increments received counts,
-- transitions purchase status, logs movements and audit trail.
create or replace function public.receive_purchase(
  p_business_id uuid,
  p_purchase_id uuid,
  p_idempotency_key text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid;
  v_existing_receipt public.purchase_receipts%rowtype;
  v_purchase public.purchases%rowtype;
  v_item record;
  v_po_item record;
  v_prod record;
  v_receipt_id uuid;
  v_all_received boolean := true;
  v_cur_item record;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED: Authentication is required';
  end if;

  if not app_private.has_business_role(p_business_id, array['admin', 'manager', 'inventory_staff']::public.member_role[]) then
    raise exception 'FORBIDDEN: You do not have permission to receive stock';
  end if;

  -- 1. Check idempotency
  select * into v_existing_receipt
  from public.purchase_receipts
  where business_id = p_business_id and idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'success', true,
      'is_duplicate', true,
      'receipt_id', v_existing_receipt.id
    );
  end if;

  -- 2. Validate purchase
  select * into v_purchase
  from public.purchases
  where id = p_purchase_id and business_id = p_business_id
  for update;

  if not found then
    raise exception 'PURCHASE_NOT_FOUND: Purchase order % not found', p_purchase_id;
  end if;

  if v_purchase.status in ('received', 'cancelled') then
    raise exception 'INVALID_STATUS: Purchase order is already %', v_purchase.status;
  end if;

  -- 3. Create receipt record
  insert into public.purchase_receipts (
    business_id, purchase_id, idempotency_key, received_by
  ) values (
    p_business_id, p_purchase_id, p_idempotency_key, v_user_id
  ) returning id into v_receipt_id;

  -- 4. Process items
  for v_item in select * from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
  loop
    if v_item.quantity is null or v_item.quantity <= 0 then
      continue;
    end if;

    select * into v_po_item
    from public.purchase_items
    where purchase_id = p_purchase_id and product_id = v_item.product_id
    for update;

    if not found then
      raise exception 'ITEM_NOT_IN_PO: Product % was not found on purchase order %', v_item.product_id, p_purchase_id;
    end if;

    if v_po_item.quantity_received + v_item.quantity > v_po_item.quantity_ordered then
      raise exception 'OVER_RECEIVING: Received quantity (%) exceeds ordered quantity (%) for product %',
        v_po_item.quantity_received + v_item.quantity, v_po_item.quantity_ordered, v_item.product_id;
    end if;

    update public.purchase_items
    set quantity_received = quantity_received + v_item.quantity
    where id = v_po_item.id;

    select id, name, sku, stock_quantity into v_prod
    from public.products
    where id = v_item.product_id and business_id = p_business_id
    for update;

    update public.products
    set stock_quantity = stock_quantity + v_item.quantity,
        updated_at = now()
    where id = v_prod.id;

    insert into public.inventory_movements (
      business_id, product_id, movement_type, quantity_delta, quantity_after,
      reason, purchase_receipt_id, actor_id
    ) values (
      p_business_id, v_prod.id, 'purchase_receipt', v_item.quantity,
      v_prod.stock_quantity + v_item.quantity,
      'Received PO ' || v_purchase.purchase_number,
      v_receipt_id, v_user_id
    );
  end loop;

  -- 5. Determine overall PO status
  for v_cur_item in select quantity_ordered, quantity_received from public.purchase_items where purchase_id = p_purchase_id
  loop
    if v_cur_item.quantity_received < v_cur_item.quantity_ordered then
      v_all_received := false;
      exit;
    end if;
  end loop;

  update public.purchases
  set status = case when v_all_received then 'received'::public.purchase_status else 'partially_received'::public.purchase_status end,
      updated_at = now()
  where id = p_purchase_id;

  insert into public.audit_logs (
    business_id, actor_id, action, entity_type, entity_id, details
  ) values (
    p_business_id, v_user_id, 'PURCHASE_RECEIVED', 'purchases', p_purchase_id,
    jsonb_build_object(
      'receipt_id', v_receipt_id,
      'status', case when v_all_received then 'received' else 'partially_received' end
    )
  );

  return jsonb_build_object(
    'success', true,
    'receipt_id', v_receipt_id,
    'new_status', case when v_all_received then 'received' else 'partially_received' end
  );
end;
$$;

-- Dashboard statistics function: queries actual database metrics
create or replace function public.get_business_dashboard_stats(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_stats jsonb;
begin
  if not app_private.is_business_member(p_business_id) then
    raise exception 'FORBIDDEN: You do not belong to this business';
  end if;

  select jsonb_build_object(
    'today_sales', coalesce((
      select sum(total) from public.sales
      where business_id = p_business_id
        and status in ('completed', 'partially_refunded')
        and created_at >= date_trunc('day', now())
    ), 0),
    'today_sales_count', coalesce((
      select count(*) from public.sales
      where business_id = p_business_id
        and status in ('completed', 'partially_refunded')
        and created_at >= date_trunc('day', now())
    ), 0),
    'month_sales', coalesce((
      select sum(total) from public.sales
      where business_id = p_business_id
        and status in ('completed', 'partially_refunded')
        and created_at >= date_trunc('month', now())
    ), 0),
    'month_sales_count', coalesce((
      select count(*) from public.sales
      where business_id = p_business_id
        and status in ('completed', 'partially_refunded')
        and created_at >= date_trunc('month', now())
    ), 0),
    'total_revenue', coalesce((
      select sum(total) from public.sales
      where business_id = p_business_id
        and status in ('completed', 'partially_refunded')
    ), 0),
    'total_products', coalesce((
      select count(*) from public.products
      where business_id = p_business_id
    ), 0),
    'active_products', coalesce((
      select count(*) from public.products
      where business_id = p_business_id and is_active = true
    ), 0),
    'inventory_value_cost', coalesce((
      select sum(stock_quantity * cost_price) from public.products
      where business_id = p_business_id and is_active = true
    ), 0),
    'inventory_value_retail', coalesce((
      select sum(stock_quantity * selling_price) from public.products
      where business_id = p_business_id and is_active = true
    ), 0),
    'low_stock_count', coalesce((
      select count(*) from public.products
      where business_id = p_business_id and is_active = true
        and stock_quantity <= stock_threshold and stock_quantity > 0
    ), 0),
    'out_of_stock_count', coalesce((
      select count(*) from public.products
      where business_id = p_business_id and is_active = true
        and stock_quantity = 0
    ), 0),
    'recent_sales', coalesce((
      select jsonb_agg(sub)
      from (
        select s.id, s.receipt_number, s.total, s.payment_method, s.status, s.created_at,
               coalesce(up.display_name, 'Cashier') as cashier_name
        from public.sales s
        left join public.user_profiles up on up.id = s.cashier_id
        where s.business_id = p_business_id
        order by s.created_at desc
        limit 5
      ) sub
    ), '[]'::jsonb),
    'top_selling_products', coalesce((
      select jsonb_agg(top_sub)
      from (
        select si.product_id, si.product_name, si.sku,
               sum(si.quantity) as units_sold,
               sum(si.line_total) as total_revenue
        from public.sale_items si
        join public.sales s on s.id = si.sale_id
        where si.business_id = p_business_id
          and s.status in ('completed', 'partially_refunded')
        group by si.product_id, si.product_name, si.sku
        order by units_sold desc
        limit 5
      ) top_sub
    ), '[]'::jsonb),
    'sales_chart_7days', coalesce((
      select jsonb_agg(chart_sub)
      from (
        select to_char(d.day, 'YYYY-MM-DD') as date_label,
               to_char(d.day, 'Mon DD') as short_label,
               coalesce(sum(s.total), 0) as daily_total,
               count(s.id) as orders_count
        from generate_series(
          date_trunc('day', now()) - interval '6 days',
          date_trunc('day', now()),
          interval '1 day'
        ) d(day)
        left join public.sales s on s.business_id = p_business_id
          and s.status in ('completed', 'partially_refunded')
          and date_trunc('day', s.created_at) = d.day
        group by d.day
        order by d.day asc
      ) chart_sub
    ), '[]'::jsonb)
  ) into v_stats;

  return v_stats;
end;
$$;

-- Grant execution permissions on stored functions
revoke all on function public.perform_checkout from public, anon;
revoke all on function public.perform_refund from public, anon;
revoke all on function public.perform_stock_adjustment from public, anon;
revoke all on function public.receive_purchase from public, anon;
revoke all on function public.get_business_dashboard_stats from public, anon;

grant execute on function public.perform_checkout to authenticated;
grant execute on function public.perform_refund to authenticated;
grant execute on function public.perform_stock_adjustment to authenticated;
grant execute on function public.receive_purchase to authenticated;
grant execute on function public.get_business_dashboard_stats to authenticated;

commit;

-- Kaafi Business Sample Seed Data
-- Run this in the Supabase SQL editor after creating an initial business and user.
-- Replace ':business_id' and ':admin_user_id' with your actual business ID and user ID,
-- or use the provided helper do-block that automatically targets the most recently created business.

do $$
declare
  v_biz_id uuid;
  v_user_id uuid;
  v_cat_elec uuid;
  v_cat_groc uuid;
  v_cat_bev uuid;
  v_cat_off uuid;
  v_sup_tech uuid;
  v_sup_prime uuid;
  v_sup_oasis uuid;
begin
  -- Select the first active business and member
  select id into v_biz_id from public.businesses order by created_at desc limit 1;
  select user_id into v_user_id from public.business_members where business_id = v_biz_id and role = 'admin' limit 1;

  if v_biz_id is null or v_user_id is null then
    raise notice 'No business or admin found. Please create a user and business first via the app or auth.users.';
    return;
  end if;

  raise notice 'Seeding data for Business ID: % with User ID: %', v_biz_id, v_user_id;

  -- 1. Categories
  insert into public.categories (business_id, name, description)
  values
    (v_biz_id, 'Electronics & Gadgets', 'Computing, peripherals, chargers, and mobile accessories')
  on conflict (business_id, name) do update set description = excluded.description
  returning id into v_cat_elec;

  insert into public.categories (business_id, name, description)
  values
    (v_biz_id, 'Groceries & Foods', 'Fresh staples, grains, coffee, tea, and cooking oils')
  on conflict (business_id, name) do update set description = excluded.description
  returning id into v_cat_groc;

  insert into public.categories (business_id, name, description)
  values
    (v_biz_id, 'Beverages & Drinks', 'Mineral water, organic juices, sodas, and energy drinks')
  on conflict (business_id, name) do update set description = excluded.description
  returning id into v_cat_bev;

  insert into public.categories (business_id, name, description)
  values
    (v_biz_id, 'Office Supplies & Stationery', 'Paper, writing instruments, desk organizers, and notebooks')
  on conflict (business_id, name) do update set description = excluded.description
  returning id into v_cat_off;

  -- 2. Suppliers
  insert into public.suppliers (business_id, name, contact_name, email, phone, address)
  values
    (v_biz_id, 'Global Tech Distributors', 'John Smith', 'john@globaltech.example', '+1-555-0101', '124 Industrial Parkway, Suite 4')
  returning id into v_sup_tech;

  insert into public.suppliers (business_id, name, contact_name, email, phone, address)
  values
    (v_biz_id, 'Prime Goods Wholesalers', 'Sarah Ahmed', 'sarah@primegoods.example', '+1-555-0102', '45 Harbour Road, Warehouse 12')
  returning id into v_sup_prime;

  insert into public.suppliers (business_id, name, contact_name, email, phone, address)
  values
    (v_biz_id, 'Oasis Bottling & Beverage Co.', 'Michael Vance', 'orders@oasisbev.example', '+1-555-0103', '88 Oasis Valley Road')
  returning id into v_sup_oasis;

  -- 3. Products
  insert into public.products (business_id, category_id, supplier_id, name, sku, description, cost_price, selling_price, stock_quantity, stock_threshold)
  values
    (v_biz_id, v_cat_elec, v_sup_tech, 'Wireless Optical Mouse', 'SKU-ELEC-001', 'Ergonomic 2.4GHz wireless mouse with USB nano receiver', 8.50, 19.99, 45, 10),
    (v_biz_id, v_cat_elec, v_sup_tech, 'USB-C Fast Charger 65W', 'SKU-ELEC-002', 'Dual port GaN wall charger with Power Delivery', 14.00, 29.99, 28, 8),
    (v_biz_id, v_cat_elec, v_sup_tech, 'Mechanical Gaming Keyboard', 'SKU-ELEC-003', 'RGB backlit mechanical keyboard with tactile blue switches', 32.00, 64.99, 15, 5),
    (v_biz_id, v_cat_elec, v_sup_tech, 'HD Pro Webcam 1080p', 'SKU-ELEC-004', 'Autofocus webcam with dual noise-reduction microphones', 22.00, 49.99, 4, 6),
    (v_biz_id, v_cat_elec, v_sup_tech, 'Bluetooth ANC Headphones', 'SKU-ELEC-005', 'Active noise cancelling over-ear headphones with 40h battery', 42.00, 89.99, 0, 5),

    (v_biz_id, v_cat_groc, v_sup_prime, 'Somali Highland Spiced Tea (500g)', 'SKU-GROC-001', 'Traditional aromatic black tea infused with cardamom and cinnamon', 3.50, 7.50, 60, 15),
    (v_biz_id, v_cat_groc, v_sup_prime, 'Single Origin Roast Coffee Beans 1kg', 'SKU-GROC-002', 'Medium-dark roast Arabica whole beans', 9.00, 18.50, 32, 10),
    (v_biz_id, v_cat_groc, v_sup_prime, 'Pure Extra Virgin Olive Oil 1L', 'SKU-GROC-003', 'Cold-pressed extra virgin Mediterranean olive oil', 6.80, 14.25, 3, 8),

    (v_biz_id, v_cat_bev, v_sup_oasis, 'Sparkling Mineral Water 500ml', 'SKU-BEV-001', 'Crisp natural effervescent spring water in recyclable bottles', 0.40, 1.25, 140, 30),
    (v_biz_id, v_cat_bev, v_sup_oasis, 'Natural Mango Passion Juice 1L', 'SKU-BEV-002', '100% freshly pressed tropical mango and passionfruit juice', 1.10, 2.80, 52, 12),
    (v_biz_id, v_cat_bev, v_sup_oasis, 'Electrolyte Hydration Drink 750ml', 'SKU-BEV-003', 'Zero sugar citrus isotonic sports drink', 0.90, 2.50, 65, 15),

    (v_biz_id, v_cat_off, v_sup_prime, 'Multipurpose Copy Paper A4 80gsm (Box of 5 Reams)', 'SKU-OFF-001', 'High brightness jam-free laser and inkjet copy paper', 18.50, 32.00, 20, 5),
    (v_biz_id, v_cat_off, v_sup_prime, 'Premium Retractable Gel Pens (Pack of 12)', 'SKU-OFF-002', 'Quick-drying 0.7mm smooth writing gel ink pens (Black)', 2.80, 6.50, 75, 20),
    (v_biz_id, v_cat_off, v_sup_prime, 'Executive Hardcover Notebook A5', 'SKU-OFF-003', 'Lined 192 pages faux leather notebook with ribbon bookmark', 3.20, 8.99, 40, 10);

  -- 4. Initial Expenses
  insert into public.expenses (business_id, category, description, amount, expense_date, recorded_by)
  values
    (v_biz_id, 'Rent & Facilities', 'Main storefront retail lease payment', 1200.00, current_date - 10, v_user_id),
    (v_biz_id, 'Utilities', 'Electric and water monthly utility bill', 215.50, current_date - 7, v_user_id),
    (v_biz_id, 'Internet & Telecom', 'Fiber broadband internet connectivity', 85.00, current_date - 5, v_user_id),
    (v_biz_id, 'Marketing & Ads', 'Local promotional flyers and social media campaigns', 150.00, current_date - 2, v_user_id);

  raise notice 'Seed data completed successfully for business: %', v_biz_id;
end;
$$;

-- Glamour Touch — full schema baseline (generated 2026-09-30 from the live database)
-- SAFE / NON-DESTRUCTIVE: every statement is idempotent (IF NOT EXISTS / OR REPLACE / guarded).
-- No DROP, DELETE or TRUNCATE. Running it on the existing database changes nothing and keeps all data.
-- Running it on an empty Supabase project recreates the full structure (data not included).

DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin','user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL CONSTRAINT categories_slug_key UNIQUE,
  image_url text,
  status text NOT NULL DEFAULT 'published',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric NOT NULL CONSTRAINT products_price_check CHECK (price >= 0),
  old_price numeric,
  image_url text,
  image_urls text[] NOT NULL DEFAULT '{}',
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  stock_quantity integer NOT NULL DEFAULT 0 CONSTRAINT products_stock_quantity_check CHECK (stock_quantity >= 0),
  status text NOT NULL DEFAULT 'published',
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  qty_discount_min integer,
  qty_discount_percent numeric
);

CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  color_name text NOT NULL,
  color_hex text NOT NULL DEFAULT '#000000',
  image_url text,
  stock_quantity integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_variants_product_idx ON public.product_variants (product_id, sort_order);

CREATE TABLE IF NOT EXISTS public.shipping_rates (
  wilaya_code integer PRIMARY KEY,
  wilaya_name text NOT NULL,
  domicile_fee integer NOT NULL,
  stopdesk_fee integer NOT NULL
);

CREATE TABLE IF NOT EXISTS public.communes (
  id bigserial PRIMARY KEY,
  wilaya_code integer NOT NULL,
  wilaya_name text NOT NULL,
  commune_name text NOT NULL,
  postal_code text
);
CREATE INDEX IF NOT EXISTS communes_wilaya_idx ON public.communes (wilaya_code);

CREATE TABLE IF NOT EXISTS public.stopdesks (
  id bigserial PRIMARY KEY,
  wilaya_code integer NOT NULL,
  wilaya_name text NOT NULL,
  commune_name text NOT NULL,
  desk_name text NOT NULL,
  desk_code text,
  address text NOT NULL
);
CREATE INDEX IF NOT EXISTS stopdesks_wilaya_idx ON public.stopdesks (wilaya_code);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  product_price numeric NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  full_name text NOT NULL,
  phone text NOT NULL,
  wilaya_id integer NOT NULL,
  wilaya_name text NOT NULL,
  commune text NOT NULL,
  adresse text,
  desk_code text,
  delivery_type text NOT NULL,
  shipping_fee numeric NOT NULL,
  total numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  sheet_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text,
  unit_price numeric,
  color_name text,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items (order_id);

CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer PRIMARY KEY DEFAULT 1 CONSTRAINT app_settings_id_check CHECK (id = 1),
  site_name text NOT NULL DEFAULT 'Glamour Touch',
  site_tagline text DEFAULT 'Bags & Accessories',
  primary_color text DEFAULT '#556959',
  logo_url text,
  hero_title text, hero_subtitle text, hero_image_url text, hero_button_text text,
  phone text, whatsapp text,
  instagram_url text, facebook_url text, tiktok_url text,
  meta_pixel_id text, tiktok_pixel_id text,
  telegram_bot_token text, telegram_chat_id text,
  google_sheet_webhook_url text,
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ===== Grants =====
GRANT SELECT ON public.categories, public.products, public.product_variants,
  public.shipping_rates, public.communes, public.stopdesks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- ===== Functions =====
CREATE OR REPLACE FUNCTION public.claim_first_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    return false;
  end if;

  if exists (select 1 from public.user_roles where role = 'admin') then
    return false;
  end if;

  insert into public.user_roles (user_id, role)
  values (_uid, 'admin')
  on conflict (user_id, role) do nothing;

  return true;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.discounted_unit(_price numeric, _min integer, _pct numeric, _qty integer)
 RETURNS numeric
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$ SELECT CASE WHEN _min IS NOT NULL AND _min > 0 AND _pct IS NOT NULL AND _pct > 0 AND _pct < 100 AND _qty >= _min
  THEN round(_price * (1 - _pct / 100)) ELSE _price END $function$
;
CREATE OR REPLACE FUNCTION public.get_public_settings()
 RETURNS TABLE(site_name text, phone text, whatsapp text, instagram_url text, facebook_url text, tiktok_url text, meta_pixel_id text, tiktok_pixel_id text, features jsonb, site_tagline text, primary_color text, logo_url text, hero_title text, hero_subtitle text, hero_image_url text, hero_button_text text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 SELECT s.site_name, s.phone, s.whatsapp, s.instagram_url, s.facebook_url, s.tiktok_url, s.meta_pixel_id, s.tiktok_pixel_id, s.features, s.site_tagline, s.primary_color, s.logo_url, s.hero_title, s.hero_subtitle, s.hero_image_url, s.hero_button_text
 FROM public.app_settings s WHERE s.id = 1
$function$
;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$function$
;
CREATE OR REPLACE FUNCTION public.place_cart_order(_items jsonb, _full_name text, _phone text, _wilaya_code integer, _commune text, _delivery_type text, _adresse text, _desk_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p public.products%ROWTYPE;
  r public.shipping_rates%ROWTYPE;
  v public.product_variants%ROWTYPE;
  fee numeric(12,2);
  total_qty int := 0;
  subtotal numeric(12,2) := 0;
  line_count int := 0;
  has_variants boolean;
  new_id uuid;
  item jsonb;
  it_pid uuid;
  it_color text;
  it_qty int;
  prod_qty int;
  unit numeric(12,2);
  disc_on boolean := public.qty_discount_on();
BEGIN
  IF _delivery_type NOT IN ('domicile','stopdesk') THEN RAISE EXCEPTION 'Mode de livraison invalide'; END IF;
  IF length(trim(coalesce(_full_name,''))) < 3 THEN RAISE EXCEPTION 'Nom complet invalide'; END IF;
  IF length(trim(coalesce(_phone,''))) < 8 THEN RAISE EXCEPTION 'Numéro de téléphone invalide'; END IF;
  IF length(trim(coalesce(_commune,''))) < 1 THEN RAISE EXCEPTION 'Commune requise'; END IF;
  IF _delivery_type = 'domicile' AND length(trim(coalesce(_adresse,''))) < 5 THEN RAISE EXCEPTION 'Adresse requise'; END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Panier vide';
  END IF;
  IF jsonb_array_length(_items) > 50 THEN RAISE EXCEPTION 'Trop d''articles'; END IF;

  SELECT * INTO r FROM public.shipping_rates WHERE wilaya_code = _wilaya_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wilaya invalide'; END IF;
  fee := CASE WHEN _delivery_type = 'domicile' THEN r.domicile_fee ELSE r.stopdesk_fee END;

  INSERT INTO public.orders (product_id, product_name, product_price, quantity, full_name, phone,
    wilaya_id, wilaya_name, commune, adresse, desk_code, delivery_type, shipping_fee, total)
  VALUES (NULL, 'Panier', 0, 0, left(trim(_full_name),120), left(trim(_phone),30),
    r.wilaya_code, r.wilaya_name, left(trim(_commune),120), left(trim(coalesce(_adresse,'')),400),
    left(trim(coalesce(_desk_code,'')),120), _delivery_type, fee, fee)
  RETURNING id INTO new_id;

  FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    it_pid := (item->>'product_id')::uuid;
    it_qty := GREATEST(COALESCE((item->>'quantity')::int, 1), 1);
    it_color := NULLIF(trim(coalesce(item->>'color_name','')), '');

    SELECT * INTO p FROM public.products WHERE id = it_pid AND status = 'published' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable'; END IF;
    SELECT EXISTS (SELECT 1 FROM public.product_variants WHERE product_id = p.id) INTO has_variants;

    IF has_variants THEN
      IF it_color IS NULL THEN RAISE EXCEPTION 'Couleur requise pour %', p.name; END IF;
      SELECT * INTO v FROM public.product_variants
        WHERE product_id = p.id AND color_name = it_color FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Couleur introuvable: %', it_color; END IF;
      IF v.stock_quantity < it_qty THEN RAISE EXCEPTION 'Stock insuffisant pour % (%)', p.name, it_color; END IF;
      UPDATE public.product_variants SET stock_quantity = stock_quantity - it_qty WHERE id = v.id;
      UPDATE public.products SET stock_quantity = GREATEST(stock_quantity - it_qty, 0) WHERE id = p.id;
    ELSE
      it_color := NULL;
      IF p.stock_quantity < it_qty THEN RAISE EXCEPTION 'Stock insuffisant pour %', p.name; END IF;
      UPDATE public.products SET stock_quantity = stock_quantity - it_qty WHERE id = p.id;
    END IF;

    SELECT coalesce(sum(GREATEST(COALESCE((e->>'quantity')::int, 1), 1)), 0) INTO prod_qty
      FROM jsonb_array_elements(_items) e WHERE (e->>'product_id')::uuid = p.id;
    unit := CASE WHEN disc_on
      THEN public.discounted_unit(p.price, p.qty_discount_min, p.qty_discount_percent, prod_qty) ELSE p.price END;

    INSERT INTO public.order_items (order_id, product_id, product_name, unit_price, color_name, quantity)
    VALUES (new_id, p.id, p.name, unit, it_color, it_qty);

    total_qty := total_qty + it_qty;
    subtotal := subtotal + unit * it_qty;
    line_count := line_count + 1;
  END LOOP;

  UPDATE public.orders
    SET product_name = 'Panier (' || line_count || ' article' || CASE WHEN line_count > 1 THEN 's' ELSE '' END || ')',
        product_price = subtotal, quantity = total_qty, total = subtotal + fee
    WHERE id = new_id;

  RETURN new_id;
END; $function$
;
CREATE OR REPLACE FUNCTION public.place_order(_product_id uuid, _quantity integer, _full_name text, _phone text, _wilaya_code integer, _commune text, _delivery_type text, _adresse text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p public.products%ROWTYPE;
  r public.shipping_rates%ROWTYPE;
  fee numeric(12,2);
  qty int;
  new_id uuid;
BEGIN
  qty := GREATEST(COALESCE(_quantity,1), 1);
  IF _delivery_type NOT IN ('domicile','stopdesk') THEN RAISE EXCEPTION 'Mode de livraison invalide'; END IF;
  IF length(trim(coalesce(_full_name,''))) < 3 THEN RAISE EXCEPTION 'Nom complet invalide'; END IF;
  IF length(trim(coalesce(_phone,''))) < 8 THEN RAISE EXCEPTION 'Numéro de téléphone invalide'; END IF;
  IF length(trim(coalesce(_commune,''))) < 1 THEN RAISE EXCEPTION 'Commune requise'; END IF;
  IF _delivery_type = 'domicile' AND length(trim(coalesce(_adresse,''))) < 5 THEN RAISE EXCEPTION 'Adresse requise'; END IF;

  SELECT * INTO p FROM public.products WHERE id = _product_id AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable'; END IF;
  IF p.stock_quantity < qty THEN RAISE EXCEPTION 'Stock insuffisant'; END IF;

  SELECT * INTO r FROM public.shipping_rates WHERE wilaya_code = _wilaya_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wilaya invalide'; END IF;
  fee := CASE WHEN _delivery_type = 'domicile' THEN r.domicile_fee ELSE r.stopdesk_fee END;

  INSERT INTO public.orders (product_id, product_name, product_price, quantity, full_name, phone,
    wilaya_id, wilaya_name, commune, adresse, delivery_type, shipping_fee, total)
  VALUES (p.id, p.name, p.price, qty, left(trim(_full_name),120), left(trim(_phone),30),
    r.wilaya_code, r.wilaya_name, left(trim(_commune),120), left(trim(coalesce(_adresse,'')),400),
    _delivery_type, fee, (p.price * qty) + fee)
  RETURNING id INTO new_id;

  UPDATE public.products SET stock_quantity = stock_quantity - qty WHERE id = p.id;
  RETURN new_id;
END; $function$
;
CREATE OR REPLACE FUNCTION public.place_order(_product_id uuid, _quantity integer, _full_name text, _phone text, _wilaya_code integer, _commune text, _delivery_type text, _adresse text, _desk_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p public.products%ROWTYPE;
  r public.shipping_rates%ROWTYPE;
  fee numeric(12,2);
  qty int;
  new_id uuid;
BEGIN
  qty := GREATEST(COALESCE(_quantity,1), 1);
  IF _delivery_type NOT IN ('domicile','stopdesk') THEN RAISE EXCEPTION 'Mode de livraison invalide'; END IF;
  IF length(trim(coalesce(_full_name,''))) < 3 THEN RAISE EXCEPTION 'Nom complet invalide'; END IF;
  IF length(trim(coalesce(_phone,''))) < 8 THEN RAISE EXCEPTION 'Numéro de téléphone invalide'; END IF;
  IF length(trim(coalesce(_commune,''))) < 1 THEN RAISE EXCEPTION 'Commune requise'; END IF;
  IF _delivery_type = 'domicile' AND length(trim(coalesce(_adresse,''))) < 5 THEN RAISE EXCEPTION 'Adresse requise'; END IF;

  SELECT * INTO p FROM public.products WHERE id = _product_id AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable'; END IF;
  IF p.stock_quantity < qty THEN RAISE EXCEPTION 'Stock insuffisant'; END IF;

  SELECT * INTO r FROM public.shipping_rates WHERE wilaya_code = _wilaya_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wilaya invalide'; END IF;
  fee := CASE WHEN _delivery_type = 'domicile' THEN r.domicile_fee ELSE r.stopdesk_fee END;

  INSERT INTO public.orders (product_id, product_name, product_price, quantity, full_name, phone,
    wilaya_id, wilaya_name, commune, adresse, desk_code, delivery_type, shipping_fee, total)
  VALUES (p.id, p.name, p.price, qty, left(trim(_full_name),120), left(trim(_phone),30),
    r.wilaya_code, r.wilaya_name, left(trim(_commune),120), left(trim(coalesce(_adresse,'')),400),
    left(trim(coalesce(_desk_code,'')),120),
    _delivery_type, fee, (p.price * qty) + fee)
  RETURNING id INTO new_id;

  UPDATE public.products SET stock_quantity = stock_quantity - qty WHERE id = p.id;
  RETURN new_id;
END; $function$
;
CREATE OR REPLACE FUNCTION public.place_order_items(_product_id uuid, _items jsonb, _full_name text, _phone text, _wilaya_code integer, _commune text, _delivery_type text, _adresse text, _desk_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p public.products%ROWTYPE;
  r public.shipping_rates%ROWTYPE;
  fee numeric(12,2);
  total_qty int := 0;
  has_variants boolean;
  new_id uuid;
  item jsonb;
  it_color text;
  it_qty int;
  v public.product_variants%ROWTYPE;
  unit numeric(12,2);
BEGIN
  IF _delivery_type NOT IN ('domicile','stopdesk') THEN RAISE EXCEPTION 'Mode de livraison invalide'; END IF;
  IF length(trim(coalesce(_full_name,''))) < 3 THEN RAISE EXCEPTION 'Nom complet invalide'; END IF;
  IF length(trim(coalesce(_phone,''))) < 8 THEN RAISE EXCEPTION 'Numéro de téléphone invalide'; END IF;
  IF length(trim(coalesce(_commune,''))) < 1 THEN RAISE EXCEPTION 'Commune requise'; END IF;
  IF _delivery_type = 'domicile' AND length(trim(coalesce(_adresse,''))) < 5 THEN RAISE EXCEPTION 'Adresse requise'; END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Aucun article sélectionné';
  END IF;

  SELECT * INTO p FROM public.products WHERE id = _product_id AND status = 'published';
  IF NOT FOUND THEN RAISE EXCEPTION 'Produit introuvable'; END IF;

  SELECT EXISTS (SELECT 1 FROM public.product_variants WHERE product_id = p.id) INTO has_variants;

  SELECT * INTO r FROM public.shipping_rates WHERE wilaya_code = _wilaya_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wilaya invalide'; END IF;
  fee := CASE WHEN _delivery_type = 'domicile' THEN r.domicile_fee ELSE r.stopdesk_fee END;

  FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    it_qty := GREATEST(COALESCE((item->>'quantity')::int, 1), 1);
    total_qty := total_qty + it_qty;
  END LOOP;

  IF NOT has_variants AND p.stock_quantity < total_qty THEN
    RAISE EXCEPTION 'Stock insuffisant';
  END IF;

  unit := CASE WHEN public.qty_discount_on()
    THEN public.discounted_unit(p.price, p.qty_discount_min, p.qty_discount_percent, total_qty) ELSE p.price END;

  INSERT INTO public.orders (product_id, product_name, product_price, quantity, full_name, phone,
    wilaya_id, wilaya_name, commune, adresse, desk_code, delivery_type, shipping_fee, total)
  VALUES (p.id, p.name, unit, total_qty, left(trim(_full_name),120), left(trim(_phone),30),
    r.wilaya_code, r.wilaya_name, left(trim(_commune),120), left(trim(coalesce(_adresse,'')),400),
    left(trim(coalesce(_desk_code,'')),120),
    _delivery_type, fee, (unit * total_qty) + fee)
  RETURNING id INTO new_id;

  FOR item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    it_qty := GREATEST(COALESCE((item->>'quantity')::int, 1), 1);
    it_color := NULLIF(trim(coalesce(item->>'color_name','')), '');

    IF has_variants THEN
      IF it_color IS NULL THEN RAISE EXCEPTION 'Couleur requise'; END IF;
      SELECT * INTO v FROM public.product_variants
        WHERE product_id = p.id AND color_name = it_color FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Couleur introuvable: %', it_color; END IF;
      IF v.stock_quantity < it_qty THEN RAISE EXCEPTION 'Stock insuffisant pour la couleur %', it_color; END IF;
      UPDATE public.product_variants SET stock_quantity = stock_quantity - it_qty WHERE id = v.id;
    END IF;

    INSERT INTO public.order_items (order_id, color_name, quantity)
    VALUES (new_id, it_color, it_qty);
  END LOOP;

  UPDATE public.products
    SET stock_quantity = GREATEST(stock_quantity - total_qty, 0)
    WHERE id = p.id;

  RETURN new_id;
END; $function$
;
CREATE OR REPLACE FUNCTION public.qty_discount_on()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$ SELECT coalesce((SELECT features->>'qty_discount' FROM public.app_settings WHERE id = 1), '') = 'true' $function$
;
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$
;

GRANT EXECUTE ON FUNCTION public.place_order_items(uuid,jsonb,text,text,integer,text,text,text,text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.place_cart_order(jsonb,text,text,integer,text,text,text,text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated, service_role;

-- ===== Triggers =====
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['app_settings','categories','orders','product_variants','products'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = t || '_updated') THEN
      EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t || '_updated', t);
    END IF;
  END LOOP;
END $$;

-- ===== Row Level Security =====
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stopdesks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT * FROM (VALUES
    ('user_roles','own roles readable','CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid())'),
    ('user_roles','admins manage roles','CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),''admin'')) WITH CHECK (public.has_role(auth.uid(),''admin''))'),
    ('categories','public read published categories','CREATE POLICY "public read published categories" ON public.categories FOR SELECT USING (status = ''published'')'),
    ('categories','admins manage categories','CREATE POLICY "admins manage categories" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),''admin'')) WITH CHECK (public.has_role(auth.uid(),''admin''))'),
    ('products','public read published products','CREATE POLICY "public read published products" ON public.products FOR SELECT USING (status = ''published'')'),
    ('products','admins manage products','CREATE POLICY "admins manage products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(),''admin'')) WITH CHECK (public.has_role(auth.uid(),''admin''))'),
    ('product_variants','public read variants of published products','CREATE POLICY "public read variants of published products" ON public.product_variants FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND p.status = ''published''))'),
    ('product_variants','admins manage variants','CREATE POLICY "admins manage variants" ON public.product_variants FOR ALL TO authenticated USING (public.has_role(auth.uid(),''admin'')) WITH CHECK (public.has_role(auth.uid(),''admin''))'),
    ('shipping_rates','public read rates','CREATE POLICY "public read rates" ON public.shipping_rates FOR SELECT USING (true)'),
    ('shipping_rates','admins manage rates','CREATE POLICY "admins manage rates" ON public.shipping_rates FOR ALL TO authenticated USING (public.has_role(auth.uid(),''admin'')) WITH CHECK (public.has_role(auth.uid(),''admin''))'),
    ('communes','public read communes','CREATE POLICY "public read communes" ON public.communes FOR SELECT USING (true)'),
    ('communes','admins manage communes','CREATE POLICY "admins manage communes" ON public.communes FOR ALL TO authenticated USING (public.has_role(auth.uid(),''admin'')) WITH CHECK (public.has_role(auth.uid(),''admin''))'),
    ('stopdesks','public read stopdesks','CREATE POLICY "public read stopdesks" ON public.stopdesks FOR SELECT USING (true)'),
    ('stopdesks','admins manage stopdesks','CREATE POLICY "admins manage stopdesks" ON public.stopdesks FOR ALL TO authenticated USING (public.has_role(auth.uid(),''admin'')) WITH CHECK (public.has_role(auth.uid(),''admin''))'),
    ('orders','admins read orders','CREATE POLICY "admins read orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(),''admin''))'),
    ('orders','admins update orders','CREATE POLICY "admins update orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),''admin''))'),
    ('orders','admins delete orders','CREATE POLICY "admins delete orders" ON public.orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(),''admin''))'),
    ('order_items','admins read order items','CREATE POLICY "admins read order items" ON public.order_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(),''admin''))'),
    ('order_items','admins delete order items','CREATE POLICY "admins delete order items" ON public.order_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(),''admin''))'),
    ('app_settings','admins manage settings','CREATE POLICY "admins manage settings" ON public.app_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),''admin'')) WITH CHECK (public.has_role(auth.uid(),''admin''))')
  ) AS v(tbl, name, ddl) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=p.tbl AND policyname=p.name) THEN
      EXECUTE p.ddl;
    END IF;
  END LOOP;
END $$;

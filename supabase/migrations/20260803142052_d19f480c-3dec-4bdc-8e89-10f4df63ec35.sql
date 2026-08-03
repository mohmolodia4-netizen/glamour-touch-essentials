
CREATE TYPE public.app_role AS ENUM ('admin','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "own roles readable" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- categories
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  image_url text,
  status text NOT NULL DEFAULT 'published',
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read published categories" ON public.categories FOR SELECT USING (status = 'published');
CREATE POLICY "admins manage categories" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER categories_updated BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- products
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL CHECK (price >= 0),
  old_price numeric(12,2),
  image_url text,
  image_urls text[] NOT NULL DEFAULT '{}',
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  stock_quantity int NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  status text NOT NULL DEFAULT 'published',
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read published products" ON public.products FOR SELECT USING (status = 'published');
CREATE POLICY "admins manage products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- shipping rates
CREATE TABLE public.shipping_rates (
  wilaya_code int PRIMARY KEY,
  wilaya_name text NOT NULL,
  domicile_fee int NOT NULL,
  stopdesk_fee int NOT NULL
);
GRANT SELECT ON public.shipping_rates TO anon, authenticated;
GRANT ALL ON public.shipping_rates TO service_role;
ALTER TABLE public.shipping_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read rates" ON public.shipping_rates FOR SELECT USING (true);
CREATE POLICY "admins manage rates" ON public.shipping_rates FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- communes
CREATE TABLE public.communes (
  id bigserial PRIMARY KEY,
  wilaya_code int NOT NULL,
  wilaya_name text NOT NULL,
  commune_name text NOT NULL,
  postal_code text
);
CREATE INDEX communes_wilaya_idx ON public.communes(wilaya_code);
GRANT SELECT ON public.communes TO anon, authenticated;
GRANT ALL ON public.communes TO service_role;
ALTER TABLE public.communes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read communes" ON public.communes FOR SELECT USING (true);
CREATE POLICY "admins manage communes" ON public.communes FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- stopdesks
CREATE TABLE public.stopdesks (
  id bigserial PRIMARY KEY,
  wilaya_code int NOT NULL,
  wilaya_name text NOT NULL,
  commune_name text NOT NULL,
  desk_name text NOT NULL,
  desk_code text,
  address text NOT NULL
);
CREATE INDEX stopdesks_wilaya_idx ON public.stopdesks(wilaya_code);
GRANT SELECT ON public.stopdesks TO anon, authenticated;
GRANT ALL ON public.stopdesks TO service_role;
ALTER TABLE public.stopdesks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read stopdesks" ON public.stopdesks FOR SELECT USING (true);
CREATE POLICY "admins manage stopdesks" ON public.stopdesks FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- orders
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  product_price numeric(12,2) NOT NULL,
  quantity int NOT NULL DEFAULT 1,
  full_name text NOT NULL,
  phone text NOT NULL,
  wilaya_id int NOT NULL,
  wilaya_name text NOT NULL,
  commune text NOT NULL,
  adresse text,
  delivery_type text NOT NULL,
  shipping_fee numeric(12,2) NOT NULL,
  total numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins update orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins delete orders" ON public.orders FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- app settings (single row)
CREATE TABLE public.app_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  site_name text NOT NULL DEFAULT 'Glamour Touch',
  phone text,
  whatsapp text,
  instagram_url text,
  facebook_url text,
  tiktok_url text,
  meta_pixel_id text,
  telegram_bot_token text,
  telegram_chat_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage settings" ON public.app_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.app_settings (id) VALUES (1);
CREATE TRIGGER app_settings_updated BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- public (non-sensitive) settings view for the storefront
CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS TABLE (site_name text, phone text, whatsapp text, instagram_url text, facebook_url text, tiktok_url text, meta_pixel_id text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT site_name, phone, whatsapp, instagram_url, facebook_url, tiktok_url, meta_pixel_id
  FROM public.app_settings WHERE id = 1
$$;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated;

-- place order RPC
CREATE OR REPLACE FUNCTION public.place_order(
  _product_id uuid,
  _quantity int,
  _full_name text,
  _phone text,
  _wilaya_code int,
  _commune text,
  _delivery_type text,
  _adresse text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
END; $$;
GRANT EXECUTE ON FUNCTION public.place_order(uuid,int,text,text,int,text,text,text) TO anon, authenticated;

INSERT INTO public.shipping_rates (wilaya_code, wilaya_name, domicile_fee, stopdesk_fee) VALUES
(1,'Adrar',1100,750),(2,'Chlef',680,400),(3,'Laghouat',800,500),(4,'Oum El Bouaghi',680,400),(5,'Batna',700,400),
(6,'Béjaïa',700,400),(7,'Biskra',800,500),(8,'Béchar',1000,700),(9,'Blida',500,350),(10,'Bouira',600,400),
(11,'Tamanrasset',1500,1050),(12,'Tébessa',720,450),(13,'Tlemcen',700,400),(14,'Tiaret',700,400),(15,'Tizi Ouzou',600,400),
(16,'Alger',400,300),(17,'Djelfa',800,500),(18,'Jijel',700,400),(19,'Sétif',680,400),(20,'Saïda',730,450),
(21,'Skikda',700,400),(22,'Sidi Bel Abbès',700,400),(23,'Annaba',700,450),(24,'Guelma',700,400),(25,'Constantine',680,400),
(26,'Médéa',600,400),(27,'Mostaganem',700,400),(28,'M''Sila',700,400),(29,'Mascara',700,400),(30,'Ouargla',900,550),
(31,'Oran',580,400),(32,'El Bayadh',970,700),(33,'Illizi',1500,1050),(34,'Bordj Bou Arreridj',680,400),(35,'Boumerdès',530,350),
(36,'El Tarf',730,450),(37,'Tindouf',1100,750),(38,'Tissemsilt',700,400),(39,'El Oued',900,550),(40,'Khenchela',700,400),
(41,'Souk Ahras',730,450),(42,'Tipaza',530,350),(43,'Mila',700,400),(44,'Aïn Defla',700,400),(45,'Naâma',930,550),
(46,'Aïn Témouchent',700,400),(47,'Ghardaïa',850,500),(48,'Relizane',700,400),(49,'Timimoun',1100,750),(51,'Ouled Djellal',800,500),
(52,'Beni Abbes',1000,750),(53,'In Salah',1400,950),(55,'Touggourt',930,550),(56,'Djanet',2100,1500),(57,'El M''Ghair',930,550),
(58,'El Meniaa',850,500);

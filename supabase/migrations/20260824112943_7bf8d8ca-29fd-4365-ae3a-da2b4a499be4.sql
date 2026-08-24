CREATE TABLE public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  color_name text NOT NULL,
  color_hex text NOT NULL DEFAULT '#000000',
  image_url text,
  stock_quantity integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_variants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variants TO authenticated;
GRANT ALL ON public.product_variants TO service_role;

ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read variants of published products"
  ON public.product_variants FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.status = 'published'));

CREATE POLICY "admins manage variants"
  ON public.product_variants FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER product_variants_updated BEFORE UPDATE ON public.product_variants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX product_variants_product_idx ON public.product_variants(product_id, sort_order);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  color_name text,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read order items"
  ON public.order_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete order items"
  ON public.order_items FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX order_items_order_idx ON public.order_items(order_id);

CREATE OR REPLACE FUNCTION public.place_order_items(
  _product_id uuid,
  _items jsonb,
  _full_name text,
  _phone text,
  _wilaya_code integer,
  _commune text,
  _delivery_type text,
  _adresse text,
  _desk_code text
) RETURNS uuid
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

  INSERT INTO public.orders (product_id, product_name, product_price, quantity, full_name, phone,
    wilaya_id, wilaya_name, commune, adresse, desk_code, delivery_type, shipping_fee, total)
  VALUES (p.id, p.name, p.price, total_qty, left(trim(_full_name),120), left(trim(_phone),30),
    r.wilaya_code, r.wilaya_name, left(trim(_commune),120), left(trim(coalesce(_adresse,'')),400),
    left(trim(coalesce(_desk_code,'')),120),
    _delivery_type, fee, (p.price * total_qty) + fee)
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
END; $function$;

REVOKE ALL ON FUNCTION public.place_order_items(uuid, jsonb, text, text, integer, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.place_order_items(uuid, jsonb, text, text, integer, text, text, text, text) TO anon, authenticated, service_role;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS qty_discount_min integer NULL, ADD COLUMN IF NOT EXISTS qty_discount_percent numeric NULL;

CREATE OR REPLACE FUNCTION public.qty_discount_on()
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT coalesce((SELECT features->>'qty_discount' FROM public.app_settings WHERE id = 1), '') = 'true' $$;

CREATE OR REPLACE FUNCTION public.discounted_unit(_price numeric, _min integer, _pct numeric, _qty integer)
 RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $$ SELECT CASE WHEN _min IS NOT NULL AND _min > 0 AND _pct IS NOT NULL AND _pct > 0 AND _pct < 100 AND _qty >= _min
  THEN round(_price * (1 - _pct / 100)) ELSE _price END $$;

CREATE OR REPLACE FUNCTION public.place_order_items(_product_id uuid, _items jsonb, _full_name text, _phone text, _wilaya_code integer, _commune text, _delivery_type text, _adresse text, _desk_code text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
END; $function$;

CREATE OR REPLACE FUNCTION public.place_cart_order(_items jsonb, _full_name text, _phone text, _wilaya_code integer, _commune text, _delivery_type text, _adresse text, _desk_code text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
END; $function$;

REVOKE EXECUTE ON FUNCTION public.qty_discount_on() FROM anon, authenticated, public;
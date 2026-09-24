ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS product_name text,
  ADD COLUMN IF NOT EXISTS unit_price numeric;

CREATE OR REPLACE FUNCTION public.place_cart_order(
  _items jsonb, _full_name text, _phone text, _wilaya_code integer, _commune text,
  _delivery_type text, _adresse text, _desk_code text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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

    INSERT INTO public.order_items (order_id, product_id, product_name, unit_price, color_name, quantity)
    VALUES (new_id, p.id, p.name, p.price, it_color, it_qty);

    total_qty := total_qty + it_qty;
    subtotal := subtotal + p.price * it_qty;
    line_count := line_count + 1;
  END LOOP;

  UPDATE public.orders
    SET product_name = 'Panier (' || line_count || ' article' || CASE WHEN line_count > 1 THEN 's' ELSE '' END || ')',
        product_price = subtotal, quantity = total_qty, total = subtotal + fee
    WHERE id = new_id;

  RETURN new_id;
END; $function$;

REVOKE ALL ON FUNCTION public.place_cart_order(jsonb, text, text, integer, text, text, text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.place_cart_order(jsonb, text, text, integer, text, text, text, text) TO anon, authenticated, service_role;
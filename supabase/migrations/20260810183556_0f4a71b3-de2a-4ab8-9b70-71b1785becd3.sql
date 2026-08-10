ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS desk_code text;

CREATE OR REPLACE FUNCTION public.place_order(
  _product_id uuid,
  _quantity int,
  _full_name text,
  _phone text,
  _wilaya_code int,
  _commune text,
  _delivery_type text,
  _adresse text,
  _desk_code text
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
    wilaya_id, wilaya_name, commune, adresse, desk_code, delivery_type, shipping_fee, total)
  VALUES (p.id, p.name, p.price, qty, left(trim(_full_name),120), left(trim(_phone),30),
    r.wilaya_code, r.wilaya_name, left(trim(_commune),120), left(trim(coalesce(_adresse,'')),400),
    left(trim(coalesce(_desk_code,'')),120),
    _delivery_type, fee, (p.price * qty) + fee)
  RETURNING id INTO new_id;

  UPDATE public.products SET stock_quantity = stock_quantity - qty WHERE id = p.id;
  RETURN new_id;
END; $$;

GRANT EXECUTE ON FUNCTION public.place_order(uuid,int,text,text,int,text,text,text,text) TO anon, authenticated;
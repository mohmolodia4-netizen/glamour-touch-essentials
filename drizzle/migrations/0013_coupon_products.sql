CREATE TABLE IF NOT EXISTS public.coupon_products (
  coupon_id uuid NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  PRIMARY KEY (coupon_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupon_products TO authenticated;
GRANT ALL ON public.coupon_products TO service_role;
ALTER TABLE public.coupon_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins manage coupon products" ON public.coupon_products;
CREATE POLICY "admins manage coupon products" ON public.coupon_products FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.coupon_apply_items(_code text, _items jsonb, _consume boolean)
RETURNS TABLE(code text, discount numeric, error text, products text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE c public.coupons%ROWTYPE; d numeric; restricted boolean; elig numeric; names text[];
BEGIN
  IF coalesce((SELECT s.features->>'coupons' FROM public.app_settings s WHERE s.id = 1), '') <> 'true' THEN
    RETURN QUERY SELECT NULL::text, 0::numeric, 'Codes promo indisponibles', NULL::text[]; RETURN;
  END IF;
  IF _consume THEN
    SELECT * INTO c FROM public.coupons WHERE coupons.code = upper(trim(coalesce(_code,''))) FOR UPDATE;
  ELSE
    SELECT * INTO c FROM public.coupons WHERE coupons.code = upper(trim(coalesce(_code,'')));
  END IF;
  IF NOT FOUND OR NOT c.active THEN RETURN QUERY SELECT NULL::text, 0::numeric, 'Code promo invalide', NULL::text[]; RETURN; END IF;
  IF c.starts_at IS NOT NULL AND now() < c.starts_at THEN RETURN QUERY SELECT NULL::text, 0::numeric, 'Code promo pas encore actif', NULL::text[]; RETURN; END IF;
  IF c.expires_at IS NOT NULL AND now() > c.expires_at THEN RETURN QUERY SELECT NULL::text, 0::numeric, 'Code promo expiré', NULL::text[]; RETURN; END IF;
  IF c.max_uses IS NOT NULL AND c.used_count >= c.max_uses THEN RETURN QUERY SELECT NULL::text, 0::numeric, 'Code promo épuisé', NULL::text[]; RETURN; END IF;

  restricted := EXISTS (SELECT 1 FROM public.coupon_products cp WHERE cp.coupon_id = c.id);
  SELECT coalesce(sum(greatest((i->>'quantity')::numeric,0) * greatest((i->>'unit_price')::numeric,0)),0)
    INTO elig
    FROM jsonb_array_elements(coalesce(_items,'[]'::jsonb)) i
    WHERE NOT restricted OR EXISTS (SELECT 1 FROM public.coupon_products cp
      WHERE cp.coupon_id = c.id AND cp.product_id::text = i->>'product_id');
  IF restricted THEN
    SELECT array_agg(p.name ORDER BY p.name) INTO names FROM public.products p
      WHERE p.id::text IN (SELECT i->>'product_id' FROM jsonb_array_elements(coalesce(_items,'[]'::jsonb)) i)
        AND EXISTS (SELECT 1 FROM public.coupon_products cp WHERE cp.coupon_id = c.id AND cp.product_id = p.id);
    IF elig <= 0 THEN
      RETURN QUERY SELECT NULL::text, 0::numeric, 'Ce code ne s''applique pas aux produits de votre panier', NULL::text[]; RETURN;
    END IF;
  END IF;
  IF elig < c.min_order THEN RETURN QUERY SELECT NULL::text, 0::numeric, 'Montant minimum non atteint: ' || round(c.min_order) || ' DA', NULL::text[]; RETURN; END IF;
  d := CASE WHEN c.type = 'percent' THEN round(elig * c.value / 100) ELSE round(c.value) END;
  d := LEAST(GREATEST(d, 0), elig);
  IF _consume THEN UPDATE public.coupons SET used_count = used_count + 1 WHERE id = c.id; END IF;
  RETURN QUERY SELECT c.code, d, NULL::text, names;
END; $$;
REVOKE ALL ON FUNCTION public.coupon_apply_items(text, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coupon_apply_items(text, jsonb, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.validate_coupon(_code text, _subtotal numeric, _items jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record;
BEGIN
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' THEN RETURN public.validate_coupon(_code, _subtotal); END IF;
  SELECT * INTO r FROM public.coupon_apply_items(_code, _items, false);
  IF r.error IS NOT NULL THEN RETURN jsonb_build_object('valid', false, 'message', r.error); END IF;
  RETURN jsonb_build_object('valid', true, 'code', r.code, 'discount', r.discount, 'products', to_jsonb(r.products));
END; $$;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, numeric, jsonb) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.place_order_items(_product_id uuid, _items jsonb, _full_name text, _phone text, _wilaya_code integer, _commune text, _delivery_type text, _adresse text, _desk_code text, _coupon_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE new_id uuid; o public.orders%ROWTYPE; cr record; sub numeric;
BEGIN
  new_id := public.place_order_items(_product_id, _items, _full_name, _phone, _wilaya_code, _commune, _delivery_type, _adresse, _desk_code);
  IF length(trim(coalesce(_coupon_code,''))) = 0 THEN RETURN new_id; END IF;
  SELECT * INTO o FROM public.orders WHERE id = new_id;
  sub := o.product_price * o.quantity;
  SELECT * INTO cr FROM public.coupon_apply_items(_coupon_code,
    jsonb_build_array(jsonb_build_object('product_id', o.product_id, 'quantity', o.quantity, 'unit_price', o.product_price)), true);
  IF cr.error IS NOT NULL THEN RAISE EXCEPTION '%', cr.error; END IF;
  UPDATE public.orders SET coupon_code = cr.code, discount_amount = cr.discount,
    total = sub - cr.discount + o.shipping_fee WHERE id = new_id;
  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.place_cart_order(_items jsonb, _full_name text, _phone text, _wilaya_code integer, _commune text, _delivery_type text, _adresse text, _desk_code text, _coupon_code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE new_id uuid; o public.orders%ROWTYPE; cr record; lines jsonb;
BEGIN
  new_id := public.place_cart_order(_items, _full_name, _phone, _wilaya_code, _commune, _delivery_type, _adresse, _desk_code);
  IF length(trim(coalesce(_coupon_code,''))) = 0 THEN RETURN new_id; END IF;
  SELECT * INTO o FROM public.orders WHERE id = new_id;
  SELECT coalesce(jsonb_agg(jsonb_build_object('product_id', oi.product_id, 'quantity', oi.quantity, 'unit_price', oi.unit_price)), '[]'::jsonb)
    INTO lines FROM public.order_items oi WHERE oi.order_id = new_id;
  SELECT * INTO cr FROM public.coupon_apply_items(_coupon_code, lines, true);
  IF cr.error IS NOT NULL THEN RAISE EXCEPTION '%', cr.error; END IF;
  UPDATE public.orders SET coupon_code = cr.code, discount_amount = cr.discount,
    total = o.product_price - cr.discount + o.shipping_fee WHERE id = new_id;
  RETURN new_id;
END; $$;

NOTIFY pgrst, 'reload schema';
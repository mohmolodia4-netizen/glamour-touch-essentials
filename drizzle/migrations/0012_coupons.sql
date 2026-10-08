CREATE TABLE public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code = upper(code) AND length(code) BETWEEN 2 AND 40),
  type text NOT NULL DEFAULT 'percent' CHECK (type IN ('percent','fixed')),
  value numeric(12,2) NOT NULL CHECK (value > 0),
  min_order numeric(12,2) NOT NULL DEFAULT 0 CHECK (min_order >= 0),
  max_uses integer CHECK (max_uses IS NULL OR max_uses > 0),
  used_count integer NOT NULL DEFAULT 0,
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coupons_percent_max CHECK (type <> 'percent' OR value <= 100)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.coupons TO authenticated;
GRANT ALL ON public.coupons TO service_role;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins manage coupons" ON public.coupons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.coupons_normalize() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.code := upper(trim(NEW.code)); NEW.updated_at := now(); RETURN NEW; END; $$;
CREATE TRIGGER coupons_normalize BEFORE INSERT OR UPDATE ON public.coupons
  FOR EACH ROW EXECUTE FUNCTION public.coupons_normalize();

ALTER TABLE public.orders ADD COLUMN coupon_code text;
ALTER TABLE public.orders ADD COLUMN discount_amount numeric(12,2) NOT NULL DEFAULT 0;

-- Internal: checks a coupon against a subtotal. Optionally locks + consumes it.
CREATE OR REPLACE FUNCTION public.coupon_apply(_code text, _subtotal numeric, _consume boolean)
RETURNS TABLE(code text, discount numeric, error text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.coupons%ROWTYPE; d numeric;
BEGIN
  IF coalesce((SELECT s.features->>'coupons' FROM public.app_settings s WHERE s.id = 1), '') <> 'true' THEN
    RETURN QUERY SELECT NULL::text, 0::numeric, 'Codes promo indisponibles'; RETURN;
  END IF;
  IF _consume THEN
    SELECT * INTO c FROM public.coupons WHERE coupons.code = upper(trim(coalesce(_code,''))) FOR UPDATE;
  ELSE
    SELECT * INTO c FROM public.coupons WHERE coupons.code = upper(trim(coalesce(_code,'')));
  END IF;
  IF NOT FOUND OR NOT c.active THEN RETURN QUERY SELECT NULL::text, 0::numeric, 'Code promo invalide'; RETURN; END IF;
  IF c.starts_at IS NOT NULL AND now() < c.starts_at THEN RETURN QUERY SELECT NULL::text, 0::numeric, 'Code promo pas encore actif'; RETURN; END IF;
  IF c.expires_at IS NOT NULL AND now() > c.expires_at THEN RETURN QUERY SELECT NULL::text, 0::numeric, 'Code promo expiré'; RETURN; END IF;
  IF c.max_uses IS NOT NULL AND c.used_count >= c.max_uses THEN RETURN QUERY SELECT NULL::text, 0::numeric, 'Code promo épuisé'; RETURN; END IF;
  IF coalesce(_subtotal,0) < c.min_order THEN RETURN QUERY SELECT NULL::text, 0::numeric, 'Montant minimum non atteint: ' || round(c.min_order) || ' DA'; RETURN; END IF;
  d := CASE WHEN c.type = 'percent' THEN round(_subtotal * c.value / 100) ELSE round(c.value) END;
  d := LEAST(GREATEST(d, 0), _subtotal);
  IF _consume THEN UPDATE public.coupons SET used_count = used_count + 1 WHERE id = c.id; END IF;
  RETURN QUERY SELECT c.code, d, NULL::text;
END; $$;
REVOKE ALL ON FUNCTION public.coupon_apply(text, numeric, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.validate_coupon(_code text, _subtotal numeric)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.coupon_apply(_code, _subtotal, false);
  IF r.error IS NOT NULL THEN RETURN jsonb_build_object('valid', false, 'message', r.error); END IF;
  RETURN jsonb_build_object('valid', true, 'code', r.code, 'discount', r.discount);
END; $$;
GRANT EXECUTE ON FUNCTION public.validate_coupon(text, numeric) TO anon, authenticated, service_role;

-- Coupon-aware variants (10 args); the 9-arg versions are kept unchanged.
CREATE OR REPLACE FUNCTION public.place_order_items(_product_id uuid, _items jsonb, _full_name text, _phone text, _wilaya_code integer, _commune text, _delivery_type text, _adresse text, _desk_code text, _coupon_code text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  new_id uuid; o public.orders%ROWTYPE; cr record; sub numeric;
BEGIN
  new_id := public.place_order_items(_product_id, _items, _full_name, _phone, _wilaya_code, _commune, _delivery_type, _adresse, _desk_code);
  IF length(trim(coalesce(_coupon_code,''))) = 0 THEN RETURN new_id; END IF;
  SELECT * INTO o FROM public.orders WHERE id = new_id;
  sub := o.product_price * o.quantity;
  SELECT * INTO cr FROM public.coupon_apply(_coupon_code, sub, true);
  IF cr.error IS NOT NULL THEN RAISE EXCEPTION '%', cr.error; END IF;
  UPDATE public.orders SET coupon_code = cr.code, discount_amount = cr.discount,
    total = sub - cr.discount + o.shipping_fee WHERE id = new_id;
  RETURN new_id;
END; $function$;
GRANT EXECUTE ON FUNCTION public.place_order_items(uuid, jsonb, text, text, integer, text, text, text, text, text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.place_cart_order(_items jsonb, _full_name text, _phone text, _wilaya_code integer, _commune text, _delivery_type text, _adresse text, _desk_code text, _coupon_code text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  new_id uuid; o public.orders%ROWTYPE; cr record;
BEGIN
  new_id := public.place_cart_order(_items, _full_name, _phone, _wilaya_code, _commune, _delivery_type, _adresse, _desk_code);
  IF length(trim(coalesce(_coupon_code,''))) = 0 THEN RETURN new_id; END IF;
  SELECT * INTO o FROM public.orders WHERE id = new_id;
  SELECT * INTO cr FROM public.coupon_apply(_coupon_code, o.product_price, true);
  IF cr.error IS NOT NULL THEN RAISE EXCEPTION '%', cr.error; END IF;
  UPDATE public.orders SET coupon_code = cr.code, discount_amount = cr.discount,
    total = o.product_price - cr.discount + o.shipping_fee WHERE id = new_id;
  RETURN new_id;
END; $function$;
GRANT EXECUTE ON FUNCTION public.place_cart_order(jsonb, text, text, integer, text, text, text, text, text) TO anon, authenticated, service_role;
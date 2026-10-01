CREATE TABLE public.cross_sell_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL UNIQUE REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cross_sell_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cross_sell_products TO authenticated;
GRANT ALL ON public.cross_sell_products TO service_role;
ALTER TABLE public.cross_sell_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read cross sell" ON public.cross_sell_products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins manage cross sell" ON public.cross_sell_products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
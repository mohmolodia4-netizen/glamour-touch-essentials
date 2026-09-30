ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS site_tagline text DEFAULT 'Bags & Accessories';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#687C6C';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS logo_url text;

DROP FUNCTION public.get_public_settings();
CREATE FUNCTION public.get_public_settings()
RETURNS TABLE(site_name text, phone text, whatsapp text, instagram_url text, facebook_url text, tiktok_url text, meta_pixel_id text, tiktok_pixel_id text, features jsonb, site_tagline text, primary_color text, logo_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
 SELECT s.site_name, s.phone, s.whatsapp, s.instagram_url, s.facebook_url, s.tiktok_url, s.meta_pixel_id, s.tiktok_pixel_id, s.features, s.site_tagline, s.primary_color, s.logo_url
 FROM public.app_settings s WHERE s.id = 1
$$;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated, service_role;
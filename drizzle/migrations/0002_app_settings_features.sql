ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS features jsonb NOT NULL DEFAULT '{}'::jsonb;
DROP FUNCTION IF EXISTS public.get_public_settings();
CREATE FUNCTION public.get_public_settings()
 RETURNS TABLE(site_name text, phone text, whatsapp text, instagram_url text, facebook_url text, tiktok_url text, meta_pixel_id text, tiktok_pixel_id text, features jsonb)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT site_name, phone, whatsapp, instagram_url, facebook_url, tiktok_url, meta_pixel_id, tiktok_pixel_id, features
  FROM public.app_settings WHERE id = 1
$$;
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated, service_role;
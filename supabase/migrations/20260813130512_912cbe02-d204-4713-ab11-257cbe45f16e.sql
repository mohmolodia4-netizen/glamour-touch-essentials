ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS tiktok_pixel_id text;

DROP FUNCTION IF EXISTS public.get_public_settings();

CREATE FUNCTION public.get_public_settings()
 RETURNS TABLE(site_name text, phone text, whatsapp text, instagram_url text, facebook_url text, tiktok_url text, meta_pixel_id text, tiktok_pixel_id text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT site_name, phone, whatsapp, instagram_url, facebook_url, tiktok_url, meta_pixel_id, tiktok_pixel_id
  FROM public.app_settings WHERE id = 1
$function$;
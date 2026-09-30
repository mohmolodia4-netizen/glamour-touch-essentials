ALTER TABLE public.app_settings ALTER COLUMN primary_color SET DEFAULT '#556959';
UPDATE public.app_settings SET primary_color = '#556959' WHERE primary_color = '#687C6C';
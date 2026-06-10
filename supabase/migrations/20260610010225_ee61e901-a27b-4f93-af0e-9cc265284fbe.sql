ALTER TABLE public.personas ADD COLUMN IF NOT EXISTS category text;
CREATE INDEX IF NOT EXISTS personas_category_idx ON public.personas (category);
CREATE INDEX IF NOT EXISTS personas_is_public_category_idx ON public.personas (is_public, category) WHERE is_public = true;
ALTER TABLE public.personas
ADD COLUMN IF NOT EXISTS voice_clone_source text,
ADD COLUMN IF NOT EXISTS voice_clone_name text;
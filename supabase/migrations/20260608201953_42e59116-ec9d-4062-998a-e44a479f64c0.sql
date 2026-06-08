ALTER TABLE public.personas ADD COLUMN IF NOT EXISTS voice_provider text, ADD COLUMN IF NOT EXISTS voice_id text;
ALTER TABLE public.debates 
  ADD COLUMN IF NOT EXISTS voice_provider_mod text,
  ADD COLUMN IF NOT EXISTS voice_id_mod text,
  ADD COLUMN IF NOT EXISTS voice_provider_a text,
  ADD COLUMN IF NOT EXISTS voice_id_a text,
  ADD COLUMN IF NOT EXISTS voice_provider_b text,
  ADD COLUMN IF NOT EXISTS voice_id_b text,
  ADD COLUMN IF NOT EXISTS synopsis text;
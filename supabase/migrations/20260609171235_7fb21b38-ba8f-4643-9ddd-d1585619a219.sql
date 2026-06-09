ALTER TABLE public.debates
  ADD COLUMN IF NOT EXISTS debater_a_image_url text,
  ADD COLUMN IF NOT EXISTS debater_b_image_url text;
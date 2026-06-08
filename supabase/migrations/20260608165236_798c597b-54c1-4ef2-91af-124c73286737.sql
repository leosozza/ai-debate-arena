ALTER TABLE public.debates
  ADD COLUMN IF NOT EXISTS debater_a_model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  ADD COLUMN IF NOT EXISTS debater_b_model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  ADD COLUMN IF NOT EXISTS moderator_model text NOT NULL DEFAULT 'google/gemini-3-flash-preview',
  ADD COLUMN IF NOT EXISTS dynamic_flow boolean NOT NULL DEFAULT false;
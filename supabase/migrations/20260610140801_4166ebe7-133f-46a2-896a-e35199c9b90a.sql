
ALTER TABLE public.debates
  ADD COLUMN IF NOT EXISTS format TEXT NOT NULL DEFAULT 'duel';

CREATE INDEX IF NOT EXISTS debates_format_idx ON public.debates(format);

CREATE TABLE IF NOT EXISTS public.debate_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  debate_id UUID NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  persona_id UUID REFERENCES public.personas(id) ON DELETE SET NULL,
  slot INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'debater',
  display_name TEXT NOT NULL,
  persona_prompt TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  voice_provider TEXT,
  voice_id TEXT,
  model TEXT,
  team TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (debate_id, slot)
);

CREATE INDEX IF NOT EXISTS debate_participants_debate_idx
  ON public.debate_participants(debate_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.debate_participants TO authenticated;
GRANT ALL ON public.debate_participants TO service_role;

ALTER TABLE public.debate_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own debate participants"
  ON public.debate_participants
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_debate_participants_updated_at
  BEFORE UPDATE ON public.debate_participants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

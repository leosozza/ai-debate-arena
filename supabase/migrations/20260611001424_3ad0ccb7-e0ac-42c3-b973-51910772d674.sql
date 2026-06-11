CREATE TABLE public.voice_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  voice_url TEXT NOT NULL,
  storage_path TEXT,
  is_real_person BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_presets TO authenticated;
GRANT ALL ON public.voice_presets TO service_role;
ALTER TABLE public.voice_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own voice presets" ON public.voice_presets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_voice_presets_updated BEFORE UPDATE ON public.voice_presets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX voice_presets_user_idx ON public.voice_presets(user_id, created_at DESC);
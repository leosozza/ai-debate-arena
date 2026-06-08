
CREATE TABLE public.debates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  topic TEXT NOT NULL,
  debater_a_name TEXT NOT NULL,
  debater_a_persona TEXT NOT NULL,
  debater_b_name TEXT NOT NULL,
  debater_b_persona TEXT NOT NULL,
  moderator_tone TEXT NOT NULL DEFAULT 'formal',
  rounds INTEGER NOT NULL DEFAULT 3,
  rules TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.debates TO authenticated;
GRANT ALL ON public.debates TO service_role;

ALTER TABLE public.debates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own debates" ON public.debates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.debate_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  debate_id UUID NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role TEXT NOT NULL,
  phase TEXT NOT NULL,
  content TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX debate_messages_debate_order_idx ON public.debate_messages(debate_id, order_index);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.debate_messages TO authenticated;
GRANT ALL ON public.debate_messages TO service_role;

ALTER TABLE public.debate_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own debate messages" ON public.debate_messages
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER debates_updated_at BEFORE UPDATE ON public.debates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

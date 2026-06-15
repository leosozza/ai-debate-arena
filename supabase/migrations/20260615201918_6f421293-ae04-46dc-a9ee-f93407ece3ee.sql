
CREATE TABLE public.debate_exports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  debate_id uuid NOT NULL REFERENCES public.debates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('full','block')),
  block_index integer,
  block_title text,
  storage_path text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  duration_seconds numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX debate_exports_debate_id_idx ON public.debate_exports(debate_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.debate_exports TO authenticated;
GRANT ALL ON public.debate_exports TO service_role;

ALTER TABLE public.debate_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own debate exports"
ON public.debate_exports FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Storage policies: debate-videos bucket, path prefix = {user_id}/...
CREATE POLICY "Users read own debate videos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'debate-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users upload own debate videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'debate-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own debate videos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'debate-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own debate videos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'debate-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

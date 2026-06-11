
ALTER TABLE public.personas
  ADD COLUMN IF NOT EXISTS vignette_url text,
  ADD COLUMN IF NOT EXISTS vignette_model text;

CREATE POLICY "persona-videos owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'persona-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "persona-videos owner insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'persona-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "persona-videos owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'persona-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "persona-videos owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'persona-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

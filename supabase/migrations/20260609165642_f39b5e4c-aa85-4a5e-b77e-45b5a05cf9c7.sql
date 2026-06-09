
ALTER TABLE public.personas ADD COLUMN IF NOT EXISTS image_url text;

CREATE POLICY "Read persona-images (authenticated)"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'persona-images');

CREATE POLICY "Upload own persona-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'persona-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Update own persona-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'persona-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Delete own persona-images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'persona-images' AND auth.uid()::text = (storage.foldername(name))[1]);

INSERT INTO storage.buckets (id, name, public) VALUES ('vendor-covers', 'vendor-covers', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "vendor_covers_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'vendor-covers');

CREATE POLICY "vendor_covers_admin_write"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'vendor-covers' AND public.is_admin(auth.uid()));

CREATE POLICY "vendor_covers_admin_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'vendor-covers' AND public.is_admin(auth.uid()));

CREATE POLICY "vendor_covers_admin_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'vendor-covers' AND public.is_admin(auth.uid()));
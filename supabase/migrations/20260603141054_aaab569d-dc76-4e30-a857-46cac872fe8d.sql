CREATE POLICY "backups_admin_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'backups' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "backups_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'backups' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "backups_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'backups' AND has_role(auth.uid(), 'admin'::app_role));

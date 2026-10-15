DROP POLICY IF EXISTS "Auth users upload receipt photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users update receipt photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users delete receipt photos" ON storage.objects;
DROP POLICY IF EXISTS "Receipt photos viewable by auth" ON storage.objects;

CREATE POLICY "Receipt photos insert own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'receipt-photos'
  AND (storage.foldername(name))[1] = (select auth.uid()::text)
);

CREATE POLICY "Receipt photos update own"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'receipt-photos'
  AND owner_id = (select auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'receipt-photos'
  AND owner_id = (select auth.uid()::text)
);

CREATE POLICY "Receipt photos delete own"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'receipt-photos'
  AND owner_id = (select auth.uid()::text)
);

CREATE POLICY "Receipt photos viewable by owner and homestead mates"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'receipt-photos'
  AND (
    owner_id = (select auth.uid()::text)
    OR (storage.foldername(name))[1] = (select auth.uid()::text)
    OR EXISTS (
      SELECT 1 FROM public.homestead_members m1
      JOIN public.homestead_members m2 ON m2.homestead_id = m1.homestead_id
      WHERE m1.user_id = auth.uid()
        AND m2.user_id::text = COALESCE(owner_id, (storage.foldername(name))[1])
    )
  )
);
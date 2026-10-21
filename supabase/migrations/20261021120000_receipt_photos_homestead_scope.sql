-- Tighten receipt-photos storage policies: homestead-scoped access.
--
-- Why: the original migration's policies let ANY signed-in user read, add,
-- replace, or delete files in the receipt-photos bucket. Lovable's security
-- scan flags that as a critical finding ("Some file storage rules don't tie
-- files to their owner"). Correct to fix before public sign-ups.
--
-- How receipt paths work (src/lib/receipt-upload.ts): every upload goes to
-- "{uploader_user_id}/{uuid}.{ext}" in the private receipt-photos bucket,
-- and the feed page views them via signed URLs. So access can be scoped by
-- the path's first folder: a signed-in user may access a receipt photo when
-- they share a homestead with the user who uploaded it. That keeps household
-- sharing working (receipts are household financial records, like the
-- homestead-scoped feed_purchases rows) while shutting out other homesteads.
--
-- Writes additionally require a data-writing role, mirroring the table RLS
-- (SELECT -> is_approved_user, writes -> can_write_data) used app-wide.

-- Helper: does _uid share a homestead with the owner of the object at _name?
-- Owner id is the path's first folder, compared as text to avoid cast errors
-- on any unexpected path shape.
CREATE OR REPLACE FUNCTION public.receipt_photo_shared(_name text, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.homestead_members mine
    JOIN public.homestead_members theirs
      ON theirs.homestead_id = mine.homestead_id
    WHERE mine.user_id = _uid
      AND theirs.user_id::text = (storage.foldername(_name))[1]
  );
$$;
REVOKE EXECUTE ON FUNCTION public.receipt_photo_shared(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.receipt_photo_shared(text, uuid) TO authenticated;

-- Read: only members of the uploader's homestead.
DROP POLICY IF EXISTS "Receipt photos viewable by auth" ON storage.objects;
CREATE POLICY "Receipt photos viewable by homestead"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipt-photos'
    AND public.receipt_photo_shared(name, auth.uid())
  );

-- Upload: only into your own folder, and only with a write role.
DROP POLICY IF EXISTS "Auth users upload receipt photos" ON storage.objects;
CREATE POLICY "Auth users upload own receipt photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipt-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND public.can_write_data(auth.uid())
  );

-- Replace: write role + shared homestead; the file must stay in your folder.
DROP POLICY IF EXISTS "Auth users update receipt photos" ON storage.objects;
CREATE POLICY "Auth users update receipt photos in homestead"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'receipt-photos'
    AND public.can_write_data(auth.uid())
    AND public.receipt_photo_shared(name, auth.uid())
  )
  WITH CHECK (
    bucket_id = 'receipt-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: write role + shared homestead.
DROP POLICY IF EXISTS "Auth users delete receipt photos" ON storage.objects;
CREATE POLICY "Auth users delete receipt photos in homestead"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipt-photos'
    AND public.can_write_data(auth.uid())
    AND public.receipt_photo_shared(name, auth.uid())
  );

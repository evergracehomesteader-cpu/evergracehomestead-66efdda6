-- 1. Make photo buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('animal-photos', 'barter-photos');

-- 2. Drop any existing public SELECT policies on these buckets, then add authenticated-only policies
DROP POLICY IF EXISTS "Public read animal-photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read barter-photos" ON storage.objects;
DROP POLICY IF EXISTS "animal-photos public read" ON storage.objects;
DROP POLICY IF EXISTS "barter-photos public read" ON storage.objects;
DROP POLICY IF EXISTS "animal_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "barter_photos_public_read" ON storage.objects;
DROP POLICY IF EXISTS "animal_photos_auth_select" ON storage.objects;
DROP POLICY IF EXISTS "animal_photos_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "animal_photos_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "animal_photos_auth_delete" ON storage.objects;
DROP POLICY IF EXISTS "barter_photos_auth_select" ON storage.objects;
DROP POLICY IF EXISTS "barter_photos_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "barter_photos_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "barter_photos_auth_delete" ON storage.objects;

CREATE POLICY "animal_photos_auth_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'animal-photos');
CREATE POLICY "animal_photos_auth_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'animal-photos');
CREATE POLICY "animal_photos_auth_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'animal-photos') WITH CHECK (bucket_id = 'animal-photos');
CREATE POLICY "animal_photos_auth_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'animal-photos');

CREATE POLICY "barter_photos_auth_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'barter-photos');
CREATE POLICY "barter_photos_auth_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'barter-photos');
CREATE POLICY "barter_photos_auth_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'barter-photos') WITH CHECK (bucket_id = 'barter-photos');
CREATE POLICY "barter_photos_auth_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'barter-photos');

-- 3. Lock down SECURITY DEFINER helper functions (used only as triggers).
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
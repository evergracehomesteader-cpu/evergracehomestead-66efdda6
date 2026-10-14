-- Reference/role tables
DROP POLICY IF EXISTS role_perm_select_auth ON public.role_permissions;
CREATE POLICY role_perm_select_own ON public.role_permissions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR role IN (SELECT ur.role FROM public.user_roles ur WHERE ur.user_id = auth.uid())
  OR role IN (SELECT m.role FROM public.homestead_members m WHERE m.user_id = auth.uid())
);

DROP POLICY IF EXISTS user_roles_select_auth ON public.user_roles;
CREATE POLICY user_roles_select_self ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS profiles_select_auth ON public.profiles;
CREATE POLICY profiles_select_shared ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1 FROM public.homestead_members a
    JOIN public.homestead_members b ON a.homestead_id = b.homestead_id
    WHERE a.user_id = auth.uid() AND b.user_id = profiles.id
  )
);

DROP POLICY IF EXISTS species_catalog_all_auth ON public.species_catalog;
CREATE POLICY species_catalog_select ON public.species_catalog FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);
CREATE POLICY species_catalog_admin_write ON public.species_catalog FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS breeds_catalog_all_auth ON public.breeds_catalog;
CREATE POLICY breeds_catalog_select ON public.breeds_catalog FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);
CREATE POLICY breeds_catalog_insert ON public.breeds_catalog FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND is_custom = true);
CREATE POLICY breeds_catalog_modify ON public.breeds_catalog FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY breeds_catalog_delete ON public.breeds_catalog FOR DELETE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Storage: photos stored under <uploader_user_id>/<file>
DROP POLICY IF EXISTS "Auth users can upload barter photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can update barter photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can delete barter photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users upload animal photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users update animal photos" ON storage.objects;
DROP POLICY IF EXISTS "Auth users delete animal photos" ON storage.objects;
DROP POLICY IF EXISTS animal_photos_auth_select ON storage.objects;
DROP POLICY IF EXISTS animal_photos_auth_insert ON storage.objects;
DROP POLICY IF EXISTS animal_photos_auth_update ON storage.objects;
DROP POLICY IF EXISTS animal_photos_auth_delete ON storage.objects;
DROP POLICY IF EXISTS barter_photos_auth_select ON storage.objects;
DROP POLICY IF EXISTS barter_photos_auth_insert ON storage.objects;
DROP POLICY IF EXISTS barter_photos_auth_update ON storage.objects;
DROP POLICY IF EXISTS barter_photos_auth_delete ON storage.objects;

CREATE POLICY photos_owner_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('animal-photos','barter-photos')
  AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY photos_owner_update ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('animal-photos','barter-photos') AND owner_id = auth.uid()::text)
WITH CHECK (bucket_id IN ('animal-photos','barter-photos')
  AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY photos_owner_delete ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('animal-photos','barter-photos') AND owner_id = auth.uid()::text);

CREATE POLICY photos_homestead_select ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('animal-photos','barter-photos') AND (
    owner_id = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.homestead_members a
      JOIN public.homestead_members b ON a.homestead_id = b.homestead_id
      WHERE a.user_id = auth.uid()
        AND (b.user_id::text = owner_id OR b.user_id::text = (storage.foldername(name))[1])
    )
  )
);
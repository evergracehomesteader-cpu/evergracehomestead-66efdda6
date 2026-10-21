-- For Sale listings: animals marked for sale in the app publish live to the
-- Evergrace Homestead website.
--
-- 1) New columns on animals: the for-sale switch, price, a PUBLIC sale
--    description (separate from the private `notes` field), and when listed.
-- 2) A public read-only view exposing ONLY buyer-safe fields and ONLY for
--    animals currently listed for sale. The view runs with its owner's
--    rights, so the animals table itself stays fully private behind RLS.
-- 3) Photo access: animal-photos is a private bucket. A security-definer
--    helper lets the public read only photos that belong to an animal that
--    is currently for sale (same pattern as receipt_photo_shared).

ALTER TABLE public.animals
  ADD COLUMN IF NOT EXISTS for_sale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS listing_price_cents integer,
  ADD COLUMN IF NOT EXISTS sale_notes text,
  ADD COLUMN IF NOT EXISTS sale_listed_at timestamptz;

CREATE OR REPLACE VIEW public.for_sale_listings AS
SELECT
  a.id,
  a.name,
  a.species,
  a.breed,
  a.sex,
  a.date_of_birth,
  COALESCE(a.front_photo_url, a.photo_url) AS photo_path,
  a.listing_price_cents,
  a.sale_notes,
  a.sale_listed_at
FROM public.animals a
WHERE a.for_sale = true AND a.status = 'active';

GRANT SELECT ON public.for_sale_listings TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_for_sale_photo(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.animals a
    WHERE a.for_sale = true AND a.status = 'active'
      AND (
        _name = a.photo_url
        OR _name = a.front_photo_url
        OR _name = a.side_photo_url
        OR _name = ANY (COALESCE(a.additional_photo_urls, ARRAY[]::text[]))
      )
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_for_sale_photo(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_for_sale_photo(text) TO anon, authenticated;

DROP POLICY IF EXISTS "For-sale animal photos public read" ON storage.objects;
CREATE POLICY "For-sale animal photos public read"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'animal-photos' AND public.is_for_sale_photo(name));

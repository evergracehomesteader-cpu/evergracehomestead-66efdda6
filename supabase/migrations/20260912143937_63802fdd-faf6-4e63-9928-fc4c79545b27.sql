CREATE OR REPLACE FUNCTION public.can_view_finances(_hid uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.homesteads h
    WHERE h.id = _hid AND h.owner_id = _uid
  ) OR EXISTS (
    SELECT 1 FROM public.homestead_members m
    WHERE m.homestead_id = _hid AND m.user_id = _uid
      AND m.role IN ('admin','manager','bookkeeper')
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_finances(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_finances(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS bills_select ON public.bills;
CREATE POLICY bills_select ON public.bills FOR SELECT TO authenticated
  USING (public.can_view_finances(homestead_id, auth.uid()));
DROP POLICY IF EXISTS bills_insert ON public.bills;
CREATE POLICY bills_insert ON public.bills FOR INSERT TO authenticated
  WITH CHECK (public.can_view_finances(homestead_id, auth.uid()));
DROP POLICY IF EXISTS bills_update ON public.bills;
CREATE POLICY bills_update ON public.bills FOR UPDATE TO authenticated
  USING (public.can_view_finances(homestead_id, auth.uid()))
  WITH CHECK (public.can_view_finances(homestead_id, auth.uid()));
DROP POLICY IF EXISTS bills_delete ON public.bills;
CREATE POLICY bills_delete ON public.bills FOR DELETE TO authenticated
  USING (public.can_view_finances(homestead_id, auth.uid()));

DROP POLICY IF EXISTS income_entries_select ON public.income_entries;
CREATE POLICY income_entries_select ON public.income_entries FOR SELECT TO authenticated
  USING (public.can_view_finances(homestead_id, auth.uid()));
DROP POLICY IF EXISTS income_entries_insert ON public.income_entries;
CREATE POLICY income_entries_insert ON public.income_entries FOR INSERT TO authenticated
  WITH CHECK (public.can_view_finances(homestead_id, auth.uid()));
DROP POLICY IF EXISTS income_entries_update ON public.income_entries;
CREATE POLICY income_entries_update ON public.income_entries FOR UPDATE TO authenticated
  USING (public.can_view_finances(homestead_id, auth.uid()))
  WITH CHECK (public.can_view_finances(homestead_id, auth.uid()));
DROP POLICY IF EXISTS income_entries_delete ON public.income_entries;
CREATE POLICY income_entries_delete ON public.income_entries FOR DELETE TO authenticated
  USING (public.can_view_finances(homestead_id, auth.uid()));
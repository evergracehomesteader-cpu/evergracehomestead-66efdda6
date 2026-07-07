
-- =========================================================================
-- Multi-homestead / multi-tenant support
-- =========================================================================

-- 1. Core tables ----------------------------------------------------------

CREATE TABLE public.homesteads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homesteads TO authenticated;
GRANT ALL ON public.homesteads TO service_role;
ALTER TABLE public.homesteads ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.homestead_members (
  homestead_id uuid NOT NULL REFERENCES public.homesteads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (homestead_id, user_id)
);
CREATE INDEX homestead_members_user_idx ON public.homestead_members(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homestead_members TO authenticated;
GRANT ALL ON public.homestead_members TO service_role;
ALTER TABLE public.homestead_members ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.homestead_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  homestead_id uuid NOT NULL REFERENCES public.homesteads(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.app_role NOT NULL DEFAULT 'viewer',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX homestead_invitations_hid_idx ON public.homestead_invitations(homestead_id);
CREATE INDEX homestead_invitations_email_idx ON public.homestead_invitations(lower(email));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homestead_invitations TO authenticated;
GRANT ALL ON public.homestead_invitations TO service_role;
ALTER TABLE public.homestead_invitations ENABLE ROW LEVEL SECURITY;

-- 2. Helper functions -----------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_homestead_member(_hid uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.homestead_members WHERE homestead_id = _hid AND user_id = _uid);
$$;

CREATE OR REPLACE FUNCTION public.homestead_role(_hid uuid, _uid uuid)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.homestead_members WHERE homestead_id = _hid AND user_id = _uid LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_homestead_owner(_hid uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.homesteads WHERE id = _hid AND owner_id = _uid);
$$;

CREATE OR REPLACE FUNCTION public.can_write_homestead(_hid uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.homestead_members
    WHERE homestead_id = _hid AND user_id = _uid
      AND role IN ('admin','manager','animal_care','helper','bookkeeper')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_admin_homestead(_hid uuid, _uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.homesteads h WHERE h.id = _hid AND h.owner_id = _uid
    UNION
    SELECT 1 FROM public.homestead_members m WHERE m.homestead_id = _hid AND m.user_id = _uid AND m.role = 'admin'
  );
$$;

-- 3. Policies on core tables ---------------------------------------------

CREATE POLICY homesteads_select ON public.homesteads FOR SELECT TO authenticated
  USING (public.is_homestead_member(id, auth.uid()) OR owner_id = auth.uid());
CREATE POLICY homesteads_insert ON public.homesteads FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY homesteads_update ON public.homesteads FOR UPDATE TO authenticated
  USING (public.can_admin_homestead(id, auth.uid()))
  WITH CHECK (public.can_admin_homestead(id, auth.uid()));
CREATE POLICY homesteads_delete ON public.homesteads FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY hm_select ON public.homestead_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_homestead_member(homestead_id, auth.uid()));
CREATE POLICY hm_insert ON public.homestead_members FOR INSERT TO authenticated
  WITH CHECK (public.can_admin_homestead(homestead_id, auth.uid()));
CREATE POLICY hm_update ON public.homestead_members FOR UPDATE TO authenticated
  USING (public.can_admin_homestead(homestead_id, auth.uid()))
  WITH CHECK (public.can_admin_homestead(homestead_id, auth.uid()));
CREATE POLICY hm_delete ON public.homestead_members FOR DELETE TO authenticated
  USING (public.can_admin_homestead(homestead_id, auth.uid()) OR user_id = auth.uid());

CREATE POLICY hi_select ON public.homestead_invitations FOR SELECT TO authenticated
  USING (public.can_admin_homestead(homestead_id, auth.uid())
         OR lower(email) = lower(coalesce((auth.jwt() ->> 'email'), '')));
CREATE POLICY hi_insert ON public.homestead_invitations FOR INSERT TO authenticated
  WITH CHECK (public.can_admin_homestead(homestead_id, auth.uid()) AND invited_by = auth.uid());
CREATE POLICY hi_delete ON public.homestead_invitations FOR DELETE TO authenticated
  USING (public.can_admin_homestead(homestead_id, auth.uid()));
CREATE POLICY hi_update ON public.homestead_invitations FOR UPDATE TO authenticated
  USING (public.can_admin_homestead(homestead_id, auth.uid()))
  WITH CHECK (public.can_admin_homestead(homestead_id, auth.uid()));

-- Allow the accept-invite RPC to run for the invitee (via SECURITY DEFINER fn); no additional policy needed.

-- 4. Backfill: create Legacy Homestead, migrate users --------------------

DO $$
DECLARE
  legacy_owner uuid;
  legacy_hid uuid;
  urow record;
BEGIN
  SELECT user_id INTO legacy_owner FROM public.user_roles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1;
  IF legacy_owner IS NULL THEN
    SELECT id INTO legacy_owner FROM auth.users ORDER BY created_at ASC LIMIT 1;
  END IF;
  IF legacy_owner IS NOT NULL THEN
    INSERT INTO public.homesteads (name, owner_id) VALUES ('EverGrace Homestead', legacy_owner) RETURNING id INTO legacy_hid;
    -- Add every existing profile as a member with their highest role
    FOR urow IN
      SELECT p.id AS user_id,
             COALESCE(
               (SELECT role FROM public.user_roles ur WHERE ur.user_id = p.id
                ORDER BY CASE ur.role
                  WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 WHEN 'animal_care' THEN 3
                  WHEN 'bookkeeper' THEN 4 WHEN 'helper' THEN 5 WHEN 'viewer' THEN 6
                  WHEN 'volunteer' THEN 7 ELSE 8 END LIMIT 1),
               'viewer'::public.app_role
             ) AS role
      FROM public.profiles p
    LOOP
      INSERT INTO public.homestead_members (homestead_id, user_id, role)
      VALUES (legacy_hid, urow.user_id, urow.role)
      ON CONFLICT DO NOTHING;
    END LOOP;
    -- Store legacy homestead id in a settings row for the migration below
    PERFORM set_config('app.legacy_hid', legacy_hid::text, false);
  END IF;
END $$;

-- 5. Add homestead_id to every tenant table, backfill, index, replace policies --

DO $$
DECLARE
  tbls text[] := ARRAY[
    'animals','animal_events','backups','barter_contacts','barter_deals','barter_items',
    'bills','breeding_decisions','chore_assignments','chore_completions','chores',
    'compost_entries','contacts','feed_container_stock','feed_containers','feed_items',
    'feed_logs','feed_purchases','feed_units','garden_plots','health_records','heat_events',
    'income_entries','incubations','litters','pens','pregnancies','production_logs',
    'tasks','weight_logs'
  ];
  t text;
  legacy_hid uuid;
BEGIN
  SELECT id INTO legacy_hid FROM public.homesteads ORDER BY created_at ASC LIMIT 1;

  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS homestead_id uuid REFERENCES public.homesteads(id) ON DELETE CASCADE', t);
    IF legacy_hid IS NOT NULL THEN
      EXECUTE format('UPDATE public.%I SET homestead_id = %L WHERE homestead_id IS NULL', t, legacy_hid);
    END IF;
    -- Only enforce NOT NULL if there is data or a legacy_hid exists; leave nullable otherwise so fresh installs still work.
    IF legacy_hid IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN homestead_id SET NOT NULL', t);
    END IF;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(homestead_id)', t || '_hid_idx', t);
  END LOOP;
END $$;

-- For fresh installs where there are no rows, still require homestead_id going forward via a trigger check.
-- (Skipped — inserts from the app always supply it; RLS blocks anon.)

-- 6. Replace every per-table RLS policy with homestead-scoped versions ---

DO $$
DECLARE
  tbls text[] := ARRAY[
    'animals','animal_events','backups','barter_contacts','barter_deals','barter_items',
    'bills','breeding_decisions','chore_assignments','chore_completions','chores',
    'compost_entries','contacts','feed_container_stock','feed_containers','feed_items',
    'feed_logs','feed_purchases','feed_units','garden_plots','health_records','heat_events',
    'income_entries','incubations','litters','pens','pregnancies','production_logs',
    'tasks','weight_logs'
  ];
  t text;
  pol record;
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    -- Drop all existing policies on this table
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
    -- Ensure RLS is on
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    -- SELECT: any member
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_homestead_member(homestead_id, auth.uid()))$f$, t || '_select', t);
    -- INSERT: writers only, must belong to homestead
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_write_homestead(homestead_id, auth.uid()))$f$, t || '_insert', t);
    -- UPDATE: writers
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.can_write_homestead(homestead_id, auth.uid())) WITH CHECK (public.can_write_homestead(homestead_id, auth.uid()))$f$, t || '_update', t);
    -- DELETE: writers
    EXECUTE format($f$CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.can_write_homestead(homestead_id, auth.uid()))$f$, t || '_delete', t);
  END LOOP;
END $$;

-- 7. New signup handler: auto-create a personal homestead + owner membership

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  display text;
  new_hid uuid;
  invite_row record;
BEGIN
  display := coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1));

  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, display)
  ON CONFLICT (id) DO NOTHING;

  -- Legacy user_roles kept for backwards-compat (viewer default)
  INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'viewer') ON CONFLICT DO NOTHING;

  -- Auto-accept any pending invitations matching this email
  FOR invite_row IN
    SELECT * FROM public.homestead_invitations
    WHERE lower(email) = lower(new.email) AND accepted_at IS NULL AND expires_at > now()
  LOOP
    INSERT INTO public.homestead_members (homestead_id, user_id, role)
    VALUES (invite_row.homestead_id, new.id, invite_row.role)
    ON CONFLICT DO NOTHING;
    UPDATE public.homestead_invitations SET accepted_at = now() WHERE id = invite_row.id;
  END LOOP;

  -- Always create a personal homestead so the user has somewhere to work
  INSERT INTO public.homesteads (name, owner_id)
  VALUES (display || '''s Homestead', new.id)
  RETURNING id INTO new_hid;

  INSERT INTO public.homestead_members (homestead_id, user_id, role)
  VALUES (new_hid, new.id, 'admin')
  ON CONFLICT DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8. Accept-invite RPC (SECURITY DEFINER) --------------------------------

CREATE OR REPLACE FUNCTION public.accept_homestead_invitation(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inv record;
  uid uuid := auth.uid();
  uemail text := lower(coalesce(auth.jwt() ->> 'email', ''));
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT * INTO inv FROM public.homestead_invitations WHERE token = _token;
  IF inv IS NULL THEN RAISE EXCEPTION 'invitation not found'; END IF;
  IF inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'invitation already used'; END IF;
  IF inv.expires_at < now() THEN RAISE EXCEPTION 'invitation expired'; END IF;
  IF lower(inv.email) <> uemail THEN RAISE EXCEPTION 'invitation is for a different email'; END IF;

  INSERT INTO public.homestead_members (homestead_id, user_id, role)
  VALUES (inv.homestead_id, uid, inv.role)
  ON CONFLICT (homestead_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.homestead_invitations SET accepted_at = now() WHERE id = inv.id;
  RETURN inv.homestead_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_homestead_invitation(text) TO authenticated;

-- 9. updated_at trigger for homesteads

DROP TRIGGER IF EXISTS homesteads_set_updated_at ON public.homesteads;
CREATE TRIGGER homesteads_set_updated_at BEFORE UPDATE ON public.homesteads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 1. Enum
CREATE TYPE public.app_role AS ENUM ('admin','manager','helper','viewer','bookkeeper','animal_care','volunteer','pending');

-- 2. user_roles
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- 4. Policies on user_roles
CREATE POLICY user_roles_select_auth ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY user_roles_admin_write ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. role_permissions table
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  permission text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(role, permission)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_perm_select_auth ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY role_perm_admin_write ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6. Profiles: notes + active flag
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- 7. Seed default role permissions
INSERT INTO public.role_permissions (role, permission) VALUES
  -- admin: wildcard
  ('admin','*'),
  -- manager
  ('manager','dashboard.view'),('manager','animals.view'),('manager','animals.create'),('manager','animals.edit'),
  ('manager','feed.view'),('manager','feed.create'),('manager','feed.edit'),
  ('manager','inventory.view'),('manager','inventory.create'),('manager','inventory.edit'),
  ('manager','chores.view'),('manager','chores.create'),('manager','chores.edit'),
  ('manager','reports.view'),('manager','finances.view'),('manager','finances.create'),('manager','finances.edit'),
  ('manager','photos.upload'),
  -- helper
  ('helper','dashboard.view'),('helper','animals.view'),('helper','feed.view'),('helper','feed.create'),
  ('helper','chores.view'),('helper','chores.complete'),('helper','animals.notes.add'),('helper','animals.weights.add'),('helper','photos.upload'),
  -- viewer
  ('viewer','dashboard.view'),('viewer','animals.view'),('viewer','feed.view'),('viewer','chores.view'),
  -- bookkeeper
  ('bookkeeper','dashboard.view'),('bookkeeper','finances.view'),('bookkeeper','finances.create'),('bookkeeper','finances.edit'),
  ('bookkeeper','reports.view'),('bookkeeper','reports.export'),
  -- animal_care
  ('animal_care','animals.view'),('animal_care','animals.create'),('animal_care','animals.edit'),
  ('animal_care','health.create'),('animal_care','health.edit'),('animal_care','animals.weights.add'),
  ('animal_care','breeding.create'),('animal_care','photos.upload'),('animal_care','feed.view'),
  -- volunteer
  ('volunteer','chores.view.assigned'),('volunteer','chores.complete'),('volunteer','animals.notes.add'),('volunteer','animals.view.assigned')
ON CONFLICT DO NOTHING;

-- 8. Auto-promote yuri to admin; everyone else (including yuri) starts with no other roles. Other existing users -> pending.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role FROM auth.users u WHERE u.email = 'yurizagamboa82@gmail.com'
ON CONFLICT DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'pending'::public.app_role
FROM auth.users u
WHERE u.email <> 'yurizagamboa82@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = u.id)
ON CONFLICT DO NOTHING;

-- 9. Update handle_new_user to also assign 'viewer' to brand-new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'viewer')
  ON CONFLICT DO NOTHING;
  RETURN new;
END;
$$;

-- Ensure trigger exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

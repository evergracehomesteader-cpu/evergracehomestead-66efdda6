CREATE TABLE public.pens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  species text,
  capacity integer,
  location text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pens TO authenticated;
GRANT ALL ON public.pens TO service_role;

ALTER TABLE public.pens ENABLE ROW LEVEL SECURITY;

CREATE POLICY pens_select_auth ON public.pens FOR SELECT TO authenticated USING (true);
CREATE POLICY pens_write_admin_manager ON public.pens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER set_pens_updated_at BEFORE UPDATE ON public.pens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

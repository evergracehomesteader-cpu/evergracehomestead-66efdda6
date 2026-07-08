
CREATE TABLE public.suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  homestead_id UUID REFERENCES public.homesteads(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'feature' CHECK (category IN ('feature','bug','improvement','question')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','planned','in_progress','added','rejected','needs_more_info')),
  is_public BOOLEAN NOT NULL DEFAULT false,
  admin_notes TEXT,
  admin_reply TEXT,
  duplicate_of UUID REFERENCES public.suggestions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_suggestions_user ON public.suggestions(user_id);
CREATE INDEX idx_suggestions_status ON public.suggestions(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suggestions TO authenticated;
GRANT ALL ON public.suggestions TO service_role;

ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

-- Read: own, public, or app admin
CREATE POLICY "read own or public or admin"
  ON public.suggestions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_public = true
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Insert: authenticated user creating their own suggestion
CREATE POLICY "insert own"
  ON public.suggestions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Update: owner while still Submitted, OR app admin (any time)
CREATE POLICY "update own submitted or admin"
  ON public.suggestions FOR UPDATE
  TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'submitted')
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    (user_id = auth.uid() AND status = 'submitted')
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Delete: owner while still Submitted, OR app admin
CREATE POLICY "delete own submitted or admin"
  ON public.suggestions FOR DELETE
  TO authenticated
  USING (
    (user_id = auth.uid() AND status = 'submitted')
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE TRIGGER trg_suggestions_updated_at
  BEFORE UPDATE ON public.suggestions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

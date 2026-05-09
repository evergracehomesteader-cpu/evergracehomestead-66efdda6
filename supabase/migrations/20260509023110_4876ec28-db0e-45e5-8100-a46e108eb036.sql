-- Enums
CREATE TYPE public.barter_status AS ENUM ('pending', 'completed', 'cancelled');
CREATE TYPE public.barter_category AS ENUM ('livestock', 'feed', 'equipment', 'labor', 'produce', 'building_materials', 'services', 'other');
CREATE TYPE public.barter_direction AS ENUM ('given', 'received');
CREATE TYPE public.barter_link_type AS ENUM ('animal', 'feed', 'garden', 'equipment', 'service', 'other');

-- Contacts
CREATE TABLE public.barter_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  location TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Deals
CREATE TABLE public.barter_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  contact_id UUID REFERENCES public.barter_contacts(id) ON DELETE SET NULL,
  person_name TEXT,
  contact_info TEXT,
  given_summary TEXT,
  received_summary TEXT,
  estimated_value_cents INTEGER NOT NULL DEFAULT 0,
  trade_date DATE,
  due_date DATE,
  status public.barter_status NOT NULL DEFAULT 'pending',
  category public.barter_category NOT NULL DEFAULT 'other',
  location TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  photo_urls TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Items linked to deals
CREATE TABLE public.barter_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES public.barter_deals(id) ON DELETE CASCADE,
  direction public.barter_direction NOT NULL,
  link_type public.barter_link_type NOT NULL DEFAULT 'other',
  link_id UUID,
  description TEXT NOT NULL,
  quantity NUMERIC,
  unit TEXT,
  value_cents INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_barter_deals_status ON public.barter_deals(status);
CREATE INDEX idx_barter_deals_due_date ON public.barter_deals(due_date);
CREATE INDEX idx_barter_items_deal ON public.barter_items(deal_id);

-- RLS
ALTER TABLE public.barter_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barter_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barter_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY barter_contacts_all_auth ON public.barter_contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY barter_deals_all_auth ON public.barter_deals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY barter_items_all_auth ON public.barter_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Updated_at triggers
CREATE TRIGGER barter_contacts_updated BEFORE UPDATE ON public.barter_contacts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER barter_deals_updated BEFORE UPDATE ON public.barter_deals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket for barter photos
INSERT INTO storage.buckets (id, name, public) VALUES ('barter-photos', 'barter-photos', true);

CREATE POLICY "Barter photos are publicly viewable"
  ON storage.objects FOR SELECT USING (bucket_id = 'barter-photos');
CREATE POLICY "Auth users can upload barter photos"
  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'barter-photos');
CREATE POLICY "Auth users can update barter photos"
  ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'barter-photos');
CREATE POLICY "Auth users can delete barter photos"
  ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'barter-photos');
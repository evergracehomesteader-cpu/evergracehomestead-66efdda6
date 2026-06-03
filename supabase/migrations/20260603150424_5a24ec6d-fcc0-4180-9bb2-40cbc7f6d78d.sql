
-- =========================================================
-- FEED CONTAINERS
-- =========================================================
CREATE TABLE public.feed_containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  capacity_lbs numeric,
  location text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_containers TO authenticated;
GRANT ALL ON public.feed_containers TO service_role;

ALTER TABLE public.feed_containers ENABLE ROW LEVEL SECURITY;

CREATE POLICY feed_containers_select_auth ON public.feed_containers
  FOR SELECT TO authenticated USING (true);
CREATE POLICY feed_containers_write_admin_manager ON public.feed_containers
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER feed_containers_updated_at
  BEFORE UPDATE ON public.feed_containers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- FEED UNITS
-- =========================================================
CREATE TABLE public.feed_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  lbs_per_unit numeric NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_units TO authenticated;
GRANT ALL ON public.feed_units TO service_role;

ALTER TABLE public.feed_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY feed_units_select_auth ON public.feed_units
  FOR SELECT TO authenticated USING (true);
CREATE POLICY feed_units_write_admin_manager ON public.feed_units
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER feed_units_updated_at
  BEFORE UPDATE ON public.feed_units
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.feed_units (name, lbs_per_unit, is_system) VALUES
  ('Full bucket', 20, true),
  ('Half bucket', 10, true),
  ('Quarter bucket', 5, true),
  ('Scoop', 2, true),
  ('5 gal bucket', 25, true);

-- =========================================================
-- FEED CONTAINER STOCK (running totals per container/feed)
-- =========================================================
CREATE TABLE public.feed_container_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id uuid NOT NULL,
  feed_item_id uuid NOT NULL,
  stock_lbs numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (container_id, feed_item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_container_stock TO authenticated;
GRANT ALL ON public.feed_container_stock TO service_role;

ALTER TABLE public.feed_container_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY feed_container_stock_all_auth ON public.feed_container_stock
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER feed_container_stock_updated_at
  BEFORE UPDATE ON public.feed_container_stock
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- FEED PURCHASES - extend
-- =========================================================
ALTER TABLE public.feed_purchases
  ADD COLUMN container_id uuid,
  ADD COLUMN unit_type text NOT NULL DEFAULT 'lbs',
  ADD COLUMN bag_size_lbs numeric,
  ADD COLUMN bag_count numeric,
  ADD COLUMN custom_unit_id uuid,
  ADD COLUMN custom_unit_qty numeric,
  ADD COLUMN total_lbs numeric NOT NULL DEFAULT 0,
  ADD COLUMN cost_per_bag_cents integer;

-- =========================================================
-- FEED LOGS - extend
-- =========================================================
ALTER TABLE public.feed_logs
  ADD COLUMN container_id uuid,
  ADD COLUMN unit_id uuid,
  ADD COLUMN unit_qty numeric,
  ADD COLUMN total_lbs numeric NOT NULL DEFAULT 0,
  ADD COLUMN target_type text NOT NULL DEFAULT 'animal',
  ADD COLUMN target_value text;

-- =========================================================
-- TRIGGERS: adjust container + item stock on purchase/feed
-- =========================================================
CREATE OR REPLACE FUNCTION public.apply_feed_purchase_stock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE delta numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    delta := COALESCE(NEW.total_lbs, 0);
    IF NEW.container_id IS NOT NULL AND delta <> 0 THEN
      INSERT INTO public.feed_container_stock (container_id, feed_item_id, stock_lbs)
      VALUES (NEW.container_id, NEW.feed_item_id, delta)
      ON CONFLICT (container_id, feed_item_id)
      DO UPDATE SET stock_lbs = feed_container_stock.stock_lbs + EXCLUDED.stock_lbs,
                    updated_at = now();
    END IF;
    IF delta <> 0 THEN
      UPDATE public.feed_items SET stock_qty = COALESCE(stock_qty,0) + delta WHERE id = NEW.feed_item_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    delta := COALESCE(OLD.total_lbs, 0);
    IF OLD.container_id IS NOT NULL AND delta <> 0 THEN
      UPDATE public.feed_container_stock
        SET stock_lbs = stock_lbs - delta, updated_at = now()
        WHERE container_id = OLD.container_id AND feed_item_id = OLD.feed_item_id;
    END IF;
    IF delta <> 0 THEN
      UPDATE public.feed_items SET stock_qty = COALESCE(stock_qty,0) - delta WHERE id = OLD.feed_item_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER feed_purchases_stock_trg
  AFTER INSERT OR DELETE ON public.feed_purchases
  FOR EACH ROW EXECUTE FUNCTION public.apply_feed_purchase_stock();

CREATE OR REPLACE FUNCTION public.apply_feed_log_stock()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE delta numeric;
BEGIN
  IF TG_OP = 'INSERT' THEN
    delta := COALESCE(NEW.total_lbs, 0);
    IF NEW.container_id IS NOT NULL AND delta <> 0 THEN
      INSERT INTO public.feed_container_stock (container_id, feed_item_id, stock_lbs)
      VALUES (NEW.container_id, NEW.feed_item_id, -delta)
      ON CONFLICT (container_id, feed_item_id)
      DO UPDATE SET stock_lbs = feed_container_stock.stock_lbs - delta,
                    updated_at = now();
    END IF;
    IF delta <> 0 THEN
      UPDATE public.feed_items SET stock_qty = COALESCE(stock_qty,0) - delta WHERE id = NEW.feed_item_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    delta := COALESCE(OLD.total_lbs, 0);
    IF OLD.container_id IS NOT NULL AND delta <> 0 THEN
      UPDATE public.feed_container_stock
        SET stock_lbs = stock_lbs + delta, updated_at = now()
        WHERE container_id = OLD.container_id AND feed_item_id = OLD.feed_item_id;
    END IF;
    IF delta <> 0 THEN
      UPDATE public.feed_items SET stock_qty = COALESCE(stock_qty,0) + delta WHERE id = OLD.feed_item_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER feed_logs_stock_trg
  AFTER INSERT OR DELETE ON public.feed_logs
  FOR EACH ROW EXECUTE FUNCTION public.apply_feed_log_stock();

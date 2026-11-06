-- Jobs estimator v2: helper pay + crew size (time & cost breakdown) and an
-- itemized materials estimate. materials_items is a JSON array of
-- { key, label, qty, price } lines; materials_cost keeps holding the
-- computed materials total so reports/invoices don't change shape.
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS helper_rate numeric;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS helper_hours numeric;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS crew_size integer NOT NULL DEFAULT 1;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS materials_items jsonb;

-- Jobs: customer email, so an invoice can be sent by email as well as text.
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS email text;

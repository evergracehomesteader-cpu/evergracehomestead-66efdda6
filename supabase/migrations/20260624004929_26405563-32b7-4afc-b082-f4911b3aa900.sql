
ALTER TYPE public.animal_status ADD VALUE IF NOT EXISTS 'nursing';

ALTER TABLE public.animals
  ADD COLUMN IF NOT EXISTS nursing_started_at date,
  ADD COLUMN IF NOT EXISTS weaning_due date,
  ADD COLUMN IF NOT EXISTS recovery_complete_at timestamptz;

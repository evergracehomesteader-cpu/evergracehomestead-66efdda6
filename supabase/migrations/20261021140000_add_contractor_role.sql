-- Add 'contractor' to the app_role enum (access for Aaron's drywall business).
-- This file ONLY adds the enum value: Postgres cannot use a new enum value in
-- the same transaction that adds it, so the jobs table and the contractor
-- permission seeds that reference 'contractor' live in the next migration.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'contractor';

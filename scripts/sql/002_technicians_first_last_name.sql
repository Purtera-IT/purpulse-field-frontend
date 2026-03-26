-- Add first_name / last_name if 001 was applied before those columns existed.
-- Safe to run multiple times (PostgreSQL 11+).

ALTER TABLE technicians ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE technicians ADD COLUMN IF NOT EXISTS last_name TEXT;

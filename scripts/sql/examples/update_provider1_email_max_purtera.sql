-- One-off: set Provider1 (Field Nation id 931914) technician email for Entra /api/me matching.
-- Run against PurPulse Postgres (Supabase SQL editor, psql, etc.).
--
-- Before: if another technicians row already uses max@purtera-it.com, resolve the UNIQUE(email) conflict first.
-- Schema: this matches scripts/sql/001 (technicians.id UUID + fieldnation_mapping.internal_technician_id).
-- If your DB uses technician_uid as PK only, adjust the WHERE clause (see comment at bottom).

BEGIN;

-- Optional: confirm target row
-- SELECT t.id, t.email, fm.fieldnation_provider_id
-- FROM technicians t
-- JOIN fieldnation_mapping fm ON fm.internal_technician_id = t.id
-- WHERE fm.fieldnation_provider_id = '931914';

UPDATE public.technicians AS t
SET
  email = 'max@purtera-it.com',
  updated_at = now()
FROM public.fieldnation_mapping AS fm
WHERE fm.fieldnation_provider_id = '931914'
  AND fm.internal_technician_id = t.id;

COMMIT;

-- Verify
SELECT
  t.id,
  t.email,
  t.display_name,
  fm.fieldnation_provider_id
FROM public.technicians AS t
JOIN public.fieldnation_mapping AS fm ON fm.internal_technician_id = t.id
WHERE fm.fieldnation_provider_id = '931914';

-- If UPDATE matched 0 rows, your FK may use technician_uid (text) instead of id:
-- UPDATE public.technicians AS t
-- SET email = 'max@purtera-it.com', updated_at = now()
-- FROM public.fieldnation_mapping AS fm
-- WHERE fm.fieldnation_provider_id = '931914'
--   AND fm.internal_technician_id::text = t.technician_uid;

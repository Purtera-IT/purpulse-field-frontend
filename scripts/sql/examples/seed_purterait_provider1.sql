-- One-off seed: PurTeraIT test provider (Field Nation provider id + profile fields).
-- Requires 001 (technicians, fieldnation_mapping). Safe to re-run (upserts).
--
-- Parsed from request:
--   Field Nation provider id: 931914
--   Email: max@purtera-it.com (Entra sign-in; /api/me matches JWT email to this column)
--   Display: PurTeraIT Provider1
--   Location: Alpharetta, GA, US
--   Phone: (800) 334-9494

BEGIN;

WITH upsert_tech AS (
  INSERT INTO technicians (email, first_name, last_name, display_name, status, metadata)
  VALUES (
    'max@purtera-it.com',
    'PurTeraIT',
    'Provider1',
    'PurTeraIT Provider1',
    'active',
    jsonb_build_object(
      'phone', '(800) 334-9494',
      'location', 'Alpharetta, GA, US'
    )
  )
  ON CONFLICT (email) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    display_name = EXCLUDED.display_name,
    metadata = technicians.metadata || EXCLUDED.metadata,
    updated_at = now()
  RETURNING id
)
INSERT INTO fieldnation_mapping (fieldnation_provider_id, internal_technician_id)
SELECT '931914', id FROM upsert_tech
ON CONFLICT (fieldnation_provider_id) DO UPDATE SET
  internal_technician_id = EXCLUDED.internal_technician_id;

COMMIT;

-- Verify
SELECT t.id AS internal_technician_id,
       t.email,
       t.first_name,
       t.last_name,
       t.display_name,
       t.metadata,
       fm.fieldnation_provider_id
FROM technicians t
JOIN fieldnation_mapping fm ON fm.internal_technician_id = t.id
WHERE fm.fieldnation_provider_id = '931914';

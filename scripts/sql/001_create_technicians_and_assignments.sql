-- Purpulse: technicians, Field Nation mapping, assignment/runbook columns (draft DDL).
-- Target: Azure Database for PostgreSQL Flexible Server 16+.
-- Review with DBA before applying; adjust schema names (e.g. public vs core).
--
-- Canonical schema & alternate DDL notes: docs/plans/option-a-ddl-reconciliation.md
-- Primary key for technicians: id (UUID). This is the internal_technician_id used in APIs and query params.

-- ---------------------------------------------------------------------------
-- Technicians (canonical internal identity)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS technicians (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  email             TEXT UNIQUE,
  first_name        TEXT,
  last_name         TEXT,
  display_name      TEXT,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  idp_subject       TEXT UNIQUE,  -- e.g. Entra OID / B2C sub
  entra_object_id   TEXT,         -- Entra directory object id (guest/user) after invite; optional
  entra_invite_sent_at TIMESTAMPTZ,
  entra_invite_last_error TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_technicians_idp_subject ON technicians (idp_subject)
  WHERE idp_subject IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Field Nation provider identity → internal technician
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fieldnation_mapping (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  fieldnation_provider_id     TEXT NOT NULL,  -- FN user/worker id as string
  internal_technician_id      UUID NOT NULL REFERENCES technicians (id) ON DELETE CASCADE,
  UNIQUE (fieldnation_provider_id)
);

CREATE INDEX IF NOT EXISTS idx_fn_mapping_internal ON fieldnation_mapping (internal_technician_id);

-- ---------------------------------------------------------------------------
-- Jobs / assignments: extend existing jobs table OR use assignment view.
-- If your legacy table is named `jobs`, use ALTER; below is greenfield-friendly.
-- ---------------------------------------------------------------------------
-- Option A: columns on existing jobs table (run as ALTER on real table):
--
-- ALTER TABLE jobs ADD COLUMN IF NOT EXISTS assigned_to_internal_technician_id UUID REFERENCES technicians (id);
-- ALTER TABLE jobs ADD COLUMN IF NOT EXISTS runbook_version TEXT;
-- ALTER TABLE jobs ADD COLUMN IF NOT EXISTS runbook_json JSONB;
-- ALTER TABLE jobs ADD COLUMN IF NOT EXISTS evidence_requirements JSONB;
-- CREATE INDEX IF NOT EXISTS idx_jobs_assigned_technician ON jobs (assigned_to_internal_technician_id)
--   WHERE assigned_to_internal_technician_id IS NOT NULL;

-- Option B: minimal assignments table if jobs are external to Base44 sync:
CREATE TABLE IF NOT EXISTS job_assignments (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id                          TEXT NOT NULL,  -- Purpulse / Base44 job id string
  title                           TEXT,
  scheduled_date                  TEXT,           -- ISO date string for GET /api/assignments payload
  assigned_to_internal_technician_id UUID REFERENCES technicians (id) ON DELETE SET NULL,
  status                          TEXT NOT NULL DEFAULT 'offered',
  runbook_version                 TEXT,
  runbook_json                    JSONB,
  evidence_requirements           JSONB,
  fieldnation_work_order_id       TEXT,
  updated_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id)
);

CREATE INDEX IF NOT EXISTS idx_job_assignments_technician
  ON job_assignments (assigned_to_internal_technician_id)
  WHERE assigned_to_internal_technician_id IS NOT NULL;

-- Idempotency for webhook deliveries
CREATE TABLE IF NOT EXISTS webhook_idempotency (
  idempotency_key   TEXT PRIMARY KEY,
  received_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload_hash      TEXT,
  result_status     TEXT
);

COMMENT ON TABLE technicians IS 'Canonical internal technician; maps to IdP + Field Nation.';
COMMENT ON TABLE fieldnation_mapping IS 'Maps Field Nation provider id to technicians.id.';
COMMENT ON TABLE job_assignments IS 'Optional split if jobs row cannot be altered; prefer ALTER jobs in prod.';

-- ============================================================
-- Migration: 2026-03-17 — Evidence ML fields & supporting tables
-- Requires: Postgres ≥ 14, pgvector extension
-- Run: psql $DATABASE_URL -f migrations/20260317_add_evidence_fields.sql
-- ============================================================

BEGIN;

-- Enable pgvector if not already present
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- for gen_random_uuid()

-- ── 1. Extend evidence table ─────────────────────────────────────────
ALTER TABLE evidence
  ADD COLUMN IF NOT EXISTS thumbnail_url          TEXT,
  ADD COLUMN IF NOT EXISTS ocr_text               TEXT,
  ADD COLUMN IF NOT EXISTS embedding_vector       vector(1536),   -- text-embedding-3-small dim
  ADD COLUMN IF NOT EXISTS embedding_model        TEXT,           -- e.g. 'text-embedding-3-small'
  ADD COLUMN IF NOT EXISTS quality_score          DOUBLE PRECISION CHECK (quality_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS quality_flags          JSONB,          -- { blur: bool, dark: bool, obstructed: bool }
  ADD COLUMN IF NOT EXISTS sr_version             TEXT,           -- super-resolution model version applied
  ADD COLUMN IF NOT EXISTS raw_event_id           UUID REFERENCES raw_events(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS face_redaction_status  JSONB;          -- { faces_detected: int, redacted: bool, redacted_url: text }

-- Index for fast embedding similarity search (IVFFlat — tune lists for dataset size)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evidence_embedding
  ON evidence USING ivfflat (embedding_vector vector_cosine_ops)
  WITH (lists = 100);

-- Index for full-text OCR search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_evidence_ocr_text
  ON evidence USING gin (to_tsvector('english', coalesce(ocr_text, '')));

-- ── 2. raw_events — idempotent client event log ───────────────────────
CREATE TABLE IF NOT EXISTS raw_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_event_id TEXT        UNIQUE,              -- idempotency key from client
  job_id          TEXT        NOT NULL,
  entity_type     TEXT        NOT NULL,            -- e.g. 'evidence', 'time_entry'
  payload         JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed       BOOLEAN     NOT NULL DEFAULT false,
  processed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_raw_events_job_id    ON raw_events (job_id);
CREATE INDEX IF NOT EXISTS idx_raw_events_processed ON raw_events (processed) WHERE NOT processed;

-- ── 3. audit_log — immutable change history ───────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT        NOT NULL,
  entity_id    TEXT        NOT NULL,
  action       TEXT        NOT NULL,               -- 'create' | 'update' | 'delete' | 'closeout_override'
  actor_id     TEXT        NOT NULL,               -- user email or service account
  before_state JSONB,
  after_state  JSONB,
  reason       TEXT,                               -- required for override actions
  ts           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_entity   ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor    ON audit_log (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_ts       ON audit_log (ts DESC);

COMMIT;
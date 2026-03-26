-- Hybrid Entra (technician-only) — tracking columns for Graph invites.
-- Apply if 001 ran before these columns existed.

ALTER TABLE technicians ADD COLUMN IF NOT EXISTS entra_object_id TEXT;
ALTER TABLE technicians ADD COLUMN IF NOT EXISTS entra_invite_sent_at TIMESTAMPTZ;
ALTER TABLE technicians ADD COLUMN IF NOT EXISTS entra_invite_last_error TEXT;

COMMENT ON COLUMN technicians.entra_object_id IS 'Entra directory object id after invitation (guest/user).';
COMMENT ON COLUMN technicians.entra_invite_sent_at IS 'Set when Entra invitation was sent (hybrid technician flow).';
COMMENT ON COLUMN technicians.entra_invite_last_error IS 'Last Graph/invite error message for operators.';

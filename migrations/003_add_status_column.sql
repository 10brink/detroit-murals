-- Migration 003 — adds status column for approval workflow (approved/pending/rejected)

ALTER TABLE murals ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved';
CREATE INDEX IF NOT EXISTS murals_status_idx ON murals (status);

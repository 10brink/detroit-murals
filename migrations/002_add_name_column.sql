-- Migration 002 — adds name column to murals table (idempotent)

ALTER TABLE murals ADD COLUMN IF NOT EXISTS name TEXT;

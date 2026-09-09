-- Migration: optional TOTP two-factor authentication for staff logins
-- (Phase 7.9).
--
-- Run against the LIVE database with:
--   npx wrangler d1 execute ozyfi-db --remote --file=./worker/migrations/005_staff_2fa.sql
--
-- Safe against a database with real staff accounts: both are plain
-- ALTER TABLE ADD COLUMN calls, nullable/defaulted so every existing
-- staff row just gets totp_secret = NULL / totp_enabled = 0, i.e.
-- "2FA not set up" — exactly correct for every account that existed
-- before this shipped (2FA is opt-in per the brief, never forced on).
--
-- Note: SQLite/D1 has no "ADD COLUMN IF NOT EXISTS" — running this a
-- second time by mistake will fail both lines with "duplicate column
-- name" (harmless; nothing already applied gets corrupted).

ALTER TABLE staff ADD COLUMN totp_secret TEXT;
ALTER TABLE staff ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0;

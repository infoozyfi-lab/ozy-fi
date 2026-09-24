-- Priority-fixes brief (roadmap gap analysis), Bundle 1 Task 4 — add a
-- 'staff' role, sitting between 'kitchen' and 'manager'.
--
-- Run against the LIVE database with:
--   npx wrangler d1 execute ozyfi-db --remote --file=./worker/migrations/019_staff_role.sql
--
-- Unlike every other migration in this project, this ISN'T a plain
-- ADD COLUMN — staff.role has a DB-level CHECK constraint
-- (CHECK (role IN ('kitchen', 'manager', 'owner'))), and SQLite has no
-- ALTER TABLE ... DROP/MODIFY CONSTRAINT. Widening it requires SQLite's
-- standard table-rebuild pattern: create a new table with the desired
-- constraint, copy every row across completely unchanged, drop the old
-- table, then rename the new one into the old one's place. No existing
-- staff row's data changes — every current 'kitchen'/'manager'/'owner'
-- account keeps working exactly as it does today; this only widens the
-- SET of values a role can be going forward.
--
-- AUTOINCREMENT note: SQLite's ALTER TABLE RENAME updates the table's
-- own entry in sqlite_sequence (its AUTOINCREMENT bookkeeping) to the new
-- name automatically, and inserting rows with their original, explicit
-- `id` values (via INSERT ... SELECT below, not a bare INSERT that lets
-- SQLite assign new ids) still advances that bookkeeping to the highest
-- id actually inserted — so the next staff member created after this
-- migration still gets an id after the last real one, not id 1.
PRAGMA foreign_keys=OFF;

CREATE TABLE staff_new (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('kitchen', 'staff', 'manager', 'owner')),
  active        INTEGER NOT NULL DEFAULT 1,
  totp_secret   TEXT,
  totp_enabled  INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO staff_new (id, name, email, password_hash, role, active, totp_secret, totp_enabled, created_at)
SELECT id, name, email, password_hash, role, active, totp_secret, totp_enabled, created_at FROM staff;

DROP TABLE staff;
ALTER TABLE staff_new RENAME TO staff;

PRAGMA foreign_keys=ON;

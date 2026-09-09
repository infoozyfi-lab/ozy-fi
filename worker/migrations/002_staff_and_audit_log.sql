-- Migration: staff accounts + audit log (replaces the single shared
-- ADMIN_EMAIL/ADMIN_PASSWORD admin login).
--
-- Run against the LIVE database with:
--   npx wrangler d1 execute ozyfi-db --remote --file=./worker/migrations/002_staff_and_audit_log.sql
--
-- Uses IF NOT EXISTS throughout — unlike worker/schema.sql (which DROPs
-- and recreates everything and is only for a fresh database), this is
-- safe to run against a database that already has real orders/menu data.

CREATE TABLE IF NOT EXISTS staff (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('kitchen', 'manager', 'owner')),
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id   INTEGER REFERENCES staff(id),
  staff_name TEXT NOT NULL,
  action     TEXT NOT NULL,
  detail     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

-- Seed one Owner account from the current shared login, so there's
-- always at least one way in during the transition.
INSERT INTO staff (name, email, password_hash, role, active)
VALUES (
  'Owner',
  'hello@ozy.fi',
  'clwVMWFD595xbb1-NpYk1A:100000:jKUWzNpVJY7fJBSFegsLvt8bl1VTGBa2cMy8t_MwNbQ',
  'owner',
  1
);

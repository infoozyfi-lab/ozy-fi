-- Migration: delivery driver assignment (Phase 7.1).
--
-- Run against the LIVE database with:
--   npx wrangler d1 execute ozyfi-db --remote --file=./worker/migrations/003_delivery_driver.sql
--
-- Safe to run against a database with real order history — only adds a
-- new, nullable column, doesn't touch existing rows. SQLite/D1 doesn't
-- support "ADD COLUMN IF NOT EXISTS", so this uses a workaround: it
-- fails loudly (harmlessly) with "duplicate column name" if run twice,
-- which is fine — same as this project's other single-column additions.
--
-- Free-text driver name, not a separate `drivers` table/foreign key —
-- the brief for this feature explicitly left that choice open ("your
-- call"), and a free-text field is simplest for a business this size
-- (no need to pre-register drivers, add/remove them, etc.). Can be
-- upgraded to a real table later without losing data — existing
-- driver_name values would just become the seed data for it.

ALTER TABLE orders ADD COLUMN driver_name TEXT;

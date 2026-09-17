-- Migration: new table for growth features batch 2 (Feature 5 — scheduled
-- weekday offers, e.g. a Monday/Tuesday slow-day discount or a Friday
-- special the business owner brands themselves).
--
-- Run against the LIVE database with:
--   npx wrangler d1 execute ozyfi-db --remote --file=./worker/migrations/009_scheduled_offers.sql
--
-- Brand-new table, so this migration is just the CREATE TABLE statement
-- (nothing to backfill) — same shape as worker/schema.sql's copy, kept in
-- sync with it. Managed through the existing generic admin CRUD system
-- (lib/api-helpers.ts's ADMIN_TABLES + app/api/admin/[table]/**), not a
-- bespoke API.
--
-- `days` is a JSON-encoded array of day keys ('mon'..'sun', the same
-- convention admin_settings.opening_hours already uses). `start_time`/
-- `end_time` are 'HH:MM' 24h strings; both NULL/empty means "all day".
-- See lib/scheduledOffers.ts for the one place that decides whether an
-- offer is active right now (shared between the server, which enforces
-- it at order-creation time, and the client, which only uses it to show
-- a banner).
--
-- Feature 6 ("Ozy Wow Moment") needs no schema change at all: its odds
-- and reward percentage are plain admin_settings keys
-- (wow_moment_chance_percent, wow_moment_reward_percent), and its reward
-- coupon reuses the exact same `coupons` table/INSERT shape the
-- stamp-card reward already uses.

CREATE TABLE scheduled_offers (
  id                TEXT PRIMARY KEY,
  label             TEXT NOT NULL,
  days              TEXT NOT NULL DEFAULT '[]',
  start_time        TEXT,
  end_time          TEXT,
  discount_percent  REAL NOT NULL,
  active            INTEGER NOT NULL DEFAULT 1,
  sort_order        INTEGER NOT NULL DEFAULT 0
);

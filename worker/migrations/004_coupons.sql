-- Migration: coupon/discount code system (Phase 7.6).
--
-- Run against the LIVE database with:
--   npx wrangler d1 execute ozyfi-db --remote --file=./worker/migrations/004_coupons.sql
--
-- Safe against a database with real order history: CREATE TABLE IF NOT
-- EXISTS for the new table, plain ALTER TABLE ADD COLUMN for the two new
-- (nullable/defaulted) columns on `orders` — existing rows just get
-- discount_amount = 0 / coupon_code = NULL, meaning "no coupon", which is
-- correct for every order placed before this shipped.
--
-- Note: SQLite/D1 has no "ADD COLUMN IF NOT EXISTS" — if you run this
-- migration a second time by mistake, the two ALTER TABLE lines below
-- will fail with "duplicate column name" (harmless, nothing already
-- applied gets re-applied or corrupted) while the CREATE TABLE line is
-- safely a no-op either way.

CREATE TABLE IF NOT EXISTS coupons (
  code             TEXT PRIMARY KEY,
  discount_type    TEXT NOT NULL CHECK (discount_type IN ('percent', 'amount')),
  discount_value   REAL NOT NULL,
  active           INTEGER NOT NULL DEFAULT 1,
  expires_at       TEXT,
  min_order_amount REAL,
  usage_limit      INTEGER,
  times_used       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE orders ADD COLUMN coupon_code TEXT;
ALTER TABLE orders ADD COLUMN discount_amount REAL NOT NULL DEFAULT 0;

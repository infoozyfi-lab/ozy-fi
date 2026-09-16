-- Migration: optional Finnish translation columns for the bilingual site
-- (Finnish primary + English secondary).
--
-- Run against the LIVE database with:
--   npx wrangler d1 execute ozyfi-db --remote --file=./worker/migrations/006_bilingual_menu_fields.sql
--
-- Safe against a database with real menu/order history: every line is a
-- plain ALTER TABLE ADD COLUMN, all nullable — existing rows just get
-- NULL for every `_fi` column, which resolveText() (lib/menu-i18n.js)
-- treats identically to "not translated yet" and falls back to the
-- existing English/default column. Nothing existing changes meaning or
-- value; no data migration needed.
--
-- Note: SQLite/D1 has no "ADD COLUMN IF NOT EXISTS" — running this a
-- second time by mistake will fail on "duplicate column name" (harmless;
-- nothing already applied gets corrupted).

ALTER TABLE categories ADD COLUMN title_fi TEXT;
ALTER TABLE categories ADD COLUMN sub_fi TEXT;

ALTER TABLE products ADD COLUMN name_fi TEXT;
ALTER TABLE products ADD COLUMN description_fi TEXT;

ALTER TABLE option_groups ADD COLUMN title_fi TEXT;

ALTER TABLE options ADD COLUMN label_fi TEXT;

ALTER TABLE addons ADD COLUMN name_fi TEXT;

ALTER TABLE bundles ADD COLUMN title_fi TEXT;
ALTER TABLE bundles ADD COLUMN description_fi TEXT;

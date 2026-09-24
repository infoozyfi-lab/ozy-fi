-- Priority-fixes brief (roadmap gap analysis), Part 2 — 🔴 admin SEO
-- fields for products and categories.
--
-- Run against the LIVE database with:
--   npx wrangler d1 execute ozyfi-db --remote --file=./worker/migrations/017_admin_seo_fields.sql
--
-- Before this migration, the ONLY editable SEO lever anywhere in the
-- admin was one meta_description/meta_description_fi pair on products
-- (worker/migrations/014_product_meta_description.sql) — no SEO title
-- override, no canonical override, no index/noindex toggle, no OG image
-- override existed for products, and categories had NONE of this, not
-- even a meta description. This migration adds the same five fields to
-- BOTH tables, all nullable/zero-default so every existing row keeps
-- rendering exactly as it does today until an admin actually fills one
-- in — purely additive, same convention as every other migration here.
--
-- seo_title / seo_title_fi — overrides the auto-derived <title> when set
-- (see generateMetadata in app/(site)/[locale]/product/[id]/page.tsx and
-- .../menu/[category]/page.tsx for the exact fallback chain).
-- canonical_url — overrides the computed canonical path when set. Rare
-- (this project deliberately doesn't want to encourage pointing a
-- canonical somewhere that changes the page's own indexed identity —
-- see that fallback chain's comment for the one legitimate use this is
-- for), stored as a full path or absolute URL, admin's responsibility to
-- get right if used.
-- noindex — INTEGER (0/1) boolean, same style as products.active/
-- has_toppings. When 1: the page's own robots metadata says noindex,
-- and app/sitemap.ts excludes the row entirely.
-- og_image_url — overrides the Open Graph image when set; falls back to
-- the product/category's own `image` when not.
--
-- categories additionally gets meta_description/meta_description_fi
-- (products already had this from migration 014) — categories had no
-- SEO-relevant text field at all before this.
ALTER TABLE products ADD COLUMN seo_title TEXT;
ALTER TABLE products ADD COLUMN seo_title_fi TEXT;
ALTER TABLE products ADD COLUMN canonical_url TEXT;
ALTER TABLE products ADD COLUMN noindex INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN og_image_url TEXT;

ALTER TABLE categories ADD COLUMN meta_description TEXT;
ALTER TABLE categories ADD COLUMN meta_description_fi TEXT;
ALTER TABLE categories ADD COLUMN seo_title TEXT;
ALTER TABLE categories ADD COLUMN seo_title_fi TEXT;
ALTER TABLE categories ADD COLUMN canonical_url TEXT;
ALTER TABLE categories ADD COLUMN noindex INTEGER NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN og_image_url TEXT;

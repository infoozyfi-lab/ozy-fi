-- SEO meta description, separated from the customer-facing ingredients
-- description (see this task's brief).
--
-- Run against the LIVE database with:
--   npx wrangler d1 execute ozyfi-db --remote --file=./worker/migrations/014_product_meta_description.sql
--
-- products.description/description_fi previously did double duty: shown
-- to the customer on the product page as the ingredients list, AND reused
-- directly as the SEO <meta name="description"> (see generateMetadata in
-- app/(site)/[locale]/product/[id]/page.tsx). A good ingredient list and a
-- good search-result snippet aren't the same kind of writing, so these are
-- now separate, independently-editable fields.
--
-- Nullable, additive-only, same convention as every other _fi column in
-- this project (see 006_bilingual_menu_fields.sql) — every existing
-- product just gets NULL for both new columns, and generateMetadata falls
-- back to the existing ingredients-description / generic-sentence
-- behavior until the business owner fills these in, so nothing regresses.
ALTER TABLE products ADD COLUMN meta_description TEXT;
ALTER TABLE products ADD COLUMN meta_description_fi TEXT;

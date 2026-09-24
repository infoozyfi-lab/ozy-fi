-- ============================================================================
-- THROWAWAY TEST DATA — per-product size feature (option_groups.kind =
-- 'size', now scoped by the new `product_id` column — worker/migrations/
-- 021_option_group_product_id.sql). NOT real menu content. NOT part of
-- worker/seed.sql and NOT run automatically by anything in this project —
-- you have to execute this file yourself, on purpose, if you want to see
-- the new per-product UI against a real database rather than just the
-- code-level verification already done (see this feature's delivery
-- report).
--
-- Supersedes the prior pizza-size-feature brief's own
-- pizza-size-feature-demo.sql (now deleted): that file's own big warning
-- explained 'size' groups were GLOBAL at the time — one option group
-- affected every toppings-enabled product on the menu at once. That's no
-- longer true for 'size' specifically (every other kind is still global,
-- unchanged): a 'size' group now only affects the one product named by its
-- `product_id`. Re-running the OLD deleted script today wouldn't do
-- anything harmful, but it also wouldn't do anything useful — a 'size'
-- group with product_id left NULL is now simply ignored everywhere (see
-- lib/menu-i18n.ts's normalizeMenuBlob: only a 'size' group with a real
-- product_id gets attached to that product's sizeOptions).
--
-- This script creates TWO separate throwaway test products, each with its
-- own 'size' group and its own distinct tiers/prices, specifically to
-- prove genuine per-product independence — the exact thing this brief was
-- about — not just that one product can have a size selector.
--
-- Run with (adjust db name to your wrangler.jsonc):
--   npx wrangler d1 execute ozyfi-db --local --file=./worker/test-data/per-product-size-demo.sql
-- ============================================================================

-- ---- Test product A -------------------------------------------------------
-- Left INACTIVE by default so it never appears in a live/production menu
-- listing even if this script is ever run somewhere it shouldn't be. Made-up
-- base price — not any real Pizza Kuningas price.
INSERT INTO products (id, category_id, name, description, price, offer_price, image, tag, has_toppings, sort_order, active)
VALUES (
  'TEST-per-product-size-a',
  'pizzat',
  '[TEST] Per-Product Size Demo A — NOT REAL MENU DATA',
  'Throwaway product A for verifying per-product size pricing. Delete before going live — see per-product-size-demo-cleanup.sql.',
  8.00,
  NULL,
  'https://www.sourcesplash.com/i/random?q=pizza&w=900&h=700',
  'TEST — DO NOT SHIP',
  1,
  9999,
  0
);

-- Product A's OWN 'size' group — product_id ties it to TEST-per-product-size-a
-- alone. Three tiers, deliberately inserted out of price order (Regular,
-- then the pricier-sounding "Jumbo", then "Mega" last) to prove on-screen
-- order is governed by `sort_order` (ascending resulting price), not
-- insertion order or the option's own name.
INSERT INTO option_groups (id, title, title_fi, kind, icon, sort_order, product_id)
VALUES ('test-size-a', '[TEST] Size', '[TEST] Koko', 'size', NULL, 9999, 'TEST-per-product-size-a');

-- TEST A Regular — product A's own base price (8.00 €), price_delta 0.
INSERT INTO options (id, group_id, label, label_fi, price_delta, color, sort_order)
VALUES ('test-size-a-regular', 'test-size-a', 'TEST Regular', 'TEST Normaali', 0, NULL, 0);

-- TEST A Jumbo — 10.50 € (8.00 + 2.50).
INSERT INTO options (id, group_id, label, label_fi, price_delta, color, sort_order)
VALUES ('test-size-a-jumbo', 'test-size-a', 'TEST Jumbo', 'TEST Iso', 2.50, NULL, 1);

-- TEST A Mega — 13.00 € (8.00 + 5.00).
INSERT INTO options (id, group_id, label, label_fi, price_delta, color, sort_order)
VALUES ('test-size-a-mega', 'test-size-a', 'TEST Mega', 'TEST Perhe', 5.00, NULL, 2);

-- ---- Test product B ---------------------------------------------------
-- A SECOND, independent test product with its own base price and its own
-- 'size' group using DIFFERENT tier names, DIFFERENT deltas, and a
-- DIFFERENT number of tiers (two, not three) than product A — deliberately
-- dissimilar so a test that accidentally reads product A's sizeOptions for
-- product B would produce an obviously wrong price/label rather than one
-- that could coincidentally look right.
INSERT INTO products (id, category_id, name, description, price, offer_price, image, tag, has_toppings, sort_order, active)
VALUES (
  'TEST-per-product-size-b',
  'pizzat',
  '[TEST] Per-Product Size Demo B — NOT REAL MENU DATA',
  'Throwaway product B for verifying per-product size pricing is independent of product A. Delete before going live — see per-product-size-demo-cleanup.sql.',
  11.00,
  NULL,
  'https://www.sourcesplash.com/i/random?q=pizza&w=900&h=700',
  'TEST — DO NOT SHIP',
  1,
  9998,
  0
);

-- Product B's OWN 'size' group — a completely different id, product_id,
-- and set of options/ids/prices than product A's, and NONE of its option
-- ids collide with product A's (test-size-b-* vs test-size-a-*), so a
-- tampered request can never accidentally hit a real row belonging to the
-- other product by id collision alone — only by this feature's own
-- per-product sizeOptions lookup correctly rejecting the mismatch.
INSERT INTO option_groups (id, title, title_fi, kind, icon, sort_order, product_id)
VALUES ('test-size-b', '[TEST] Size', '[TEST] Koko', 'size', NULL, 9998, 'TEST-per-product-size-b');

-- TEST B Small — product B's own base price (11.00 €), price_delta 0.
INSERT INTO options (id, group_id, label, label_fi, price_delta, color, sort_order)
VALUES ('test-size-b-small', 'test-size-b', 'TEST Small', 'TEST Pieni', 0, NULL, 0);

-- TEST B Large — 15.75 € (11.00 + 4.75), well above product A's cheapest
-- tier (TEST Regular, 8.00 €) — so a tampered checkout that claims product
-- A's cheap sizeOptionId ('test-size-a-regular', delta 0) while actually
-- buying product B's Large is a real, obvious underpayment attempt
-- (paying as little as 11.00 € for something that should cost 15.75 €),
-- not a coincidence that happens to net out the same either way.
INSERT INTO options (id, group_id, label, label_fi, price_delta, color, sort_order)
VALUES ('test-size-b-large', 'test-size-b', 'TEST Large', 'TEST Iso', 4.75, NULL, 1);

-- After running this, look up either test product's own page (only
-- reachable if you flip `active` to 1 above, in a local/dev database
-- only — ProductPage renders whatever it's given even while hidden from
-- menu listings):
--   /en/product/TEST-per-product-size-a
--   /en/product/TEST-per-product-size-b
-- Each should show its OWN size selector with its OWN tiers/prices, and
-- changing one should have zero effect on the other or on any other
-- product's own page (every other pizza in the seed data has no 'size'
-- group at all, so they're unaffected either way — unlike the OLD global
-- mechanism this replaces).

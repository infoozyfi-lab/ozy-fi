-- Migration: store each order's marketing/analytics consent choice.
--
-- Run against the LIVE database with:
--   npx wrangler d1 execute ozyfi-db --remote --file=./worker/migrations/007_order_marketing_consent.sql
--
-- Fixes a real compliance gap: server-side ad-platform tracking (Meta/
-- TikTok Conversions API, GA4 Measurement Protocol — see
-- lib/server-tracking.js) previously fired for every order regardless
-- of whether the customer chose "Necessary only" in the cookie banner.
-- Storing the choice on the order itself means it's available again
-- later at refund/cancel time too, not just at the moment of purchase.
--
-- Safe against a database with real order history: a single nullable/
-- defaulted ALTER TABLE ADD COLUMN. Existing orders get `0` (no
-- consent) — the safe default, meaning old orders are simply never
-- retroactively tracked, which is correct (we never captured a real
-- consent choice for them).

ALTER TABLE orders ADD COLUMN marketing_consent INTEGER NOT NULL DEFAULT 0;

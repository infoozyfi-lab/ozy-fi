-- Migration: shared discount-value shape (color-palette-and-discount-
-- pattern brief, part 2 — "shared discount-value pattern"). See the
-- brief for the full spec.
--
-- Run against the LIVE database with:
--   npx wrangler d1 execute ozyfi-db --remote --file=./worker/migrations/011_shared_discount_value.sql
--
-- Every growth feature (first-order welcome discount, stamp card,
-- referral, scheduled weekday offer, Ozy Wow Moment) hardcoded its own
-- discount shape before this migration — most percent-only, referral
-- flat-euro-amount-only. This introduces ONE shared shape,
-- `{ type: 'percent' | 'amount', value: number }` (lib/types.ts's
-- DiscountValue — not new vocabulary, it mirrors this database's own
-- pre-existing `coupons.discount_type` / `coupons.discount_value`
-- columns), and extends every place a feature's discount SETTING is
-- stored to use it:
--
-- 1. admin_settings — a flat key/value table, so a `{type, value}` pair
--    becomes two sibling keys, `<setting>_type` + `<setting>_value`
--    (the same "two sibling keys for one concept" convention this table
--    already used for e.g. stamp_card_eligible_product_ids alongside
--    stamp_card_reward_percent). Four settings move over:
--      first_order_discount_percent -> first_order_discount_type/_value
--      stamp_card_reward_percent    -> stamp_card_reward_type/_value
--      wow_moment_reward_percent    -> wow_moment_reward_type/_value
--      referral_discount_amount     -> referral_discount_type/_value
--    Every one backfills type='percent' EXCEPT referral, which backfills
--    type='amount' — preserving its existing flat-euro-only behavior
--    exactly (this is the one feature that was never percent-based to
--    begin with; a wrong backfill here would silently change every
--    referral coupon's math). wow_moment_chance_percent is NOT touched —
--    it's an odds percentage (how often the reward triggers), not a
--    discount value, and is out of scope of this shape.
--    The OLD bare keys are left in place (never deleted — admin_settings
--    has no schema to migrate, and this project's migrations are
--    additive-only) but are no longer read by app/api/orders/route.ts or
--    the admin UI after this task; they're harmless, orphaned rows.
--
-- 2. scheduled_offers — a real table with its own discount_percent
--    column, so this adds real sibling columns instead: discount_type
--    (default 'percent', matching every existing row's actual meaning)
--    and discount_value (backfilled from discount_percent). The OLD
--    discount_percent column is NOT dropped (SQLite/D1 migrations in
--    this project are additive-only — see every prior migration file)
--    and stays NOT NULL, so the admin API continues writing it too
--    (0 when discount_type is 'amount') purely to satisfy that
--    constraint; discount_type/discount_value are what the app actually
--    reads going forward (lib/scheduledOffers.ts).
--
-- 3. stamp_card_pending_rewards — same treatment as scheduled_offers:
--    adds reward_type (default 'percent') and reward_value (backfilled
--    from reward_percent), for the same reason — a reward is banked at
--    EARN time (see migration 010's own comment) and needs to remember
--    what TYPE of reward it banked, not just what percentage. The old
--    reward_percent column stays NOT NULL and continues being written
--    (0 when reward_type is 'amount') for the same additive-only reason.
--
-- Explicitly NOT touched by this migration or the code changes that
-- follow it: any eligibility/trigger logic (who gets a welcome discount,
-- when a stamp card milestone is reached, whether a scheduled offer is
-- active right now, the Wow Moment chance roll) — this is a settings-
-- SHAPE unification only, per the brief's own explicit scope.

-- 1. admin_settings backfill — INSERT ... SELECT so a setting that was
-- never configured (no existing row) simply gets no new row either,
-- same "0/unset means disabled" behavior as before this migration.
INSERT INTO admin_settings (key, value)
  SELECT 'first_order_discount_type', 'percent'
  WHERE EXISTS (SELECT 1 FROM admin_settings WHERE key = 'first_order_discount_percent');
INSERT INTO admin_settings (key, value)
  SELECT 'first_order_discount_value', value FROM admin_settings WHERE key = 'first_order_discount_percent';

INSERT INTO admin_settings (key, value)
  SELECT 'stamp_card_reward_type', 'percent'
  WHERE EXISTS (SELECT 1 FROM admin_settings WHERE key = 'stamp_card_reward_percent');
INSERT INTO admin_settings (key, value)
  SELECT 'stamp_card_reward_value', value FROM admin_settings WHERE key = 'stamp_card_reward_percent';

INSERT INTO admin_settings (key, value)
  SELECT 'wow_moment_reward_type', 'percent'
  WHERE EXISTS (SELECT 1 FROM admin_settings WHERE key = 'wow_moment_reward_percent');
INSERT INTO admin_settings (key, value)
  SELECT 'wow_moment_reward_value', value FROM admin_settings WHERE key = 'wow_moment_reward_percent';

-- Referral is the one feature backfilling to 'amount', not 'percent' —
-- see this file's header.
INSERT INTO admin_settings (key, value)
  SELECT 'referral_discount_type', 'amount'
  WHERE EXISTS (SELECT 1 FROM admin_settings WHERE key = 'referral_discount_amount');
INSERT INTO admin_settings (key, value)
  SELECT 'referral_discount_value', value FROM admin_settings WHERE key = 'referral_discount_amount';

-- 2. scheduled_offers
ALTER TABLE scheduled_offers ADD COLUMN discount_type TEXT NOT NULL DEFAULT 'percent';
ALTER TABLE scheduled_offers ADD COLUMN discount_value REAL;
UPDATE scheduled_offers SET discount_value = discount_percent;

-- 3. stamp_card_pending_rewards
ALTER TABLE stamp_card_pending_rewards ADD COLUMN reward_type TEXT NOT NULL DEFAULT 'percent';
ALTER TABLE stamp_card_pending_rewards ADD COLUMN reward_value REAL;
UPDATE stamp_card_pending_rewards SET reward_value = reward_percent;

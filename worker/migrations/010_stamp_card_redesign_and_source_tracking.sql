-- Migration: stamp-card reward redesign, discount-source tracking, and
-- reorder tracking (see the cowork brief for the full spec).
--
-- Run against the LIVE database with:
--   npx wrangler d1 execute ozyfi-db --remote --file=./worker/migrations/010_stamp_card_redesign_and_source_tracking.sql
--
-- 1. orders.discount_source — nullable TEXT, records which SINGLE
--    mechanism won the "most favorable discount wins, never stacked"
--    comparison in app/api/orders/route.ts. Fixed vocabulary:
--    'manual_coupon' | 'referral' | 'first_order_welcome' | 'stamp_card'
--    | 'scheduled_offer' | NULL (no discount applied). A referral-minted
--    coupon is distinguished from a manually-created one the same way
--    the rest of this codebase already does — coupons.referral_email is
--    set only for the former (see app/api/referral/route.ts) — so this
--    column doesn't duplicate that distinction, it just records the
--    outcome of checking it. Existing rows get NULL (unknown source —
--    they predate this column and are never re-derived retroactively).
--
-- 2. orders.triggered_wow_moment — separate from discount_source on
--    purpose: the Ozy Wow Moment reward is minted for the customer's
--    NEXT order, not the order that rolled it, so that triggering order
--    may ALSO separately carry a real discount_source at the same time
--    (e.g. it could win the welcome discount AND roll a Wow Moment).
--    Folding this into discount_source would make the two mutually
--    exclusive, which they aren't.
--
-- 3. orders.is_reorder — set when this order was placed via the
--    "Reorder this" feature. Nothing previously marked this (traced
--    app/api/orders/[orderNum]/reorder/route.ts: it only rebuilds and
--    returns a cart, the actual order placement afterwards goes through
--    the fully generic POST /api/orders with no awareness of reorder
--    origin) — this column is new tracking, not a rename of anything.
--    Client-supplied and trusted as-is: purely informational/reporting,
--    never used in any price or discount calculation, same trust level
--    already given to marketing_consent.
--
-- 4. stamp_card_pending_rewards — brand-new table (no reusable "pending
--    reward" mechanism existed anywhere in this codebase — the referral
--    program's reward is minted immediately on submission, not held
--    pending; confirmed by search before writing this). Holds an earned
--    stamp-card reward for a phone number when the order that earned it
--    had no eligible item to apply it to, until an order that does have
--    one comes in. `reward_percent` is captured at EARN time (not looked
--    up again at redemption time) so a later admin change to the reward
--    percentage never retroactively changes an already-earned pending
--    reward. At most one un-redeemed (redeemed_at IS NULL) row per phone
--    is ever created — enforced in application logic
--    (app/api/orders/route.ts), not a DB constraint, consistent with how
--    phone matching is already done in JS (lib/api-helpers.ts's
--    phoneMatches(), last-6-digits) rather than in SQL everywhere else
--    in this project.

ALTER TABLE orders ADD COLUMN discount_source TEXT;
ALTER TABLE orders ADD COLUMN triggered_wow_moment INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN is_reorder INTEGER NOT NULL DEFAULT 0;

CREATE TABLE stamp_card_pending_rewards (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  phone              TEXT NOT NULL,
  reward_percent     REAL NOT NULL,
  earned_at          TEXT NOT NULL DEFAULT (datetime('now')),
  earned_order_num   TEXT NOT NULL,
  redeemed_at        TEXT,
  redeemed_order_num TEXT
);

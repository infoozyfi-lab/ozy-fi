-- ozy.fi D1 schema.
-- Run once against a fresh database:
--   npx wrangler d1 execute ozyfi-db --remote --file=./worker/schema.sql

DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS option_groups;
DROP TABLE IF EXISTS options;
DROP TABLE IF EXISTS addons;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS admin_settings;
DROP TABLE IF EXISTS bundles;
DROP TABLE IF EXISTS staff;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS coupons;

-- Phase: bilingual site (Finnish primary + English) — every `_fi` column
-- below is OPTIONAL. The pre-existing column (title/name/description/
-- label/sub) stays the single source of truth for the default/English
-- text and is never renamed — the `_fi` column is purely an optional
-- Finnish override, filled in via the admin panel over time. Anywhere
-- this text reaches a customer, it falls back to the non-_fi value when
-- the _fi one is empty (see lib/menu-i18n.js's resolveText()), so the
-- bilingual site works correctly even for products nobody has
-- translated yet.
-- SEO fields (worker/migrations/017_admin_seo_fields.sql) — see that
-- migration's header comment for the fallback chain each one feeds.
CREATE TABLE categories (
  id                   TEXT PRIMARY KEY,
  title                TEXT NOT NULL,
  title_fi             TEXT,
  sub                  TEXT,
  sub_fi               TEXT,
  image                TEXT,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  meta_description     TEXT,
  meta_description_fi  TEXT,
  seo_title            TEXT,
  seo_title_fi         TEXT,
  canonical_url        TEXT,
  noindex              INTEGER NOT NULL DEFAULT 0,
  og_image_url         TEXT
);

CREATE TABLE products (
  id              TEXT PRIMARY KEY,
  category_id     TEXT NOT NULL REFERENCES categories(id),
  name            TEXT NOT NULL,
  name_fi         TEXT,
  -- Customer-facing ingredients list, shown on the product page. Separate
  -- from meta_description/meta_description_fi below (worker/migrations/
  -- 014_product_meta_description.sql) — this field's job is describing
  -- what's in the product, not writing a search-result snippet.
  description     TEXT,
  description_fi  TEXT,
  -- SEO meta description (014_product_meta_description.sql) — what
  -- generateMetadata (app/(site)/[locale]/product/[id]/page.tsx) uses for
  -- <meta name="description"> and the Open Graph description, when set.
  -- Nullable: NULL means "not written yet", not "empty on purpose" — that
  -- distinction is what lets generateMetadata fall back to `description`/
  -- `description_fi` and then to a generic auto-generated sentence for any
  -- product the business owner hasn't filled this in for.
  meta_description    TEXT,
  meta_description_fi TEXT,
  price           REAL NOT NULL DEFAULT 0,
  offer_price     REAL,
  image           TEXT,
  tag             TEXT,
  has_toppings    INTEGER NOT NULL DEFAULT 0,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  active          INTEGER NOT NULL DEFAULT 1,
  -- Option-gating-and-extras-system brief, Task 3 — freeform per-product
  -- notes (a special prep note, an allergen callout, a temporary
  -- ingredient-substitution note — anything that doesn't fit any other
  -- field). Nullable, same bilingual-optional convention as every other
  -- `_fi` column here: NULL means "nothing written," not "empty on
  -- purpose," and components/ProductPage.tsx renders nothing at all when
  -- unset (see that file). Deliberately just two plain text columns, not a
  -- richer content model — this is content flexibility only (see that
  -- brief's own explicit scoping), never a per-product layout mechanism.
  additional_info    TEXT,
  additional_info_fi TEXT,
  -- Admin SEO fields (worker/migrations/017_admin_seo_fields.sql) — see
  -- that migration's header comment for the fallback chain each feeds.
  seo_title       TEXT,
  seo_title_fi    TEXT,
  canonical_url   TEXT,
  noindex         INTEGER NOT NULL DEFAULT 0,
  og_image_url    TEXT
);

-- kind: 'base' | 'sauce' | 'cheese' | 'sauce_stripe' | 'dip' | 'filling' |
--       'size' | 'extra'
-- title_fi only really shows to customers for 'filling' groups (rendered
-- as a "More fillings" category heading) — harmless to have it on every
-- kind regardless, one consistent column beats a special case.
CREATE TABLE option_groups (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  title_fi   TEXT,
  kind       TEXT NOT NULL,
  icon       TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  -- Per-product-size brief (worker/migrations/021_option_group_product_id.sql)
  -- — NULL (the default, every pre-existing group) means global, shared by
  -- every product, exactly as every kind but 'size'/'extra' still works
  -- today. Option-gating-and-extras-system brief, Task 2 — 'extra' now
  -- reads this column too (generalizing the exact same per-product
  -- mechanism 'size' already proved — see lib/menu-i18n.ts's
  -- normalizeMenuBlob), so a business owner can give any single product
  -- its own admin-defined extras (e.g. "Double meat +4.00€") without them
  -- leaking onto any other product. Every other kind still ignores this
  -- column and stays a single global list, unchanged.
  product_id TEXT REFERENCES products(id)
);

CREATE TABLE options (
  id          TEXT PRIMARY KEY,
  group_id    TEXT NOT NULL REFERENCES option_groups(id),
  label       TEXT NOT NULL,
  label_fi    TEXT,
  price_delta REAL NOT NULL DEFAULT 0,
  color       TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- type: 'drink' | 'dip' | 'snack'
CREATE TABLE addons (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,
  name       TEXT NOT NULL,
  name_fi    TEXT,
  price      REAL NOT NULL DEFAULT 0,
  image      TEXT,
  active     INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE orders (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  order_num          TEXT NOT NULL UNIQUE,
  customer_name      TEXT NOT NULL,
  address            TEXT NOT NULL,
  -- Round-2 fixes brief, Part 5 (worker/migrations/015_pickup_fulfillment.sql)
  -- — 'delivery' | 'pickup'. `address` stays required either way; a pickup
  -- order stores a clear sentinel string there instead of a real address
  -- (see that migration's comment for why the column itself isn't made
  -- nullable). Defaults to 'delivery' so every pre-existing order (all of
  -- which were, in effect, delivery orders before this brief) keeps
  -- reading exactly as it always has.
  order_type         TEXT NOT NULL DEFAULT 'delivery',
  -- Optional since the "email removal" change (Phase 7 remainder) — an
  -- empty string means the customer skipped it, not NULL (see
  -- app/api/orders/route.js for why: no migration needed this way).
  email              TEXT NOT NULL,
  phone              TEXT NOT NULL,
  notes              TEXT,
  total              REAL NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'received',
  payment_method     TEXT NOT NULL DEFAULT 'cod',
  -- Stripe card payments (worker/migrations/012_stripe_payments.sql).
  -- payment_status: 'cod' (default, nothing to track) | 'pending' (a card
  -- order was created and a Stripe PaymentIntent exists for it, unconfirmed)
  -- | 'paid' (the webhook confirmed the charge — sole source of truth, see
  -- app/api/webhooks/stripe) | 'failed' (card declined) | 'refunded' (Part C
  -- — the full charge was refunded) | 'partially_refunded' (Part C — some
  -- but not all of the charge was refunded). The two refund values, same as
  -- 'paid'/'failed', are set ONLY by the webhook (charge.refunded), never
  -- directly by the admin refund action — see worker/migrations/
  -- 013_refunds.sql. A COD order's "refund" is a plain manual marker with
  -- no Stripe involvement at all, so it never produces these two values.
  -- stripe_payment_intent_id is Stripe's own id for the PaymentIntent tied
  -- to this order, so the webhook (which only receives Stripe ids, never
  -- our order_num) can look up which order to update.
  payment_status     TEXT NOT NULL DEFAULT 'cod',
  stripe_payment_intent_id TEXT,
  -- Refunds (worker/migrations/013_refunds.sql) — set by the webhook from
  -- Stripe's own charge.refunded event, not trusted from the admin's
  -- refund request. NULL for every order that was never refunded.
  refunded_amount    REAL,
  refunded_at        TEXT,
  estimated_ready_at TEXT,
  -- Phase 7.1: who's delivering this order, set (optionally) from the
  -- Kanban board when moving an order to "on_the_way" — see
  -- components/admin/OrderKanban.js's DriverPromptModal. Free text, no
  -- separate drivers table (this business's current size doesn't need one
  -- — see the migration file's comment for the same reasoning).
  driver_name        TEXT,
  -- Phase 7.6 — set only when a coupon was actually applied and passed
  -- server-side re-validation in app/api/orders/route.js; discount_amount
  -- is the euro amount taken off (not the coupon's raw percent/amount
  -- value), so revenue reports never need to re-derive it. `total` above
  -- is always the POST-discount amount actually owed — same column every
  -- other query (analytics, refund tracking, /track) already reads.
  coupon_code        TEXT,
  discount_amount    REAL NOT NULL DEFAULT 0,
  -- Whether this customer had chosen "Accept all" (not "Necessary
  -- only") in the cookie banner at the moment they checked out — see
  -- context/StoreContext.js's placeOrder(). Server-side ad-platform
  -- tracking (lib/server-tracking.js) checks this before firing, both
  -- at purchase time and again at refund/cancel time, so consent is
  -- respected consistently rather than only at the initial moment.
  marketing_consent  INTEGER NOT NULL DEFAULT 0,
  -- Stamp-card redesign / discount-source tracking (worker/migrations/
  -- 010_stamp_card_redesign_and_source_tracking.sql) — see that file for
  -- the full explanation of all three columns below. discount_source
  -- records which single mechanism won the "most favorable discount"
  -- comparison in app/api/orders/route.ts: 'manual_coupon' | 'referral' |
  -- 'first_order_welcome' | 'stamp_card' | 'scheduled_offer' | NULL.
  discount_source    TEXT,
  -- Separate from discount_source: the Ozy Wow Moment reward is minted
  -- for the customer's NEXT order, not this one, so this order may ALSO
  -- separately carry a real discount_source at the same time.
  triggered_wow_moment INTEGER NOT NULL DEFAULT 0,
  -- Set when this order was placed via the "Reorder this" feature.
  -- Client-supplied and trusted as-is — informational/reporting only,
  -- never used in any price or discount calculation.
  is_reorder         INTEGER NOT NULL DEFAULT 0,
  -- Priority-fixes brief (roadmap gap analysis), Bundle 1 Task 1
  -- (worker/migrations/020_order_locale.sql) — the locale the customer
  -- was ordering in, captured once here so every later email-sending
  -- trigger point (the Stripe webhook, an admin status change, a
  -- refund) can send in the right language without needing a live
  -- browser session/cookie to read it from. 'fi' | 'en'.
  locale             TEXT NOT NULL DEFAULT 'en',
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE order_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES orders(id),
  product_id  TEXT,
  name        TEXT NOT NULL,
  qty         INTEGER NOT NULL DEFAULT 1,
  line_total  REAL NOT NULL DEFAULT 0,
  details     TEXT,
  -- Growth features (Phase: reorder/loyalty/referral) — a JSON-encoded
  -- `{ selection?, bundleId?, bundleItems? }` blob, the same structured
  -- pricing data POST /api/orders already verifies against real D1 prices
  -- (see lib/pricing.ts) before writing this row, saved here too so the
  -- "Reorder this" feature can rebuild a real, exact cart line later —
  -- recomputed at CURRENT prices, never by trusting `line_total` above —
  -- instead of only having the human-readable `details` strings, which
  -- were never enough to know exactly which option ids were chosen. NULL
  -- for any order placed before this column existed, and for a plain
  -- (non-customizable) product/addon line, which has nothing to store.
  selection_json TEXT
);

CREATE TABLE admin_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Bundles/combos, e.g. "3 Pizza + 1.5L Lemonade — €45".
-- `slots` is a JSON array describing what goes in the bundle:
--   { "kind": "choice", "categoryId": "pizza", "qty": 3, "label": "Choose any Pizza" }
--   { "kind": "fixed",  "productId": "lemonade-15l", "qty": 1, "label": "Lemonade 1.5L" }
-- Choice slots let the customer pick+customize any product from that
-- category (base price already covered by `price`; only customization
-- extras — toppings, size, base/sauce/cheese — add to the total).
-- Fixed slots are included as-is, no customer choice.
CREATE TABLE bundles (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  title_fi        TEXT,
  description     TEXT,
  description_fi  TEXT,
  image           TEXT,
  price           REAL NOT NULL DEFAULT 0,
  slots           TEXT NOT NULL DEFAULT '[]',
  active          INTEGER NOT NULL DEFAULT 1,
  sort_order      INTEGER NOT NULL DEFAULT 0
);

-- Growth features batch 2 (Feature 5 — scheduled weekday offers). One row
-- per admin-configured offer (e.g. a Monday/Tuesday slow-day discount, or
-- a Friday special) — managed through the SAME generic admin CRUD system
-- as categories/products/option_groups/options/addons/bundles (see
-- lib/api-helpers.ts's ADMIN_TABLES and app/api/admin/[table]/**), not a
-- bespoke new API, matching this project's existing pattern for "an
-- admin-manageable list of things."
--
-- `days` is a JSON-encoded array of day keys ('mon'..'sun', the SAME
-- convention admin_settings.opening_hours already uses — see
-- app/admin/dashboard/page.tsx's OPENING_HOURS_DAYS) — same "store
-- structured data as JSON in a TEXT column, don't parse it server-side
-- beyond what's needed" precedent as bundles.slots.
-- `start_time`/`end_time` are 'HH:MM' 24h strings; both NULL/empty means
-- "all day" (see lib/scheduledOffers.ts, which is the one place that
-- decides whether an offer is active right now — shared between the
-- server, which enforces it, and the client, which only uses it for a
-- banner).
-- discount_type/discount_value (added by worker/migrations/
-- 011_shared_discount_value.sql — see that file's header) are the
-- shared discount-value shape (lib/types.ts's DiscountValue) this
-- feature was folded into, and are what the app actually reads
-- (lib/scheduledOffers.ts). discount_percent is kept (NOT NULL, still
-- written by the admin API — 0 when discount_type is 'amount') per this
-- project's additive-only migration convention; it's otherwise unused.
CREATE TABLE scheduled_offers (
  id                TEXT PRIMARY KEY,
  label             TEXT NOT NULL,
  days              TEXT NOT NULL DEFAULT '[]',
  start_time        TEXT,
  end_time          TEXT,
  discount_percent  REAL NOT NULL,
  discount_type     TEXT NOT NULL DEFAULT 'percent',
  discount_value    REAL,
  active            INTEGER NOT NULL DEFAULT 1,
  sort_order        INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_options_group ON options(group_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_stripe_payment_intent_id ON orders (stripe_payment_intent_id);

-- Failed-login tracking for /api/admin/login rate-limiting. Rows older
-- than a day are pruned opportunistically by the login route itself, so
-- this table stays small — no scheduled cleanup job needed.
-- purpose ('login' | 'referral', worker/migrations/016_referral_rate_
-- limit.sql) keeps the admin-login rate limit and the public referral-
-- endpoint rate limit as two independent counters sharing one table,
-- rather than one shared counter that could let referral traffic lock
-- an admin out of their own login (or vice versa) just for sharing an IP.
CREATE TABLE login_attempts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ip           TEXT NOT NULL,
  attempted_at TEXT NOT NULL DEFAULT (datetime('now')),
  purpose      TEXT NOT NULL DEFAULT 'login'
);
CREATE INDEX idx_login_attempts_ip_purpose ON login_attempts(ip, purpose, attempted_at);

-- Individual staff accounts, replacing the single shared ADMIN_EMAIL/
-- ADMIN_PASSWORD login. password_hash is "<saltB64url>:<iterations>:
-- <hashB64url>" — see lib/adminAuth.js's hashPassword/verifyPassword,
-- never a plaintext password.
-- role: 'kitchen' | 'staff' | 'manager' | 'owner' — see lib/adminAuth.ts's
-- ROLES and the per-route requireRole() calls for exactly what each can
-- do. 'staff' (worker/migrations/019_staff_role.sql) sits between
-- 'kitchen' and 'manager': same order/manage-orders access as kitchen,
-- plus toggling a product's availability, but none of manager's
-- pricing/discount/settings access.
CREATE TABLE staff (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('kitchen', 'staff', 'manager', 'owner')),
  active        INTEGER NOT NULL DEFAULT 1,
  -- Phase 7.9 — optional per-account TOTP 2FA (see lib/totp.js). NULL
  -- secret + 0 means "never set up"; a secret can also sit here with
  -- totp_enabled still 0 while a setup is in progress (generated but not
  -- yet confirmed with a correct code) — only a successful /api/admin/
  -- 2fa/confirm call flips totp_enabled to 1. Storing the raw base32
  -- secret (not further encrypted) mirrors how SESSION_SECRET etc. are
  -- handled in this project already — D1 access itself is the trust
  -- boundary, same as every other column here.
  totp_secret   TEXT,
  totp_enabled  INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Who did what, when. Written by lib/auditLog.js's logActivity() from
-- the handful of routes that mutate something worth attributing to a
-- person (order status changes, menu/settings edits, staff changes).
-- staff_id is nullable and has no ON DELETE behavior specified (D1/
-- SQLite default: deleting a still-referenced staff row does not cascade
-- or block — the FK is descriptive here, not enforced unless the
-- connection has `PRAGMA foreign_keys = ON`); staff_name is denormalized
-- specifically so history still reads correctly if a staff row is later
-- removed. A NULL staff_id with a "(legacy admin login)" suffix on
-- staff_name marks an action taken through the transitional shared
-- ADMIN_EMAIL/ADMIN_PASSWORD login rather than a real staff account.
CREATE TABLE audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  staff_id   INTEGER REFERENCES staff(id),
  staff_name TEXT NOT NULL,
  action     TEXT NOT NULL,
  detail     TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_audit_log_created ON audit_log(created_at);

-- Phase 7.6 — coupon/discount codes. `code` is the primary key (stored
-- normalized: trimmed + uppercased by the API before every read/write),
-- not an auto id — a coupon code IS its own natural identifier, and
-- storing it uppercase means "save10"/"SAVE10"/" Save10 " all match the
-- one row instead of silently creating near-duplicates.
CREATE TABLE coupons (
  code             TEXT PRIMARY KEY,
  discount_type    TEXT NOT NULL CHECK (discount_type IN ('percent', 'amount')),
  discount_value   REAL NOT NULL,
  active           INTEGER NOT NULL DEFAULT 1,
  expires_at       TEXT,
  min_order_amount REAL,
  usage_limit      INTEGER,
  times_used       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  -- Priority-fixes brief (roadmap gap analysis), Part 4 — nullable
  -- ceiling on the euro amount a single coupon can ever discount off one
  -- order, applied in lib/coupons.ts's validateCoupon (clamped after
  -- computeDiscountAmount, before finalTotal). NULL (the default) means
  -- uncapped — every coupon created before worker/migrations/
  -- 018_coupon_max_discount.sql keeps behaving exactly as before.
  max_discount_amount REAL,
  -- Growth features (Phase: referral program) — set only on a coupon
  -- auto-created by the Footer referral form (POST /api/referral),
  -- normalized (trimmed + lowercased) so a second submission from the
  -- same address is recognized regardless of capitalization. NULL for
  -- every coupon created any other way (admin-created, or the stamp-card
  -- loyalty reward — see app/api/orders/route.ts). Not UNIQUE at the
  -- schema level (SQLite allows multiple NULLs in a UNIQUE column anyway,
  -- so it would only really constrain non-null values, and the "does this
  -- email already have a code" check already reads-before-writing in the
  -- API route) — kept as a plain indexed-by-nothing column for simplicity
  -- at this feature's scale, same reasoning as other small tables here.
  referral_email   TEXT
);

-- Stamp-card redesign (Part A of the stamp-card/discount-source/
-- Customer-Source brief) — see worker/migrations/
-- 010_stamp_card_redesign_and_source_tracking.sql for the full
-- explanation. Holds an earned stamp-card reward for a phone number
-- when the order that earned it had no eligible item to apply it to,
-- until an order that does have one comes in. At most one un-redeemed
-- row per phone at a time (enforced in app/api/orders/route.ts).
-- reward_type/reward_value (added by worker/migrations/
-- 011_shared_discount_value.sql) are the shared discount-value shape
-- this feature was folded into, and are what the app actually reads.
-- reward_percent is kept (NOT NULL, still written on every insert — 0
-- when reward_type is 'amount') per this project's additive-only
-- migration convention; it's otherwise unused.
CREATE TABLE stamp_card_pending_rewards (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  phone              TEXT NOT NULL,
  reward_percent     REAL NOT NULL,
  reward_type        TEXT NOT NULL DEFAULT 'percent',
  reward_value       REAL,
  earned_at          TEXT NOT NULL DEFAULT (datetime('now')),
  earned_order_num   TEXT NOT NULL,
  redeemed_at        TEXT,
  redeemed_order_num TEXT
);

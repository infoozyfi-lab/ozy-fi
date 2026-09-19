# Round 2 fixes & pickup — delivery report

Implements all 7 parts of `cowork-brief-round2-fixes-and-pickup.md`. Each
part's code changes are commented in-place with a `Round-2 fixes brief,
Part N` marker, so you can grep for `Round-2 fixes brief` to find every
touch point for a given part.

Verification method used throughout: every touched `.ts`/`.tsx` file was
run through the TypeScript compiler in strict mode (no `any`, no
implicit errors) after each edit, and again as a final sweep — 0
diagnostics across all 22 touched TypeScript/TSX files. Cross-file
wiring (props threaded between components, shared helper functions,
context fields) was verified by tracing every call site with grep, not
by running the app live — this sandbox has no installed dependencies to
build or run the actual Next.js/Cloudflare Workers dev server against a
real database. Where that distinction matters for a specific part, it's
called out below.

---

## Part 1 — Delivery fee & minimum order, enforced server-side

**What changed:**
- `app/api/orders/route.ts` now reads `admin_settings.minimum_order` and
  `admin_settings.delivery_fee` and applies both — but only when
  `orderType === 'delivery'` (coordinated with Part 5's pickup work, per
  the brief). A delivery order under the configured minimum is rejected
  with a 400 before it's ever written to the database. The delivery fee
  is added to the final total *after* discounts are applied, so it's
  never itself discounted.
- `components/CheckoutModal.tsx` now shows the delivery fee as its own
  line item and includes it in every total shown to the customer
  (cart step, mini-summary in steps 2–3, the pay button's amount) —
  before any payment is initiated. An under-minimum order shows an
  informational notice in the cart rather than blocking the "Continue"
  button there, because order type isn't chosen until step 2 and pickup
  has no minimum; the real enforcement is the server-side check above,
  which surfaces as the existing order-error banner if a customer
  reaches step 3 with a delivery order still under minimum.
- `components/DeliveryPageClient.tsx` (the `/delivery` info page) was
  **not modified** — it already reads `delivery_fee`, `minimum_order`,
  and `delivery_postal_codes` directly from the same `admin_settings`
  table via `PublicSettings`, so it can't drift out of sync with what
  checkout enforces; both read the same source of truth.

**How to verify live:** set `delivery_fee` and `minimum_order` in admin
settings, add an item under the minimum to the cart, choose delivery at
checkout, and confirm (a) the fee shows in the running total before you
pay, (b) submitting still under minimum is rejected with a clear
message, (c) `/delivery` shows the same numbers you set.

**Verified by:** tracing (no live database in this sandbox to actually
place a test order against).

---

## Part 2 — Real H1 on category pages

**What changed:**
- `app/(site)/[locale]/menu/[category]/page.tsx` now resolves the
  category's real title and passes it to `MenuPageClient` as
  `categoryTitle`.
- `components/MenuPageClient.tsx` renders that as an `<h1>` when
  present.
- `components/MenuSection.tsx` gained `hideHeading`/`headingTag` props;
  on category pages it's told to hide its own heading (so there's no
  H1 + near-duplicate-H2 pair) and, on the plain `/menu` page (which
  doesn't set `categoryTitle`), still renders its own heading as
  before — so `/menu` keeps its single H1 and each `/menu/<category>`
  page gets a real, distinct one.

**Verified by:** tracing + reading the rendered JSX structure for both
call sites (`/menu` and `/menu/[category]`).

---

## Part 3 — Related products & category cross-links

**What changed:**
- `components/ProductPage.tsx` gained a `RelatedProducts` block shown
  under every product's detail (customizable or not): products sharing
  the same category or tag (category matches ranked first, capped to
  6), each a real link to that product's page. If the current product
  is a *fixed* slot in a bundle (not just eligible for a choice slot),
  a callout links to that bundle instead of/alongside the related list.
- `app/(site)/[locale]/menu/[category]/page.tsx` runs a SQL query
  (`getRelatedCategories`) that finds other categories sharing a real
  product `tag` with the current category, ranked by overlap count,
  capped to 3 — genuinely data-driven rather than a hardcoded pair.
  I deliberately did **not** implement the brief's own illustrative
  example (vegaani → voner) as a hardcoded link: I checked
  `worker/seed.sql` and voner's products aren't actually tagged
  `Vegan` there, so that specific pair doesn't hold against this
  project's real data. The query finds whatever overlaps genuinely
  exist instead, per the brief's own instruction not to force links
  that don't make sense. `components/MenuPageClient.tsx` renders
  whatever the query returns (nothing, if there's no genuine overlap).

**Verified by:** tracing + a manual check of the tag-overlap query
logic against the seed data's actual tag values (real database not
available to run the query against live).

---

## Part 4 — Checkout UX polish (4 items)

1. **Step 3 styling** — coupon block and discount banners now use
   dedicated CSS classes (`.cs-coupon-block`, `.cs-discount-banner`,
   etc.) instead of inline `style={{...}}`, matching the rest of the
   checkout's styling approach.
2. **Step transitions** — each step's content is wrapped in a
   `.checkout-step-panel` keyed by step number, with a CSS fade-in
   keyframe (respecting `prefers-reduced-motion`).
3. **Add-to-cart feedback** — `components/OrderBar.tsx`'s item-count
   badge now gets a brief pulse animation whenever the count increases
   (never on decrease, never on first render).
4. **`.cs-total` visual weight** — heavier font weight, larger size,
   and a solid top border in `app/globals.css`.

**Verified by:** tracing (CSS keyframes and class wiring read back to
confirm no conflicting selectors; not seen animating in a browser).

---

## Part 5 — Real pickup fulfillment, end-to-end

**What changed:**
- **Schema:** `worker/migrations/015_pickup_fulfillment.sql` adds
  `orders.order_type TEXT NOT NULL DEFAULT 'delivery'` (additive,
  every existing row keeps behaving as a delivery order).
  `worker/schema.sql` updated to match. `orders.address` is
  deliberately kept `NOT NULL` (SQLite/D1 can't cheaply drop that
  constraint) — a pickup order stores a clear sentinel string,
  `PICKUP_ADDRESS_SENTINEL = 'Pickup — no delivery address'`, exported
  from `app/api/orders/route.ts`, so every existing display of
  `orders.address` still renders sensible plain text even on a surface
  this brief didn't specifically update.
- **Checkout:** a delivery/pickup toggle in `CheckoutModal.tsx` (reusing
  the existing `.payment-method`/`.pay-option` styling — no new CSS for
  the toggle itself). Choosing pickup replaces the address/postal-code
  fields with a real store-info box (address + today's actual hours,
  via `formatHoursRows`) and skips the delivery fee/minimum/zone checks
  entirely.
- **API:** `app/api/orders/route.ts` conditionally validates
  address/postal code and the delivery zone/fee/minimum only for
  `orderType === 'delivery'`; the same "never trust the client" pricing
  path applies to both order types.
- **Admin Kanban:** pickup orders get a badge (both the compact card
  grid and the detail modal) and pickup-appropriate button text ("Mark
  ready for pickup →" / "Mark picked up →") instead of delivery
  wording, so staff don't dispatch a driver for a pickup order. The
  underlying `OrderStatus` pipeline (`received → preparing →
  on_the_way → delivered`) was **deliberately left unchanged** — see
  "Known limitations" below.
- **Downstream:** invoice, `/track`, and the reorder flow (via a
  one-shot `sessionStorage` handoff, same pattern as the existing
  reorder-cart flag) all show/carry the correct order type.
- **`/pickup` page:** the old honest-placeholder block is replaced with
  real ordering instructions (no invented facts — it just explains how
  to order for pickup using the flow that now actually exists).

**Known limitation (disclosed, not fixed in this pass):** pickup
orders still flow through the same delivery-shaped status pipeline
(`on_the_way` = "ready, awaiting pickup", `delivered` = "picked up")
rather than a separate pickup-specific status set. This was a
deliberate scope decision — restructuring `OrderStatus` project-wide
was out of this part's explicit scope — and is layered over with
pickup-aware labels/badges instead. If a dedicated pickup status model
is wanted later, that's a larger, separate piece of work.

**Verified by:** tracing every touch point end-to-end (schema →
checkout → API → admin → invoice → track → reorder) by reading each
file; **not** tested against a live database or a real Stripe/COD order
placed through the running app, since neither is available in this
sandbox.

---

## Part 6 — Homepage honesty fixes (3 items)

1. **Fake reviews removed** — `components/Hero.tsx` no longer shows
   "★ 4.8 · 320+ reviews" (there was no reviews table or
   `AggregateRating` schema backing it anywhere in the codebase). The
   now-unused `.hero-meta .stars` CSS rule was removed too.
2. **Real "Open now" state** — new `lib/openingHours.ts` (`isOpenNow`)
   reuses the existing Helsinki-time helpers from
   `lib/scheduledOffers.ts` rather than duplicating them, and checks
   the real `admin_settings.store_closed` override plus today's
   configured hours. `Hero.tsx` now shows "Closed" when actually
   closed instead of a hardcoded "Open now".
3. **Story section** — `components/Story.tsx`'s confident but invented
   founding-story copy (`t.story.p1/p2/p3`) is replaced with the exact
   same `.placeholder-block` treatment (and the same
   `t.about.storyPlaceholder` copy) that `/about` already uses, rather
   than inventing a different fake story to paper over the
   inconsistency. The stats row underneath (made-to-order / menu size /
   days open) was left as-is — it wasn't part of this item's scope.

**Verified by:** tracing (the Helsinki-time logic mirrors an
already-established, presumably-tested helper; not observed running
against the real current time/settings in a browser).

---

## Part 7 — Category field in Product JSON-LD

**What changed:** `app/(site)/[locale]/product/[id]/page.tsx`'s
`Product` JSON-LD now includes a `category` field, using the
already-computed `categoryTitle` value (the same one used for the
breadcrumb) — omitted entirely, rather than emitted as an empty
string, in the fallback case where the category lookup fails.

**Verified by:** tracing (one-line, low-risk addition; not checked
against Google's Rich Results Test live).

---

## Standing rules — confirmed intact

- No use of `cookies()` from `next/headers` anywhere touched this
  round.
- All touched files pass a strict-mode TypeScript check with no `any`.
- `package.json`'s `overrides` block (`@opennextjs/cloudflare`,
  `@opennextjs/aws`, `@stripe/react-stripe-js`) and `.npmrc`
  (`legacy-peer-deps=true`) were both re-checked at the end and are
  intact — neither was touched by this round's changes.
- Parts were kept independent except the explicit Part 1/Part 5
  coordination (delivery fee/minimum only applying to delivery
  orders), which is implemented consistently in both places.

## Overall honesty note

Nothing in this round was run against a live Next.js dev server,
a real D1 database, or a real Stripe/COD payment — this sandbox has
no installed dependencies and no database to run against. Every change
was verified by strict TypeScript compilation (per-file, then as a
full sweep of all 22 touched files with 0 diagnostics) and by manually
tracing every cross-file call site (props passed, context fields read,
shared helpers called) with grep and direct reads. The one factual
check I could and did run against real project data was Part 3's
category-overlap logic, which I checked against `worker/seed.sql`
rather than trusting the brief's own example. If you can run this
against a staging environment before it goes live, I'd treat that as
the real test — particularly for Part 5 (money is involved) and Part 1
(the minimum-order rejection path).

# Audit fixes — delivery report

Seven independent parts, each scoped to its own files so one part's changes never touch another part's files. Standing rules followed throughout: no `cookies()` from `next/headers`, full TypeScript `strict: true` with no `any` in new code, no invented business facts (address/phone/hours/coordinates/delivery areas — every real-world value still comes from `admin_settings` with a graceful fallback when unset).

No `node_modules`/network access was available in this sandbox (same as every prior round on this project), so verification means: a full-file syntax/type check of every touched file via TypeScript's compiler API (`ts.transpileModule` under `strict: true`), isolated `ts.createProgram` runs with hand-written stub type declarations for a couple of trickier structural questions, manual tracing of every call site and prop flow, and read-throughs of the rendered logic. Nothing was clicked through in a running dev server or browser — that's flagged per part below wherever it matters.

---

## Part 1 — Stale order/address after a card payment starts

**The bug, precisely:** once `placeOrder()` creates a card PaymentIntent, the checkout modal's "←" back button let a customer return to the address step, edit it, hit Continue, and land back on the same payment step — which, since the pending order/PaymentIntent state was never cleared, silently re-showed the *original* order's payment form. If they then paid, Stripe charged the correct (frozen) amount, but the order row in the database still had the *old* address — the customer believes they updated it; the kitchen doesn't know.

**Fix:** once a card payment is pending, the back button is disabled and replaced with an explicit "Cancel and start over" action. That action calls a new endpoint, `POST /api/orders/[orderNum]/cancel`, which verifies the phone number matches (same check the existing order-tracking endpoint uses), cancels the Stripe PaymentIntent (non-fatal if that call fails), and marks the order `cancelled`. Only after that completes does the checkout modal reset and let the customer start a fresh order with their edited address. The displayed amount is also now frozen to the server-authoritative value returned when the PaymentIntent was created, rather than being recomputed from live cart state, so it can't silently drift even if something in the background changes the cart while checkout is hidden.

Traced, not clicked through live: the full state flow (`CheckoutModal` → `CardPaymentStep` → Stripe) checks out on paper, and the cancel endpoint mirrors the existing refund endpoint's pattern closely, but the actual Stripe cancel-and-recreate round trip was not exercised against a live Stripe test key.

**Files:** `context/StoreContext.tsx`, `components/CardPaymentStep.tsx`, `components/CheckoutModal.tsx`, new `app/api/orders/[orderNum]/cancel/route.ts`.

## Part 2 — FAQ's stale "coming soon" card-payment copy

The "How can I pay?" answer still said card payment was coming soon, months after it shipped. Updated in both languages to describe the real options: card, Google Pay, and Apple Pay online, or cash on delivery.

**Files:** `lib/i18n/en.tsx`, `lib/i18n/fi.tsx`.

## Part 3 — Placeholder page styling + missing sitemap entries

The four new informational pages (`/about`, `/contact`, `/delivery`, `/pickup`) and the FAQ page had unstyled placeholder blocks and were missing from `sitemap.ts` entirely, so search engines had no path to discover them. Added a proper `.placeholder-block`/`.placeholder-eyebrow` visual treatment matching the site's existing design language, and added all five routes to the sitemap with reasonable priorities.

**Files:** `app/globals.css`, `app/sitemap.ts`.

## Part 4 — Sticky Pay button disappears during card entry

Done together with Part 1 since it touches the same files. The Pay button now lives in `CheckoutModal.tsx`'s sticky footer rather than inside `CardPaymentStep.tsx` itself, using a `forwardRef`/`useImperativeHandle` handle (`CardPaymentHandle`) so the parent can trigger Stripe's `confirmPayment()` without lifting Stripe's own hooks out of the child. This was specifically checked against TypeScript `strict: true` with an isolated compiler run (stubbed React types) to confirm the pattern type-checks cleanly.

**Files:** `components/CardPaymentStep.tsx`, `components/CheckoutModal.tsx`.

## Part 5 — Desktop grid for the menu/product listing

The menu category listing was a single-column flex list at every screen width, including on desktop, where it left most of the page empty. Added `min-width` media queries (900px: 2 columns, 1280px: 3 columns) that switch `.menu-category` to CSS Grid and reflow each `.menu-item` into an image-forward card (`flex-direction: column-reverse` reorders the existing thumb/info elements visually without touching JSX or DOM order, so accessibility/tab order is unaffected). The existing mobile breakpoint (`max-width: 860px`) was deliberately left untouched, per scope.

**Known adjacent limitation, flagged rather than fixed:** `.menu-category`'s `scroll-margin-top: 130px` is a separate, CSS-only offset from the JS-computed sticky-tabs/scroll-spy offset fixed in Part 6.6 below. Extending into that third mechanism felt like scope creep beyond "small fix" for a part that only asked about the grid — left as-is.

**Files:** `app/globals.css`.

## Part 6 — Ten smaller fixes

**6.1 — iOS auto-zoom on checkout/tracking inputs.** `#checkoutForm input`/`.track-form input` font-size raised from `0.95rem` to `1rem` — iOS Safari auto-zooms into any input under 16px, which this was just under.

**6.2 — Tap targets too small.** `.cs-qty` quantity buttons grown from 22×22px to 40×40px; `.cs-remove` given generous invisible padding (`padding: 10px; margin: -6px`) so its tap target grows without visually crowding the adjacent quantity control.

**6.3 — Missing trust signal on the card payment step.** Added a small "secure payment" notice with a lock icon directly above the Stripe `PaymentElement`, plus inline SVG icons (replacing emoji) for the cash/card payment-method picker, both using `currentColor` so they inherit the existing `.pay-icon` color states automatically.

**6.4 — Footer/Visit page showing fake hardcoded contact info.** `components/Footer.tsx` and `components/Visit.tsx` previously hardcoded a fake email/phone/address. Both now read real values from `admin_settings` (via a new `contactInfo` field on `StoreContext`, sourced from `/api/menu`'s raw settings blob) and fall back gracefully — Footer omits an unset email/phone link entirely (it renders on every page, so a bracketed "not set" placeholder would look like a site-wide error), while the dedicated Visit page shows the existing `t.visit.notSet` placeholder text, since that's the appropriate place for it.

**6.5 — Wrong nav labels.** The header nav said "Offers" and "Gift Cards" — links that actually go to the "Our story" and "Find us" sections (the Footer already used the correct wording). Renamed the two i18n keys and every usage site.

**6.6 — Sticky category tabs sit at the wrong offset, breaking scroll-spy.** The tabs bar's `top` offset and the scroll-spy's scroll-target offset were both hardcoded pixel constants that assumed a fixed header height. Replaced with a `ResizeObserver`-driven measurement of the real header and tabs-bar heights at runtime, so both stay correct if either element's height ever changes (a promo banner, a longer/wrapped category name, a different viewport width).

**6.7 — Destructive admin actions gated behind `window.confirm()`.** Six call sites (delete a menu resource, delete a bundle, delete a scheduled offer, cancel an order, disable your own 2FA, force-disable a staff member's 2FA) all used the unstylable, thread-blocking browser-native confirm dialog. Built one reusable `ConfirmDialog` component matching the admin panel's existing modal visual language (the same overlay/card look `OrderKanban.tsx`'s own ETA/driver/refund prompt modals already used) and wired it into all six sites with the standard "open a pending-action state, run the real action only on confirm" pattern. The order-cancel flow needed one extra care point: the original code closed the order-detail modal the instant Cancel was clicked (via an `await`), so `setViewingOrder(null)` was moved into the actual confirm handler instead, so nothing closes until the admin genuinely confirms.

**6.8 — Flat, hard-to-scan admin tab strip.** The 13-tab top nav (more than any non-Owner role sees, but still a lot) was one long wrapped row with no indication of which tabs relate to which part of the app. Grouped into six labeled clusters (Overview, Operations, Marketing, Customers, Insights, Admin) — purely a layout change; tab selection/routing/badges are untouched, and a group with no visible tabs for the current role (e.g. Kitchen, which only sees Orders) simply doesn't render its label.

**6.9 — Missing alt text on two admin thumbnails.** The product-photo and bundle-photo preview thumbnails (`components/admin/ResourceForm.tsx`, `components/admin/BundleManager.tsx`) both had `alt=""`, which is only correct for purely decorative images — these are meaningful previews an admin uses to confirm the right photo is set. Given real, contextual alt text instead (the field's own label, or the bundle's title when one's been entered).

**6.10 — Floating order bar sits under the iPhone home-indicator area.** The `.order-bar`'s `bottom: 16px` didn't account for `env(safe-area-inset-bottom)`, so on a device with a reserved bottom safe area the bar could sit right where the OS's own swipe gesture area is. Added `bottom: calc(16px + env(safe-area-inset-bottom, 0px))` (and the equivalent for the `.on-product-page` variant), with the plain pixel value kept first as a fallback for any browser with no `env()` support at all.

**Files across Part 6:** `app/globals.css`, `components/CheckoutModal.tsx`, `lib/i18n/en.tsx`, `lib/i18n/fi.tsx`, `components/Header.tsx`, `components/Visit.tsx`, `components/Footer.tsx`, `context/StoreContext.tsx`, `components/MenuSection.tsx`, new `components/admin/ConfirmDialog.tsx`, `components/admin/ResourceManager.tsx`, `components/admin/BundleManager.tsx`, `components/admin/ScheduledOffersManager.tsx`, `components/admin/OrderKanban.tsx`, `components/admin/MyAccountModal.tsx`, `components/admin/ResourceForm.tsx`, `app/admin/dashboard/page.tsx`.

Not verified live: 6.6's `ResizeObserver` behavior and 6.10's safe-area rendering both need an actual device/browser to see, not just trace — the logic was checked by reading it carefully, not by measuring pixels on screen.

## Part 7 — Restaurant structured data

The `Restaurant` JSON-LD block in `app/(site)/[locale]/layout.tsx` was missing several fields Google's rich-result guidelines look for. Added, all with the same graceful-fallback-if-unset pattern the existing phone/email/address fields already used:

- **`openingHoursSpecification`** — built from the real per-day hours already stored in `admin_settings.opening_hours` (the same data the Visit page displays), one entry per day that's actually open.
- **`areaServed`** — built from the same comma-separated postal-code/prefix list `admin_settings.delivery_postal_codes` already stores and checkout already enforces, so this can't drift out of sync with the delivery area the site actually honors.
- **`hasMenu`** — a straightforward link to the site's own `/menu` page per locale; not a business fact, just a real route.
- **`geo`** (GeoCoordinates) — there was no existing coordinates field anywhere in this codebase (no admin_settings key, no admin UI field), so nothing was invented here. Two new optional fields, "Map latitude"/"Map longitude", were added to the Restaurant Settings admin form; the `geo` block only appears once an owner actually fills them in, and stays omitted until then, exactly like an unset phone number.
- **`address` restructuring** — now a full `PostalAddress` object with `addressCountry: 'FI'` added. That country code isn't a new invented fact: it's the same fixed constant this codebase already hardcodes elsewhere for this single-country business (the invoice page's literal "Suomi" line, the +358-only phone validation). The street address itself is still passed through as one `streetAddress` string rather than split into street/city/postal-code parts — attempting to parse that structure out of a free-text field the admin can type anything into risked silently mislabeling data, which felt like the wrong trade for a nice-to-have schema refinement.

**Files:** `app/(site)/[locale]/layout.tsx`, `app/admin/dashboard/page.tsx` (new `geo_lat`/`geo_lng` settings fields, plus a per-field `step` override so the browser's native number-input validation doesn't reject a precise coordinate and silently block the Save button).

Not verified live: the emitted JSON-LD wasn't run through Google's Rich Results Test — only checked by hand against the schema.org field names/shapes for `Restaurant`, `OpeningHoursSpecification`, `PostalAddress`, and `GeoCoordinates`.

---

## Cross-cutting checks

- `package.json`'s `overrides` block and `.npmrc` were both confirmed intact before packaging (this project has a history of losing one or both between rounds).
- Every file touched across all seven parts was run through a `strict: true` TypeScript syntax/type check (`ts.transpileModule`); all pass with zero errors.
- `app/globals.css`'s braces were confirmed balanced after all additions.
- Grepped for leftover references to anything removed or renamed this round (the old `amountLabel` prop, the old `header.offers`/`header.giftCards` i18n keys, any remaining live `window.confirm()` call) — none found; the only remaining text matches are code comments explaining what was replaced.
- Confirmed the earlier bundle-slug-and-navigation brief's deliverables (auto-slug in `BundleManager.tsx`, the dedicated product edit page) are still present and untouched by this round's changes.

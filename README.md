# ozy.fi — Next.js (SSR) + Cloudflare Workers + D1

Pizza/kebab/burger ordering site. Next.js 14 (App Router), server-rendered
via **OpenNext on Cloudflare Workers** (not a static export — see
"Architecture" below), with a D1 database backing the menu, orders, and the
admin panel.

> **Branch note:** this SSR architecture currently lives on the
> `ssr-migration` branch only. Production (`main`, the live ozy.fi domain)
> still runs the older static-export Worker (`worker/index.js`) until the
> switch-over (see `ozy-fi-ssr-roadmap-bn.md` — Phase 6). Don't assume
> `main` and `ssr-migration` behave the same.

## Architecture

- **Rendering:** `@opennextjs/cloudflare` builds the Next.js app into a
  Cloudflare Worker that does real server-side rendering per request —
  `output: 'export'` is **not** used. Every `app/api/**/route.js` that
  touches D1 has `export const dynamic = 'force-dynamic'` and reads
  `env`/`ctx` via `getCloudflareContext({ async: true })`.
- **Real, crawlable URLs:** `/menu` (full menu), `/menu/[category]` (one per
  category), `/product/[id]` (one per product) — each with its own
  `generateMetadata()` (title, description, Open Graph for products) pulled
  live from D1. The homepage (`/`) keeps the original single-page
  browsing/cart experience; these are additional real pages, not a
  replacement.
  ⚠️ **Known gap:** page `<head>` metadata is server-rendered correctly, but
  the actual menu/product *content* on these pages is still fetched
  client-side (`StoreContext` → `fetch('/api/menu')`). Full server-rendered
  content is the next major piece of SSR work — see the roadmap doc,
  Phase 10, item 3.
- **Caching:** `/api/menu` is cached at the edge and in the browser
  (`Cache-Control`), and explicitly purged (`purgeMenuCache()`) on every
  admin write, so admin changes show up immediately without waiting out the
  cache window.

## Current state

- ✅ **Menu** is fully database-driven — categories, products, sizes,
  toppings, base/sauce/cheese, "more fillings", sauce stripes, dip, and the
  drinks/dips/snacks upsell all come from `/api/menu` (D1).
- ✅ **Checkout** saves real orders (`POST /api/orders` → `orders` /
  `order_items`) with **server-side price re-validation** — the client's
  price is never trusted as-is; each line is checked against the real
  product/addon price in D1, and the grand total is recomputed server-side
  before saving. (Known limitation: topping/size price deltas aren't fully
  re-verified yet, only floor-checked — see roadmap Phase 10, item 3's
  neighbor note.)
- ✅ **Order tracking** (`/track`): order number + phone (last-6-digit
  match), *or* phone-only lookup for customers who lost their order number
  (returns a short recent-orders list, no address/email exposed). The
  customer's own device also remembers recent orders (`localStorage`) and
  offers a one-tap shortcut. Shows a live status timeline and, once staff
  accept the order with an ETA, an estimated ready time.
- ✅ **Cookie consent banner** (Accept all / Necessary only / Cookie
  settings) gates all marketing/analytics scripts — nothing loads until the
  customer consents.
- ✅ **Tracking & Analytics infrastructure** (GA4, Meta Pixel + Conversions
  API, TikTok Pixel + Events API, Microsoft Clarity) — fully built and
  wired (client `dataLayer` events + server-side purchase/refund events),
  but **inert until IDs/tokens are entered** in the admin panel's
  *Tracking & Analytics* tab. Test-mode fields included for each platform.
- ✅ **Admin panel** (`/admin` → `/admin/dashboard`) — top-level tabs:
  - **Dashboard** — KPI tiles, 30-day revenue chart, best-sellers,
    revenue-by-category, order-status mix, peak-hours chart. All computed
    live by `GET /api/admin/analytics`.
  - **Orders** — Kanban board (New → Preparing → Out for delivery →
    Delivered), with: a repeating sound alert until new orders are
    accepted (tap-to-unlock, since browsers block autoplay), color-coded
    order age, an ETA prompt (with the order's items shown) when accepting,
    a collapsible cancelled-orders section, and a tap-to-open order detail
    panel. A "Switch to list view" toggle keeps the old table view
    available. **Kitchen Display** (`/admin/kitchen`) is a separate,
    distraction-free full-screen version of the same board (large text,
    no other admin tabs) meant for a dedicated kitchen tablet/phone.
  - **Menu & Pricing** — opens to a "Product Management" landing page
    (Products / Categories / Options & Toppings / Add-ons / Bundles as big
    cards); each drills in with a "← Back" to return. **Products** and
    **Add-ons** support bulk actions: filter by category, multi-select,
    then bulk price change (± %, ± €, or set to €X) or bulk in-stock/
    out-of-stock — plus a one-tap out-of-stock toggle and a "Duplicate"
    button per item outside bulk mode.
  - **Homepage Display** — the homepage featured card (real product or
    custom banner) and the "Popular right now" picker (up to 3 products).
  - **Customers** — a customer list derived from order history.
  - **Reports** — a "Today's Closing Summary" card (today's revenue,
    order counts by stage, today's best-sellers) plus the full 7/30-day
    KPI comparisons, best-sellers, revenue-by-category, and status tables.
  - **Tracking & Analytics** — GA4/Meta/TikTok/Clarity IDs and access
    tokens, plus a test-mode field/toggle for each platform. Saves to
    `admin_settings`; access tokens are stored under `secret_`-prefixed
    keys, which `/api/menu` explicitly excludes from its public response.
  - **Settings** — now just restaurant info (name, contact, address,
    opening hours, minimum order, delivery fee) and the "Close store now"
    emergency toggle (blocks new orders site-wide, server-side enforced,
    shows a banner to customers).
- `data/menu.js` is only used to (re)generate `worker/seed.sql` for the
  initial database load — the live site never reads it directly.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Build

```bash
npm run build
```

This runs an env-var-guarded build script that invokes
`@opennextjs/cloudflare build` (see `package.json`) — it produces a
Cloudflare Worker bundle in `.open-next/`, **not** a static `out/`
directory. `--dangerouslyUseUnsupportedNextVersion` is required because
this project is on Next.js 14.2.5.

## Deploy (Cloudflare Workers + D1)

This project deploys via **Cloudflare Workers Builds** (CI triggered on
git push), not a manual local `wrangler deploy`. On the `ssr-migration`
branch, every push to GitHub triggers a Cloudflare build automatically,
publishing to a **preview URL** (`ssr-migration-<worker-name>.<account>.
workers.dev`) — production traffic on the real domain is untouched until
the Phase 6 switch-over (branch merge to `main`).

### 1. Database schema (one-time, or when `worker/schema.sql` changes)

Run the contents of `worker/schema.sql` in the Cloudflare D1 console for
the `ozyfi-db` database. This file is the source of truth for table
structure — keep it in sync with any `ALTER TABLE` run directly against
the live database (a drift here was one of the Phase 10 audit findings).

### 2. Seed data (first-time setup only)

Run `worker/seed.sql` in the D1 console to load the starting menu. To
regenerate it from `data/menu.js`:

```bash
npm run generate-seed
```

After this initial load, use the **admin panel** to manage the menu day to
day — there's no need to touch SQL again for normal price/menu changes.

### 3. Set the admin login secrets

In the Cloudflare dashboard → Workers & Pages → the Worker → Settings →
Variables and Secrets, add as **Secrets** (not build variables):

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

### 4. Create the R2 bucket for uploaded images (one-time)

```bash
npx wrangler r2 bucket create ozyfi-images
```

This backs the "upload a photo" button in the admin panel (category/
product/addon images) and the homepage banner upload. Images are stored in
R2 and served back through the Worker at `/images/<key>`. Skipping this
step still works — you just fall back to pasting image URLs by hand.

### 5. Push to deploy

```bash
git push origin ssr-migration
```

Cloudflare Workers Builds picks up the push automatically, runs the build
(`@opennextjs/cloudflare build`), and publishes a new version to the
preview URL. Check the Deployments tab in the Cloudflare dashboard for
build logs and the "Total Upload" size (Workers Free plan caps a Worker at
3 MB compressed — Workers Paid, $5/month, raises this to 10 MB).

## Notes

- **Product photos**: menu items currently use placeholder photography.
  Update the `image` field per product/category from the admin panel
  whenever real photography is available — this is a launch-readiness
  item, not a code task.
- **Checkout**: cash on delivery only. No online payment gateway
  (Stripe/Paytrail) is integrated yet.
- **Order tracking** (`/track`, linked from the header/footer): order
  number + phone (last-6-digit match, tolerant of `+358…` vs `0…`), or a
  phone-only lookup for a short recent-orders list. `GET
  /api/orders/:orderNum` requires a matching `?phone=` — an order number
  alone can't pull up a stranger's details.
- **Dashboard analytics**: `GET /api/admin/analytics` (admin-auth
  required) returns everything the Dashboard and Reports tabs render,
  including today-specific figures for the Reports tab's Closing Summary
  — computed in SQL aggregate queries against `orders`/`order_items`, so
  it stays fast as order history grows.
- **Settings storage**: `admin_settings` is a generic key/value table.
  Keys prefixed `secret_` (currently: ad-platform access tokens) are
  never included in `/api/menu`'s public response — see
  `app/api/menu/route.js`. Everything else in that table (including
  Pixel/Measurement IDs, which aren't sensitive) is public by design.
- **Known audit findings not yet fixed**: see `ozy-fi-ssr-roadmap-bn.md`,
  Phase 10, for the full prioritized list (real server-rendered menu
  content, admin login rate-limiting, httpOnly auth cookies, Schema.org/
  JSON-LD, multi-user admin roles, image optimization, TypeScript/tests).

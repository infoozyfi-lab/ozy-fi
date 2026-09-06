# ozy.fi — Next.js + Cloudflare Workers + D1

Pizza/kebab/burger ordering site. Next.js (App Router) frontend, deployed as a
static export served by a Cloudflare Worker, with a D1 database for orders.

## Current state (important — read before deploying)

- ✅ Menu listing (`/`) reads from `/api/menu`, which reads from D1.
- ✅ Checkout really saves orders: `POST /api/orders` writes to the `orders` /
  `order_items` tables and returns a real order number.
- ✅ Admin login (`/admin`) + dashboard (`/admin/dashboard`) — **but the
  dashboard currently only lists orders and lets you change order status.**
  There is no product/category/option editing screen yet, even though the
  backend routes for it already exist (`/api/admin/<table>` — see
  `worker/index.js`). Until that UI is built, editing the menu means editing
  `data/menu.js` and re-running the seed script below.
- ✅ Product customization (toppings, base, sauce, cheese, fillings, sauce
  stripe, dip) and the drinks/dips/snacks upsell still read from
  `data/menu.js` at build time, not from the database. Changing prices in
  the database for those items won't show up on the product page yet.

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

Produces a static export in `out/` (via `output: 'export'` in
`next.config.mjs`).

## Deploy (Cloudflare Workers + D1)

### 1. Create the D1 database (one-time)

```bash
npx wrangler d1 create ozyfi-db
```

Copy the `database_id` it prints into `wrangler.jsonc` under
`d1_databases[0].database_id` (a value is already there from earlier setup —
replace it if you created a new database).

### 2. Create the tables and load the menu

```bash
npx wrangler d1 execute ozyfi-db --remote --file=./worker/schema.sql
npx wrangler d1 execute ozyfi-db --remote --file=./worker/seed.sql
```

`schema.sql` creates all tables (drops them first, so re-running is safe —
but it wipes existing data, including orders, so don't re-run it in
production once you have real orders). `seed.sql` loads the 67 products, 13
categories, all pizza customization options, and the drinks/dips/snacks
add-ons from `data/menu.js`.

If you ever edit `data/menu.js` and want to regenerate `worker/seed.sql`
from it:

```bash
npm run generate-seed
```

Then re-run the `wrangler d1 execute ... seed.sql` command above.

### 3. Set the admin login secrets

The admin panel checks against two Worker secrets — not stored in the
database:

```bash
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put ADMIN_PASSWORD
```

You'll be prompted to enter each value.

### 4. Build and deploy

```bash
npm run build
npx wrangler deploy
```

This builds the static site into `out/` and deploys the Worker (which both
serves those static files and handles every `/api/*` route — see
`wrangler.jsonc`).

## Notes

- **Product photos**: every menu item shows a photo representative of its
  category rather than individually sourced photos. Swap the `image` field
  in `data/menu.js` (and re-seed) for real product photography whenever you
  have it.
- **Checkout**: cash on delivery only, two-step flow (delivery details →
  payment/review).
- **Order tracking**: `GET /api/orders/:orderNum` returns an order's status
  and items — not yet wired to a page in the frontend.

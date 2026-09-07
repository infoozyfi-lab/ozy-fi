# ozy.fi — Next.js + Cloudflare Workers + D1

Pizza/kebab/burger ordering site. Next.js (App Router) frontend, deployed as a
static export served by a Cloudflare Worker, with a D1 database backing the
menu, orders, and the admin panel.

## Current state

- ✅ **Menu** (`/`) is fully database-driven: categories, products, sizes,
  toppings, base/sauce/cheese, "more fillings", sauce stripes, dip, and the
  drinks/dips/snacks upsell all come from `/api/menu` (D1) — nothing is
  hardcoded in the frontend anymore.
- ✅ **Checkout** really saves orders: `POST /api/orders` writes to `orders` /
  `order_items` and returns a real order number.
- ✅ **Admin panel** (`/admin` → `/admin/dashboard`) has two tabs:
  - **Orders** — view every order and change its status (received →
    preparing → on the way → delivered / cancelled) from a dropdown.
  - **Menu & Pricing** — add, edit, and delete Categories, Products, Option
    Groups + Options (base, sauce, cheese, toppings, fillings, sauce
    stripe, dip), and Add-ons (drinks/dips/snacks) — no code changes or
    redeploys needed for everyday menu/price updates.
- `data/menu.js` is now only used to (re)generate `worker/seed.sql` for the
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

Produces a static export in `out/` (via `output: 'export'` in
`next.config.mjs`).

## Deploy (Cloudflare Workers + D1)

### 1. Create the D1 database (one-time)

```bash
npx wrangler d1 create ozyfi-db
```

Copy the `database_id` it prints into `wrangler.jsonc` under
`d1_databases[0].database_id`.

### 2. Create the tables and load the menu (one-time)

```bash
npx wrangler d1 execute ozyfi-db --remote --file=./worker/schema.sql
npx wrangler d1 execute ozyfi-db --remote --file=./worker/seed.sql
```

`schema.sql` creates all tables (drops them first — re-running wipes
existing data, including orders, so don't re-run it once you have real
orders). `seed.sql` loads the starting menu from `data/menu.js`.

After this initial load, use the **admin panel** to manage the menu day to
day — there's no need to touch SQL again for normal price/menu changes.

If you ever want to regenerate `worker/seed.sql` from `data/menu.js` (e.g.
to reset back to the original starting menu):

```bash
npm run generate-seed
```

### 3. Set the admin login secrets

```bash
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put ADMIN_PASSWORD
```

### 4. Create the R2 bucket for uploaded images (one-time)

```bash
npx wrangler r2 bucket create ozyfi-images
```

This backs the "upload a photo" button in the admin panel (category/product/
addon images). Images are stored in R2 and served back through the Worker at
`/images/<key>`, so no separate CDN or public bucket config is needed. If you
skip this step the site still works — you just fall back to pasting image
URLs by hand.

### 5. Build and deploy

```bash
npm run build
npx wrangler deploy
```

## Notes

- **Product photos**: menu items show category-representative photos.
  Update the `image` field per product/category from the admin panel
  whenever you have real photography.
- **Checkout**: cash on delivery only, two-step flow (delivery details →
  payment/review).
- **Order tracking**: `GET /api/orders/:orderNum` returns an order's status
  and items — not yet wired to a page in the frontend.
- **Pricing constants** (large-size upcharge) live in the `admin_settings`
  table and are exposed publicly via `/api/menu` for the storefront to
  price orders — no secrets are ever stored in that table.

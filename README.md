# ozy.fi — Next.js

Pizza/kebab/burger ordering site, rebuilt in Next.js (App Router) from the original
single-file HTML. Same color palette, a kotipizza.fi-style full-screen product page,
a photo for every menu category, and a two-step checkout with cash on delivery.

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

This produces a static export in the `out/` folder (configured via `output: 'export'`
in `next.config.mjs`) — a plain folder of HTML/CSS/JS, no server required.

## Deploy to Cloudflare Pages

**Option A — connect your Git repo (recommended):**
1. Push this project to GitHub/GitLab.
2. In Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. Build command: `npm run build`
4. Build output directory: `out`
5. Deploy.

**Option B — direct upload (no Git):**
1. Run `npm install && npm run build` locally.
2. In Cloudflare dashboard → Workers & Pages → Create → Pages → Upload assets.
3. Upload the contents of the `out/` folder.

## Notes

- **Product photos**: every menu item shows a photo representative of its category
  (pizza, kebab, burger, salad, schnitzel, etc.) rather than 60+ individually
  sourced photos — real unique photography for every single dish isn't something
  I can fetch reliably, and repeating near-identical stock photos across near
  identical items would look worse, not better. Swap any `image` field in
  `data/menu.js` for your own product photography whenever you have it —
  each item just needs an image URL.
- **Checkout**: cash on delivery only, in a two-step flow (delivery details →
  payment/review), matching the kotipizza.fi pattern.
- **Colors, layout and menu data** are unchanged from your original file.

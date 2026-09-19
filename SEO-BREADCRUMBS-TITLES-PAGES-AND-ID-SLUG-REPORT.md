# SEO gap-fill (breadcrumbs, titles, new pages) + admin ID auto-slug

Two independent tasks, delivered together. No existing URL/route was restructured or removed anywhere in this delivery — every change is additive (new components, new pages, corrected `<title>` values, a new admin convenience). Checkout, payment, and the rest of the admin panel were not touched.

---

## Task 1, Part A — Breadcrumbs

**What was missing:** no visible breadcrumb trail and no `BreadcrumbList` structured data anywhere on the site.

**What was built:**

- `components/Breadcrumbs.tsx` — a real `<nav aria-label="Breadcrumb"><ol>...<Link>` trail (crawlable HTML, not a JS-only widget), plus `buildBreadcrumbSchema()`, which turns the exact same array of `{label, href}` items into `BreadcrumbList` JSON-LD. Both the visible nav and the JSON-LD are built from one array, so they cannot drift apart.
- Wired into the category page (`app/(site)/[locale]/menu/[category]/page.tsx`) as **Home > Category** (2 levels), and the product page (`app/(site)/[locale]/product/[id]/page.tsx`) as **Home > Category > Product** (3 levels) — matching the literal depth described in the brief. The product page looks up its category's real title from the database to build the middle crumb.
- Labels come from `lib/i18n` (`t.breadcrumb.home` = "Home" / "Etusivu"), so the trail is bilingual like the rest of the site.

**Worked example (real seed data — category `pizzat` "Pizzas", product `pizzat-0` "1. Bolognese"):**

Category page `/en/menu/pizzat` — visible trail: `Home > Pizzas`

```json
{
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://ozy.fi/en" },
    { "@type": "ListItem", "position": 2, "name": "Pizzas", "item": "https://ozy.fi/en/menu/pizzat" }
  ]
}
```

Product page `/en/product/pizzat-0` — visible trail: `Home > Pizzas > 1. Bolognese`

```json
{
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://ozy.fi/en" },
    { "@type": "ListItem", "position": 2, "name": "Pizzas", "item": "https://ozy.fi/en/menu/pizzat" },
    { "@type": "ListItem", "position": 3, "name": "1. Bolognese", "item": "https://ozy.fi/en/product/pizzat-0" }
  ]
}
```

The JSON-LD names/URLs match the visible trail exactly, for every category and product, by construction — not just in this example.

---

## Task 1, Part B — Title tag audit

**The main finding:** the root locale layout (`app/(site)/[locale]/layout.tsx`) had:

```tsx
title: { default: '...', template: '%s | ozy.fi' }
```

Every one of the 8 indexable pages already builds its own complete, already-branded title (e.g. `"Privacy Policy — ozy.fi"`). Next.js's metadata inheritance applies a parent `template` to *any* plain-string child title — it doesn't check whether the child already contains the brand name — so every single page's rendered `<title>` was silently getting `ozy.fi` appended a second time. This wasn't visible from reading any one page's own code; it only shows up once you know how `template`/`default` inheritance works. Fixed by removing the `template` (kept only `default`, used as a true fallback for a route that sets no title of its own).

**Before → after, all 8 indexable pages (English; Finnish mirrors the same fix):**

| Page | Before (rendered `<title>`) | After |
|---|---|---|
| Homepage `/en` | `ozy.fi — Pizza, Kebab & Burgers | Delivery & Pickup | ozy.fi` | `ozy.fi — Pizza, Kebab & Burgers | Delivery & Pickup` |
| `/en/menu` | `Full Menu — Pizza, Kebab & Burgers | ozy.fi | ozy.fi` | `Full Menu — Pizza, Kebab & Burgers | ozy.fi` |
| `/en/menu/[category]` (e.g. Pizzas) | `Pizzas Menu — ozy.fi | ozy.fi` | `Pizzas Menu — ozy.fi` |
| `/en/product/[id]` (e.g. 1. Bolognese) | `1. Bolognese — ozy.fi | ozy.fi` | `1. Bolognese — ozy.fi` |
| `/en/faq` | `FAQ — Delivery, Payment & Ordering | ozy.fi | ozy.fi` | `FAQ — Delivery, Payment & Ordering | ozy.fi` |
| `/en/privacy` | `Privacy Policy — ozy.fi | ozy.fi` | `Privacy Policy — ozy.fi` |
| `/en/terms` | `Terms & Conditions — ozy.fi | ozy.fi` | `Terms & Conditions — ozy.fi` |
| `/en/track` | `Track your order — ozy.fi | ozy.fi` | `Track your order — ozy.fi` |

Separately from the double-branding bug: every category and product page was already confirmed to build a genuinely unique title per item (the category/product's own real name, not a generic "Menu" repeated everywhere) — no invented copy was needed there, only the layout fix above.

---

## Task 1, Part C — New pages: `/about`, `/contact`, `/delivery`, `/pickup`

All four are real routes inside the existing `[locale]` structure (so `/en/about`, `/fi/about`, etc., following the same bilingual pattern as every other page), each with its own `generateMetadata` (unique title/description, canonical + hreflang), and each now linked from the footer on every page (previously they'd have been invisible/orphaned even once built).

- **About** (`app/(site)/[locale]/about/page.tsx`) — story section is a clearly marked placeholder block (dashed border, "Placeholder — needs real content" label) asking for the business's real story, plus a "Find us" section built from live `admin_settings` (address/hours/phone/email).
- **Contact** — live `admin_settings` contact details (address, hours, phone as `tel:`, email as `mailto:`), no invented details.
- **Delivery** — fee, minimum order, and delivery-area text are all read from `admin_settings` (`delivery_fee`, `minimum_order`, `delivery_postal_codes`) — **the same settings `app/api/orders/route.ts` actually enforces at checkout**, so this page can't drift out of sync with what checkout really does. If a setting isn't configured, the page says so plainly rather than inventing a number.
- **Pickup** — location/hours from the same live settings, plus a placeholder flagging a real discrepancy found while building this (see below).

**Placeholders still needing the business owner's real content before launch:**

1. **About → "Our story"** — needs the actual story of how ozy.fi started and what makes it different. I deliberately did not reuse the homepage's existing flavor-text copy (`components/Story.tsx`) here, even though it's already live — generic marketing copy isn't the same as a verified real story, and presenting it as one on a dedicated About page felt like it could misrepresent unverified copy as fact. Left it as an explicit placeholder instead.
2. **Pickup → ordering flow** — this is the one that needs attention soonest. The site's marketing copy (hero, product pages) says customers can choose "delivery or pickup" at checkout, but checkout (`CheckoutModal`) only ever collects a delivery address — there's no pickup option anywhere in the actual order flow, no database column for it, no API handling. The Pickup page currently carries an explicit placeholder note flagging this gap rather than asserting a pickup flow that doesn't exist. **This is a pre-existing discrepancy between marketing copy and actual functionality, not something introduced by this delivery** — worth the business owner's attention regardless of this SEO work.

**Also noted, out of scope for this delivery:** `components/Visit.tsx` (the homepage's existing "Find us" section) has hardcoded dummy contact details (`"Esimerkkikatu 12"`, `"040 000 0000"`) rather than reading from `admin_settings`. The four new pages read the real, admin-configurable settings instead, which means the homepage and these new pages can show different contact info until that pre-existing homepage bug is fixed separately.

---

## Task 2 — Auto-generate the admin ID slug from name/title/label

`components/admin/ResourceManager.tsx` is the shared admin UI actually used for **5** tables (traced from every `<ResourceManager table="..." fields={...} />` call in `app/admin/dashboard/page.tsx`):

| Table | Slug source field | Example |
|---|---|---|
| `products` | `name` | "Margherita Pizza" → `margherita-pizza` |
| `addons` | `name` | "Coca-Cola 33cl" → `coca-cola-33cl` |
| `categories` | `title` | "Pizzas & Calzones" → `pizzas-calzones` |
| `option_groups` | `title` | "Sauce" → `sauce` |
| `options` | `label` | "Extra Cheese" → `extra-cheese` |

Confirming the brief's caution was warranted: there is no single field key that works for every table (`name` vs. `title` vs. `label`), so the new logic checks for whichever one a given table actually has, in that priority order, rather than assuming one key.

**Note on `bundles`:** the brief's premise was that ResourceManager is the shared UI "behind products/categories/addons/bundles" — but bundles actually have their own separate component, `components/admin/BundleManager.tsx`, not ResourceManager. It already has different (and more limited) ID behavior: a manually-typed ID field with a placeholder claiming "auto from title," but the auto-fill only actually happens once, as a fallback at submit time if the field was left blank — never live as you type, and never something you can override after the fact once it fills. Since this task's brief is framed specifically around `ResourceManager.tsx`, I left BundleManager as-is rather than expanding scope into a second, differently-structured component; flagging it here in case the business owner wants the same live-slug convenience there too.

**What changed:**

- New `lib/slugify.ts` — extracted the core kebab-case normalization (lowercase, spaces/underscores → hyphens, strip other characters, collapse/trim hyphens) into one shared pure function. `app/api/admin/upload/route.ts`'s existing `slugifyFilename` now calls this for its core normalization step and layers its own upload-specific behavior (extension-stripping, length cap, empty-result fallback) on top — unchanged behavior, just no longer duplicated. `ResourceManager.tsx` uses the same shared function directly, so the admin panel's ID slugs and the image-upload filename slugs can never drift out of sync on what counts as "kebab-case." (I chose to extract rather than duplicate, since both call sites needed exactly the same core rule and any future change to it should only need to happen once.)
- `ResourceManager.tsx`: while creating a new row (`editingId === 'new'`), typing into the table's name-like field live-fills the `id` field with a kebab-case slug of it, using the table's own slug-source field (see the table above). The moment the admin types into the `id` field themselves, a `touched` flag flips on and auto-fill stops for the rest of that "New" session — they can still freely override the id for that one item. Opening a fresh "New" form again resets the flag. Editing an existing resource is completely unaffected: `id` is still rendered disabled whenever `editingId !== 'new'`, exactly as before this change — that code path wasn't touched.
- No server-side validation, save logic, or anything about how `id` is used elsewhere changed. This is a client-side form convenience only.

**Verified with a standalone simulation of the exact state machine** (typing sequences, not just the slug function in isolation):

- Typing "Margherita Pizza" into Name live-populates ID as `margherita-pizza`. ✓
- After manually changing ID to `margherita-classic`, continuing to type in Name no longer overwrites it. ✓
- Categories correctly derive from `title`, options correctly derive from `label` (not `name`/`title`). ✓
- Closing and reopening "New" resets the touched flag, so auto-fill works again for the next new item. ✓
- Editing an existing resource still shows `id` locked/disabled, unaffected. ✓ (confirmed by code inspection — that branch wasn't modified)

---

## Verification performed

- `registry.npmjs.org` remains blocked by this session's network policy (as in every prior phase), so a full `npm install` + project-wide `tsc --noEmit` still isn't possible here. Used the same fallback as before: every changed/new file was syntax-checked with TypeScript's `transpileModule` in `strict` mode (catches syntax errors and many type errors within a single file), and manually reviewed for `strict`/no-`any` compliance and for the "never use `cookies()` from `next/headers`" rule — all clean.
- The breadcrumb JSON-LD/visible-trail match was verified against real seed data (category `pizzat`, product `pizzat-0`) — see Part A above — and is structurally guaranteed to match for every other category/product, since both the nav and the schema are built from the same array.
- The Part B title-template bug and its fix were verified against Next.js's documented `title.template`/`default` inheritance rules, and a full before/after table was built for all 8 currently-indexable pages (see above), not just "fixed."
- The Task 2 ID-slug logic (the pure slugify function, and the full touched-flag state machine, including the multi-table per-key behavior) was executed with Node against worked examples covering every table and the exact scenarios in the brief's verification checklist — all passed.
- Confirmed no existing route was changed, renamed, or removed: Parts A/B only add breadcrumb UI/JSON-LD and correct `<title>` values on existing pages; Part C only adds brand-new routes; Task 2 only touches the admin panel's client-side form behavior.
- Confirmed the new `about`/`contact`/`delivery`/`pickup` translation keys are complete and identical in shape between `lib/i18n/en.tsx` and `lib/i18n/fi.tsx` (no missing key that would break the Finnish pages).

## Placeholder content still needed from the business owner before launch

1. About page's "Our story" section — the business's real story.
2. Pickup page's ordering-flow explanation — needs a decision first: either build a real pickup option into checkout, or update the marketing copy that currently promises one.

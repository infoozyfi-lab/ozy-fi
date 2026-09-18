# Auto-generate SEO filenames from product name + ingredients — report

## A heads-up before the summary

The uploaded snapshot already contained a partial attempt at this exact
feature (in `components/admin/ResourceManager.tsx` — a `buildSeoFilenameHint`
helper plus a stopword-filtering "ingredient keyword extractor"). It worked
for the wiring you described, but not the way this brief specifies:

- It never touched `app/api/admin/upload/route.ts` at all — instead it
  disguised the hint text as the uploaded file's own name, which happens to
  work but isn't what was asked for and doesn't scale to a description with
  a period in it (e.g. "1.5L cola" — the existing `slugifyFilename` strips
  what looks like a trailing file extension, which would have silently
  mangled a hint routed that way).
- It picked out 2-3 "ingredient-looking" keywords from the description
  with a hand-written stopword list, rather than using the full
  name + description text the way the brief describes.
- It only covered the generic product/category/addon image field — not
  bundles or the homepage banner.

I replaced it with an implementation that follows the brief directly:
separate `nameHint`/`descriptionHint` fields sent to the server, which
builds the slug from them using the exact same `slugifyFilename` function
as before (just taught to skip its filename-specific extension-stripping
step when it's given hint text instead of a real filename — a one-line,
non-forking change, per the brief's own suggestion). Wanted to flag this
plainly rather than silently overwrite someone's earlier work.

## What changed

- **`app/api/admin/upload/route.ts`** — added `formHintText` and
  `buildHintedSlug`, and a `stripExtension` parameter on the existing
  `slugifyFilename` (on by default, off when slugifying hint text). When
  the request includes a non-empty `nameHint` field, the key is built from
  `nameHint` (+ `descriptionHint`, if present) instead of the file's own
  name. No `nameHint` → same behavior as before this feature existed.
- **`components/admin/ResourceManager.tsx`** — removed the partial attempt
  described above. Added `nameHintFor`/`descriptionHintFor` helpers that
  read whatever's currently in the edit form (`name`, or `title` if there's
  no `name` field on this table; `description`, if present) and pass them
  to `uploadImage`, which now sends them as `nameHint`/`descriptionHint`
  form fields alongside the file. This is the shared component behind the
  product image field (and, for free, category/addon images too, since
  they go through the same generic image field and the helpers just no-op
  when a table has neither `name`/`title` nor `description`).
- **`components/admin/BundleManager.tsx`** — same pattern: its image
  upload now sends the bundle's own `title`/`description` as hints.
- **`app/admin/dashboard/page.tsx`** — the homepage's custom-banner image
  upload (`uploadBannerImage`) now sends the banner's `Banner title` field
  as `nameHint`. (The featured-card mode where an existing *product's*
  photo is reused automatically has no separate upload step, so there was
  nothing to wire there — that mode doesn't call the upload route at all.)

Every one of these falls back to today's behavior (slugify the file's own
name) whenever there's no name/title text yet to draw from.

## Where each call site draws its hint from

| Upload call site | nameHint from | descriptionHint from |
|---|---|---|
| Product / category / addon image (`ResourceManager.tsx`) | `name` field, or `title` if the table has no `name` | `description` field, if the table has one |
| Bundle image (`BundleManager.tsx`) | bundle's `title` | bundle's `description` |
| Homepage custom banner (`app/admin/dashboard/page.tsx`) | `Banner title` | *(none — no ingredients-like field on a banner)* |

## Worked examples (actually run, not just reasoned through)

**Product "Margherita", description "Tomaatti, Mozzarella, Basilika":**
```
uploads/margherita-tomaatti-mozzarella-basilika-586c9fc0.webp
```
Matches the brief's own expected shape exactly.

**Brand-new product, no name typed yet:** falls back to the uploaded
file's own name, e.g. uploading `IMG_9981.jpg` still produces
```
uploads/img-9981-9917ebce.jpg
```
rather than an empty or broken slug.

**Banner with "Weekend Kebab Deal" as its title:**
```
uploads/weekend-kebab-deal-9c073f12.jpg
```
**Banner with no title set:** falls back to the file's own name, e.g.
`uploads/36449-fea83f5f.jpg`.

**Bundle "Family Feast Combo", description "2 large pizzas, garlic bread,
1.5L cola":**
```
uploads/family-feast-combo-2-large-pizzas-garlic-bread-15l-cola-6d92b676.png
```
This one specifically checks the `stripExtension` fix — the description
contains a period ("1.5L"), and the old filename-oriented slugifier would
have treated ".5L cola" as a fake trailing extension and cut it off. With
`stripExtension` turned off for hint text, it doesn't.

**Long description (product "Meat Lovers Supreme" with an 8-ingredient
description):** still truncates cleanly at a hyphen boundary within the
80-character cap, same as the original filename-preservation task:
```
uploads/meat-lovers-supreme-pepperoni-italian-sausage-ground-beef-bacon-ham-mozzarella-5bc8554b.jpg
```

## Verification method

Same approach as the earlier filename-preservation task: the actual
updated slug-building logic (`slugifyFilename` + `buildHintedSlug`) was
extracted and executed for real against the cases above, not just reasoned
about. All four changed files were also run through the TypeScript
compiler's own parser (no `node_modules` needed for this, since it doesn't
resolve imports) to catch syntax errors — all clean. This session's network
policy still blocks `registry.npmjs.org`, so — as with the previous SEO
report — a full project-wide `npm install` + `tsc --noEmit` diff wasn't
possible; the rest of the changes (four small, additive edits following
patterns already established three times over in this codebase) were
checked by hand against `strict: true` / no-`any`.

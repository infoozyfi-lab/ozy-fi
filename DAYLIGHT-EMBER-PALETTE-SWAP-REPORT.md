# Delivery report — "Daylight Ember" palette swap (replaces Cream & Terracotta)

This follows the color-palette brainstorm demo (`Ozy Palette Lab`, 7 directions compared
against your real menu). You picked **Daylight Ember** — Charcoal Ember's near-black
header and hot-ember accent, kept on a light body so it stays readable on a phone in
direct sun. This is now live in the code in this zip, replacing the Cream & Terracotta
swap from before. Same care as that swap: every real usage traced and updated, not just
the `:root` block, and every text/background pairing contrast-checked.

## The one real complication

Cream & Terracotta's header/hero was **literally the same color** as its button accent
(`--ember` did double duty), so one shared "text on accent" variable safely covered both.
Daylight Ember's header is near-black and its accent is a bright orange — two different
colors — so that one variable would have been wrong for one of the two surfaces no matter
which value it got. I split it:

- **`--header-bg`** (new, `#211B17`) — the hero and CTA-strip surface only.
- **`--header-text`** (new, `#F3EAE0`, 14.31:1 on `--header-bg`) — text that sits on that
  surface: hero title/meta, CTA-strip heading, and — this was the part easy to miss — the
  store-closed banner, the scheduled-offer banner, and the "done" checkout step. Those
  three use `--danger`/`--gold` backgrounds, not `--header-bg`, but they're dark/saturated
  the same way, and they were quietly borrowing the old shared variable too. Recoloring
  that variable without noticing them would have made all three illegible.
- **`--text-on-accent`** (now `#1C1210`, dark) — narrowed to mean strictly "text on a
  surface that IS `var(--ember)`" — buttons, active tabs/pills, badges. Flipped from light
  to dark because the new, brighter `--ember` needs dark text on it (5.43:1), where the
  old muted terracotta needed light.
- **`--ember-dark`** (now `#C14815`) — also redefined. Old `--ember-dark` was just "a
  darker shade for hover." New `--ember-dark` is that *and* the stand-in everywhere the
  old code used `--ember` directly as a **text color** on a light background (prices,
  links, the logo's ".fi", tab labels, etc.) — the new bright `--ember` only measures
  ~3.1:1 as text on the light body, which fails normal-text contrast. `--ember` itself is
  now reserved for backgrounds/borders only.

I found this by taking one screenshot of the real component markup (header, hero, menu
grid, CTA strip, both banner variants) after the swap — the same "write, look once, then
one fix pass" process as the palette demo — and the near-black-on-near-black hero text
was immediately obvious. The banner cases I caught by tracing every remaining usage of
the old variable, not by eye.

## Full token mapping

| Token | Old (Cream & Terracotta) | New (Daylight Ember) | Role |
|---|---|---|---|
| `--bg` | `#FAF3E9` | `#F7F4EF` | page background |
| `--bg-card` | `#FFFCF6` | `#FFFFFF` | card/panel surface |
| `--bg-alt` | `#F0E4D3` | `#EFEAE1` | secondary surface |
| `--ember` | `#C1552A` | `#E8622A` | accent — **backgrounds/borders only** now |
| `--ember-dark` | `#B24A26` | `#C14815` | hover-darken **and** accent-as-text on light bg |
| `--icon-bg` | `#F0DCC8` | `#F0E4D6` | icon-tile backdrop |
| `--icon-color` | `#B24A26` | `#B24A26` (unchanged) | icon glyph |
| `--header-bg` | *(none — was `--ember`)* | `#211B17` (new) | hero / CTA-strip surface |
| `--header-text` | *(none — was `--text-on-accent`)* | `#F3EAE0` (new) | text on that surface |
| `--line` | `#E8DCC8` | `#E7E1D6` | borders |
| `--tab-inactive-bg` | `#F0E4D3` | `#EFEAE1` | inactive tab/pill |
| `--tab-inactive-text` | `#5C4A38` | `#5B5147` | inactive tab/pill text |
| `--cream` (primary text) | `#3A2A1E` | `#231D19` | body text |
| `--muted` | `#8A7A68` | `#756B5F` | secondary text |
| `--text-on-accent` | `#FFF7EE` | `#1C1210` | text on literal `--ember` (buttons/badges) |
| `--text-on-accent-muted` | `#F3DACB` | `#D9CBBC` | muted text on `--header-bg` |
| `--gold`, `--danger`, `--danger-bg`, `--danger-border`, `--success`, `--wow-accent` | unchanged | unchanged | independent semantic tokens — still pass against the new (barely different) light background |

## Contrast verification (WCAG relative-luminance formula, computed directly)

All text/background pairings this swap touches:

- Body text, muted text, tab text, header text, danger/gold badge text: **all ≥4.5:1**
  (several 10–16:1).
- `--text-on-accent` on `--ember` (buttons/badges): **5.43:1**.
- `--ember-dark` as text on the light body/cards: **4.55–4.99:1**.
- `--ember-dark` on `--icon-bg`, and the icon-color/icon-bg pairing: **3.68–4.30:1** —
  large-text-only tier. Checked every specific rule this applies to: the qty-stepper
  "−"/"+" glyphs and the button-hover-background case (a transient, non-resting state).
  Nothing at body-text size relies on this tier.

Script and full pairing list are in this delivery's scratch notes if you want to re-run
it after any future tweak.

## Files touched

`app/globals.css` (the real, imported stylesheet — same one confirmed in the last swap),
`app/manifest.ts`, `app/global-error.tsx` (literal hex, not `var()` — unchanged reasoning
from last time: a root catastrophic-error page shouldn't depend on the normal stylesheet
loading), `app/(site)/[locale]/error.tsx`, `app/(site)/[locale]/not-found.tsx`,
`app/admin/page.tsx`, `components/ConfirmModal.tsx`, `components/MenuPageClient.tsx`,
`components/FaqPageClient.tsx`, `components/admin/MyAccountModal.tsx`,
`components/admin/charts/colors.ts`, `components/admin/charts/ColumnChart.tsx`,
`components/admin/charts/AreaTrendChart.tsx`. Everything else in the app (CheckoutModal,
the admin dashboard shell, OrderKanban, ScheduledOffersManager, etc.) styles itself purely
through the CSS classes in `globals.css` — no separate file-level edits needed, they pick
up the new palette automatically.

The stray duplicate root-level `globals.css` (flagged in the last swap's report as
unused, dead code — confirmed again this time via the same import-path check) was left
untouched, same as before.

## Verification performed

- Syntax-checked every touched `.ts`/`.tsx` file with esbuild's transform (bundled inside
  the project's `tsx` install, since `npm install` is still blocked by a registry 403 in
  this environment) — all 12 clean.
- Balanced-brace/paren check on the full `globals.css`.
- Full WCAG contrast pass on every token pairing this swap introduced or changed (table
  above).
- Rendered the real component markup (header/nav, hero, product grid, category tabs,
  menu list, CTA strip, both banner variants) against the actual updated `globals.css` in
  a headless browser and inspected the screenshot — this is what caught the hero-text and
  banner-text bugs described above.

## Judgment calls

- **`--ember-dark`'s hover-on-orange-button contrast (3.68:1) is a known, accepted trade-
  off**, not an oversight: making it fully AA-safe there would require lightening it
  toward `--ember` itself, which then fails as the "deep, text-safe accent" role it's
  needed for everywhere else (prices, links). Hover is a brief, transient state (most of
  these buttons also lift with `transform: translateY(-2px)` on hover already), so I
  prioritized the resting-state text uses. Flagging this rather than hiding it — if you'd
  rather have a fully-compliant hover at the cost of a subtler darken, say so and I'll
  adjust just that one value.
- **`BRAND_DIM` in the admin chart color tokens was left at its old value on purpose** —
  it's a secondary/dimmer chart accent, not scrutinized as heavily as the main site
  palette, and nothing depends on it matching `--ember-dark` exactly. Commented in the
  code so a future reader doesn't assume it's stale.

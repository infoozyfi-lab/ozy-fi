'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/context/StoreContext';
import { useTranslations, useLocalePath } from '@/lib/i18n';
import type { FillingCategory, FillingItem, OptionItem, Product, Bundle } from '@/lib/types';

// Keyed by the ENGLISH topping label from the database — since Finnish
// toppings now resolve to their translated `label_fi` text (see
// lib/menu-i18n.js), a topping the business owner has translated no
// longer matches a key here and silently falls back to the generic '●'
// bullet below. Purely cosmetic (pricing/selection still work correctly
// either way) — flagged in this feature's delivery summary rather than
// reworked into a bigger ID-based lookup.
const TOPPING_EMOJI: Record<string, string> = {
  'Extra cheese': '🧀', Pepperoni: '🔴', Mushroom: '🍄', Onion: '🧅',
  Bacon: '🥓', Jalapeño: '🌶️', Olives: '🫒', Pineapple: '🍍', Ham: '🍖', Garlic: '🧄',
};

function money(n: number) {
  return `${n.toFixed(2)} €`;
}

function BottomRow({ label, options, current, onChange, t }: { label: string; options: OptionItem[]; current: string | undefined; onChange: (id: string) => void; t: any }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === current) || options[0];
  if (!selected) return null;
  return (
    <div className="pp-bottom-row">
      <button type="button" className="pp-bottom-row-head" onClick={() => setOpen((v) => !v)}>
        <span className="label">{selected.label}</span>
        <span className="change-btn">{t.productPage.change} <span className={`chev${open ? ' up' : ''}`}>▾</span></span>
      </button>
      {open && (
        <div className="pp-bottom-options">
          {options.map((opt) => (
            <label key={opt.id} className={opt.id === current ? 'is-current' : ''}>
              <input
                type="radio"
                name={label}
                checked={opt.id === current}
                onChange={() => { onChange(opt.id); setOpen(false); }}
              />
              <span>{opt.label}</span>
              {opt.delta > 0 && <span className="opt-delta">+{opt.delta.toFixed(2)} €</span>}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// Bug-fix + UI-change follow-up brief, Task 2 — the business owner
// confirmed (after seeing the collapsed BottomRow dropdown live) that
// pizza sizes specifically should render as always-visible tappable
// buttons, matching the look of the old, now-retired Medium/Large toggle
// (components/ProductPage.tsx's history — see PER-PRODUCT-SIZE-DELIVERY-
// REPORT.md), NOT hidden behind a "change" tap the way base/sauce/cheese
// still are. This is a dedicated component, used ONLY for the 'size'
// option-group kind — BottomRow itself is untouched and still drives
// every other option kind below unchanged.
//
// `hasRealTiers` (computed by the caller) hides this row entirely for a
// product with no real 'size' group configured — `selection.sizeOptions`
// is then just the single synthetic FALLBACK_OPTION entry (id: 'default'),
// which is a real, working choice for BottomRow's collapsed style (it just
// shows "Default" with nothing to change) but would be a meaningless
// single button here, so it's suppressed instead per this brief's own
// "shows no size row whatsoever" requirement.
//
// Price display choice: each button shows the tier's own RESULTING
// ABSOLUTE price (e.g. "Perhe — 14.50 €"), not a "+X.XX €" delta off the
// product's base price. The old M/L toggle could get away with a delta
// badge because there were only ever two fixed, known tiers (Medium was
// always literally the base price, so "+3.50 €" on Large was
// self-explanatory). A per-product tier ladder can have any number of
// tiers with no fixed "this one is the base" convention a customer would
// recognize on sight (e.g. Normaali/Pannu/Perhe) — showing what they'll
// actually pay for each tier directly is unambiguous regardless of how
// many tiers there are or which one happens to be cheapest, and matches
// how food-ordering UIs conventionally show size buttons.
function SizeTierButtons({ options, current, basePrice, onChange }: { options: OptionItem[]; current: string | undefined; basePrice: number; onChange: (id: string) => void }) {
  return (
    <div className="pp-size-tiles">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={`pp-size-tile${opt.id === current ? ' active' : ''}`}
          onClick={() => onChange(opt.id)}
        >
          <span className="pp-size-tile-label">{opt.label}</span>
          <span className="pp-size-tile-price">{money(basePrice + opt.delta)}</span>
        </button>
      ))}
    </div>
  );
}

function SauceStripeRow({ options, current, onChange, t }: { options: OptionItem[]; current: string | undefined; onChange: (id: string) => void; t: any }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === current) || options[0];
  if (!selected) return null;
  return (
    <div className="pp-section">
      <p className="pp-label">{t.productPage.sauceStripesHeading}</p>
      <div className="pp-swatch-row">
        <span className="pp-swatch" style={{ background: selected.color ?? undefined }} aria-hidden="true" />
        <span className="pp-swatch-label">{selected.label}</span>
        <button type="button" className="change-btn" onClick={() => setOpen((v) => !v)}>
          {t.productPage.change} <span className={`chev${open ? ' up' : ''}`}>▾</span>
        </button>
      </div>
      {open && (
        <div className="pp-bottom-options">
          {options.map((opt) => (
            <label key={opt.id} className={opt.id === current ? 'is-current' : ''}>
              <input
                type="radio"
                name="sauce-stripe"
                checked={opt.id === current}
                onChange={() => { onChange(opt.id); setOpen(false); }}
              />
              <span className="pp-swatch pp-swatch-sm" style={{ background: opt.color ?? undefined }} />
              <span>{opt.label}</span>
              {opt.delta > 0 && <span className="opt-delta">+{opt.delta.toFixed(2)} €</span>}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function DipRow({ options, current, onChange, t }: { options: OptionItem[]; current: string | undefined; onChange: (id: string) => void; t: any }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.id === current) || options[0];
  if (!selected) return null;
  return (
    <div className="pp-section">
      <p className="pp-label">{t.productPage.dipHeading}</p>
      <div className="pp-select-box">
        <button type="button" className="pp-select-head" onClick={() => setOpen((v) => !v)}>
          <span>{selected.id === options[0]?.id ? t.productPage.selectADip : selected.label}</span>
          <span className="change-btn">{t.productPage.select} <span className={`chev${open ? ' up' : ''}`}>▾</span></span>
        </button>
        {open && (
          <div className="pp-bottom-options">
            {options.map((opt) => (
              <label key={opt.id} className={opt.id === current ? 'is-current' : ''}>
                <input
                  type="radio"
                  name="dip"
                  checked={opt.id === current}
                  onChange={() => { onChange(opt.id); setOpen(false); }}
                />
                <span>{opt.label}</span>
                {opt.delta > 0 && <span className="opt-delta">+{opt.delta.toFixed(2)} €</span>}
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function QtyStepper({ qty, onDec, onInc, t }: { qty: number; onDec: () => void; onInc: () => void; t: any }) {
  return (
    <div className="pp-qty-stepper">
      <button type="button" aria-label={t.productPage.removeOneAriaLabel} onClick={onDec} disabled={qty <= 0}>−</button>
      {qty > 0 && <span>{qty}</span>}
      <button type="button" aria-label={t.productPage.addOneAriaLabel} onClick={onInc}>+</button>
    </div>
  );
}

function CurrentFillings({ allFillings, fillings, onSetQty, t }: { allFillings: FillingItem[]; fillings: Record<string, number>; onSetQty: (id: string, qty: number) => void; t: any }) {
  const entries = Object.entries(fillings).filter(([, qty]) => qty > 0);
  return (
    <div className="pp-section">
      <p className="pp-label">{t.productPage.fillingsHeading}</p>
      {entries.length === 0 ? (
        <p className="pp-empty-hint">{t.productPage.fillingsEmptyHint}</p>
      ) : (
        <div className="pp-fillings-list">
          {entries.map(([id, qty]) => {
            const item = allFillings.find((f) => f.id === id);
            if (!item) return null;
            return (
              <div className="pp-filling-row active" key={id}>
                <button
                  type="button"
                  className="fname"
                  onClick={() => onSetQty(id, qty + 1)}
                >
                  {item.label}{qty > 1 ? <span className="fqty-badge"> x {qty}</span> : null}
                </button>
                <QtyStepper
                  qty={qty}
                  onDec={() => onSetQty(id, qty - 1)}
                  onInc={() => onSetQty(id, qty + 1)}
                  t={t}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MoreFillingsCategory({ category, fillings, onSetQty, open, onToggle, t }: { category: FillingCategory; fillings: Record<string, number>; onSetQty: (id: string, qty: number) => void; open: boolean; onToggle: () => void; t: any }) {
  return (
    <div className="pp-cat">
      <button type="button" className="pp-cat-head" onClick={onToggle}>
        <span className="pp-cat-icon">{category.icon}</span>
        <span className="pp-cat-title">{category.title}</span>
        {category.badge && <span className="pp-cat-badge">{category.badge}</span>}
        <span className={`chev pp-cat-chev${open ? ' up' : ''}`}>⌄</span>
      </button>
      {open && (
        <div className="pp-cat-body">
          {category.items.map((item) => {
            const qty = fillings[item.id] || 0;
            return (
              <div className={`pp-filling-row${qty > 0 ? ' active' : ''}`} key={item.id}>
                <button
                  type="button"
                  className="fname"
                  onClick={() => onSetQty(item.id, qty + 1)}
                >
                  {item.label}
                  <span className="fprice"> +{item.price.toFixed(2)} €</span>
                </button>
                <QtyStepper
                  qty={qty}
                  onDec={() => onSetQty(item.id, qty - 1)}
                  onInc={() => onSetQty(item.id, qty + 1)}
                  t={t}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProductDetails({ t }: { t: any }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const sections = [
    { id: 'raw-material', title: t.productPage.rawMaterialTitle, body: t.productPage.rawMaterialBody },
    { id: 'nutrition', title: t.productPage.nutritionTitle, body: t.productPage.nutritionBody },
    { id: 'climate', title: t.productPage.climateTitle, body: t.productPage.climateBody },
  ];
  return (
    <div className="pp-section">
      <p className="pp-heading">{t.productPage.productDetailsHeading}</p>
      <div className="pp-details-list">
        {sections.map((sec) => {
          const open = openId === sec.id;
          return (
            <div className="pp-details-row" key={sec.id}>
              <button
                type="button"
                className="pp-details-head"
                onClick={() => setOpenId(open ? null : sec.id)}
              >
                <span>{sec.title}</span>
                <span className={`chev${open ? ' up' : ''}`}>⌄</span>
              </button>
              {open && <p className="pp-details-body">{sec.body}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Round-2 fixes brief, Part 3 — zero internal linking existed between
// products/categories/bundles anywhere on the site (see
// FULL-SITE-AUDIT-ROUND2-REPORT.md). Rendered on BOTH this component's
// usages — the standalone, crawlable /product/[id] page
// (ProductPageStandalone.tsx just renders this same component; see that
// file's header) and the in-app modal opened from a menu tile — so this
// one addition covers the brief's "and, if reasonable, ProductPage.tsx"
// clause for free, without a second implementation.
//
// "Related" = same category OR sharing this product's own tag (e.g. two
// different "Spicy"-tagged items in different categories) — real
// `category_id`/`tag` data already on every Product, nothing invented.
// Links are real <Link>s to /product/[id], the exact same convention
// components/MenuSection.tsx's own product tiles already use, so this is
// a genuinely crawlable internal link, not just a client-side state swap.
function RelatedProducts({
  activeProduct,
  products,
  bundles,
  openBundle,
  t,
  lp,
}: {
  activeProduct: Product;
  products: Product[];
  bundles: Bundle[];
  openBundle: (bundle: Bundle) => void;
  t: any;
  lp: (path: string) => string;
}) {
  const related = products
    .filter((p) => p.id !== activeProduct.id && p.price != null)
    .filter((p) => p.category_id === activeProduct.category_id || (Boolean(activeProduct.tag) && p.tag === activeProduct.tag))
    // Same-category matches first (the strongest, most obviously relevant
    // signal), then tag-only matches — rather than an arbitrary DB order.
    .sort((a, b) => {
      const aSameCat = a.category_id === activeProduct.category_id ? 0 : 1;
      const bSameCat = b.category_id === activeProduct.category_id ? 0 : 1;
      return aSameCat - bSameCat;
    })
    .slice(0, 6);

  // A bundle "contains" a product via one of its own fixed slots — a
  // choice slot only names categories, not a specific product, so it
  // isn't a genuine "this exact product is in this bundle" claim.
  const bundle = bundles.find((b) => b.slots.some((slot) => slot.kind === 'fixed' && slot.productId === activeProduct.id));

  if (related.length === 0 && !bundle) return null;

  return (
    <div className="pp-section">
      {bundle && (
        <div className="pp-related-bundle">
          <span className="pp-label" style={{ margin: 0 }}>{t.productPage.partOfBundleLabel}</span>
          {/* No dedicated bundle URL exists in this codebase (bundles open
              as a modal from wherever they're featured — see
              components/Bundles.tsx/FeaturedCard.tsx for the same
              pattern) — this is the same one-click affordance those use,
              not a real crawlable link, disclosed as such in this
              feature's delivery report. */}
          <button type="button" className="pp-related-bundle-btn" onClick={() => openBundle(bundle)}>
            {t.productPage.viewBundle(bundle.title)}
          </button>
        </div>
      )}
      {related.length > 0 && (
        <>
          <p className="pp-heading">{t.productPage.relatedHeading}</p>
          <div className="pp-related-list">
            {related.map((p) => (
              <Link key={p.id} href={lp(`/product/${p.id}`)} className="pp-related-item">
                <img src={p.image ?? undefined} alt={p.name} />
                <span className="pp-related-name">{p.name}</span>
                <span className="pp-related-price">{(p.price ?? 0).toFixed(2)} €</span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function ProductPage() {
  const {
    activeProduct, selection, unitPrice, lineTotal,
    isProductPageOpen, closeProduct, toggleTopping, toggleExtra, setQty, setOption,
    setFillingQty, addToCart, goToCheckoutDirect,
    toppings: TOPPINGS, toppingPrice: TOPPING_PRICE,
    baseOptions: BASE_OPTIONS, sauceOptions: SAUCE_OPTIONS, cheeseOptions: CHEESE_OPTIONS,
    fillingCategories: FILLING_CATEGORIES, allFillings: ALL_FILLINGS,
    sauceStripeOptions: SAUCE_STRIPE_OPTIONS, dipOptions: DIP_OPTIONS,
    // Round-2 fixes brief, Part 3 — for RelatedProducts below.
    products: ALL_PRODUCTS, bundles: ALL_BUNDLES, openBundle,
  } = useStore();
  const t = useTranslations();
  const lp = useLocalePath();

  const [openCat, setOpenCat] = useState<string | null>(null);

  if (!activeProduct || !selection) {
    return <div className="product-page" aria-hidden="true" />;
  }

  const isBundleSlot = selection.bundleSlotIndex != null;

  // Bug-fix + UI-change follow-up brief, Task 2 — a real, admin-configured
  // 'size' group is anything other than the exact synthetic FALLBACK_OPTION
  // shape (a single entry with id 'default' — see lib/menu-i18n.ts's
  // normalizeMenuBlob and Product.sizeOptions's own comment). A real group
  // with just one tier still counts (it's a genuine admin choice, not the
  // fallback), so this checks the sentinel id, not the array length alone.
  const hasRealSizeTiers = !(selection.sizeOptions.length === 1 && selection.sizeOptions[0].id === 'default');

  // Option-gating-and-extras-system brief, Task 1 — same sentinel-id check
  // as hasRealSizeTiers above, applied to each of the other option-group
  // kinds this page renders. Base/sauce/cheese/sauce-stripe/dip are all
  // still GLOBAL lists today (only 'size' and 'extra' are ever scoped per-
  // product — see worker/schema.sql's option_groups.product_id comment),
  // so "does real data exist for this product" reduces to "has the admin
  // configured a real, non-fallback group for this kind AT ALL" — every
  // toppingsEnabled product currently gets the same answer for these rows
  // (there's no per-product base/sauce/cheese/sauce-stripe/dip data model
  // to differ by), which is disclosed in this feature's delivery report.
  // Only a real admin-configured group (any shape, even a single option)
  // counts — never the synthetic single-entry fallback every unconfigured
  // kind falls back to in lib/menu-i18n.ts's normalizeMenuBlob.
  const hasRealBase = !(BASE_OPTIONS.length === 1 && BASE_OPTIONS[0].id === 'default');
  const hasRealSauce = !(SAUCE_OPTIONS.length === 1 && SAUCE_OPTIONS[0].id === 'default');
  const hasRealCheese = !(CHEESE_OPTIONS.length === 1 && CHEESE_OPTIONS[0].id === 'default');
  const hasRealSauceStripe = !(SAUCE_STRIPE_OPTIONS.length === 1 && SAUCE_STRIPE_OPTIONS[0].id === 'default');
  const hasRealDip = !(DIP_OPTIONS.length === 1 && DIP_OPTIONS[0].id === 'default');
  // "More Fillings" section — fillingCategories has no synthetic fallback
  // entry at all (it's simply an empty array when unconfigured, unlike
  // every other kind above), so real data is just "is it non-empty."
  // CurrentFillings (the running "Current fillings" summary right above
  // "More Fillings") is gated by this SAME flag, not just the literal
  // "More Fillings" section named in the brief — the two are one system
  // with no independent existence (CurrentFillings has no way to ever
  // gain an entry when there are no filling categories to add one from),
  // so showing it alone would be exactly the kind of dead placeholder
  // this task removes; see this feature's delivery report.
  const hasRealFillingCategories = FILLING_CATEGORIES.length > 0;
  // Option-gating-and-extras-system brief, Task 2 — UNLIKE every check
  // above, this one IS genuinely per-product (selection.extraOptions is a
  // snapshot of the active product's own extras — see Selection.extraOptions's
  // own comment) and has no fallback/sentinel-id shape to check against at
  // all (lib/menu-i18n.ts's normalizeMenuBlob never gives an unconfigured
  // product anything but a plain empty array here — see
  // Product.extraOptions's own comment) — a real, admin-added extra is the
  // only thing that ever makes this true.
  const hasRealExtras = selection.extraOptions.length > 0;

  const [intPart, decPart] = unitPrice.toFixed(2).split('.');

  return (
    <div className={`product-page${isProductPageOpen ? ' open' : ''}`}>
      <div className="pp-topbar">
        <button className="pp-back" type="button" aria-label={t.productPage.backAriaLabel} onClick={closeProduct}>←</button>
        <Link href={lp('/')} className="pp-topbar-title">ozy<span>.fi</span></Link>
        <button
          className="pp-cart"
          type="button"
          aria-label={t.productPage.cartAriaLabel}
          onClick={() => { closeProduct(); goToCheckoutDirect(); }}
        >
          🛒
        </button>
      </div>

      <div className="pp-scroll">
        <div className="pp-hero">
          <img className="pp-hero-img" src={activeProduct.image ?? undefined} alt={activeProduct.name} />
          <div className="pp-price-badge">
            <div className="pp-price-row">
              <span>{intPart}</span>
              <span className="pp-price-dec">.{decPart}</span>
              <span className="pp-price-eur">€</span>
            </div>
          </div>
        </div>

        <div className="pp-body wrap">
          <h1 className="pp-name">{activeProduct.name}</h1>
          <p className="pp-desc">{activeProduct.desc}</p>

          {/* Option-gating-and-extras-system brief, Task 3 — freeform
              per-product note (worker/migrations/
              023_extras_and_additional_info.sql's additional_info/
              additional_info_fi). Placed directly after the description
              (and before any customization UI) since it reads as part of
              "what is this product" rather than "how do I customize it" —
              a prep note or allergen callout belongs with the product's
              own description, not buried below its options. Renders
              nothing at all — no heading, no empty section — when unset,
              same "only render if real data exists" principle as every
              row below. Plain typography (pp-additional-info, defined
              alongside pp-desc in app/globals.css/globals.css), not a new
              visual treatment, per that task's own explicit scoping. */}
          {activeProduct.additionalInfo && (
            <p className="pp-additional-info">{activeProduct.additionalInfo}</p>
          )}

          {/* Option-gating-and-extras-system brief, Task 2 — the general
              "Extras" row. Deliberately OUTSIDE the `selection.toppingsEnabled`
              block below (unlike every row inside it) — extras must work on
              ANY product, explicitly including a non-customizable one like a
              kebab (has_toppings=0), so it can't be gated behind that same
              flag. `hasRealExtras` is genuinely per-product (see its own
              comment above), so this shows only for a product the business
              owner has actually given extras to. */}
          {hasRealExtras && (
            <div className="pp-section">
              <p className="pp-label">{t.productPage.extrasHeading}</p>
              <div className="pp-extras-list">
                {selection.extraOptions.map((opt) => {
                  const checked = selection.extraIds.includes(opt.id);
                  return (
                    <label key={opt.id} className={`pp-extra-row${checked ? ' is-selected' : ''}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleExtra(opt.id)} />
                      <span>{opt.label}</span>
                      {opt.delta > 0 && <span className="opt-delta">+{opt.delta.toFixed(2)} €</span>}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {selection.toppingsEnabled && (
            <>
              {/* Per-product-size brief — the M/L toggle that used to live
                  here has been fully retired (Part 2). This is now the
                  ONLY size-related control. Bug-fix + UI-change follow-up
                  brief, Task 2 — now rendered as always-visible tappable
                  buttons (SizeTierButtons) instead of BottomRow's
                  collapsed dropdown, per the business owner's explicit
                  feedback after seeing the dropdown live. Reads
                  `selection.sizeOptions` — THIS product's own snapshotted
                  size tiers (see Selection.sizeOptions's own comment),
                  never a context-level global list.
                  `hasRealSizeTiers` distinguishes a real, admin-configured
                  'size' group (any shape, even a single tier) from the
                  synthetic FALLBACK_OPTION single "Default" entry every
                  unconfigured option kind gets — only the former renders a
                  row at all, so a product with no 'size' group configured
                  (e.g. a non-pizza item) shows no size row whatsoever,
                  same as today. */}
              {hasRealSizeTiers && (
                <div className="pp-section">
                  <p className="pp-label">{t.productPage.size}</p>
                  <SizeTierButtons options={selection.sizeOptions} current={selection.sizeOptionId} basePrice={selection.basePrice} onChange={(id) => setOption('sizeOptionId', id)} />
                </div>
              )}

              <div className="pp-section">
                <p className="pp-label">{t.productPage.finishToppings}</p>
                <div className="pp-finish-row">
                  {TOPPINGS.map((topping) => (
                    <button
                      key={topping.id}
                      type="button"
                      className={`pp-finish-tile${selection.toppings.includes(topping.label) ? ' selected' : ''}`}
                      onClick={() => toggleTopping(topping.label)}
                    >
                      <span className="emoji">{TOPPING_EMOJI[topping.label] || '●'}</span>
                      <span className="fname">{topping.label}</span>
                      <span className="fprice">+{TOPPING_PRICE.toFixed(2)} €</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Option-gating-and-extras-system brief, Task 1 — this
                  section (and each row inside it) now independently
                  requires real admin-configured data for its own kind
                  (hasRealBase/hasRealSauce/hasRealCheese — see their own
                  comments above), not just `selection.toppingsEnabled`.
                  The wrapping heading itself only shows when at least one
                  of the three rows has something real to show — an empty
                  "Bottom" heading over zero rows would be exactly the kind
                  of dead placeholder this task removes. */}
              {(hasRealBase || hasRealSauce || hasRealCheese) && (
                <div className="pp-section">
                  <p className="pp-label">{t.productPage.bottom}</p>
                  <div className="pp-bottom-list">
                    {hasRealBase && <BottomRow label="base" options={BASE_OPTIONS} current={selection.base} onChange={(id) => setOption('base', id)} t={t} />}
                    {hasRealSauce && <BottomRow label="sauce" options={SAUCE_OPTIONS} current={selection.sauce} onChange={(id) => setOption('sauce', id)} t={t} />}
                    {hasRealCheese && <BottomRow label="cheese" options={CHEESE_OPTIONS} current={selection.cheese} onChange={(id) => setOption('cheese', id)} t={t} />}
                  </div>
                </div>
              )}

              {/* Option-gating-and-extras-system brief, Task 1 — see
                  hasRealFillingCategories's own comment: CurrentFillings and
                  the "More Fillings" section below are one system, gated
                  together. */}
              {hasRealFillingCategories && (
                <>
                  <CurrentFillings allFillings={ALL_FILLINGS} fillings={selection.fillings} onSetQty={setFillingQty} t={t} />

                  <div className="pp-section">
                    <p className="pp-heading">{t.productPage.moreFillings}</p>
                    <div className="pp-cat-list">
                      {FILLING_CATEGORIES.map((cat) => (
                        <MoreFillingsCategory
                          key={cat.id}
                          category={cat}
                          fillings={selection.fillings}
                          onSetQty={setFillingQty}
                          open={openCat === cat.id}
                          onToggle={() => setOpenCat((c) => (c === cat.id ? null : cat.id))}
                          t={t}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {hasRealSauceStripe && (
                <SauceStripeRow options={SAUCE_STRIPE_OPTIONS} current={selection.sauceStripe} onChange={(id) => setOption('sauceStripe', id)} t={t} />
              )}

              {hasRealDip && (
                <DipRow options={DIP_OPTIONS} current={selection.dip} onChange={(id) => setOption('dip', id)} t={t} />
              )}

              <ProductDetails t={t} />
            </>
          )}

          {/* Round-2 fixes brief, Part 3 — outside the toppingsEnabled
              block above so a non-customizable item (e.g. a drink or
              snack sold as its own /product/[id] page) still gets related
              links/bundle surfacing, not just customizable food items. */}
          <RelatedProducts
            activeProduct={activeProduct}
            products={ALL_PRODUCTS}
            bundles={ALL_BUNDLES}
            openBundle={openBundle}
            t={t}
            lp={lp}
          />
        </div>
      </div>

      <div className="pp-footer">
        {!isBundleSlot && (
          <div className="pp-qty">
            <button type="button" onClick={() => setQty((q) => q - 1)}>−</button>
            <span>{selection.qty}</span>
            <button type="button" onClick={() => setQty((q) => q + 1)}>+</button>
          </div>
        )}
        <button className="btn-primary pp-add-btn" type="button" onClick={addToCart}>
          {/* basePrice is typed optional (Product.basePrice?) but always populated
              once a product is active/selected here — non-null assertions are a
              no-op fix under strict mode, same behavior as before. */}
          {isBundleSlot
            ? unitPrice > activeProduct.basePrice!
              ? t.productPage.addToBundleExtra(money(unitPrice - activeProduct.basePrice!))
              : t.productPage.addToBundle
            : t.productPage.addToOrder(money(lineTotal))}
        </button>
      </div>
    </div>
  );
}

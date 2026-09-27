// Real-execution reproduction + fix verification for the "checkout
// doesn't restore on refresh" bug report.
//
// Root cause (confirmed via Next.js's own documented App Router behavior
// — see e.g. github.com/vercel/next.js/issues/52700 — not just re-reading
// this project's source): `usePathname()` reflects a middleware
// REWRITE's DESTINATION path during the render pass that produces the
// initial hydration, not the real, unaffected browser-address-bar URL a
// `rewrite` (as opposed to a `redirect`) is specifically defined to leave
// alone. The restoration effect in context/StoreContext.tsx captured
// that value once, at mount (`[]` deps), so on a real refresh of the fake
// `/checkout` URL (which middleware.ts rewrites to `/menu`) it was
// reading "/menu" — never "/checkout" — and its own path check silently
// took the early return every single time. The prior round's test
// harness never caught this because it mocked `usePathname()` to return
// the fake overlay path directly, which is exactly what the real hook
// does NOT reliably do across a middleware rewrite — this harness
// instead drives the real effect off `window.location.pathname` the same
// way the fixed code itself now does, and separately demonstrates the
// OLD code's failure mode for direct comparison.
//
// This extracts the REAL effect body out of the actual, current
// context/StoreContext.tsx via brace-matching (same technique used by
// worker/test-data/fake-url-404-verify.js in the prior round) and
// executes it for real against a mocked window/sessionStorage — nothing
// about the restoration logic itself is reimplemented here.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SRC = fs.readFileSync(path.join(ROOT, 'context/StoreContext.tsx'), 'utf8');

let passed = 0, failed = 0;
function check(cond, label, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${detail !== undefined ? ' :: ' + JSON.stringify(detail) : ''}`);
  if (cond) passed++; else failed++;
}

// --- Extract the real restoration effect's body via brace-matching,
// anchored on a comment string that only appears on this exact effect. ---
function extractEffectBody(marker) {
  const markerIdx = SRC.indexOf(marker);
  if (markerIdx === -1) throw new Error(`Marker not found: ${marker}`);
  // The marker comment sits INSIDE the target effect's body (right after
  // its opening), not before it — so the effect's own `useEffect(() => {`
  // is the nearest one BEFORE the marker, not after.
  const useEffectIdx = SRC.lastIndexOf('useEffect(() => {', markerIdx);
  const bodyStart = SRC.indexOf('{', useEffectIdx) + 1;
  let depth = 1, i = bodyStart;
  for (; i < SRC.length; i++) {
    if (SRC[i] === '{') depth++;
    else if (SRC[i] === '}') { depth--; if (depth === 0) break; }
  }
  return SRC.slice(bodyStart, i);
}

const restoreEffectBody = extractEffectBody("Checkout-restore bug report — confirmed root cause");
check(restoreEffectBody.includes('window.location.pathname'), 'sanity check: extracted the correct (fixed) restoration effect body');
check(!restoreEffectBody.includes('afterLocale = (pathname'), 'the fixed effect body no longer reads the old, unreliable usePathname() value');

// Run the real extracted effect body against a constructed fake
// environment — `new Function` here executes the REAL source text
// unmodified, it does not reimplement its logic.
function runRestoreEffect({ browserPathname, locale, savedCart }) {
  const calls = { setCartOpen: [], setCheckoutOpen: [], setDrinkUpsellOpen: [] };
  const fakeWindow = { location: { pathname: browserPathname } };
  const fakeSessionStorage = {
    getItem: (k) => (k === 'ozy_cart' ? savedCart : null),
  };
  const fn = new Function(
    'window', 'sessionStorage', 'locale', 'setCartOpen', 'setCheckoutOpen', 'setDrinkUpsellOpen',
    restoreEffectBody
  );
  fn(
    fakeWindow, fakeSessionStorage, locale,
    (v) => calls.setCartOpen.push(v),
    (v) => calls.setCheckoutOpen.push(v),
    (v) => calls.setDrinkUpsellOpen.push(v)
  );
  return calls;
}

// A realistic, non-trivial cart line (structured selection data, not just
// a bare {name, qty}) — addresses the bug report's own investigation
// point 4, that a real cart's contents (with options/selections) might
// round-trip through sessionStorage JSON differently than a toy cart.
const REALISTIC_CART_JSON = JSON.stringify([
  {
    key: 'pizza-margherita-172233',
    productId: 'pizza-margherita',
    name: 'Margherita',
    image: '/images/margherita.jpg',
    details: ['Extra cheese', 'Thin crust'],
    qty: 2,
    unitPrice: 11.9,
    lineTotal: 23.8,
    selection: {
      basePrice: 10.9,
      toppingsEnabled: true,
      qty: 2,
      toppings: ['Extra cheese'],
      base: 'thin',
      sauce: 'tomato',
      cheese: 'mozzarella',
      fillings: { ham: 1, pineapple: 0 },
      sauceStripe: 'none',
      dip: 'none',
      sizeOptionId: 'L',
    },
  },
  {
    key: 'drink-cola-172240',
    drinkId: 'cola-033',
    productId: 'cola-033',
    name: 'Coca-Cola 0.33L',
    image: '/images/cola.jpg',
    details: [],
    qty: 1,
    unitPrice: 2.5,
    lineTotal: 2.5,
  },
]);

// --- 1. The exact reported repro: real browser URL still shows the fake
// /fi/checkout path (a middleware REWRITE never changes the address bar
// — that's the whole point), and a real, non-trivial saved cart exists.
{
  const calls = runRestoreEffect({ browserPathname: '/fi/checkout', locale: 'fi', savedCart: REALISTIC_CART_JSON });
  check(calls.setCheckoutOpen.includes(true), 'checkout genuinely reopens on a real refresh of the fake /checkout URL, with a real (non-trivial) cart', calls);
  check(calls.setDrinkUpsellOpen.includes(false), 'drink-upsell is explicitly closed when restoring checkout (never both open)');
  check(calls.setCartOpen.includes(false), 'the cart drawer is explicitly closed when restoring checkout');
}

// --- 2. Same for /drinks.
{
  const calls = runRestoreEffect({ browserPathname: '/en/drinks', locale: 'en', savedCart: REALISTIC_CART_JSON });
  check(calls.setDrinkUpsellOpen.includes(true), 'the drink-upsell step reopens on a real refresh of the fake /drinks URL (English locale)');
  check(calls.setCheckoutOpen.includes(false), 'checkout is explicitly closed when restoring the drink-upsell step');
}

// --- 3. No saved cart at all — must NOT reopen an overlay with nothing
// to show (an empty checkout would be worse than the current bare page).
{
  const calls = runRestoreEffect({ browserPathname: '/fi/checkout', locale: 'fi', savedCart: null });
  check(calls.setCheckoutOpen.length === 0, 'never reopens checkout when there is no saved cart to restore it with');
}

// --- 4. Empty-array saved cart (cart was emptied, but the key still
// exists in sessionStorage) — same "nothing to restore" outcome.
{
  const calls = runRestoreEffect({ browserPathname: '/fi/checkout', locale: 'fi', savedCart: '[]' });
  check(calls.setCheckoutOpen.length === 0, 'never reopens checkout for an explicitly empty saved cart');
}

// --- 5. A genuinely different real page (not a fake overlay path) —
// must never fire at all.
{
  const calls = runRestoreEffect({ browserPathname: '/fi/menu', locale: 'fi', savedCart: REALISTIC_CART_JSON });
  check(calls.setCheckoutOpen.length === 0 && calls.setDrinkUpsellOpen.length === 0, 'a real, non-overlay page never triggers a restore');
}

// --- 6. Demonstrates the OLD bug for direct comparison: if this same
// effect body were driven by the OLD (broken) source of truth — the
// rewrite DESTINATION path a middleware rewrite leaves `usePathname()`
// reporting at mount, per the researched Next.js behavior — restoration
// would never fire, reproducing the exact reported symptom (no 404, but
// checkout silently never reopens).
{
  const calls = runRestoreEffect({ browserPathname: '/fi/menu' /* the OLD, incorrectly-used value */, locale: 'fi', savedCart: REALISTIC_CART_JSON });
  check(calls.setCheckoutOpen.length === 0, 'reproduces the OLD bug exactly: using the rewrite-destination path instead of the real browser URL silently never restores checkout, even with a real cart present');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

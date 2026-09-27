// Source-inspection checks for pieces of the search/cart/checkout brief
// that are impractical to exercise via a full React render in this
// sandbox (no npm registry access, so no real React/Next.js runtime is
// installable — same disclosed limitation as every prior delivery on
// this project). These check the REAL, final source text of the actual
// files for the specific structural properties that matter, the same
// "source-inspection" technique used by worker/test-data/
// fake-url-404-verify.js in the prior round.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

let passed = 0, failed = 0;
function check(cond, label, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${detail !== undefined ? ' :: ' + JSON.stringify(detail) : ''}`);
  if (cond) passed++; else failed++;
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// --- notifyItemAdded (toast + haptics) is wired into exactly the 3 real
// cart-mutating call sites, and NOT into addToCart's bundle-slot branch.
{
  const src = read('context/StoreContext.tsx');

  // Extract the bundleSlotIndex branch body via brace-matching, starting
  // at its own `if (selection.bundleSlotIndex != null) {` inside addToCart.
  const ifIdx = src.indexOf('if (selection.bundleSlotIndex != null) {');
  check(ifIdx !== -1, 'addToCart\'s bundle-slot-filling branch is present (sanity check before extracting it)');
  let depth = 0, i = src.indexOf('{', ifIdx), end = -1;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  const bundleSlotBranch = src.slice(ifIdx, end + 1);
  check(!bundleSlotBranch.includes('notifyItemAdded'), 'notifyItemAdded is never called from the bundle-slot-filling branch (it doesn\'t touch the real cart)');

  // The real-cart branch of addToCart calls it right after trackAddToCart.
  const afterBundleBranch = src.slice(end + 1, src.indexOf('const removeFromCart'));
  check(/trackAddToCart\(\{[\s\S]*?\}\);\s*\n\s*notifyItemAdded\(activeProduct\.name\);/.test(afterBundleBranch), 'addToCart\'s real (non-bundle-slot) branch calls notifyItemAdded right after tracking the add');

  const addDrinkBody = src.slice(src.indexOf('const addDrinkToCart = useCallback'), src.indexOf('const updateCartQty = useCallback'));
  check(/notifyItemAdded\(drink\.name\)/.test(addDrinkBody), 'addDrinkToCart calls notifyItemAdded');

  const addBundleBody = src.slice(src.indexOf('const addBundleToCart = useCallback'), src.indexOf('const closeConfirm = useCallback'));
  check(/notifyItemAdded\(activeBundle\.title\)/.test(addBundleBody), 'addBundleToCart calls notifyItemAdded');

  check(/addedNotice,\s*\n\s*\};/.test(src) || /addBundleToCart,\s*\n\s*addedNotice,/.test(src), 'addedNotice is exposed on the context value for AddedToast.tsx to read');

  check(/navigator\.vibrate\(18\)/.test(src), 'a haptic pulse (~18ms, within the brief\'s 15-20ms ask) fires from notifyItemAdded');
  check(/typeof navigator !== 'undefined' && typeof navigator\.vibrate === 'function'/.test(src), 'the vibrate call is guarded defensively (TypeScript-strict style), consistent with it being safe to call unconditionally per MDN');
}

// --- OrderBar always renders a [data-cart-fly-target] anchor, even when
// the real bar itself is hidden (itemCount 0 / checkout or drink-upsell
// open) — this is what fixes the first-add-to-empty-cart race.
{
  const src = read('components/OrderBar.tsx');
  check(/data-cart-fly-target/.test(src), 'OrderBar carries the data-cart-fly-target attribute lib/flyToCart.ts looks for');
  check(/order-bar-anchor-placeholder/.test(src), 'a placeholder anchor class is used when the real bar is hidden');
  check(!/return null;/.test(src), 'OrderBar no longer ever returns null (it always renders something findable)');
}

// --- CheckoutModal's StepIndicator shows an explicit "Step X of Y" line
// and marks the active dot for assistive tech.
{
  const src = read('components/CheckoutModal.tsx');
  check(/checkout\.stepOfLabel\(step, stepLabels\.length\)/.test(src), 'StepIndicator renders the real "Step X of Y" translation');
  check(/aria-current=\{isActive \? 'step' : undefined\}/.test(src), 'the active step dot carries aria-current="step" for screen readers');
  check(/CartLineQty/.test(src) && /useHoldRepeat\(onDec\)/.test(src), 'the step-1 cart-line qty stepper uses hold-to-repeat');
  check(/triggerFlyToCart\(e\.currentTarget\)/.test(src), 'the drink-tile add uses the flying-to-cart animation');
  check(/if \(sourceEl\) triggerFlyToCart\(sourceEl\);/.test(src), 'handleAdd (extra-list-row) uses the flying-to-cart animation');
  check(/estimatedDeliveryTime\(deliverySettings\.estimatedDeliveryMinutes\)/.test(src), 'the delivery time estimate is shown from real deliverySettings, not a hardcoded number');
  check(/estimatedDeliveryMinutes > 0/.test(src) && /estimatedPickupMinutes > 0/.test(src), 'the time estimate is only shown once actually configured (never an invented number)');
  check(/tryPrefillAddress\(customer\.phone\)/.test(src), 'the phone-blur handler triggers the last-address prefill lookup');
  check(/c\.name\.trim\(\) \? c\.name : \(data\.name \|\| c\.name\)/.test(src), 'prefill only fills the name field when it was empty (never overwrites active typing)');
  check(/c\.address\.trim\(\) \? c\.address : \(data\.address \|\| c\.address\)/.test(src), 'prefill only fills the address field when it was empty');
}

// --- ProductPage/BundleModal/DrinkUpsellModal all wire the flying
// animation from their own real hero/thumbnail image.
{
  const pp = read('components/ProductPage.tsx');
  check(/heroImgRef/.test(pp) && /if \(!isBundleSlot\) triggerFlyToCart\(heroImgRef\.current\);/.test(pp), 'ProductPage flies from its own hero image, and never when only filling a bundle slot');
  check(/mainQtyDecRepeat/.test(pp) && /useHoldRepeat\(\(\) => setQty/.test(pp), 'ProductPage\'s main quantity stepper uses hold-to-repeat');

  const bm = read('components/BundleModal.tsx');
  check(/heroImgRef/.test(bm) && /triggerFlyToCart\(heroImgRef\.current\)/.test(bm), 'BundleModal flies from its own hero image on addBundleToCart');

  const dm = read('components/DrinkUpsellModal.tsx');
  check(/pick\(d, e\.currentTarget\)/.test(dm) && /triggerFlyToCart\(sourceEl\)/.test(dm), 'DrinkUpsellModal flies from the clicked drink card');
}

// --- AddedToast is mounted in every page shell that has its own OrderBar.
for (const rel of ['components/HomePageClient.tsx', 'components/MenuPageClient.tsx', 'components/ProductPageStandalone.tsx']) {
  const src = read(rel);
  check(/<AddedToast \/>/.test(src) && /import AddedToast/.test(src), `${rel} mounts <AddedToast />`);
}

// --- deliverySettings type/state/parsing all extended consistently.
{
  const src = read('context/StoreContext.tsx');
  check(/estimatedDeliveryMinutes: number; estimatedPickupMinutes: number/.test(src), 'deliverySettings\' TS type includes the two new estimate fields');
  check(/estimated_delivery_minutes/.test(src) && /estimated_pickup_minutes/.test(src), 'the new admin_settings keys are actually parsed');
  check(/rawDeliveryMinutes > 0/.test(src), 'an unset/zero estimate parses to 0 (never a fabricated default)');
}

// --- Admin dashboard exposes the two new settings fields.
{
  const src = read('app/admin/dashboard/page.tsx');
  check(/key: 'estimated_delivery_minutes'/.test(src), 'admin dashboard has an Estimated delivery time field');
  check(/key: 'estimated_pickup_minutes'/.test(src), 'admin dashboard has an Estimated pickup time field');
}

// --- i18n keys exist in BOTH locales for every new string (a key added
// to one belongs in the other too, per this file's own stated convention).
{
  const en = read('lib/i18n/en.tsx');
  const fi = read('lib/i18n/fi.tsx');
  const keys = [
    'addedToCart', 'recentSearchesHeading', 'didYouMean', 'stepOfLabel',
    'estimatedDeliveryTime', 'estimatedPickupTime', 'addressPrefilledNotice', 'addressPrefilledClear',
  ];
  for (const key of keys) {
    check(en.includes(`${key}:`), `en.tsx defines "${key}"`);
    check(fi.includes(`${key}:`), `fi.tsx defines "${key}"`);
  }
}

// --- New CSS classes referenced by the new JSX all exist in app/globals.css
// (the file actually imported/served — see this round's own finding about
// the root-level globals.css being unused/orphaned).
{
  const css = read('app/globals.css');
  const classes = [
    '.search-hl', '.menu-search-recent', '.menu-search-recent-heading', '.menu-search-recent-item',
    '.menu-search-suggestion', '.checkout-step-of', '.order-bar-anchor-placeholder', '.fly-to-cart-ghost',
    '.added-toast',
  ];
  for (const cls of classes) {
    check(css.includes(cls), `app/globals.css defines ${cls}`);
  }
  check(/\.mini-summary\{[^}]*position: sticky/.test(css), '.mini-summary has sticky positioning for the checkout-improvements brief\'s item 14');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

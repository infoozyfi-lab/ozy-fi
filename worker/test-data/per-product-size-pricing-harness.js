// Runtime verification harness for lib/pricing.ts — per-product-size brief.
// Transpiles the REAL lib/pricing.ts (CommonJS) and calls its REAL exported
// functions with constructed data mirroring worker/test-data/
// per-product-size-demo.sql's two independent test products, exactly as
// the pizza-size-feature brief's own harness did. No mocking of the
// functions under test — only the MenuBlob/product data is constructed.

const ts = require('typescript');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const SRC_PATH = path.resolve(__dirname, '../../lib/pricing.ts');
const src = fs.readFileSync(SRC_PATH, 'utf8');
const out = ts.transpileModule(src, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    strict: true,
  },
  fileName: SRC_PATH,
});

const m = new Module(SRC_PATH, module.parent);
m.filename = SRC_PATH;
m.paths = Module._nodeModulePaths(path.dirname(SRC_PATH));
m._compile(out.outputText, SRC_PATH);
const pricing = m.exports;

const {
  calcUnitPriceFromSelection,
  verifyProductLine,
  verifyBundleLine,
  verifyCartLine,
  computeCurrentProductPrice,
} = pricing;

let passed = 0;
let failed = 0;
function assertEqual(actual, expected, label) {
  const ok = Math.abs(actual - expected) < 0.001;
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${label} (expected ${expected}, got ${actual})`);
  if (ok) passed++; else failed++;
}
function assertTrue(cond, label, extra) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${extra ? ' :: ' + JSON.stringify(extra) : ''}`);
  if (cond) passed++; else failed++;
}

// ---------------------------------------------------------------------
// Construct a MenuBlob matching worker/test-data/per-product-size-demo.sql
// exactly (ids, deltas, base prices) — real production data shape, just
// hand-built instead of read from a live D1 instance (no D1 available in
// this sandbox).
const productA_sizeOptions = [
  { id: 'test-size-a-regular', label: 'TEST Regular', delta: 0 },
  { id: 'test-size-a-jumbo', label: 'TEST Jumbo', delta: 2.5 },
  { id: 'test-size-a-mega', label: 'TEST Mega', delta: 5.0 },
];
const productB_sizeOptions = [
  { id: 'test-size-b-small', label: 'TEST Small', delta: 0 },
  { id: 'test-size-b-large', label: 'TEST Large', delta: 4.75 },
];
// Product C — no 'size' group configured at all (e.g. a non-pizza item, or
// a pizza nobody has added size tiers to yet). normalizeMenuBlob's real
// fallback (lib/menu-i18n.ts) is `p.sizeOptions = sizeOptionsByProduct[p.id]
// || FALLBACK_OPTION` — FALLBACK_OPTION is a single synthetic
// "Default"-style entry at delta 0. Reproduced here exactly.
const FALLBACK_OPTION = [{ id: 'default', label: 'Default', delta: 0 }];
const productC_sizeOptions = FALLBACK_OPTION;

const menu = {
  products: [
    { id: 'TEST-per-product-size-a', name: '[TEST] Per-Product Size Demo A', price: 8.0, toppingsEnabled: true, sizeOptions: productA_sizeOptions },
    { id: 'TEST-per-product-size-b', name: '[TEST] Per-Product Size Demo B', price: 11.0, toppingsEnabled: true, sizeOptions: productB_sizeOptions },
    { id: 'TEST-no-size-group-c', name: '[TEST] No Size Group C', price: 6.5, toppingsEnabled: true, sizeOptions: productC_sizeOptions },
  ],
  drinks: [], dipCups: [], snacks: [],
  toppings: [{ id: 'topping-1', label: 'Extra cheese', delta: 1.5 }],
  baseOptions: [{ id: 'base-classic', label: 'Classic', delta: 0 }],
  sauceOptions: [{ id: 'sauce-tomato', label: 'Tomato', delta: 0 }],
  cheeseOptions: [{ id: 'cheese-normal', label: 'Normal', delta: 0 }],
  sauceStripeOptions: [{ id: 'stripe-none', label: 'None', delta: 0 }],
  dipOptions: [{ id: 'dip-none', label: 'None', delta: 0 }],
  fillingCategories: [],
  bundles: [],
};

function emptySelection(overrides) {
  return Object.assign({
    toppingIds: [],
    baseId: 'base-classic',
    sauceId: 'sauce-tomato',
    cheeseId: 'cheese-normal',
    sauceStripeId: 'stripe-none',
    dipId: 'dip-none',
    fillings: {},
  }, overrides);
}

console.log('=== 1. Two independent products, each own correct price ===');
assertEqual(
  calcUnitPriceFromSelection(8.0, true, emptySelection({ sizeOptionId: 'test-size-a-regular' }), menu, productA_sizeOptions),
  8.0, 'Product A / Regular (delta 0)'
);
assertEqual(
  calcUnitPriceFromSelection(8.0, true, emptySelection({ sizeOptionId: 'test-size-a-jumbo' }), menu, productA_sizeOptions),
  10.5, 'Product A / Jumbo (delta 2.50)'
);
assertEqual(
  calcUnitPriceFromSelection(8.0, true, emptySelection({ sizeOptionId: 'test-size-a-mega' }), menu, productA_sizeOptions),
  13.0, 'Product A / Mega (delta 5.00)'
);
assertEqual(
  calcUnitPriceFromSelection(11.0, true, emptySelection({ sizeOptionId: 'test-size-b-small' }), menu, productB_sizeOptions),
  11.0, 'Product B / Small (delta 0)'
);
assertEqual(
  calcUnitPriceFromSelection(11.0, true, emptySelection({ sizeOptionId: 'test-size-b-large' }), menu, productB_sizeOptions),
  15.75, 'Product B / Large (delta 4.75)'
);

console.log('\n=== 2. verifyProductLine — full-stack, both products\' legitimate prices accepted ===');
assertTrue(
  verifyProductLine({ productId: 'TEST-per-product-size-a', qty: 1, lineTotal: 13.0, selection: emptySelection({ sizeOptionId: 'test-size-a-mega' }) }, menu).ok === true,
  'A/Mega with correct lineTotal 13.00 is accepted'
);
assertTrue(
  verifyProductLine({ productId: 'TEST-per-product-size-b', qty: 1, lineTotal: 15.75, selection: emptySelection({ sizeOptionId: 'test-size-b-large' }) }, menu).ok === true,
  'B/Large with correct lineTotal 15.75 is accepted'
);
assertTrue(
  verifyProductLine({ productId: 'TEST-per-product-size-a', qty: 3, lineTotal: 31.5, selection: emptySelection({ sizeOptionId: 'test-size-a-jumbo' }) }, menu).ok === true,
  'A/Jumbo x3 with correct lineTotal 31.50 is accepted (qty scaling)'
);

console.log('\n=== 3. Cross-product tamper — foreign sizeOptionId never leaks its delta ===');
const foreignDeltaLeak = calcUnitPriceFromSelection(11.0, true, emptySelection({ sizeOptionId: 'test-size-a-jumbo' }), menu, productB_sizeOptions);
assertEqual(
  foreignDeltaLeak, 11.0,
  "Product B priced with A's 'test-size-a-jumbo' id looked up against B's OWN sizeOptions — id not found, contributes 0 (NOT B's base + A's 2.50 delta = 13.50)"
);

console.log('\n=== 4. Cross-product tamper — full verifyProductLine rejects the exploit ===');
// Attacker checks out product B (true minimum price 11.00, Large is 15.75)
// but submits a lineTotal equal to product A's cheap BASE price (8.00),
// referencing one of A's own real option ids as if that somehow justified
// the discount. The server must price it from B's own data alone.
const tamperResult = verifyProductLine(
  {
    productId: 'TEST-per-product-size-b',
    qty: 1,
    lineTotal: 8.0, // product A's base price — NOT a legitimate price for B (min 11.00)
    selection: emptySelection({ sizeOptionId: 'test-size-a-regular' }),
  },
  menu
);
assertTrue(tamperResult.ok === false, 'Tampered checkout of product B using product A\'s cheap price is REJECTED', tamperResult);
assertEqual(tamperResult.expectedUnitPrice ?? -1, -1, '(expectedUnitPrice is only set on success — confirming this really is the rejection branch)');

// A second, more realistic variant: attacker wants B's expensive Large
// (true 15.75) but sends B's own Small id with a lineTotal that pretends
// the size was Large-priced while claiming the cheap tier's id — same
// underlying protection (server always recomputes from B's own data),
// just phrased as "claim the cheap id, send the expensive lineTotal" to
// show the check isn't fooled by relationship between the two either way.
const tamperResult2 = verifyProductLine(
  {
    productId: 'TEST-per-product-size-b',
    qty: 1,
    lineTotal: 15.75,
    selection: emptySelection({ sizeOptionId: 'test-size-b-small' }), // real B id, but the CHEAP one
  },
  menu
);
assertTrue(tamperResult2.ok === false, 'Claiming B/Small\'s id while paying for B/Large\'s price mismatch is REJECTED', tamperResult2);

console.log('\n=== 5. M/L fully retired — a legacy `size: "L"` key on the selection is inert ===');
const legacySelection = emptySelection({ sizeOptionId: 'test-size-a-regular', size: 'L' }); // stray historical key
const legacyUnit = calcUnitPriceFromSelection(8.0, true, legacySelection, menu, productA_sizeOptions);
assertEqual(legacyUnit, 8.0, 'A legacy `size: "L"` key adds NO upcharge (sizeLargeUpcharge is fully removed) — price is purely from sizeOptionId');
const legacyLineResult = verifyProductLine({ productId: 'TEST-per-product-size-a', qty: 1, lineTotal: 8.0, selection: legacySelection }, menu);
assertTrue(legacyLineResult.ok === true, 'validateSelectionShape does not reject the stray legacy `size` key (extra property, harmlessly ignored)', legacyLineResult);

console.log('\n=== 6. No size group configured — falls back cleanly, no crash ===');
const noSizeResult = verifyProductLine({ productId: 'TEST-no-size-group-c', qty: 1, lineTotal: 6.5, selection: emptySelection({}) }, menu);
assertTrue(noSizeResult.ok === true, 'Product with FALLBACK_OPTION-only sizeOptions and no sizeOptionId selected prices at its plain base price', noSizeResult);
const noSizeWithBadId = calcUnitPriceFromSelection(6.5, true, emptySelection({ sizeOptionId: 'test-size-a-mega' }), menu, productC_sizeOptions);
assertEqual(noSizeWithBadId, 6.5, "A size id from another product against a no-size-group product's FALLBACK_OPTION list still contributes 0 (not found)");

console.log('\n=== 7. Reorder (computeCurrentProductPrice) — historical selection_json compatibility ===');
// Simulates a parsed selection_json blob the way it could look for an
// order placed before this brief (M/L era) OR after it (sizeOptionId era)
// — either way, computeCurrentProductPrice must price it at TODAY's real
// per-product size data, never crash, and never apply any M/L upcharge.
const historicalBlob = { toppingIds: ['Pepperoni'], baseId: 'base-classic', sauceId: 'sauce-tomato', cheeseId: 'cheese-normal', sauceStripeId: 'stripe-none', dipId: 'dip-none', fillings: {}, size: 'L', sizeOptionId: 'test-size-a-jumbo' };
const reorderResult = computeCurrentProductPrice('TEST-per-product-size-a', historicalBlob, menu);
assertTrue(reorderResult.ok === true, 'Reorder of a historical (mixed M/L + sizeOptionId) blob succeeds', reorderResult);
assertEqual(reorderResult.unitPrice ?? -1, 8.0 + 1.5 + 2.5, 'Reorder price = base + 1 topping (1.50) + Jumbo delta (2.50), size:"L" contributes nothing');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

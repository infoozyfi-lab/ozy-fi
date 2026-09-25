// Real-execution verification for the option-gating-and-extras-system
// brief — Task 1 (per-row gating), Task 2 (general 'extra' option kind),
// Task 3 (additional_info). Loads and calls the REAL, current
// lib/menu-i18n.ts's normalizeMenuBlob()/normalizeProducts() and
// lib/pricing.ts's calcUnitPriceFromSelection()/validateSelectionShape()
// (indirectly, via verifyProductLine)/computeCurrentProductPrice() — the
// exact same functions the live site's /api/menu route and POST
// /api/orders's price verification actually call — never a
// reimplementation of any of them. Same Module._resolveFilename/
// Module._extensions hook as this project's other harnesses
// (worker/test-data/menu-import-verify.js) for @/* alias resolution.

const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '../..');

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.startsWith('@/')) {
    const rel = request.slice(2);
    for (const ext of ['.ts', '.tsx']) {
      const candidate = path.join(ROOT, rel + ext);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return origResolve.call(this, request, parent, isMain, options);
};
Module._extensions['.ts'] = Module._extensions['.tsx'] = function (module, filename) {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX, strict: false },
    fileName: filename,
  }).outputText;
  module._compile(out, filename);
};

let passed = 0, failed = 0;
function check(cond, label, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${detail !== undefined ? ' :: ' + JSON.stringify(detail) : ''}`);
  if (cond) passed++; else failed++;
}

const { normalizeMenuBlob, normalizeProducts } = require(path.join(ROOT, 'lib/menu-i18n.ts'));
const { calcUnitPriceFromSelection, verifyProductLine, computeCurrentProductPrice } = require(path.join(ROOT, 'lib/pricing.ts'));

// ---------------------------------------------------------------------
// Fixture — mirrors the REAL post-migration-023 shape confirmed by the
// SQLite dry run (worker/test-data/dry_run_023 equivalent, see this
// feature's delivery report): a pizza (real base group, real size group,
// has_toppings=1, no sauce/cheese/sauce_stripe/dip/filling groups — the
// actual current live state per migration 022, no extras) and a kebab
// (has_toppings=0, no size group, real 'extra' group from migration 023).
// ---------------------------------------------------------------------
const rawMenuData = {
  categories: [{ id: 'pizzat', title: 'Pizzat' }, { id: 'kebabit', title: 'Kebabit' }],
  products: [
    { id: 'pizzat-0', category_id: 'pizzat', name: 'Bolognese', price: 10.9, has_toppings: 1, active: 1 },
    { id: 'kebabit-0', category_id: 'kebabit', name: 'Kebab in Bread', price: 11.9, has_toppings: 0, active: 1 },
    // A second kebab-style product with NO extras configured at all, to
    // prove hasRealExtras-equivalent logic (an empty extraOptions array)
    // for a product nobody has added extras to yet.
    { id: 'kebabit-1', category_id: 'kebabit', name: 'Kebab with Rice', price: 11.9, has_toppings: 0, active: 1 },
  ],
  optionGroups: [
    { id: 'base', kind: 'base', product_id: null, options: [
      { id: 'base-classic', label: 'Classic', price_delta: 0 },
      { id: 'base-gluten-free', label: 'Gluten-free', price_delta: 4.0 },
    ] },
    { id: 'toppings', kind: 'topping', product_id: null, options: [
      { id: 'toppings-ham', label: 'Ham', price_delta: 2.0 },
    ] },
    { id: 'size-pizzat-0', kind: 'size', product_id: 'pizzat-0', options: [
      { id: 'size-pizzat-0-perhe', label: 'Perhe', price_delta: 9.0 },
    ] },
    // Real per-product 'extra' group — only kebabit-0 has one (mirrors
    // migration 023's mandatory kebab population). kebabit-1 deliberately
    // has NONE, same as a real product nobody's added extras to yet.
    { id: 'extra-kebabit-0', kind: 'extra', product_id: 'kebabit-0', options: [
      { id: 'extra-kebabit-0-double-meat', label: 'Double meat', price_delta: 4.0 },
      { id: 'extra-kebabit-0-yogurt-sauce', label: 'Yogurt sauce', price_delta: 1.5 },
    ] },
    // NO 'sauce'/'cheese'/'sauce_stripe'/'dip'/'filling' groups at all —
    // matches the real current post-migration-022 live state exactly
    // (confirmed via worker/migrations/022_pizza_kuningas_menu_import.sql
    // itself — see this feature's delivery report).
  ],
  addons: [],
  bundles: [],
  settings: {},
  scheduledOffers: [],
};

console.log('=== Task 1 — normalizeMenuBlob() global option lists, real vs. fallback ===');
const blob = normalizeMenuBlob(rawMenuData, 'en');
check(blob.baseOptions.length === 2 && blob.baseOptions[0].id !== 'default', 'baseOptions is REAL (2 configured options) — a hasRealBase check on this would be true', blob.baseOptions.map((o) => o.id));
check(blob.sauceOptions.length === 1 && blob.sauceOptions[0].id === 'default', 'sauceOptions is the FALLBACK single "default" entry (no sauce group configured) — a hasRealSauce check on this would be false', blob.sauceOptions);
check(blob.cheeseOptions.length === 1 && blob.cheeseOptions[0].id === 'default', 'cheeseOptions is the FALLBACK entry — hasRealCheese would be false', blob.cheeseOptions);
check(blob.sauceStripeOptions.length === 1 && blob.sauceStripeOptions[0].id === 'default', 'sauceStripeOptions is the FALLBACK entry — hasRealSauceStripe would be false', blob.sauceStripeOptions);
check(blob.dipOptions.length === 1 && blob.dipOptions[0].id === 'default', 'dipOptions (per-product option-group dip, not cart addons) is the FALLBACK entry — hasRealDip would be false', blob.dipOptions);
check(blob.fillingCategories.length === 0, 'fillingCategories is empty — hasRealFillingCategories would be false ("More Fillings" section renders nothing)', blob.fillingCategories);

console.log('\n=== Task 2 — normalizeMenuBlob() per-product extraOptions ===');
const pizza = blob.products.find((p) => p.id === 'pizzat-0');
const kebab0 = blob.products.find((p) => p.id === 'kebabit-0');
const kebab1 = blob.products.find((p) => p.id === 'kebabit-1');
check(Array.isArray(pizza.extraOptions) && pizza.extraOptions.length === 0, 'pizzat-0 (no extra group) gets an EMPTY extraOptions array — no synthesized entry, unlike sizeOptions', pizza.extraOptions);
check(kebab0.extraOptions.length === 2, 'kebabit-0 gets its own 2 real extras', kebab0.extraOptions.map((o) => [o.label, o.delta]));
check(kebab1.extraOptions.length === 0, 'kebabit-1 (a real product with NO extras configured yet) gets an empty array too — not kebabit-0\'s extras leaking across products', kebab1.extraOptions);
check(kebab0.toppingsEnabled === false, 'kebabit-0.toppingsEnabled is false (has_toppings=0) — extras must still work on this product per Task 2');

console.log('\n=== Task 2 — calcUnitPriceFromSelection() extras pricing, independent of has_toppings ===');
// A kebab (toppingsEligible=false) with 1 selected extra — must price
// correctly even though the whole toppings/size/base/etc. formula is
// gated off for this product.
const kebabOneExtra = calcUnitPriceFromSelection(
  kebab0.price, kebab0.toppingsEnabled,
  { toppingIds: [], fillings: {}, extraIds: ['extra-kebabit-0-double-meat'] },
  blob, kebab0.sizeOptions, kebab0.extraOptions
);
check(Math.abs(kebabOneExtra - (11.9 + 4.0)) < 0.001, 'kebab (has_toppings=0) + 1 extra (Double meat +4.00) = 11.90+4.00 = 15.90 — extras price WITHOUT has_toppings', kebabOneExtra);

const kebabTwoExtras = calcUnitPriceFromSelection(
  kebab0.price, kebab0.toppingsEnabled,
  { toppingIds: [], fillings: {}, extraIds: ['extra-kebabit-0-double-meat', 'extra-kebabit-0-yogurt-sauce'] },
  blob, kebab0.sizeOptions, kebab0.extraOptions
);
check(Math.abs(kebabTwoExtras - (11.9 + 4.0 + 1.5)) < 0.001, 'kebab + both extras selected = 11.90+4.00+1.50 = 17.40 (each extra its OWN delta, not a flat rate)', kebabTwoExtras);

const kebabNoExtras = calcUnitPriceFromSelection(
  kebab0.price, kebab0.toppingsEnabled,
  { toppingIds: [], fillings: {} },
  blob, kebab0.sizeOptions, kebab0.extraOptions
);
check(Math.abs(kebabNoExtras - 11.9) < 0.001, 'kebab with no extraIds field at all (a plain request) resolves to its plain base price', kebabNoExtras);

console.log('\n=== Task 2 — cross-product tamper protection (extras), mirrors the already-proven size tamper test ===');
const tamperedKebab1 = calcUnitPriceFromSelection(
  kebab1.price, kebab1.toppingsEnabled,
  { toppingIds: [], fillings: {}, extraIds: ['extra-kebabit-0-double-meat'] /* a REAL id, but for a DIFFERENT product (kebabit-0) */ },
  blob, kebab1.sizeOptions, kebab1.extraOptions /* kebab1's OWN (empty) extras */
);
check(Math.abs(tamperedKebab1 - 11.9) < 0.001, 'kebabit-1 priced with kebabit-0\'s real extraId contributes 0 (never resolves to the other product\'s extra price) — looked up only against kebabit-1\'s OWN (empty) extraOptions', tamperedKebab1);

console.log('\n=== Task 2 — extras combine correctly with a toppings-enabled product\'s existing pricing (pizza has no extras here, but the additive formula must not break when extraIds is present alongside a full pizza selection) ===');
const pizzaSelection = {
  toppingIds: ['toppings-ham'],
  fillings: {},
  baseId: 'base-gluten-free',
  sizeOptionId: pizza.sizeOptions[1].id, // Perhe (index 0 is the synthesized base entry)
  extraIds: [], // pizza has no real extras — always empty in practice, but must not crash or add anything
};
const pizzaUnit = calcUnitPriceFromSelection(pizza.price, pizza.toppingsEnabled, pizzaSelection, blob, pizza.sizeOptions, pizza.extraOptions);
// 10.90 (base) + 9.00 (Perhe) + 1*2.00 (topping) + 4.00 (gluten-free) = 25.90
check(Math.abs(pizzaUnit - 25.9) < 0.001, 'pizza + Perhe + 1 topping + gluten-free crust, with an empty extraIds array, still prices exactly as before this brief: 25.90', pizzaUnit);

console.log('\n=== Task 2 — verifyProductLine() full-stack acceptance + rejection, extras included ===');
const acceptResult = verifyProductLine(
  { productId: 'kebabit-0', qty: 1, lineTotal: 17.4, selection: { toppingIds: [], fillings: {}, extraIds: ['extra-kebabit-0-double-meat', 'extra-kebabit-0-yogurt-sauce'] } },
  blob
);
check(acceptResult.ok === true, 'kebab + both real extras with the CORRECT lineTotal (17.40) is accepted', acceptResult);

const tamperReject = verifyProductLine(
  { productId: 'kebabit-1', qty: 1, lineTotal: 15.9, selection: { toppingIds: [], fillings: {}, extraIds: ['extra-kebabit-0-double-meat'] } },
  blob
);
check(tamperReject.ok === false, 'kebabit-1 checkout claiming kebabit-0\'s extra + a lineTotal that assumes it applied is REJECTED', tamperReject);

console.log('\n=== Task 2 — backward compatibility: a HISTORICAL selection_json with no extraIds field at all still validates ===');
// Simulates a real order placed before this feature existed — its stored
// selection_json never had an extraIds key. computeCurrentProductPrice
// (the reorder path) must still price it correctly from every OTHER
// field, exactly like the already-proven historical `size: "L"` case.
const historicalBlob = { toppingIds: ['toppings-ham'], baseId: 'base-gluten-free', fillings: {}, sizeOptionId: pizza.sizeOptions[1].id };
const reorderResult = computeCurrentProductPrice('pizzat-0', historicalBlob, blob);
check(reorderResult.ok === true, 'reorder of a historical (pre-extras) selection_json blob still succeeds', reorderResult);
check(Math.abs((reorderResult.unitPrice ?? -1) - 25.9) < 0.001, 'reorder price is unaffected by the missing extraIds field: still 25.90', reorderResult.unitPrice);

console.log('\n=== Task 3 — normalizeProducts() additionalInfo bilingual resolution ===');
const rawProductsForInfo = [
  { id: 'p-both', category_id: 'x', name: 'Both', price: 5, active: 1, additional_info: 'EN note', additional_info_fi: 'FI note' },
  { id: 'p-en-only', category_id: 'x', name: 'EN only', price: 5, active: 1, additional_info: 'EN note only' },
  { id: 'p-none', category_id: 'x', name: 'None', price: 5, active: 1 },
];
const normEn = normalizeProducts(rawProductsForInfo, 'en');
const normFi = normalizeProducts(rawProductsForInfo, 'fi');
check(normEn.find((p) => p.id === 'p-both').additionalInfo === 'EN note', 'EN locale reads the EN column when both are set', normEn.find((p) => p.id === 'p-both').additionalInfo);
check(normFi.find((p) => p.id === 'p-both').additionalInfo === 'FI note', 'FI locale reads the FI column when both are set', normFi.find((p) => p.id === 'p-both').additionalInfo);
check(normFi.find((p) => p.id === 'p-en-only').additionalInfo === 'EN note only', 'FI locale falls back to the EN column when no FI translation exists yet (same resolveText fallback every other bilingual field uses)', normFi.find((p) => p.id === 'p-en-only').additionalInfo);
check(normEn.find((p) => p.id === 'p-none').additionalInfo === '', 'a product with neither column set resolves to \'\' (empty string) — components/ProductPage.tsx treats this as "render nothing"', JSON.stringify(normEn.find((p) => p.id === 'p-none').additionalInfo));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

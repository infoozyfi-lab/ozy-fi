// Real-execution verification for the Pizza Kuningas full-menu-import
// migration (worker/migrations/022_pizza_kuningas_menu_import.sql).
//
// The SQL-level dry run (a real SQLite database seeded from the real
// worker/schema.sql, then this migration run against it — see this
// feature's delivery report) already confirmed the migration executes
// cleanly with no FK/constraint errors and produces the right row
// counts. This harness goes one level further, per the brief's own
// "How to verify" — it takes the REAL rows that dry run produced
// (worker/test-data/menu-import-real-rows.json, a snapshot of every
// categories/products/option_groups/options/addons row after running
// the migration) and traces them through the REAL, current
// lib/menu-i18n.ts's normalizeMenuBlob() and lib/pricing.ts's
// calcUnitPriceFromSelection() — the exact same functions the live
// site's /api/menu route and POST /api/orders's price verification
// actually call — never a reimplementation of either.

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

const { normalizeMenuBlob } = require(path.join(ROOT, 'lib/menu-i18n.ts'));
const { calcUnitPriceFromSelection } = require(path.join(ROOT, 'lib/pricing.ts'));

// ---------------------------------------------------------------------
// Load the real post-migration rows (see worker/test-data/
// menu-import-real-rows.json's own header note) and build the exact
// MenuData shape lib/menu-data.ts's loadMenuData() builds — a pure,
// deterministic join (options grouped onto their option_groups row by
// group_id), not something that needs a live D1 binding to reproduce.
// ---------------------------------------------------------------------
const real = JSON.parse(fs.readFileSync(path.join(__dirname, 'menu-import-real-rows.json'), 'utf8'));

const optionsByGroup = {};
for (const o of real.options) {
  (optionsByGroup[o.group_id] ||= []).push(o);
}
const optionGroups = real.groups.map((g) => ({ ...g, options: optionsByGroup[g.id] || [] }));

const rawMenuData = {
  categories: real.categories,
  products: real.products,
  optionGroups,
  addons: real.addons,
  bundles: [],
  settings: {},
  scheduledOffers: [],
};

console.log('=== normalizeMenuBlob() against the real post-migration rows ===');
const blob = normalizeMenuBlob(rawMenuData, 'en');

check(blob.categories.length === 14, '14 categories in the normalized blob', blob.categories.length);
check(blob.products.length === 104, '104 products in the normalized blob', blob.products.length);
check(blob.toppings.length === 30, '30 Lisätäytteet toppings in the normalized blob', blob.toppings.length);
check(blob.toppings.every((t) => t.delta === 2), 'every topping resolves to the same flat 2.00 delta', [...new Set(blob.toppings.map((t) => t.delta))]);
check(blob.baseOptions.length === 2, '2 crust (base) options — real Pizza Kuningas data, not the retired demo crust list', blob.baseOptions.map((o) => o.label));
check(blob.dipCups.length === 7, '7 dip addons', blob.dipCups.length);
check(blob.drinks.length === 3, '3 drink addons', blob.drinks.length);

console.log('\n=== pizzat-0 (3-size pizza) — real sizeOptions ladder ===');
const bolognese = blob.products.find((p) => p.id === 'pizzat-0');
check(!!bolognese, 'pizzat-0 present in normalized products');
check(bolognese.sizeOptions.length === 3, 'pizzat-0.sizeOptions has 3 entries: synthetic Normaali + Pannu + Perhe', bolognese.sizeOptions.map((o) => [o.label, o.delta]));
check(bolognese.sizeOptions[0].delta === 0 && bolognese.sizeOptions[0].id.startsWith('size-base-'), 'entry 0 is the synthetic base/Normaali entry (delta 0)', bolognese.sizeOptions[0]);
check(bolognese.sizeOptions[1].label === 'Pannu' && bolognese.sizeOptions[1].delta === 5.6, 'entry 1 is Pannu, +5.60', bolognese.sizeOptions[1]);
check(bolognese.sizeOptions[2].label === 'Perhe' && bolognese.sizeOptions[2].delta === 9, 'entry 2 is Perhe, +9.00', bolognese.sizeOptions[2]);
check(bolognese.toppingsEnabled === true, 'pizzat-0.toppingsEnabled is true (required for size + toppings to price/render at all)');

console.log('\n=== pesto-pizzat-0 (2-size pizza, no Pannu) — real sizeOptions ladder ===');
const pesto = blob.products.find((p) => p.id === 'pesto-pizzat-0');
check(pesto.sizeOptions.length === 2, 'pesto-pizzat-0.sizeOptions has EXACTLY 2 entries (base + Perhe only), not 3', pesto.sizeOptions.map((o) => [o.label, o.delta]));
check(pesto.sizeOptions[1].label === 'Perhe' && pesto.sizeOptions[1].delta === 10, 'entry 1 is Perhe, +10.00', pesto.sizeOptions[1]);

console.log('\n=== voner-0 (no size group at all) — falls back to the single Default entry ===');
const voner = blob.products.find((p) => p.id === 'voner-0');
check(voner.sizeOptions.length === 1 && voner.sizeOptions[0].id === 'default', 'voner-0.sizeOptions is the FALLBACK_OPTION single entry (no real size group ever existed for it)', voner.sizeOptions);
check(voner.toppingsEnabled === false, 'voner-0.toppingsEnabled is false (no pizza-builder UI on a non-pizza item)');

console.log('\n=== calcUnitPriceFromSelection() — real end-to-end pricing ===');
// A customer picks pizzat-0, Perhe size, 2 real toppings, gluten-free crust.
const boloSelection = {
  toppingIds: ['toppings-ham', 'toppings-mushroom'],
  fillings: {},
  baseId: 'base-gluten-free',
  sizeOptionId: bolognese.sizeOptions[2].id, // Perhe
};
const boloUnit = calcUnitPriceFromSelection(bolognese.basePrice, bolognese.toppingsEnabled, boloSelection, blob, bolognese.sizeOptions);
// 10.90 (base) + 9.00 (Perhe) + 2*2.00 (toppings) + 4.00 (gluten-free crust) = 27.90
check(Math.abs(boloUnit - 27.9) < 0.001, 'pizzat-0 + Perhe + 2 toppings + gluten-free crust = 10.90+9.00+4.00+4.00 = 27.90', boloUnit);

// Same product, no customization at all (every option left at its
// implicit default) — should resolve to exactly the base price, since
// the synthetic Normaali entry (index 0) carries delta 0 and an absent
// baseId/toppingIds/etc. all contribute 0.
const boloDefaultSelection = { toppingIds: [], fillings: {}, sizeOptionId: bolognese.sizeOptions[0].id };
const boloDefaultUnit = calcUnitPriceFromSelection(bolognese.basePrice, bolognese.toppingsEnabled, boloDefaultSelection, blob, bolognese.sizeOptions);
check(Math.abs(boloDefaultUnit - 10.9) < 0.001, 'pizzat-0 with every option left at default = base price 10.90 exactly', boloDefaultUnit);

// A Pesto pizza's Perhe tier, no toppings.
const pestoSelection = { toppingIds: [], fillings: {}, sizeOptionId: pesto.sizeOptions[1].id };
const pestoUnit = calcUnitPriceFromSelection(pesto.basePrice, pesto.toppingsEnabled, pestoSelection, blob, pesto.sizeOptions);
check(Math.abs(pestoUnit - 21.9) < 0.001, 'pesto-pizzat-0 + Perhe = 11.90+10.00 = 21.90', pestoUnit);

// A tampered sizeOptionId naming a DIFFERENT product's size tier must
// contribute 0 (never resolve to the other product's price) — the exact
// money-critical guarantee this project's own pricing.ts header comment
// documents, re-confirmed here against this migration's real data.
const tamperSelection = { toppingIds: [], fillings: {}, sizeOptionId: 'uutuus-pizzat-0-perhe' /* a real id, but for a DIFFERENT product */ };
const tamperUnit = calcUnitPriceFromSelection(bolognese.basePrice, bolognese.toppingsEnabled, tamperSelection, blob, bolognese.sizeOptions);
check(Math.abs(tamperUnit - 10.9) < 0.001, 'a real but WRONG-PRODUCT sizeOptionId contributes 0, not the other pizza\'s tier price', tamperUnit);

// voner-0 (toppingsEnabled=false) — even a maximally-tampered selection
// must be entirely ignored; calcUnitPriceFromSelection returns basePrice
// unconditionally per its own `if (!toppingsEligible) return unit;` guard.
const vonerTamperSelection = { toppingIds: ['toppings-ham', 'toppings-mushroom'], fillings: {}, baseId: 'base-gluten-free', sizeOptionId: 'pizzat-0-perhe' };
const vonerUnit = calcUnitPriceFromSelection(voner.basePrice, voner.toppingsEnabled, vonerTamperSelection, blob, voner.sizeOptions);
check(Math.abs(vonerUnit - 11.9) < 0.001, 'voner-0 (toppingsEnabled=false) ignores every extra and resolves to its plain 11.90 base price', vonerUnit);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

// Confirms lib/pricing.ts needed ZERO changes for the data-model fix —
// its calcUnitPriceFromSelection/findDelta just .find() an option by id
// within whatever sizeOptions array they're given, so a synthetic base
// entry (lib/menu-i18n.ts) behaves identically to a real DB-backed one.
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');
const ROOT = require('path').resolve(__dirname, '../..');
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

const { calcUnitPriceFromSelection } = require(path.join(ROOT, 'lib/pricing.ts'));

let passed = 0, failed = 0;
function check(cond, label, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${detail !== undefined ? ' :: ' + JSON.stringify(detail) : ''}`);
  if (cond) passed++; else failed++;
}

const menu = {
  toppings: [{ id: 'topping-default', label: 'Topping', delta: 1.0 }],
  baseOptions: [{ id: 'base-default', label: 'Base', delta: 0 }],
  sauceOptions: [{ id: 'sauce-default', label: 'Sauce', delta: 0 }],
  cheeseOptions: [{ id: 'cheese-default', label: 'Cheese', delta: 0 }],
  sauceStripeOptions: [{ id: 'default', label: 'None', delta: 0 }],
  dipOptions: [{ id: 'default', label: 'None', delta: 0 }],
  fillingCategories: [],
};

const sizeOptions = [
  { id: 'size-base-pizzat-0', label: 'Normaali', delta: 0 },
  { id: 'pannu-abcd', label: 'Pannu', delta: 3.0 },
  { id: 'perhe-wxyz', label: 'Perhe', delta: 6.5 },
];

const basePrice = 9.9;
const selectionNormaali = { toppingIds: [], sizeOptionId: 'size-base-pizzat-0' };
const selectionPerhe = { toppingIds: [], sizeOptionId: 'perhe-wxyz' };
const selectionNoSize = { toppingIds: [] }; // customer never touched the size selector at all

check(
  calcUnitPriceFromSelection(basePrice, true, selectionNormaali, menu, sizeOptions) === 9.9,
  'Selecting the synthetic "Normaali" tier prices at exactly the base price (9.90 €)'
);
check(
  calcUnitPriceFromSelection(basePrice, true, selectionPerhe, menu, sizeOptions) === 16.4,
  'Selecting a real tier (Perhe) still prices correctly (9.90 + 6.50 = 16.40 €)'
);
check(
  calcUnitPriceFromSelection(basePrice, true, selectionNoSize, menu, sizeOptions) === 9.9,
  'No sizeOptionId at all (findDelta\'s "not found" fallback) still correctly resolves to the plain base price'
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

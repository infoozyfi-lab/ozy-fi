// Real verification of SizeTierButtons + hasRealSizeTiers — bug-fix +
// UI-change follow-up brief, Task 2.
//
// components/ProductPage.tsx is a 'use client' component with real
// dependencies (next/link, @/context/StoreContext, @/lib/i18n) unsuited to
// isolated unit rendering, and SizeTierButtons/hasRealSizeTiers aren't
// module-exported (they're internal to the file, as every other helper
// component in it already is — BottomRow, SauceStripeRow, DipRow, etc.).
// So this extracts the REAL, EXACT source of SizeTierButtons (+ its
// `money` helper dependency) and the REAL, EXACT hasRealSizeTiers
// expression directly out of the shipped file by brace-matching (not
// hand-retyped), transpiles just that real code, and executes it for
// real via ReactDOMServer — proving the actual shipped logic, not a
// reimplementation of what it's supposed to do.

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const React = require('react');
const ReactDOMServer = require('react-dom/server');

const FILE = path.resolve(__dirname, '../../components/ProductPage.tsx');
const src = fs.readFileSync(FILE, 'utf8');

function extractFunction(src, name) {
  const startIdx = src.indexOf(`function ${name}(`);
  if (startIdx === -1) throw new Error(`Could not find function ${name} in ${FILE}`);
  // Phase 1: balanced-paren scan over the parameter list (which may itself
  // contain object-destructuring braces and arrow-type parens, e.g.
  // `onChange: (id: string) => void` inside the type annotation) — this
  // finds the `)` that really closes the parameter list, not a `}` that
  // merely closes a destructuring pattern partway through it.
  const parenStart = src.indexOf('(', startIdx);
  let pdepth = 0;
  let j = parenStart;
  for (; j < src.length; j++) {
    if (src[j] === '(') pdepth++;
    else if (src[j] === ')') {
      pdepth--;
      if (pdepth === 0) break;
    }
  }
  // Phase 2: the function body's own opening brace is the first `{` after
  // the parameter list closes (skipping an optional `: ReturnType`).
  const braceStart = src.indexOf('{', j);
  let depth = 0;
  let i = braceStart;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return src.slice(startIdx, i + 1);
}

const moneySrc = extractFunction(src, 'money');
const sizeTierButtonsSrc = extractFunction(src, 'SizeTierButtons');

console.log('--- Extracted `money` source (verbatim from ProductPage.tsx) ---');
console.log(moneySrc);
console.log('\n--- Extracted `SizeTierButtons` source (verbatim from ProductPage.tsx) ---');
console.log(sizeTierButtonsSrc);

// Also extract the real hasRealSizeTiers expression (the right-hand side
// of its const declaration) so this test evaluates the EXACT shipped
// boolean logic, not a re-description of it.
const hrstMatch = src.match(/const hasRealSizeTiers = (.+);/);
if (!hrstMatch) throw new Error('Could not find hasRealSizeTiers in ProductPage.tsx');
const hasRealSizeTiersExprSrc = hrstMatch[1];
console.log('\n--- Extracted `hasRealSizeTiers` expression (verbatim) ---');
console.log(hasRealSizeTiersExprSrc);

// Compile the extracted component source (real JSX) to a callable function.
const moduleSrc = `
${moneySrc}
${sizeTierButtonsSrc}
module.exports = { money, SizeTierButtons };
`;
const compiled = ts.transpileModule(moduleSrc, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX,
    strict: false,
  },
  fileName: 'extracted-size-tier-buttons.tsx',
});

const Module = require('module');
const m = new Module('extracted-size-tier-buttons.js', module.parent);
m.filename = path.join(path.dirname(FILE), 'extracted-size-tier-buttons.js');
m.paths = Module._nodeModulePaths(path.dirname(FILE));
m._compile(compiled.outputText, m.filename);
const { SizeTierButtons } = m.exports;

// Compile the hasRealSizeTiers expression into a real callable function.
const hrstCompiled = ts.transpileModule(
  `module.exports = function hasRealSizeTiers(selectionSizeOptions) { return ${hasRealSizeTiersExprSrc.replace(/selection\.sizeOptions/g, 'selectionSizeOptions')}; };`,
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }
);
const hrstModule = new Module('extracted-hasRealSizeTiers.js', module.parent);
hrstModule._compile(hrstCompiled.outputText, 'extracted-hasRealSizeTiers.js');
const hasRealSizeTiers = hrstModule.exports;

let passed = 0, failed = 0;
function check(cond, label, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${detail !== undefined ? ' :: ' + detail : ''}`);
  if (cond) passed++; else failed++;
}

console.log('\n=== hasRealSizeTiers — real extracted expression ===');
const FALLBACK_OPTION = [{ id: 'default', label: 'Default', delta: 0 }];
check(hasRealSizeTiers(FALLBACK_OPTION) === false, '0-tier product (FALLBACK_OPTION) => hasRealSizeTiers is false (row hidden)');
check(
  hasRealSizeTiers([{ id: 'size-x-small', label: 'Small', delta: 0 }, { id: 'size-x-large', label: 'Large', delta: 4.75 }]) === true,
  '2-tier real product => hasRealSizeTiers is true'
);
check(
  hasRealSizeTiers([
    { id: 'size-x-norm', label: 'Normaali', delta: 0 },
    { id: 'size-x-pannu', label: 'Pannu', delta: 3.0 },
    { id: 'size-x-perhe', label: 'Perhe', delta: 6.5 },
  ]) === true,
  '3-tier real product => hasRealSizeTiers is true'
);
check(
  hasRealSizeTiers([{ id: 'size-x-only', label: 'Only Size', delta: 0 }]) === true,
  'A real (admin-configured) group with exactly ONE tier still counts as real — not confused with the single-entry fallback'
);

console.log('\n=== SizeTierButtons — real extracted component, rendered via ReactDOMServer ===');

function render(options, current, basePrice) {
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(SizeTierButtons, { options, current, basePrice, onChange: () => {} })
  );
  return html;
}

// 3-tier product (mirrors the manually-confirmed pizzat-0 Norm./Pannu./Perhe case)
const threeTierHtml = render(
  [
    { id: 'size-a', label: 'Normaali', delta: 0 },
    { id: 'size-b', label: 'Pannu', delta: 3.0 },
    { id: 'size-c', label: 'Perhe', delta: 6.5 },
  ],
  'size-b',
  8.0
);
const threeTierButtonCount = (threeTierHtml.match(/pp-size-tile/g) || []).length / 2; // class appears once per tile (wrapper), label/price spans don't repeat the class name
check(threeTierHtml.includes('pp-size-tiles'), '3-tier: wraps in .pp-size-tiles container');
check((threeTierHtml.match(/class="pp-size-tile( active)?"/g) || []).length === 3, '3-tier: renders exactly 3 tile buttons', threeTierHtml);
check(threeTierHtml.includes('Normaali') && threeTierHtml.includes('Pannu') && threeTierHtml.includes('Perhe'), '3-tier: all 3 labels present');
check(threeTierHtml.includes('8.00'), '3-tier: cheapest tile shows the plain base price (8.00 €, delta 0)');
check(threeTierHtml.includes('11.00'), '3-tier: middle tile shows base+delta (8.00 + 3.00 = 11.00 €)');
check(threeTierHtml.includes('14.50'), '3-tier: priciest tile shows base+delta (8.00 + 6.50 = 14.50 €)');
// Split into individual <button>...</button> elements so each tile's own
// class is checked against only that tile's own label — the earlier
// non-greedy-regex version could match PAST a button boundary into the
// next tile's label, which was a bug in the TEST's own regex, not in the
// component (confirmed by this more precise per-button parse).
const tileButtons = threeTierHtml.match(/<button[^]*?<\/button>/g) || [];
const findTile = (label) => tileButtons.find((b) => b.includes(`>${label}<`));
check(findTile('Pannu')?.includes('pp-size-tile active') === true, 'The CURRENTLY SELECTED tile (Pannu) carries the "active" class');
check(
  findTile('Normaali')?.includes('active') === false && findTile('Perhe')?.includes('active') === false,
  'Non-selected tiles (Normaali, Perhe) do NOT carry "active"'
);

// 2-tier product
const twoTierHtml = render(
  [{ id: 'size-x-small', label: 'Small', delta: 0 }, { id: 'size-x-large', label: 'Large', delta: 4.75 }],
  'size-x-small',
  11.0
);
check((twoTierHtml.match(/class="pp-size-tile( active)?"/g) || []).length === 2, '2-tier: renders exactly 2 tile buttons');
check(twoTierHtml.includes('11.00') && twoTierHtml.includes('15.75'), '2-tier: correct absolute prices (11.00 €, 15.75 €)');

console.log(`\n${passed} passed, ${failed} failed`);
console.log('\nThe zero-tier ("no size row whatsoever") case is proven by hasRealSizeTiers');
console.log('returning false for FALLBACK_OPTION above — ProductPage.tsx wraps the whole');
console.log('section in `{hasRealSizeTiers && (...)}`, so SizeTierButtons is never even');
console.log('called/rendered in that case (nothing further to render-test for that case).');
process.exit(failed ? 1 : 0);

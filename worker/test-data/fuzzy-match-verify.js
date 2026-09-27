// Real-execution verification for lib/fuzzyMatch.ts (Search-improvements
// brief, items 1, 2, 5). Loads the REAL, verbatim module (transpiled, not
// reimplemented) and runs it against real product names pulled straight
// out of worker/migrations/022_pizza_kuningas_menu_import.sql, plus the
// brief's own worked example ("bologna" -> "Bolognese").

const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '../..');

Module._extensions['.ts'] = function (module, filename) {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  module._compile(out, filename);
};

const { levenshtein, findFuzzyMatch, fuzzyContains, suggestClosestName, maxDistanceFor } =
  require(path.join(ROOT, 'lib/fuzzyMatch.ts'));

let passed = 0, failed = 0;
function check(cond, label, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${detail !== undefined ? ' :: ' + JSON.stringify(detail) : ''}`);
  if (cond) passed++; else failed++;
}

// Real product rows, extracted straight from the real migration SQL —
// (name, name_fi, description, description_fi) — same shape
// normalizeProducts() builds `searchText` from.
const sqlPath = path.join(ROOT, 'worker/migrations/022_pizza_kuningas_menu_import.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');
const productRows = [];
const insertRe = /INSERT INTO products \(id, category_id, name, name_fi, description, description_fi,[^)]*\) VALUES \('([^']+)', '([^']+)', '((?:[^'\\]|\\.)*)', '((?:[^'\\]|\\.)*)', '((?:[^'\\]|\\.)*)', '((?:[^'\\]|\\.)*)'/g;
let m;
while ((m = insertRe.exec(sql)) !== null) {
  productRows.push({ id: m[1], cat: m[2], name: m[3], name_fi: m[4], description: m[5], description_fi: m[6] });
}
check(productRows.length > 50, `parsed a realistic number of real products out of migration 022 (got ${productRows.length})`, productRows.length);

function buildSearchText(row) {
  return [row.name, row.name_fi, row.description, row.description_fi]
    .filter((v) => typeof v === 'string' && v.length > 0)
    .join(' ')
    .toLowerCase();
}

const bolognese = productRows.find((p) => p.id === 'pizzat-0');
check(!!bolognese && bolognese.name === '1. Bolognese', 'found the real "1. Bolognese" product row (pizzat-0) in the real migration SQL', bolognese && bolognese.name);

// ---------------------------------------------------------------------
// Item 1 — typo tolerance. The brief's own worked example: "bologna"
// should still find "Bolognese".
// ---------------------------------------------------------------------
{
  const searchText = buildSearchText(bolognese);
  const match = findFuzzyMatch(searchText, 'bologna');
  check(match !== null, 'query "bologna" fuzzy-matches real product "1. Bolognese" via its searchText blob', match);
  check(match && searchText.slice(match.start, match.end).includes('bologn'), 'the matched span is really inside the word "bolognese", not some unrelated coincidence', match && searchText.slice(match.start, match.end));
}
{
  // Exact match must always still work (typo tolerance is additive).
  const match = findFuzzyMatch(buildSearchText(bolognese), 'bolognese');
  check(match !== null && match.distance === 0, 'an exact (correctly-spelled) query still matches with distance 0', match);
}
{
  // A single substituted letter — very common real typo shape.
  const match = findFuzzyMatch(buildSearchText(bolognese), 'bolegnese');
  check(match !== null, '"bolegnese" (one substituted letter) still fuzzy-matches "Bolognese"', match);
}
{
  // A short, unrelated query must NOT match everything (maxDistanceFor
  // guards against a 2-3 char query fuzzing to near-arbitrary results).
  const match = findFuzzyMatch(buildSearchText(bolognese), 'xyz');
  check(match === null, 'a short, unrelated 3-char query does not spuriously match "Bolognese"', match);
}
{
  // Completely unrelated real word must not match.
  const match = findFuzzyMatch(buildSearchText(bolognese), 'submarine');
  check(match === null, 'a genuinely unrelated word does not fuzzy-match "Bolognese"', match);
}

// ---------------------------------------------------------------------
// Item 3 (already covered by existing searchText, verified here anyway)
// — ingredient/description text is searchable, not just the name.
// ---------------------------------------------------------------------
{
  const beefOnly = productRows.find((p) => /ground beef/i.test(p.description) && !/beef/i.test(p.name));
  check(!!beefOnly, 'found a real product whose DESCRIPTION (not name) mentions an ingredient word, to test description search', beefOnly && beefOnly.name);
  if (beefOnly) {
    const match = fuzzyContains(buildSearchText(beefOnly), 'beef');
    check(match, `"beef" (only in the description, e.g. "${beefOnly.description}") matches ${beefOnly.name} via searchText`, beefOnly.description);
  }
}

// ---------------------------------------------------------------------
// Item 2 — highlight span sanity: the returned {start,end} must slice
// back to a real, non-empty piece of the original (non-lowercased) text
// when applied at the same offsets (case doesn't shift character
// positions for Latin/Finnish text).
// ---------------------------------------------------------------------
{
  const original = bolognese.name; // "1. Bolognese"
  const match = findFuzzyMatch(original.toLowerCase(), 'bologna');
  check(match !== null, 'fuzzy match also found directly against the product NAME alone (not just the merged searchText)', match);
  if (match) {
    const highlighted = original.slice(match.start, match.end);
    check(highlighted.length > 0 && original.toLowerCase().includes(highlighted.toLowerCase()), 'the {start,end} span slices back to a real, sane substring of the ORIGINAL (non-lowercased) name', highlighted);
  }
}

// ---------------------------------------------------------------------
// Item 5 — "did you mean" against the full real product name list.
// ---------------------------------------------------------------------
{
  const allNames = productRows.map((p) => p.name);
  const suggestion = suggestClosestName('bolonese', allNames); // a very plausible real-world typo
  check(suggestion === '1. Bolognese', '"did you mean" suggests the real "1. Bolognese" for the typo "bolonese"', suggestion);
}
{
  const allNames = productRows.map((p) => p.name);
  const suggestion = suggestClosestName('zzzzzxxxxxqqqqq', allNames);
  check(suggestion === null, 'a nonsense query with no reasonably close real name returns null (no forced/wrong suggestion)', suggestion);
}

// ---------------------------------------------------------------------
// levenshtein() itself — basic correctness sanity, since everything else
// depends on it.
// ---------------------------------------------------------------------
check(levenshtein('kitten', 'sitting') === 3, 'levenshtein("kitten","sitting") === 3 (textbook example)', levenshtein('kitten', 'sitting'));
check(levenshtein('', 'abc') === 3, 'levenshtein("","abc") === 3 (all insertions)', levenshtein('', 'abc'));
check(levenshtein('abc', 'abc') === 0, 'levenshtein of identical strings === 0');
check(maxDistanceFor(2) === 0 && maxDistanceFor(4) === 1 && maxDistanceFor(8) === 2, 'maxDistanceFor scales as designed (0 / 1 / 2 by length band)', [maxDistanceFor(2), maxDistanceFor(4), maxDistanceFor(8)]);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

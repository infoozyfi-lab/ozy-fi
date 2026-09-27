// Real-execution verification for lib/recentSearches.ts (Search-
// improvements brief, item 4). Loads the real module with a mocked
// `window.localStorage` (an in-memory Map-backed stand-in — real
// localStorage semantics, not a reimplementation of this file's logic).

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const Module = require('module');

const ROOT = path.resolve(__dirname, '../..');

function makeFakeLocalStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => store.clear(),
  };
}

global.window = { localStorage: makeFakeLocalStorage() };

Module._extensions['.ts'] = function (module, filename) {
  const src = fs.readFileSync(filename, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    fileName: filename,
  }).outputText;
  module._compile(out, filename);
};

const { getRecentSearches, addRecentSearch, clearRecentSearches } = require(path.join(ROOT, 'lib/recentSearches.ts'));

let passed = 0, failed = 0;
function check(cond, label, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${detail !== undefined ? ' :: ' + JSON.stringify(detail) : ''}`);
  if (cond) passed++; else failed++;
}

check(getRecentSearches().length === 0, 'starts empty (nothing stored yet)');

addRecentSearch('pizza');
check(getRecentSearches().join(',') === 'pizza', 'first real search is remembered', getRecentSearches());

addRecentSearch('kebab');
check(getRecentSearches().join(',') === 'kebab,pizza', 'second search is prepended (most-recent-first)', getRecentSearches());

addRecentSearch('Pizza'); // re-search of the same term, different case
check(getRecentSearches().join(',') === 'Pizza,kebab', 're-searching the same term (different case) moves it to front, deduped, not duplicated', getRecentSearches());

addRecentSearch('a'); // too short
check(getRecentSearches().join(',') === 'Pizza,kebab', 'a 1-character query is silently ignored (below MIN_LENGTH)', getRecentSearches());

['burger', 'kana', 'bolognese', 'salaatti'].forEach((q) => addRecentSearch(q));
check(getRecentSearches().length === 5, 'list is capped at 5 entries even after many searches', getRecentSearches());
check(getRecentSearches()[0] === 'salaatti', 'the cap keeps the most recent entries, dropping the oldest', getRecentSearches());

// Simulates this "surviving a page reload" — a brand-new require of the
// module (same underlying fake localStorage instance) should see the
// same persisted data, proving this is real persistence, not in-memory
// module state.
delete require.cache[require.resolve(path.join(ROOT, 'lib/recentSearches.ts'))];
const reloaded = require(path.join(ROOT, 'lib/recentSearches.ts'));
check(reloaded.getRecentSearches().join(',') === getRecentSearches().join(','), 'persists across a simulated reload (fresh module load reads the same localStorage)', reloaded.getRecentSearches());

clearRecentSearches();
check(getRecentSearches().length === 0, 'clearRecentSearches() empties the list');

// Storage failures must never throw.
global.window.localStorage.setItem = () => { throw new Error('quota exceeded'); };
let threw = false;
try {
  addRecentSearch('resilient test');
} catch (e) {
  threw = true;
}
check(!threw, 'a localStorage write failure (e.g. quota/private mode) is swallowed, never thrown');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

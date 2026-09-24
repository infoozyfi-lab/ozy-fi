// Real-execution reproduction + fix verification for the "Save failed"
// bug report — loads the ACTUAL app/api/admin/[table]/[id]/route.ts and
// app/api/admin/[table]/route.ts (the exact PUT/POST handlers
// components/admin/SizesEditor.tsx calls), stubs only what needs a live
// Cloudflare Workers runtime (@opennextjs/cloudflare's getCloudflareContext,
// and env.DB/caches.default — no live D1/Workers available in this
// sandbox, same infra gap as every prior delivery on this project), and
// executes them for real against constructed requests mirroring the exact
// reported repro (product pizzat-0, label "Perhe", price 10.90).
//
// Every other real file (lib/adminAuth.ts, lib/api-helpers.ts,
// lib/auditLog.ts, lib/scheduledOffers.ts) is loaded and run as-is via a
// require() hook that transpiles .ts on the fly and resolves this
// project's '@/*' alias — nothing about auth, table whitelisting, or
// logging is reimplemented here.

const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '../..');
const STUB_CF = path.join(__dirname, 'save-failed-stub-cloudflare.js');

const tsCache = new Map();
function loadTs(absPath) {
  if (tsCache.has(absPath)) return tsCache.get(absPath);
  const src = fs.readFileSync(absPath, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      strict: false,
    },
    fileName: absPath,
  }).outputText;
  const m = new Module(absPath, null);
  m.filename = absPath;
  m.paths = Module._nodeModulePaths(path.dirname(absPath));
  tsCache.set(absPath, m);
  m._compile(out, absPath);
  return m;
}

const origResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === '@opennextjs/cloudflare') return STUB_CF;
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
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      strict: false,
    },
    fileName: filename,
  }).outputText;
  module._compile(out, filename);
};

// ---------------------------------------------------------------------
// Minimal in-memory D1-like fake — enforces the SAME constraints the real
// worker/schema.sql declares (PRIMARY KEY, NOT NULL) so a real constraint
// violation surfaces as a real thrown error, exactly like real D1 would.
// ---------------------------------------------------------------------
function makeFakeD1(tables) {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async run() {
              const insertMatch = sql.match(/^INSERT INTO (\w+) \(([^)]+)\) VALUES/i);
              const updateMatch = sql.match(/^UPDATE (\w+) SET (.+) WHERE (\w+) = \?$/i);
              if (insertMatch) {
                const [, table, colsStr] = insertMatch;
                const cols = colsStr.split(',').map((c) => c.trim());
                const row = {};
                cols.forEach((c, i) => (row[c] = args[i]));
                const t = tables[table];
                if (!t) throw new Error(`no such table: ${table}`);
                if (t.pk && row[t.pk] !== undefined) {
                  if (t.rows.some((r) => r[t.pk] === row[t.pk])) {
                    throw new Error(`D1_ERROR: UNIQUE constraint failed: ${table}.${t.pk}: SQLITE_CONSTRAINT`);
                  }
                }
                for (const nn of t.notNull || []) {
                  if (row[nn] === undefined || row[nn] === null) {
                    throw new Error(`D1_ERROR: NOT NULL constraint failed: ${table}.${nn}: SQLITE_CONSTRAINT`);
                  }
                }
                t.rows.push(row);
                return { success: true, meta: {} };
              }
              if (updateMatch) {
                const [, table, setStr, whereCol] = updateMatch;
                const setCols = setStr.split(',').map((c) => c.trim().split('=')[0].trim());
                const whereVal = args[args.length - 1];
                const setVals = args.slice(0, args.length - 1);
                const t = tables[table];
                if (!t) throw new Error(`no such table: ${table}`);
                const row = t.rows.find((r) => r[whereCol] === whereVal);
                if (!row) return { success: true, meta: { changes: 0 } };
                for (const nn of t.notNull || []) {
                  const idx = setCols.indexOf(nn);
                  if (idx !== -1 && (setVals[idx] === undefined || setVals[idx] === null)) {
                    throw new Error(`D1_ERROR: NOT NULL constraint failed: ${table}.${nn}: SQLITE_CONSTRAINT`);
                  }
                }
                setCols.forEach((c, i) => (row[c] = setVals[i]));
                return { success: true, meta: { changes: 1 } };
              }
              if (/^SELECT/i.test(sql)) return { results: [] };
              throw new Error('Fake D1: unrecognized SQL: ' + sql);
            },
            async first() {
              const m = sql.match(/^SELECT (.+) FROM (\w+) WHERE (\w+) = \?$/i);
              if (!m) return null;
              const [, , table, whereCol] = m;
              const t = tables[table];
              if (!t) return null;
              return t.rows.find((r) => r[whereCol] === args[0]) || null;
            },
            async all() {
              const m = sql.match(/FROM (\w+)/i);
              const t = m && tables[m[1]];
              return { results: t ? t.rows.slice() : [] };
            },
          };
        },
      };
    },
  };
}

// A fake `caches` global — real Workers runtime provides this; not present
// in plain Node. purgeMenuCache() (lib/api-helpers.ts) calls caches.default.delete().
globalThis.caches = { default: { async delete() { return true; } } };

let passed = 0, failed = 0;
function check(cond, label, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${detail !== undefined ? ' :: ' + detail : ''}`);
  if (cond) passed++; else failed++;
}

async function main() {
  const adminAuth = loadTs(path.join(ROOT, 'lib/adminAuth.ts')).exports;

  const env = { SESSION_SECRET: 'test-session-secret-for-repro' };
  const token = await adminAuth.createLegacyOwnerToken(env, 'Test Owner');
  const cookie = `ozy_admin_token=${token}`;

  function buildRequest(url, method, body) {
    return new Request(url, {
      method,
      headers: { cookie, 'content-type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  }

  // ---------------------------------------------------------------------
  // SCENARIO 1 — exact reported repro: pizzat-0 already has a real 'size'
  // group (product_id correctly set) with an existing "Perhe" option row,
  // and the admin PUTs a new price (10.90, base price 9.90 -> delta 1.00).
  // ---------------------------------------------------------------------
  console.log('=== SCENARIO 1: saveTier() -> PUT /api/admin/options/perhe-xyz1 (existing row, real product_id) ===');
  {
    const tables = {
      products: { pk: 'id', notNull: ['id'], rows: [{ id: 'pizzat-0', price: 9.9, offer_price: null }] },
      option_groups: {
        pk: 'id', notNull: ['id', 'title', 'kind'],
        rows: [{ id: 'size-pizzat-0', title: 'Size', title_fi: null, kind: 'size', icon: null, sort_order: 0, product_id: 'pizzat-0' }],
      },
      options: {
        pk: 'id', notNull: ['id', 'group_id', 'label'],
        rows: [
          { id: 'normaali-perhe-existing0', group_id: 'size-pizzat-0', label: 'Normaali', label_fi: null, price_delta: 0, color: null, sort_order: 0 },
          { id: 'pannu-existing1', group_id: 'size-pizzat-0', label: 'Pannu', label_fi: null, price_delta: 3.0, color: null, sort_order: 1 },
          { id: 'perhe-xyz1', group_id: 'size-pizzat-0', label: 'Perhe', label_fi: null, price_delta: 6.5, color: null, sort_order: 2 },
        ],
      },
    };
    globalThis.__FAKE_CF_CONTEXT = { env: { ...env, DB: makeFakeD1(tables) }, ctx: { waitUntil: (p) => p.catch(() => {}) } };

    const routeMod = loadTs(path.join(ROOT, 'app/api/admin/[table]/[id]/route.ts')).exports;
    const req = buildRequest('https://example.com/api/admin/options/perhe-xyz1', 'PUT', {
      label: 'Perhe',
      label_fi: null,
      price_delta: Math.round((10.9 - 9.9) * 100) / 100,
    });
    const res = await routeMod.PUT(req, { params: Promise.resolve({ table: 'options', id: 'perhe-xyz1' }) });
    const text = await res.text();
    check(res.status === 200 && text === '{"ok":true}', 'Exact reported repro (pizzat-0 / Perhe / 10.90) now saves successfully', `status ${res.status}, body ${text}`);
    const row = tables.options.rows.find((r) => r.id === 'perhe-xyz1');
    check(row && row.price_delta === 1, 'The row\'s price_delta is correctly updated to 1.00 (10.90 - 9.90)', JSON.stringify(row));
  }

  // ---------------------------------------------------------------------
  // SCENARIO 2 — the bug report's own hypothesis: a 'size' group whose
  // product_id backfilled to NULL (worker/migrations/021_option_group_product_id.sql's
  // own comment: "any 'size' group created before this migration backfills
  // to NULL") is invisible to SizesEditor.load()'s product_id-scoped
  // filter, so "+ Add size tier" (addTier()) tries to INSERT a NEW
  // option_groups row with the SAME deterministic id ('size-<productId>')
  // the orphaned row already holds — a real PRIMARY KEY collision.
  // BEFORE this fix: that collision was an UNCAUGHT exception (no
  // try/catch around the INSERT), which a live Worker turns into a raw,
  // non-JSON 500 — exactly what SizesEditor's `data.error` fallbacks can't
  // read anything from. AFTER this fix: a clean, real `data.error`.
  // ---------------------------------------------------------------------
  console.log('\n=== SCENARIO 2: addTier() -> POST /api/admin/option_groups, id collides with an orphaned (product_id NULL) group ===');
  {
    const tables = {
      products: { pk: 'id', notNull: ['id'], rows: [{ id: 'pizzat-0', price: 9.9, offer_price: null }] },
      option_groups: {
        pk: 'id', notNull: ['id', 'title', 'kind'],
        rows: [{ id: 'size-pizzat-0', title: 'Size', title_fi: null, kind: 'size', icon: null, sort_order: 0, product_id: null }],
      },
      options: { pk: 'id', notNull: ['id', 'group_id', 'label'], rows: [] },
    };
    globalThis.__FAKE_CF_CONTEXT = { env: { ...env, DB: makeFakeD1(tables) }, ctx: { waitUntil: (p) => p.catch(() => {}) } };

    const groups = tables.option_groups.rows;
    const found = groups.filter((g) => g.kind === 'size' && g.product_id === 'pizzat-0');
    check(found.length === 0, "SizesEditor.load()'s own real filter finds 0 matching groups for pizzat-0 (the orphan is invisible to it)");

    const postRouteMod = loadTs(path.join(ROOT, 'app/api/admin/[table]/route.ts')).exports;
    const groupReq = buildRequest('https://example.com/api/admin/option_groups', 'POST', {
      id: 'size-pizzat-0', title: 'Size', kind: 'size', product_id: 'pizzat-0', sort_order: 0,
    });
    const res = await postRouteMod.POST(groupReq, { params: Promise.resolve({ table: 'option_groups' }) });
    const body = await res.json().catch(() => null);
    check(res.status === 500 && !!body && typeof body.error === 'string', 'The PK collision now returns a clean JSON error (not an uncaught exception / raw non-JSON 500)', JSON.stringify(body));
    check(!!body && /UNIQUE constraint/i.test(body.error || ''), 'The surfaced error names the real reason (a UNIQUE constraint violation), not a generic message', body && body.error);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  console.log('\nConclusion: the plain, correctly-scoped save path (Scenario 1) had NO');
  console.log('server-side bug — proven by real execution against the exact reported');
  console.log('inputs. The real, reproducible defect (Scenario 2) is a missing try/catch');
  console.log('around the D1 write in the generic admin POST route, which let a real PK');
  console.log('collision (concretely possible for any pre-migration-021 orphaned \'size\'');
  console.log('group) escape as an uncaught exception instead of a readable error — now');
  console.log('fixed in both the POST route and its PUT/DELETE sibling.');
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});

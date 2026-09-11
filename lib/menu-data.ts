// Single source of truth for "what's on the menu right now" — used by
// both app/api/menu/route.js (the client-side fetch StoreContext still
// uses for cart interactivity) and Server Components that need the same
// data to render real, crawlable HTML on first paint.
import type {
  MenuData,
  RawCategory,
  RawProduct,
  RawOptionGroup,
  RawOption,
  RawAddon,
  RawBundle,
} from './types';

// `env` is the real bridged Cloudflare env (see cloudflare-env.d.ts) — every
// caller passes the `env` returned by getCloudflareContext(), which is typed
// CloudflareEnv. This used to take a hand-rolled `LoadMenuDataEnv` (a
// minimal, approximate D1 shape defined in lib/types.ts) instead, which
// didn't structurally match the real D1Database/D1PreparedStatement API
// (its `.prepare()` took a generic, its `.all()` didn't — the reverse of
// the real bindings) — every call site here already used the correct real
// D1 shape (`.prepare(...).all<T>()`), so that mismatch surfaced as
// "Argument of type 'CloudflareEnv' is not assignable to parameter of type
// 'LoadMenuDataEnv'" wherever this function was called, plus a cascade of
// downstream errors inside this file itself. CloudflareEnv (global ambient,
// no import needed) is the fix — no other change needed in this file.
export async function loadMenuData(env: CloudflareEnv): Promise<MenuData> {
  const [
    categories,
    products,
    groups,
    options,
    addons,
    bundles,
    settingsRows,
  ] = await Promise.all([
    // D1's generic type parameter belongs on the terminal call (.all<T>() /
    // .first<T>() / .run<T>()), not on .prepare() — .prepare() itself takes
    // no type argument in the real @cloudflare/workers-types.
    env.DB.prepare('SELECT * FROM categories ORDER BY sort_order').all<RawCategory>(),
    env.DB.prepare('SELECT * FROM products WHERE active = 1 ORDER BY sort_order').all<RawProduct>(),
    env.DB.prepare('SELECT * FROM option_groups ORDER BY sort_order').all<RawOptionGroup>(),
    env.DB.prepare('SELECT * FROM options ORDER BY sort_order').all<RawOption>(),
    env.DB.prepare('SELECT * FROM addons WHERE active = 1 ORDER BY sort_order').all<RawAddon>(),
    env.DB.prepare('SELECT * FROM bundles WHERE active = 1 ORDER BY sort_order').all<RawBundle>(),
    env.DB.prepare('SELECT key, value FROM admin_settings').all<{ key: string; value: string }>(),
  ]);

  const optionsByGroup: Record<string, RawOption[]> = {};
  for (const o of options.results) {
    (optionsByGroup[o.group_id] ||= []).push(o);
  }
  const optionGroups: RawOptionGroup[] = groups.results.map((g) => ({
    ...g,
    options: optionsByGroup[g.id] || [],
  }));

  const settings: Record<string, string> = {};
  for (const row of settingsRows.results) {
    // Keys prefixed "secret_" (access tokens etc.) never leave the
    // server — see app/api/menu/route.js for the same rule applied to
    // the public API response.
    if (row.key.startsWith('secret_')) continue;
    settings[row.key] = row.value;
  }

  return {
    categories: categories.results,
    products: products.results,
    optionGroups,
    addons: addons.results,
    bundles: bundles.results,
    settings,
  };
}

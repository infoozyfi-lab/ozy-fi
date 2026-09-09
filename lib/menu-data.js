// Single source of truth for "what's on the menu right now" — used by
// both app/api/menu/route.js (the client-side fetch StoreContext still
// uses for cart interactivity) and Server Components that need the same
// data to render real, crawlable HTML on first paint.
export async function loadMenuData(env) {
  const [
    categories,
    products,
    groups,
    options,
    addons,
    bundles,
    settingsRows,
  ] = await Promise.all([
    env.DB.prepare('SELECT * FROM categories ORDER BY sort_order').all(),
    env.DB.prepare('SELECT * FROM products WHERE active = 1 ORDER BY sort_order').all(),
    env.DB.prepare('SELECT * FROM option_groups ORDER BY sort_order').all(),
    env.DB.prepare('SELECT * FROM options ORDER BY sort_order').all(),
    env.DB.prepare('SELECT * FROM addons WHERE active = 1 ORDER BY sort_order').all(),
    env.DB.prepare('SELECT * FROM bundles WHERE active = 1 ORDER BY sort_order').all(),
    env.DB.prepare('SELECT key, value FROM admin_settings').all(),
  ]);

  const optionsByGroup = {};
  for (const o of options.results) {
    (optionsByGroup[o.group_id] ||= []).push(o);
  }
  const optionGroups = groups.results.map((g) => ({
    ...g,
    options: optionsByGroup[g.id] || [],
  }));

  const settings = {};
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

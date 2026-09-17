// Regenerates worker/seed.sql from data/menu.js.
// Run with: node scripts/generate-seed.mjs
// Only needed if you edit data/menu.js and want to re-seed the database
// with those values (the admin panel is the normal way to edit content
// once the site is live).

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  CATEGORIES,
  ITEMS,
  TOPPING_PRICE,
  SIZE_LARGE_UPCHARGE,
  TOPPINGS,
  BASE_OPTIONS,
  SAUCE_OPTIONS,
  CHEESE_OPTIONS,
  FILLING_CATEGORIES,
  SAUCE_STRIPE_OPTIONS,
  DIP_OPTIONS,
  DRINKS,
  DIP_CUPS,
  SNACKS,
} from '../data/menu.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function sqlStr(v) {
  if (v === null || v === undefined) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function sqlNum(v) {
  if (v === null || v === undefined) return 'NULL';
  return Number(v);
}

const lines = [];
lines.push('-- Auto-generated from data/menu.js by scripts/generate-seed.mjs.');
lines.push('-- Run once after schema.sql:');
lines.push('--   npx wrangler d1 execute ozyfi-db --remote --file=./worker/seed.sql');
lines.push('');
lines.push('DELETE FROM options;');
lines.push('DELETE FROM option_groups;');
lines.push('DELETE FROM products;');
lines.push('DELETE FROM categories;');
lines.push('DELETE FROM addons;');
lines.push('DELETE FROM admin_settings;');
lines.push('');

// Categories
lines.push('-- Categories');
CATEGORIES.forEach((c, i) => {
  lines.push(
    `INSERT INTO categories (id, title, sub, image, sort_order) VALUES ` +
      `(${sqlStr(c.id)}, ${sqlStr(c.title)}, ${sqlStr(c.sub)}, ${sqlStr(c.image)}, ${i});`
  );
});
lines.push('');

// Products
lines.push('-- Products');
ITEMS.forEach((it, i) => {
  lines.push(
    `INSERT INTO products (id, category_id, name, description, price, offer_price, image, tag, has_toppings, sort_order, active) VALUES ` +
      `(${sqlStr(it.id)}, ${sqlStr(it.cat)}, ${sqlStr(it.name)}, ${sqlStr(it.desc)}, ${sqlNum(it.price)}, NULL, ${sqlStr(it.image)}, ${sqlStr(it.tag)}, ${it.toppings ? 1 : 0}, ${i}, 1);`
  );
});
lines.push('');

// Option groups: base / sauce / cheese / sauce_stripe / dip / topping / filling-*
lines.push('-- Option groups + options');

function group(id, title, kind, icon, sortOrder, items, priceField = 'delta') {
  lines.push(
    `INSERT INTO option_groups (id, title, kind, icon, sort_order) VALUES ` +
      `(${sqlStr(id)}, ${sqlStr(title)}, ${sqlStr(kind)}, ${sqlStr(icon)}, ${sortOrder});`
  );
  items.forEach((opt, i) => {
    const optId = opt.id;
    const label = opt.label;
    const delta = opt[priceField] ?? 0;
    lines.push(
      `INSERT INTO options (id, group_id, label, price_delta, color, sort_order) VALUES ` +
        `(${sqlStr(`${id}-${optId}`)}, ${sqlStr(id)}, ${sqlStr(label)}, ${sqlNum(delta)}, ${sqlStr(opt.color || null)}, ${i});`
    );
  });
}

group('base', 'Base', 'base', null, 0, BASE_OPTIONS);
group('sauce', 'Sauce', 'sauce', null, 1, SAUCE_OPTIONS);
group('cheese', 'Cheese', 'cheese', null, 2, CHEESE_OPTIONS);
group('sauce-stripe', 'Sauce stripe', 'sauce_stripe', null, 3, SAUCE_STRIPE_OPTIONS);
group('dip', 'Dip', 'dip', null, 4, DIP_OPTIONS);

// Fixed-price toppings (checkbox list, all at TOPPING_PRICE).
group(
  'toppings',
  'Toppings',
  'topping',
  null,
  5,
  TOPPINGS.map((label) => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'), label, delta: TOPPING_PRICE }))
);

// "More fillings" categories, each its own group.
FILLING_CATEGORIES.forEach((fc, i) => {
  group(
    `filling-${fc.id}`,
    fc.title,
    'filling',
    fc.icon,
    6 + i,
    fc.items.map((it) => ({ id: it.id, label: it.label, delta: it.price }))
  );
});
lines.push('');

// Addons: drinks / dip cups / snacks
lines.push('-- Addons');
function addons(type, list) {
  list.forEach((a, i) => {
    lines.push(
      `INSERT INTO addons (id, type, name, price, image, active, sort_order) VALUES ` +
        `(${sqlStr(a.id)}, ${sqlStr(type)}, ${sqlStr(a.name)}, ${sqlNum(a.price)}, ${sqlStr(a.image)}, 1, ${i});`
    );
  });
}
addons('drink', DRINKS);
addons('dip', DIP_CUPS);
addons('snack', SNACKS);
lines.push('');

// Global pricing settings.
lines.push('-- Settings');
lines.push(
  `INSERT INTO admin_settings (key, value) VALUES ('topping_price', ${sqlStr(TOPPING_PRICE)});`
);
lines.push(
  `INSERT INTO admin_settings (key, value) VALUES ('size_large_upcharge', ${sqlStr(SIZE_LARGE_UPCHARGE)});`
);
lines.push('');

const out = lines.join('\n');
const outPath = join(__dirname, '..', 'worker', 'seed.sql');
writeFileSync(outPath, out, 'utf8');
console.log(`Wrote ${outPath} (${out.split('\n').length} lines)`);

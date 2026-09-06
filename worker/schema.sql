-- ozy.fi D1 schema.
-- Run once against a fresh database:
--   npx wrangler d1 execute ozyfi-db --remote --file=./worker/schema.sql

DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS option_groups;
DROP TABLE IF EXISTS options;
DROP TABLE IF EXISTS addons;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS admin_settings;

CREATE TABLE categories (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  sub        TEXT,
  image      TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE products (
  id            TEXT PRIMARY KEY,
  category_id   TEXT NOT NULL REFERENCES categories(id),
  name          TEXT NOT NULL,
  description   TEXT,
  price         REAL NOT NULL DEFAULT 0,
  offer_price   REAL,
  image         TEXT,
  tag           TEXT,
  has_toppings  INTEGER NOT NULL DEFAULT 0,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1
);

-- kind: 'base' | 'sauce' | 'cheese' | 'sauce_stripe' | 'dip' | 'filling'
CREATE TABLE option_groups (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  kind       TEXT NOT NULL,
  icon       TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE options (
  id          TEXT PRIMARY KEY,
  group_id    TEXT NOT NULL REFERENCES option_groups(id),
  label       TEXT NOT NULL,
  price_delta REAL NOT NULL DEFAULT 0,
  color       TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- type: 'drink' | 'dip' | 'snack'
CREATE TABLE addons (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,
  name       TEXT NOT NULL,
  price      REAL NOT NULL DEFAULT 0,
  image      TEXT,
  active     INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  order_num      TEXT NOT NULL UNIQUE,
  customer_name  TEXT NOT NULL,
  address        TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT NOT NULL,
  notes          TEXT,
  total          REAL NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'received',
  payment_method TEXT NOT NULL DEFAULT 'cod',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE order_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    INTEGER NOT NULL REFERENCES orders(id),
  product_id  TEXT,
  name        TEXT NOT NULL,
  qty         INTEGER NOT NULL DEFAULT 1,
  line_total  REAL NOT NULL DEFAULT 0,
  details     TEXT
);

CREATE TABLE admin_settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_options_group ON options(group_id);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_orders_status ON orders(status);

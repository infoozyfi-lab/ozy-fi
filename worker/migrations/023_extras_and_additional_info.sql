-- Option-gating-and-extras-system brief — Task 2 (general per-product
-- "Extras" system) + Task 3 (freeform per-product "Additional info").
--
-- Run against the LIVE database with:
--   npx wrangler d1 execute ozyfi-db --remote --file=./worker/migrations/023_extras_and_additional_info.sql
--
-- ---------------------------------------------------------------------
-- Task 3 — nullable, additive-only, same bilingual convention as every
-- other `_fi` column in this project (006_bilingual_menu_fields.sql,
-- 014_product_meta_description.sql). NULL means "nothing written yet" —
-- every existing product row is unaffected, and
-- components/ProductPage.tsx renders nothing at all for a product that
-- hasn't had this filled in (see that file).
-- ---------------------------------------------------------------------
ALTER TABLE products ADD COLUMN additional_info TEXT;
ALTER TABLE products ADD COLUMN additional_info_fi TEXT;

-- ---------------------------------------------------------------------
-- Task 2 — the new 'extra' option_groups kind needs no schema change of
-- its own: `kind` is a plain TEXT NOT NULL column with no CHECK
-- constraint (worker/schema.sql), and `product_id`
-- (021_option_group_product_id.sql) already exists, nullable, ready to be
-- read by a second kind (see this migration's schema.sql comment update
-- alongside this file). This migration's own job is just the row data:
-- the mandatory Kebab/Kanakebab/Rintafile population the brief requires,
-- plus (judgment call, see this feature's delivery report) the same
-- treatment for Burgerit.
--
-- Every row below is a completely ordinary 'extra'-kind option_groups/
-- options row — ids follow the existing `extra-<productId>` /
-- `extra-<productId>-<slug>` convention (mirrors SizesEditor.tsx's own
-- `size-<productId>` group-id convention), and every one of them is
-- fully editable, removable, or addable afterward through the new
-- ExtrasEditor.tsx admin UI (components/admin/ExtrasEditor.tsx), exactly
-- as freely as a row the business owner types in themselves. Nothing
-- about being pre-populated here makes these rows special or protected.
--
-- Source: pizza-kuningas-menu-extracted.md (the same already-extracted,
-- already-verified source document worker/migrations/
-- 022_pizza_kuningas_menu_import.sql was built from).
-- ---------------------------------------------------------------------

-- --- Kebab/Kanakebab/Rintafile (kebabit-0 .. kebabit-11, all 12 real
-- style variants) — the same 5 extras on every one of them, exactly as
-- the brief's "not optional — do this" instruction specifies. ---
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kebabit-0', 'Extras', 'Lisät', 'extra', 0, 'kebabit-0');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kebabit-1', 'Extras', 'Lisät', 'extra', 0, 'kebabit-1');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kebabit-2', 'Extras', 'Lisät', 'extra', 0, 'kebabit-2');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kebabit-3', 'Extras', 'Lisät', 'extra', 0, 'kebabit-3');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kebabit-4', 'Extras', 'Lisät', 'extra', 0, 'kebabit-4');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kebabit-5', 'Extras', 'Lisät', 'extra', 0, 'kebabit-5');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kebabit-6', 'Extras', 'Lisät', 'extra', 0, 'kebabit-6');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kebabit-7', 'Extras', 'Lisät', 'extra', 0, 'kebabit-7');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kebabit-8', 'Extras', 'Lisät', 'extra', 0, 'kebabit-8');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kebabit-9', 'Extras', 'Lisät', 'extra', 0, 'kebabit-9');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kebabit-10', 'Extras', 'Lisät', 'extra', 0, 'kebabit-10');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kebabit-11', 'Extras', 'Lisät', 'extra', 0, 'kebabit-11');

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-0-double-meat', 'extra-kebabit-0', 'Double meat', 'Tupla kebab/kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-0-yogurt-sauce', 'extra-kebabit-0', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-0-garlic-sauce', 'extra-kebabit-0', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-0-blue-cheese', 'extra-kebabit-0', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-0-jalapeno', 'extra-kebabit-0', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-1-double-meat', 'extra-kebabit-1', 'Double meat', 'Tupla kebab/kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-1-yogurt-sauce', 'extra-kebabit-1', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-1-garlic-sauce', 'extra-kebabit-1', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-1-blue-cheese', 'extra-kebabit-1', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-1-jalapeno', 'extra-kebabit-1', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-2-double-meat', 'extra-kebabit-2', 'Double meat', 'Tupla kebab/kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-2-yogurt-sauce', 'extra-kebabit-2', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-2-garlic-sauce', 'extra-kebabit-2', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-2-blue-cheese', 'extra-kebabit-2', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-2-jalapeno', 'extra-kebabit-2', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-3-double-meat', 'extra-kebabit-3', 'Double meat', 'Tupla kebab/kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-3-yogurt-sauce', 'extra-kebabit-3', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-3-garlic-sauce', 'extra-kebabit-3', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-3-blue-cheese', 'extra-kebabit-3', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-3-jalapeno', 'extra-kebabit-3', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-4-double-meat', 'extra-kebabit-4', 'Double meat', 'Tupla kebab/kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-4-yogurt-sauce', 'extra-kebabit-4', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-4-garlic-sauce', 'extra-kebabit-4', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-4-blue-cheese', 'extra-kebabit-4', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-4-jalapeno', 'extra-kebabit-4', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-5-double-meat', 'extra-kebabit-5', 'Double meat', 'Tupla kebab/kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-5-yogurt-sauce', 'extra-kebabit-5', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-5-garlic-sauce', 'extra-kebabit-5', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-5-blue-cheese', 'extra-kebabit-5', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-5-jalapeno', 'extra-kebabit-5', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-6-double-meat', 'extra-kebabit-6', 'Double meat', 'Tupla kebab/kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-6-yogurt-sauce', 'extra-kebabit-6', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-6-garlic-sauce', 'extra-kebabit-6', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-6-blue-cheese', 'extra-kebabit-6', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-6-jalapeno', 'extra-kebabit-6', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-7-double-meat', 'extra-kebabit-7', 'Double meat', 'Tupla kebab/kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-7-yogurt-sauce', 'extra-kebabit-7', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-7-garlic-sauce', 'extra-kebabit-7', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-7-blue-cheese', 'extra-kebabit-7', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-7-jalapeno', 'extra-kebabit-7', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-8-double-meat', 'extra-kebabit-8', 'Double meat', 'Tupla kebab/kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-8-yogurt-sauce', 'extra-kebabit-8', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-8-garlic-sauce', 'extra-kebabit-8', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-8-blue-cheese', 'extra-kebabit-8', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-8-jalapeno', 'extra-kebabit-8', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-9-double-meat', 'extra-kebabit-9', 'Double meat', 'Tupla kebab/kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-9-yogurt-sauce', 'extra-kebabit-9', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-9-garlic-sauce', 'extra-kebabit-9', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-9-blue-cheese', 'extra-kebabit-9', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-9-jalapeno', 'extra-kebabit-9', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-10-double-meat', 'extra-kebabit-10', 'Double meat', 'Tupla kebab/kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-10-yogurt-sauce', 'extra-kebabit-10', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-10-garlic-sauce', 'extra-kebabit-10', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-10-blue-cheese', 'extra-kebabit-10', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-10-jalapeno', 'extra-kebabit-10', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-11-double-meat', 'extra-kebabit-11', 'Double meat', 'Tupla kebab/kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-11-yogurt-sauce', 'extra-kebabit-11', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-11-garlic-sauce', 'extra-kebabit-11', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-11-blue-cheese', 'extra-kebabit-11', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-11-jalapeno', 'extra-kebabit-11', 'Jalapeño', 'Jalapeno', 1.50, 4);

-- --- Burgerit — judgment call (see delivery report): populated the same
-- way, on the same real-data grounds as kebab above, for every genuine
-- burger product (burgerit-0..5 and each of their -ateria meal variants —
-- 12 products). Deliberately EXCLUDED: burgerit-6 ("H7. Fries Only" —
-- source's own '— single price only' fries-only item, already treated as
-- the odd one out in migration 022's own Burgerit Norm./Ateria split) —
-- it has no patty at all, so "extra patty"/"bacon"/"cheese"/etc. would be
-- extras for a burger this product isn't. ---
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-burgerit-0', 'Extras', 'Lisät', 'extra', 0, 'burgerit-0');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-burgerit-0-ateria', 'Extras', 'Lisät', 'extra', 0, 'burgerit-0-ateria');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-burgerit-1', 'Extras', 'Lisät', 'extra', 0, 'burgerit-1');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-burgerit-1-ateria', 'Extras', 'Lisät', 'extra', 0, 'burgerit-1-ateria');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-burgerit-2', 'Extras', 'Lisät', 'extra', 0, 'burgerit-2');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-burgerit-2-ateria', 'Extras', 'Lisät', 'extra', 0, 'burgerit-2-ateria');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-burgerit-3', 'Extras', 'Lisät', 'extra', 0, 'burgerit-3');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-burgerit-3-ateria', 'Extras', 'Lisät', 'extra', 0, 'burgerit-3-ateria');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-burgerit-4', 'Extras', 'Lisät', 'extra', 0, 'burgerit-4');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-burgerit-4-ateria', 'Extras', 'Lisät', 'extra', 0, 'burgerit-4-ateria');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-burgerit-5', 'Extras', 'Lisät', 'extra', 0, 'burgerit-5');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-burgerit-5-ateria', 'Extras', 'Lisät', 'extra', 0, 'burgerit-5-ateria');

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-0-patty', 'extra-burgerit-0', 'Extra patty (120 g)', 'Lisäpihvi (120 g)', 2.50, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-0-bacon', 'extra-burgerit-0', 'Bacon', 'Pekoni', 2.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-0-cheese', 'extra-burgerit-0', 'Cheese', 'Juusto', 2.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-0-pineapple', 'extra-burgerit-0', 'Pineapple', 'Ananas', 2.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-0-blue-cheese', 'extra-burgerit-0', 'Blue cheese', 'Blue cheese', 2.50, 4);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-0-onion', 'extra-burgerit-0', 'Onion', 'Sipuli', 2.50, 5);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-0-egg', 'extra-burgerit-0', 'Egg', 'Kananmuna', 2.50, 6);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-0-ateria-patty', 'extra-burgerit-0-ateria', 'Extra patty (120 g)', 'Lisäpihvi (120 g)', 2.50, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-0-ateria-bacon', 'extra-burgerit-0-ateria', 'Bacon', 'Pekoni', 2.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-0-ateria-cheese', 'extra-burgerit-0-ateria', 'Cheese', 'Juusto', 2.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-0-ateria-pineapple', 'extra-burgerit-0-ateria', 'Pineapple', 'Ananas', 2.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-0-ateria-blue-cheese', 'extra-burgerit-0-ateria', 'Blue cheese', 'Blue cheese', 2.50, 4);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-0-ateria-onion', 'extra-burgerit-0-ateria', 'Onion', 'Sipuli', 2.50, 5);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-0-ateria-egg', 'extra-burgerit-0-ateria', 'Egg', 'Kananmuna', 2.50, 6);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-1-patty', 'extra-burgerit-1', 'Extra patty (120 g)', 'Lisäpihvi (120 g)', 2.50, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-1-bacon', 'extra-burgerit-1', 'Bacon', 'Pekoni', 2.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-1-cheese', 'extra-burgerit-1', 'Cheese', 'Juusto', 2.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-1-pineapple', 'extra-burgerit-1', 'Pineapple', 'Ananas', 2.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-1-blue-cheese', 'extra-burgerit-1', 'Blue cheese', 'Blue cheese', 2.50, 4);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-1-onion', 'extra-burgerit-1', 'Onion', 'Sipuli', 2.50, 5);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-1-egg', 'extra-burgerit-1', 'Egg', 'Kananmuna', 2.50, 6);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-1-ateria-patty', 'extra-burgerit-1-ateria', 'Extra patty (120 g)', 'Lisäpihvi (120 g)', 2.50, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-1-ateria-bacon', 'extra-burgerit-1-ateria', 'Bacon', 'Pekoni', 2.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-1-ateria-cheese', 'extra-burgerit-1-ateria', 'Cheese', 'Juusto', 2.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-1-ateria-pineapple', 'extra-burgerit-1-ateria', 'Pineapple', 'Ananas', 2.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-1-ateria-blue-cheese', 'extra-burgerit-1-ateria', 'Blue cheese', 'Blue cheese', 2.50, 4);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-1-ateria-onion', 'extra-burgerit-1-ateria', 'Onion', 'Sipuli', 2.50, 5);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-1-ateria-egg', 'extra-burgerit-1-ateria', 'Egg', 'Kananmuna', 2.50, 6);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-2-patty', 'extra-burgerit-2', 'Extra patty (120 g)', 'Lisäpihvi (120 g)', 2.50, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-2-bacon', 'extra-burgerit-2', 'Bacon', 'Pekoni', 2.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-2-cheese', 'extra-burgerit-2', 'Cheese', 'Juusto', 2.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-2-pineapple', 'extra-burgerit-2', 'Pineapple', 'Ananas', 2.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-2-blue-cheese', 'extra-burgerit-2', 'Blue cheese', 'Blue cheese', 2.50, 4);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-2-onion', 'extra-burgerit-2', 'Onion', 'Sipuli', 2.50, 5);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-2-egg', 'extra-burgerit-2', 'Egg', 'Kananmuna', 2.50, 6);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-2-ateria-patty', 'extra-burgerit-2-ateria', 'Extra patty (120 g)', 'Lisäpihvi (120 g)', 2.50, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-2-ateria-bacon', 'extra-burgerit-2-ateria', 'Bacon', 'Pekoni', 2.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-2-ateria-cheese', 'extra-burgerit-2-ateria', 'Cheese', 'Juusto', 2.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-2-ateria-pineapple', 'extra-burgerit-2-ateria', 'Pineapple', 'Ananas', 2.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-2-ateria-blue-cheese', 'extra-burgerit-2-ateria', 'Blue cheese', 'Blue cheese', 2.50, 4);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-2-ateria-onion', 'extra-burgerit-2-ateria', 'Onion', 'Sipuli', 2.50, 5);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-2-ateria-egg', 'extra-burgerit-2-ateria', 'Egg', 'Kananmuna', 2.50, 6);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-3-patty', 'extra-burgerit-3', 'Extra patty (120 g)', 'Lisäpihvi (120 g)', 2.50, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-3-bacon', 'extra-burgerit-3', 'Bacon', 'Pekoni', 2.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-3-cheese', 'extra-burgerit-3', 'Cheese', 'Juusto', 2.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-3-pineapple', 'extra-burgerit-3', 'Pineapple', 'Ananas', 2.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-3-blue-cheese', 'extra-burgerit-3', 'Blue cheese', 'Blue cheese', 2.50, 4);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-3-onion', 'extra-burgerit-3', 'Onion', 'Sipuli', 2.50, 5);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-3-egg', 'extra-burgerit-3', 'Egg', 'Kananmuna', 2.50, 6);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-3-ateria-patty', 'extra-burgerit-3-ateria', 'Extra patty (120 g)', 'Lisäpihvi (120 g)', 2.50, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-3-ateria-bacon', 'extra-burgerit-3-ateria', 'Bacon', 'Pekoni', 2.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-3-ateria-cheese', 'extra-burgerit-3-ateria', 'Cheese', 'Juusto', 2.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-3-ateria-pineapple', 'extra-burgerit-3-ateria', 'Pineapple', 'Ananas', 2.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-3-ateria-blue-cheese', 'extra-burgerit-3-ateria', 'Blue cheese', 'Blue cheese', 2.50, 4);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-3-ateria-onion', 'extra-burgerit-3-ateria', 'Onion', 'Sipuli', 2.50, 5);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-3-ateria-egg', 'extra-burgerit-3-ateria', 'Egg', 'Kananmuna', 2.50, 6);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-4-patty', 'extra-burgerit-4', 'Extra patty (120 g)', 'Lisäpihvi (120 g)', 2.50, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-4-bacon', 'extra-burgerit-4', 'Bacon', 'Pekoni', 2.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-4-cheese', 'extra-burgerit-4', 'Cheese', 'Juusto', 2.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-4-pineapple', 'extra-burgerit-4', 'Pineapple', 'Ananas', 2.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-4-blue-cheese', 'extra-burgerit-4', 'Blue cheese', 'Blue cheese', 2.50, 4);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-4-onion', 'extra-burgerit-4', 'Onion', 'Sipuli', 2.50, 5);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-4-egg', 'extra-burgerit-4', 'Egg', 'Kananmuna', 2.50, 6);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-4-ateria-patty', 'extra-burgerit-4-ateria', 'Extra patty (120 g)', 'Lisäpihvi (120 g)', 2.50, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-4-ateria-bacon', 'extra-burgerit-4-ateria', 'Bacon', 'Pekoni', 2.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-4-ateria-cheese', 'extra-burgerit-4-ateria', 'Cheese', 'Juusto', 2.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-4-ateria-pineapple', 'extra-burgerit-4-ateria', 'Pineapple', 'Ananas', 2.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-4-ateria-blue-cheese', 'extra-burgerit-4-ateria', 'Blue cheese', 'Blue cheese', 2.50, 4);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-4-ateria-onion', 'extra-burgerit-4-ateria', 'Onion', 'Sipuli', 2.50, 5);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-4-ateria-egg', 'extra-burgerit-4-ateria', 'Egg', 'Kananmuna', 2.50, 6);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-5-patty', 'extra-burgerit-5', 'Extra patty (120 g)', 'Lisäpihvi (120 g)', 2.50, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-5-bacon', 'extra-burgerit-5', 'Bacon', 'Pekoni', 2.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-5-cheese', 'extra-burgerit-5', 'Cheese', 'Juusto', 2.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-5-pineapple', 'extra-burgerit-5', 'Pineapple', 'Ananas', 2.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-5-blue-cheese', 'extra-burgerit-5', 'Blue cheese', 'Blue cheese', 2.50, 4);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-5-onion', 'extra-burgerit-5', 'Onion', 'Sipuli', 2.50, 5);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-5-egg', 'extra-burgerit-5', 'Egg', 'Kananmuna', 2.50, 6);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-5-ateria-patty', 'extra-burgerit-5-ateria', 'Extra patty (120 g)', 'Lisäpihvi (120 g)', 2.50, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-5-ateria-bacon', 'extra-burgerit-5-ateria', 'Bacon', 'Pekoni', 2.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-5-ateria-cheese', 'extra-burgerit-5-ateria', 'Cheese', 'Juusto', 2.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-5-ateria-pineapple', 'extra-burgerit-5-ateria', 'Pineapple', 'Ananas', 2.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-5-ateria-blue-cheese', 'extra-burgerit-5-ateria', 'Blue cheese', 'Blue cheese', 2.50, 4);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-5-ateria-onion', 'extra-burgerit-5-ateria', 'Onion', 'Sipuli', 2.50, 5);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-burgerit-5-ateria-egg', 'extra-burgerit-5-ateria', 'Egg', 'Kananmuna', 2.50, 6);

-- Split kebab categories brief — replaces the single combined
-- "Broilerin Rintafile / Kebabit / Kanakebabit" category (id 'kebabit',
-- 12 generic style-named products 'kebabit-0'..'kebabit-11') with 3
-- separate, clearly-labeled categories — Kebab, Chicken Kebab, and
-- Chicken Fillet — each carrying the same 12 real style variants as
-- its own named products, so a customer picks the protein via the
-- category itself instead of a same-named generic style item that
-- never said which protein it was. Matches how comparable real Finnish
-- kebab chains structure this (confirmed against a real example's live
-- ordering pages per the brief).
--
-- Every one of the 36 new products keeps the exact real source price
-- (11.90 €, flat across all styles and all 3 proteins, per Pizza
-- Kuningas's own printed menu — it does not vary price by protein) and
-- the same 5 real extras already proven on the old 12 products (Double
-- meat +4.00 €, Yogurt/Garlic/Blue cheese/Jalapeño sauce +1.50 € each),
-- via the same general per-product 'extra' option_groups mechanism
-- (worker/migrations/021_option_group_product_id.sql,
-- 023_extras_and_additional_info.sql) — no new mechanism, just scoped
-- to 3x as many products.
--
-- Deletion order (respects the real FK chain, same as migration 022):
--   options       -> REFERENCES option_groups(id)
--   option_groups -> REFERENCES products(id)
--   products      -> REFERENCES categories(id)
--   categories
-- All four DELETEs below are scoped ONLY to the old 'kebabit' category
-- and its own products/option_groups/options — every other category's
-- rows (pizzat, burgerit, voner, ...) are untouched. admin_settings,
-- orders and order_items are never referenced by this migration at
-- all — order_items snapshots its own name/line_total/details at
-- order-creation time (established in migration 022's own delivery
-- report) rather than joining live to products, so deleting the old
-- kebabit-* products cannot corrupt any historical order or invoice.
-- bundles is untouched too — no seeded/migration-created bundle row
-- anywhere in this codebase references a kebabit-* product id (traced
-- and confirmed; see this round's delivery report for the full trace).

DELETE FROM options WHERE group_id IN (SELECT id FROM option_groups WHERE product_id IN (SELECT id FROM products WHERE category_id = 'kebabit'));
DELETE FROM option_groups WHERE product_id IN (SELECT id FROM products WHERE category_id = 'kebabit');
DELETE FROM products WHERE category_id = 'kebabit';
DELETE FROM categories WHERE id = 'kebabit';

-- Old 'kebabit' occupied categories.sort_order = 7, between Vöner (6)
-- and Burgers (8). Shift every category from Burgers onward up by 2
-- (net effect of -1 category +3 categories) so the 3 new categories
-- can take sort_order 7/8/9 and the menu keeps its real, intentional
-- section order — kebab/chicken-kebab/chicken-fillet stay right where
-- the combined category used to sit, instead of getting tacked onto
-- the very end of the whole menu after Salads. Only the categories
-- table's sort_order column is touched here; nothing else about any
-- of these other categories (their products, extras, etc.) changes.
UPDATE categories SET sort_order = sort_order + 2 WHERE sort_order >= 8;

-- ---------------------------------------------------------------------
-- Categories (3, replacing the old single 'kebabit')
-- ---------------------------------------------------------------------
INSERT INTO categories (id, title, title_fi, sub, sub_fi, sort_order) VALUES ('kebabit', 'Kebab', 'Kebab', 'Kebab, your way. + Double meat +4.00 €. + Extras: yogurt sauce, garlic sauce, blue cheese or jalapeño, +1.50 € each.', 'Kebabia valitsemallasi tavalla. + Tupla kebab +4,00 €. + Lisät: jogurttikastike, valkosipulikastike, aurajuusto tai jalapeno, +1,50 €/kpl.', 7);
INSERT INTO categories (id, title, title_fi, sub, sub_fi, sort_order) VALUES ('kanakebabit', 'Chicken Kebab', 'Kanakebab', 'Chicken Kebab, your way. + Double meat +4.00 €. + Extras: yogurt sauce, garlic sauce, blue cheese or jalapeño, +1.50 € each.', 'Kanakebabia valitsemallasi tavalla. + Tupla kanakebab +4,00 €. + Lisät: jogurttikastike, valkosipulikastike, aurajuusto tai jalapeno, +1,50 €/kpl.', 8);
INSERT INTO categories (id, title, title_fi, sub, sub_fi, sort_order) VALUES ('broilerin-rintafile', 'Chicken Fillet', 'Broilerin Rintafile', 'Chicken Fillet, your way. + Double meat +4.00 €. + Extras: yogurt sauce, garlic sauce, blue cheese or jalapeño, +1.50 € each.', 'Broilerin rintafilettä valitsemallasi tavalla. + Tupla broilerin rintafile +4,00 €. + Lisät: jogurttikastike, valkosipulikastike, aurajuusto tai jalapeno, +1,50 €/kpl.', 9);

-- ---------------------------------------------------------------------
-- Products (36 = 12 real style variants x 3 proteins). sort_order
-- continues from 104 (one past the highest existing product sort_order,
-- 103) — products' own sort_order only has to be locally increasing
-- within each category (see lib/menu-data.ts's single, globally-sorted
-- 'SELECT * FROM products ... ORDER BY sort_order' plus
-- components/MenuSection.tsx's per-category .filter(), which preserves
-- that relative order) — so appending here is safe and touches no
-- other product's row.
-- ---------------------------------------------------------------------
-- Kebab (kebabit)
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-0', 'kebabit', '1. Kebab in Bread', '1. Kebab Leivällä', 'In bread, served fresh.', 'Leivässä, tuoreena tarjoiltuna.', 11.9, NULL, 0, 104, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-1', 'kebabit', '2. Kebab with Rice', '2. Kebab Riisillä', 'With rice.', 'Riisillä.', 11.9, NULL, 0, 105, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-2', 'kebabit', '3. Kebab with Fries', '3. Kebab Ranskalaisilla', 'With fries.', 'Ranskalaisilla.', 11.9, NULL, 0, 106, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-3', 'kebabit', '4. Kebab with Wedge Potatoes', '4. Kebab Lohkoperunoilla', 'With wedge potatoes.', 'Lohkoperunoilla.', 11.9, NULL, 0, 107, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-4', 'kebabit', '5. Kebab with Creamy Potatoes', '5. Kebab Kermaperunoilla', 'With creamy potatoes.', 'Kermaperunoilla.', 11.9, NULL, 0, 108, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-5', 'kebabit', '6. Kebab with Garlic Creamy Potatoes', '6. Kebab Valkosipulikermaperunoilla', 'With garlic creamy potatoes.', 'Valkosipulikermaperunoilla.', 11.9, NULL, 0, 109, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-6', 'kebabit', '7. Kebab Wrap', '7. Kebab Riulla', 'Wrap.', 'Rullana.', 11.9, NULL, 0, 110, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-7', 'kebabit', '8. Kebab Wrap with Blue Cheese', '8. Kebab Rulla Aurajuustolla', 'Wrap with blue cheese.', 'Rulla, aurajuusto.', 11.9, NULL, 0, 111, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-8', 'kebabit', '9. Spicy Kebab Wrap', '9. Tulinen Kebab Rulla', 'Wrap with jalapeño.', 'Rulla, jalapeno.', 11.9, NULL, 0, 112, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-9', 'kebabit', '10. Special Kebab Wrap', '10. Special Kebab Rulla', 'Wrap with bell pepper, onion.', 'Rulla, paprika, sipuli.', 11.9, NULL, 0, 113, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-10', 'kebabit', '11. Kebab with Salad', '11. Kebab Salaatilla', 'With salad, feta cheese, olives.', 'Salaatti, fetajuusto, oliivi.', 11.9, NULL, 0, 114, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-11', 'kebabit', '12. Kebab Iskender', '12. Kebab Iskender', 'Kebab, iskender style.', 'Kebab.', 11.9, NULL, 0, 115, 1);

-- Chicken Kebab (kanakebabit)
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kanakebabit-0', 'kanakebabit', '1. Chicken Kebab in Bread', '1. Kanakebab Leivällä', 'In bread, served fresh.', 'Leivässä, tuoreena tarjoiltuna.', 11.9, NULL, 0, 116, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kanakebabit-1', 'kanakebabit', '2. Chicken Kebab with Rice', '2. Kanakebab Riisillä', 'With rice.', 'Riisillä.', 11.9, NULL, 0, 117, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kanakebabit-2', 'kanakebabit', '3. Chicken Kebab with Fries', '3. Kanakebab Ranskalaisilla', 'With fries.', 'Ranskalaisilla.', 11.9, NULL, 0, 118, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kanakebabit-3', 'kanakebabit', '4. Chicken Kebab with Wedge Potatoes', '4. Kanakebab Lohkoperunoilla', 'With wedge potatoes.', 'Lohkoperunoilla.', 11.9, NULL, 0, 119, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kanakebabit-4', 'kanakebabit', '5. Chicken Kebab with Creamy Potatoes', '5. Kanakebab Kermaperunoilla', 'With creamy potatoes.', 'Kermaperunoilla.', 11.9, NULL, 0, 120, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kanakebabit-5', 'kanakebabit', '6. Chicken Kebab with Garlic Creamy Potatoes', '6. Kanakebab Valkosipulikermaperunoilla', 'With garlic creamy potatoes.', 'Valkosipulikermaperunoilla.', 11.9, NULL, 0, 121, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kanakebabit-6', 'kanakebabit', '7. Chicken Kebab Wrap', '7. Kanakebab Riulla', 'Wrap.', 'Rullana.', 11.9, NULL, 0, 122, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kanakebabit-7', 'kanakebabit', '8. Chicken Kebab Wrap with Blue Cheese', '8. Kanakebab Rulla Aurajuustolla', 'Wrap with blue cheese.', 'Rulla, aurajuusto.', 11.9, NULL, 0, 123, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kanakebabit-8', 'kanakebabit', '9. Spicy Chicken Kebab Wrap', '9. Tulinen Kanakebab Rulla', 'Wrap with jalapeño.', 'Rulla, jalapeno.', 11.9, NULL, 0, 124, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kanakebabit-9', 'kanakebabit', '10. Special Chicken Kebab Wrap', '10. Special Kanakebab Rulla', 'Wrap with bell pepper, onion.', 'Rulla, paprika, sipuli.', 11.9, NULL, 0, 125, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kanakebabit-10', 'kanakebabit', '11. Chicken Kebab with Salad', '11. Kanakebab Salaatilla', 'With salad, feta cheese, olives.', 'Salaatti, fetajuusto, oliivi.', 11.9, NULL, 0, 126, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kanakebabit-11', 'kanakebabit', '12. Chicken Kebab Iskender', '12. Kanakebab Iskender', 'Chicken kebab, iskender style.', 'Kanakebab.', 11.9, NULL, 0, 127, 1);

-- Chicken Fillet (broilerin-rintafile)
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('broilerin-rintafile-0', 'broilerin-rintafile', '1. Chicken Fillet in Bread', '1. Broilerin Rintafile Leivällä', 'In bread, served fresh.', 'Leivässä, tuoreena tarjoiltuna.', 11.9, NULL, 0, 128, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('broilerin-rintafile-1', 'broilerin-rintafile', '2. Chicken Fillet with Rice', '2. Broilerin Rintafile Riisillä', 'With rice.', 'Riisillä.', 11.9, NULL, 0, 129, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('broilerin-rintafile-2', 'broilerin-rintafile', '3. Chicken Fillet with Fries', '3. Broilerin Rintafile Ranskalaisilla', 'With fries.', 'Ranskalaisilla.', 11.9, NULL, 0, 130, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('broilerin-rintafile-3', 'broilerin-rintafile', '4. Chicken Fillet with Wedge Potatoes', '4. Broilerin Rintafile Lohkoperunoilla', 'With wedge potatoes.', 'Lohkoperunoilla.', 11.9, NULL, 0, 131, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('broilerin-rintafile-4', 'broilerin-rintafile', '5. Chicken Fillet with Creamy Potatoes', '5. Broilerin Rintafile Kermaperunoilla', 'With creamy potatoes.', 'Kermaperunoilla.', 11.9, NULL, 0, 132, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('broilerin-rintafile-5', 'broilerin-rintafile', '6. Chicken Fillet with Garlic Creamy Potatoes', '6. Broilerin Rintafile Valkosipulikermaperunoilla', 'With garlic creamy potatoes.', 'Valkosipulikermaperunoilla.', 11.9, NULL, 0, 133, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('broilerin-rintafile-6', 'broilerin-rintafile', '7. Chicken Fillet Wrap', '7. Broilerin Rintafile Riulla', 'Wrap.', 'Rullana.', 11.9, NULL, 0, 134, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('broilerin-rintafile-7', 'broilerin-rintafile', '8. Chicken Fillet Wrap with Blue Cheese', '8. Broilerin Rintafile Rulla Aurajuustolla', 'Wrap with blue cheese.', 'Rulla, aurajuusto.', 11.9, NULL, 0, 135, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('broilerin-rintafile-8', 'broilerin-rintafile', '9. Spicy Chicken Fillet Wrap', '9. Tulinen Broilerin Rintafile Rulla', 'Wrap with jalapeño.', 'Rulla, jalapeno.', 11.9, NULL, 0, 136, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('broilerin-rintafile-9', 'broilerin-rintafile', '10. Special Chicken Fillet Wrap', '10. Special Broilerin Rintafile Rulla', 'Wrap with bell pepper, onion.', 'Rulla, paprika, sipuli.', 11.9, NULL, 0, 137, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('broilerin-rintafile-10', 'broilerin-rintafile', '11. Chicken Fillet with Salad', '11. Broilerin Rintafile Salaatilla', 'With salad, feta cheese, olives.', 'Salaatti, fetajuusto, oliivi.', 11.9, NULL, 0, 138, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('broilerin-rintafile-11', 'broilerin-rintafile', '12. Chicken Fillet Iskender', '12. Broilerin Rintafile Iskender', 'Chicken fillet, iskender style.', 'Broilerin rintafile.', 11.9, NULL, 0, 139, 1);

-- ---------------------------------------------------------------------
-- Extras (5 per product x 36 products = 180 options), using the same
-- general 'extra' option_groups/options mechanism migration 023 already
-- proved (option_groups.product_id scopes each group to exactly one
-- product — no cross-product leakage). Same data as the old 12
-- kebabit-* products' extras, just scoped to 3x as many products; the
-- Double meat option's Finnish label is the one thing adapted per
-- protein (the old label named both "kebab/kanakebab" generically,
-- since one product used to serve either protein — now each product
-- is a single specific protein, so its label names that protein only).
-- The English "Double meat" label and the other 4 extras (sauces/
-- toppings) are protein-agnostic and stay byte-for-byte identical
-- across all 36 products, exactly as they were on the old 12.
-- ---------------------------------------------------------------------
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
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kanakebabit-0', 'Extras', 'Lisät', 'extra', 0, 'kanakebabit-0');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kanakebabit-1', 'Extras', 'Lisät', 'extra', 0, 'kanakebabit-1');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kanakebabit-2', 'Extras', 'Lisät', 'extra', 0, 'kanakebabit-2');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kanakebabit-3', 'Extras', 'Lisät', 'extra', 0, 'kanakebabit-3');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kanakebabit-4', 'Extras', 'Lisät', 'extra', 0, 'kanakebabit-4');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kanakebabit-5', 'Extras', 'Lisät', 'extra', 0, 'kanakebabit-5');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kanakebabit-6', 'Extras', 'Lisät', 'extra', 0, 'kanakebabit-6');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kanakebabit-7', 'Extras', 'Lisät', 'extra', 0, 'kanakebabit-7');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kanakebabit-8', 'Extras', 'Lisät', 'extra', 0, 'kanakebabit-8');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kanakebabit-9', 'Extras', 'Lisät', 'extra', 0, 'kanakebabit-9');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kanakebabit-10', 'Extras', 'Lisät', 'extra', 0, 'kanakebabit-10');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-kanakebabit-11', 'Extras', 'Lisät', 'extra', 0, 'kanakebabit-11');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-broilerin-rintafile-0', 'Extras', 'Lisät', 'extra', 0, 'broilerin-rintafile-0');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-broilerin-rintafile-1', 'Extras', 'Lisät', 'extra', 0, 'broilerin-rintafile-1');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-broilerin-rintafile-2', 'Extras', 'Lisät', 'extra', 0, 'broilerin-rintafile-2');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-broilerin-rintafile-3', 'Extras', 'Lisät', 'extra', 0, 'broilerin-rintafile-3');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-broilerin-rintafile-4', 'Extras', 'Lisät', 'extra', 0, 'broilerin-rintafile-4');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-broilerin-rintafile-5', 'Extras', 'Lisät', 'extra', 0, 'broilerin-rintafile-5');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-broilerin-rintafile-6', 'Extras', 'Lisät', 'extra', 0, 'broilerin-rintafile-6');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-broilerin-rintafile-7', 'Extras', 'Lisät', 'extra', 0, 'broilerin-rintafile-7');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-broilerin-rintafile-8', 'Extras', 'Lisät', 'extra', 0, 'broilerin-rintafile-8');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-broilerin-rintafile-9', 'Extras', 'Lisät', 'extra', 0, 'broilerin-rintafile-9');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-broilerin-rintafile-10', 'Extras', 'Lisät', 'extra', 0, 'broilerin-rintafile-10');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order, product_id) VALUES ('extra-broilerin-rintafile-11', 'Extras', 'Lisät', 'extra', 0, 'broilerin-rintafile-11');

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-0-double-meat', 'extra-kebabit-0', 'Double meat', 'Tupla kebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-0-yogurt-sauce', 'extra-kebabit-0', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-0-garlic-sauce', 'extra-kebabit-0', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-0-blue-cheese', 'extra-kebabit-0', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-0-jalapeno', 'extra-kebabit-0', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-1-double-meat', 'extra-kebabit-1', 'Double meat', 'Tupla kebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-1-yogurt-sauce', 'extra-kebabit-1', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-1-garlic-sauce', 'extra-kebabit-1', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-1-blue-cheese', 'extra-kebabit-1', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-1-jalapeno', 'extra-kebabit-1', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-2-double-meat', 'extra-kebabit-2', 'Double meat', 'Tupla kebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-2-yogurt-sauce', 'extra-kebabit-2', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-2-garlic-sauce', 'extra-kebabit-2', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-2-blue-cheese', 'extra-kebabit-2', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-2-jalapeno', 'extra-kebabit-2', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-3-double-meat', 'extra-kebabit-3', 'Double meat', 'Tupla kebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-3-yogurt-sauce', 'extra-kebabit-3', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-3-garlic-sauce', 'extra-kebabit-3', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-3-blue-cheese', 'extra-kebabit-3', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-3-jalapeno', 'extra-kebabit-3', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-4-double-meat', 'extra-kebabit-4', 'Double meat', 'Tupla kebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-4-yogurt-sauce', 'extra-kebabit-4', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-4-garlic-sauce', 'extra-kebabit-4', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-4-blue-cheese', 'extra-kebabit-4', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-4-jalapeno', 'extra-kebabit-4', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-5-double-meat', 'extra-kebabit-5', 'Double meat', 'Tupla kebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-5-yogurt-sauce', 'extra-kebabit-5', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-5-garlic-sauce', 'extra-kebabit-5', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-5-blue-cheese', 'extra-kebabit-5', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-5-jalapeno', 'extra-kebabit-5', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-6-double-meat', 'extra-kebabit-6', 'Double meat', 'Tupla kebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-6-yogurt-sauce', 'extra-kebabit-6', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-6-garlic-sauce', 'extra-kebabit-6', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-6-blue-cheese', 'extra-kebabit-6', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-6-jalapeno', 'extra-kebabit-6', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-7-double-meat', 'extra-kebabit-7', 'Double meat', 'Tupla kebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-7-yogurt-sauce', 'extra-kebabit-7', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-7-garlic-sauce', 'extra-kebabit-7', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-7-blue-cheese', 'extra-kebabit-7', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-7-jalapeno', 'extra-kebabit-7', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-8-double-meat', 'extra-kebabit-8', 'Double meat', 'Tupla kebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-8-yogurt-sauce', 'extra-kebabit-8', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-8-garlic-sauce', 'extra-kebabit-8', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-8-blue-cheese', 'extra-kebabit-8', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-8-jalapeno', 'extra-kebabit-8', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-9-double-meat', 'extra-kebabit-9', 'Double meat', 'Tupla kebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-9-yogurt-sauce', 'extra-kebabit-9', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-9-garlic-sauce', 'extra-kebabit-9', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-9-blue-cheese', 'extra-kebabit-9', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-9-jalapeno', 'extra-kebabit-9', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-10-double-meat', 'extra-kebabit-10', 'Double meat', 'Tupla kebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-10-yogurt-sauce', 'extra-kebabit-10', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-10-garlic-sauce', 'extra-kebabit-10', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-10-blue-cheese', 'extra-kebabit-10', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-10-jalapeno', 'extra-kebabit-10', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-11-double-meat', 'extra-kebabit-11', 'Double meat', 'Tupla kebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-11-yogurt-sauce', 'extra-kebabit-11', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-11-garlic-sauce', 'extra-kebabit-11', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-11-blue-cheese', 'extra-kebabit-11', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kebabit-11-jalapeno', 'extra-kebabit-11', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-0-double-meat', 'extra-kanakebabit-0', 'Double meat', 'Tupla kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-0-yogurt-sauce', 'extra-kanakebabit-0', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-0-garlic-sauce', 'extra-kanakebabit-0', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-0-blue-cheese', 'extra-kanakebabit-0', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-0-jalapeno', 'extra-kanakebabit-0', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-1-double-meat', 'extra-kanakebabit-1', 'Double meat', 'Tupla kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-1-yogurt-sauce', 'extra-kanakebabit-1', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-1-garlic-sauce', 'extra-kanakebabit-1', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-1-blue-cheese', 'extra-kanakebabit-1', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-1-jalapeno', 'extra-kanakebabit-1', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-2-double-meat', 'extra-kanakebabit-2', 'Double meat', 'Tupla kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-2-yogurt-sauce', 'extra-kanakebabit-2', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-2-garlic-sauce', 'extra-kanakebabit-2', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-2-blue-cheese', 'extra-kanakebabit-2', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-2-jalapeno', 'extra-kanakebabit-2', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-3-double-meat', 'extra-kanakebabit-3', 'Double meat', 'Tupla kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-3-yogurt-sauce', 'extra-kanakebabit-3', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-3-garlic-sauce', 'extra-kanakebabit-3', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-3-blue-cheese', 'extra-kanakebabit-3', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-3-jalapeno', 'extra-kanakebabit-3', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-4-double-meat', 'extra-kanakebabit-4', 'Double meat', 'Tupla kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-4-yogurt-sauce', 'extra-kanakebabit-4', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-4-garlic-sauce', 'extra-kanakebabit-4', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-4-blue-cheese', 'extra-kanakebabit-4', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-4-jalapeno', 'extra-kanakebabit-4', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-5-double-meat', 'extra-kanakebabit-5', 'Double meat', 'Tupla kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-5-yogurt-sauce', 'extra-kanakebabit-5', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-5-garlic-sauce', 'extra-kanakebabit-5', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-5-blue-cheese', 'extra-kanakebabit-5', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-5-jalapeno', 'extra-kanakebabit-5', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-6-double-meat', 'extra-kanakebabit-6', 'Double meat', 'Tupla kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-6-yogurt-sauce', 'extra-kanakebabit-6', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-6-garlic-sauce', 'extra-kanakebabit-6', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-6-blue-cheese', 'extra-kanakebabit-6', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-6-jalapeno', 'extra-kanakebabit-6', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-7-double-meat', 'extra-kanakebabit-7', 'Double meat', 'Tupla kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-7-yogurt-sauce', 'extra-kanakebabit-7', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-7-garlic-sauce', 'extra-kanakebabit-7', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-7-blue-cheese', 'extra-kanakebabit-7', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-7-jalapeno', 'extra-kanakebabit-7', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-8-double-meat', 'extra-kanakebabit-8', 'Double meat', 'Tupla kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-8-yogurt-sauce', 'extra-kanakebabit-8', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-8-garlic-sauce', 'extra-kanakebabit-8', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-8-blue-cheese', 'extra-kanakebabit-8', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-8-jalapeno', 'extra-kanakebabit-8', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-9-double-meat', 'extra-kanakebabit-9', 'Double meat', 'Tupla kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-9-yogurt-sauce', 'extra-kanakebabit-9', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-9-garlic-sauce', 'extra-kanakebabit-9', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-9-blue-cheese', 'extra-kanakebabit-9', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-9-jalapeno', 'extra-kanakebabit-9', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-10-double-meat', 'extra-kanakebabit-10', 'Double meat', 'Tupla kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-10-yogurt-sauce', 'extra-kanakebabit-10', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-10-garlic-sauce', 'extra-kanakebabit-10', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-10-blue-cheese', 'extra-kanakebabit-10', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-10-jalapeno', 'extra-kanakebabit-10', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-11-double-meat', 'extra-kanakebabit-11', 'Double meat', 'Tupla kanakebab', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-11-yogurt-sauce', 'extra-kanakebabit-11', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-11-garlic-sauce', 'extra-kanakebabit-11', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-11-blue-cheese', 'extra-kanakebabit-11', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-kanakebabit-11-jalapeno', 'extra-kanakebabit-11', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-0-double-meat', 'extra-broilerin-rintafile-0', 'Double meat', 'Tupla broilerin rintafile', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-0-yogurt-sauce', 'extra-broilerin-rintafile-0', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-0-garlic-sauce', 'extra-broilerin-rintafile-0', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-0-blue-cheese', 'extra-broilerin-rintafile-0', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-0-jalapeno', 'extra-broilerin-rintafile-0', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-1-double-meat', 'extra-broilerin-rintafile-1', 'Double meat', 'Tupla broilerin rintafile', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-1-yogurt-sauce', 'extra-broilerin-rintafile-1', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-1-garlic-sauce', 'extra-broilerin-rintafile-1', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-1-blue-cheese', 'extra-broilerin-rintafile-1', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-1-jalapeno', 'extra-broilerin-rintafile-1', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-2-double-meat', 'extra-broilerin-rintafile-2', 'Double meat', 'Tupla broilerin rintafile', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-2-yogurt-sauce', 'extra-broilerin-rintafile-2', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-2-garlic-sauce', 'extra-broilerin-rintafile-2', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-2-blue-cheese', 'extra-broilerin-rintafile-2', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-2-jalapeno', 'extra-broilerin-rintafile-2', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-3-double-meat', 'extra-broilerin-rintafile-3', 'Double meat', 'Tupla broilerin rintafile', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-3-yogurt-sauce', 'extra-broilerin-rintafile-3', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-3-garlic-sauce', 'extra-broilerin-rintafile-3', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-3-blue-cheese', 'extra-broilerin-rintafile-3', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-3-jalapeno', 'extra-broilerin-rintafile-3', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-4-double-meat', 'extra-broilerin-rintafile-4', 'Double meat', 'Tupla broilerin rintafile', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-4-yogurt-sauce', 'extra-broilerin-rintafile-4', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-4-garlic-sauce', 'extra-broilerin-rintafile-4', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-4-blue-cheese', 'extra-broilerin-rintafile-4', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-4-jalapeno', 'extra-broilerin-rintafile-4', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-5-double-meat', 'extra-broilerin-rintafile-5', 'Double meat', 'Tupla broilerin rintafile', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-5-yogurt-sauce', 'extra-broilerin-rintafile-5', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-5-garlic-sauce', 'extra-broilerin-rintafile-5', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-5-blue-cheese', 'extra-broilerin-rintafile-5', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-5-jalapeno', 'extra-broilerin-rintafile-5', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-6-double-meat', 'extra-broilerin-rintafile-6', 'Double meat', 'Tupla broilerin rintafile', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-6-yogurt-sauce', 'extra-broilerin-rintafile-6', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-6-garlic-sauce', 'extra-broilerin-rintafile-6', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-6-blue-cheese', 'extra-broilerin-rintafile-6', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-6-jalapeno', 'extra-broilerin-rintafile-6', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-7-double-meat', 'extra-broilerin-rintafile-7', 'Double meat', 'Tupla broilerin rintafile', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-7-yogurt-sauce', 'extra-broilerin-rintafile-7', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-7-garlic-sauce', 'extra-broilerin-rintafile-7', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-7-blue-cheese', 'extra-broilerin-rintafile-7', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-7-jalapeno', 'extra-broilerin-rintafile-7', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-8-double-meat', 'extra-broilerin-rintafile-8', 'Double meat', 'Tupla broilerin rintafile', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-8-yogurt-sauce', 'extra-broilerin-rintafile-8', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-8-garlic-sauce', 'extra-broilerin-rintafile-8', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-8-blue-cheese', 'extra-broilerin-rintafile-8', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-8-jalapeno', 'extra-broilerin-rintafile-8', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-9-double-meat', 'extra-broilerin-rintafile-9', 'Double meat', 'Tupla broilerin rintafile', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-9-yogurt-sauce', 'extra-broilerin-rintafile-9', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-9-garlic-sauce', 'extra-broilerin-rintafile-9', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-9-blue-cheese', 'extra-broilerin-rintafile-9', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-9-jalapeno', 'extra-broilerin-rintafile-9', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-10-double-meat', 'extra-broilerin-rintafile-10', 'Double meat', 'Tupla broilerin rintafile', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-10-yogurt-sauce', 'extra-broilerin-rintafile-10', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-10-garlic-sauce', 'extra-broilerin-rintafile-10', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-10-blue-cheese', 'extra-broilerin-rintafile-10', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-10-jalapeno', 'extra-broilerin-rintafile-10', 'Jalapeño', 'Jalapeno', 1.50, 4);

INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-11-double-meat', 'extra-broilerin-rintafile-11', 'Double meat', 'Tupla broilerin rintafile', 4.00, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-11-yogurt-sauce', 'extra-broilerin-rintafile-11', 'Yogurt sauce', 'Jogurttikastike', 1.50, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-11-garlic-sauce', 'extra-broilerin-rintafile-11', 'Garlic sauce', 'Valkosipulikastike', 1.50, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-11-blue-cheese', 'extra-broilerin-rintafile-11', 'Blue cheese', 'Aurajuusto', 1.50, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('extra-broilerin-rintafile-11-jalapeno', 'extra-broilerin-rintafile-11', 'Jalapeño', 'Jalapeno', 1.50, 4);


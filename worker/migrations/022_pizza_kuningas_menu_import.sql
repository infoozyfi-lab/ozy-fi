-- Full menu replacement brief — Pizza Kuningas Myyrmäki takes over as
-- ozy.fi's live menu. This is a genuinely destructive migration, run
-- exactly once: it deletes EVERY existing category, product,
-- option_group/option row and addon, then rebuilds the menu entirely
-- from the source document (pizza-kuningas-menu-extracted.md, attached
-- to this brief, itself extracted+double-verified against the source
-- PDF menu photos). Nothing here touches `orders`, `order_items`, or
-- `admin_settings` — see this migration's own delivery report for the
-- explicit before/after confirmation on admin_settings, and the
-- pre-existing confirmation (already established earlier in this
-- project) that order_items snapshots its own name/line_total/details
-- at order-creation time rather than joining live to `products`, so
-- deleting old products cannot corrupt any historical order or invoice.
--
-- "Supertarjoukset" (the 6 combo offers) are explicitly OUT of scope —
-- the business owner is building those themselves via the admin
-- Bundles UI once this base menu exists — so no `bundles` rows are
-- touched by this migration either way.
--
-- ---------------------------------------------------------------------
-- Deletion order (respects the real FK chain, traced from
-- worker/schema.sql, not assumed):
--   options          -> REFERENCES option_groups(id)
--   option_groups    -> REFERENCES products(id)      (product_id, per-
--                        product 'size' groups only — worker/migrations/
--                        021_option_group_product_id.sql)
--   products         -> REFERENCES categories(id)
--   categories
--   addons           -> no FK, deleted for completeness (dips/drinks are
--                        being fully replaced too)
-- `bundles` is deliberately NOT deleted — nothing in this brief's real
-- menu creates any bundle rows, and any pre-existing demo bundle rows
-- reference product ids that no longer exist after this migration; left
-- as-is per the brief's explicit "Supertarjoukset" exclusion (the
-- business owner will manage bundles themselves from here).
-- ---------------------------------------------------------------------
DELETE FROM options;
DELETE FROM option_groups;
DELETE FROM products;
DELETE FROM categories;
DELETE FROM addons;

-- ---------------------------------------------------------------------
-- Categories (14, matching the source document's own section order)
-- ---------------------------------------------------------------------
INSERT INTO categories (id, title, title_fi, sub, sub_fi, sort_order) VALUES ('pizzat', 'Pizzas', 'Pizzat', 'Classic Pizza Kuningas pizzas, 3 sizes: Normal, Pannu and Perhe. Gluten-free crust available, +4.00 €.', 'Klassiset Pizza Kuningas -pizzat, 3 kokoa: Normaali, Pannu ja Perhe. Gluteeniton pohja saatavilla, +4,00 €.', 0);
INSERT INTO categories (id, title, title_fi, sub, sub_fi, sort_order) VALUES ('uutuus-pizzat', 'New Pizzas', 'Uutuus Pizzat', 'Our newest pizza creations, 3 sizes: Normal, Pannu and Perhe.', 'Uusimmat pizzamme, 3 kokoa: Normaali, Pannu ja Perhe.', 1);
INSERT INTO categories (id, title, title_fi, sub, sub_fi, sort_order) VALUES ('pesto-pizzat', 'Pesto Pizzas', 'Pesto Pizzat', 'Fresh pesto-based pizzas, 2 sizes: Normal and Family.', 'Tuoreet pestopizzat, 2 kokoa: Normaali ja Perhe.', 2);
INSERT INTO categories (id, title, title_fi, sub, sub_fi, sort_order) VALUES ('rucola-pizzat', 'Arugula Pizzas', 'Rucola Pizzat', 'Topped with fresh arugula, 2 sizes: Normal and Family.', 'Tuoreella rucolalla, 2 kokoa: Normaali ja Perhe.', 3);
INSERT INTO categories (id, title, title_fi, sub, sub_fi, sort_order) VALUES ('vikingos-pizzat', 'Vikingos Pizzas', 'Vikingos Pizzat', 'Served with your choice of garlic or salad dressing.', 'Tarjoillaan valkosipuli- tai salaattikastikkeella.', 4);
INSERT INTO categories (id, title, title_fi, sub, sub_fi, sort_order) VALUES ('vegaanipizza', 'Vegan Pizzas', 'Vegaanipizza', '100% plant-based, made with vegan cheese.', '100% kasvipohjainen, vegaanijuustolla.', 5);
INSERT INTO categories (id, title, title_fi, sub, sub_fi, sort_order) VALUES ('voner', 'Vöner', 'Vöner', 'Choose your style: bread, fries, rice, wedge or creamy potatoes.', 'Valitse tyylisi: leipä, ranskalaiset, riisi, lohko- tai kermaperunat.', 6);
INSERT INTO categories (id, title, title_fi, sub, sub_fi, sort_order) VALUES ('kebabit', 'Chicken Fillet / Kebab / Chicken Kebab', 'Broilerin Rintafile / Kebabit / Kanakebabit', 'Chicken fillet, kebab or chicken kebab, your way. + Double meat +4.00 €. + Extras: yogurt sauce, garlic sauce, blue cheese or jalapeño, +1.50 € each.', 'Broilerin rintafilettä, kebabia tai kanakebabia, valitsemallasi tavalla. + Tupla liha +4,00 €. + Lisät: jogurttikastike, valkosipulikastike, aurajuusto tai jalapeno, +1,50 €/kpl.', 7);
INSERT INTO categories (id, title, title_fi, sub, sub_fi, sort_order) VALUES ('burgerit', 'Burgers', 'Burgerit', 'Lettuce, tomato, pickle and burger sauce always included. Ateria (meal) adds regular fries and a 0.33 L drink. + Extras (2.50 € each): 120 g patty, bacon, cheese, pineapple, blue cheese, onion, egg.', 'Salaatti, tomaatti, suolakurkku ja hampurilaiskastike aina mukana. Ateria sisältää ranskalaiset ja 0,33 l juoman. + Lisät (2,50 €/kpl): 120 g pihvi, pekoni, juusto, ananas, aurajuusto, sipuli, kananmuna.', 8);
INSERT INTO categories (id, title, title_fi, sub, sub_fi, sort_order) VALUES ('sides', 'Sides', 'Sides', 'Snacks and sides, served with a dip.', 'Naposteltavaa ja lisukkeita, tarjoillaan dipin kanssa.', 9);
INSERT INTO categories (id, title, title_fi, sub, sub_fi, sort_order) VALUES ('hot-wings', 'Hot Wings', 'Hot Wings', 'Served with your choice of dip.', 'Tarjoillaan valitsemasi dipin kanssa.', 10);
INSERT INTO categories (id, title, title_fi, sub, sub_fi, sort_order) VALUES ('falafelt', 'Falafel', 'Falafelt', 'Falafel, iceberg lettuce, tomato, onion, cucumber and yogurt sauce in every dish.', 'Falafelia, jäävuorisalaattia, tomaattia, sipulia, kurkkua ja jogurttikastiketta jokaisessa annoksessa.', 11);
INSERT INTO categories (id, title, title_fi, sub, sub_fi, sort_order) VALUES ('pihvit', 'Steaks', 'Pihvit', 'Beef sirloin steak, your way.', 'Naudan ulkofileepihvi, valitsemallasi tavalla.', 12);
INSERT INTO categories (id, title, title_fi, sub, sub_fi, sort_order) VALUES ('salaatit', 'Salads', 'Salaatit', 'Cucumber, tomato and iceberg lettuce in every salad.', 'Kurkkua, tomaattia ja jäävuorisalaattia jokaisessa salaatissa.', 13);

-- Products
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pizzat-0', 'pizzat', '1. Bolognese', '1. Bolognese', 'Ground beef.', 'jauheliha.', 10.9, NULL, 1, 0, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pizzat-1', 'pizzat', '2. Americano', '2. Americano', 'Ham, pineapple, blue cheese.', 'kinkku, ananas, aurajuusto.', 10.9, NULL, 1, 1, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pizzat-2', 'pizzat', '3. Frutti', '3. Frutti', 'Tuna, shrimp, mussels.', 'tonnikala, katkarapu, simpukka.', 10.9, NULL, 1, 2, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pizzat-3', 'pizzat', '4. Vegetariana', '4. Vegetariana', 'Olives, mushroom, onion, tomato, bell pepper.', 'oliivi, herkkusieni, sipuli, tomaatti, paprika.', 10.9, NULL, 1, 3, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pizzat-4', 'pizzat', '5. Julia', '5. Julia', 'Ham, pineapple, shrimp, blue cheese.', 'kinkku, ananas, katkarapu, aurajuusto.', 10.9, NULL, 1, 4, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pizzat-5', 'pizzat', '6. Empire Special', '6. Empire Special', 'Shrimp, ham, salami, onion, garlic.', 'katkarapu, kinkku, salami, sipuli, valkosipuli.', 10.9, NULL, 1, 5, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pizzat-6', 'pizzat', '7. Mexicano', '7. Mexicano', 'Jalapeño, onion, pepperoni sausage.', 'jalapeno, sipuli, pepperonimakkara.', 10.9, NULL, 1, 6, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pizzat-7', 'pizzat', '8. Opera Special', '8. Opera Special', 'Ham, tuna, salami, onion.', 'kinkku, tonnikala, salami, sipuli.', 10.9, NULL, 1, 7, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pizzat-8', 'pizzat', '9. Pepperoni Sausage', '9. Pepperonimakkara', 'Pepperoni sausage, onion, ground beef.', 'pepperonimakkara, sipuli, jauheliha.', 10.9, NULL, 1, 8, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pizzat-9', 'pizzat', '10. Quattro', '10. Quattro', 'Ham, mushroom, shrimp, pineapple.', 'kinkku, herkkusieni, katkarapu, ananas.', 10.9, NULL, 1, 9, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pizzat-10', 'pizzat', '11. Romeo', '11. Romeo', 'Salami, pineapple, shrimp, blue cheese.', 'salami, ananas, katkarapu, aurajuusto.', 10.9, NULL, 1, 10, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pizzat-11', 'pizzat', '12. Papa Special', '12. Papa Special', 'Salami, bell pepper, onion, olives, blue cheese.', 'salami, paprika, sipuli, oliivi, aurajuusto.', 10.9, NULL, 1, 11, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pizzat-12', 'pizzat', '13. Kebab Pizza', '13. Kebabpizza', 'Kebab meat, onion, chili, tomato, blue cheese.', 'kebabliha, sipuli, chili, tomaatti, aurajuusto.', 10.9, NULL, 1, 12, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pizzat-13', 'pizzat', '14. Kuningas Special', '14. Kuningas Special', 'Ham, salami, onion, kebab meat, garlic.', 'kinkku, salami, sipuli, kebabliha, valkosipuli.', 10.9, NULL, 1, 13, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pizzat-14', 'pizzat', '15. Dillinger', '15. Dillinger', 'Salami, ham, ground beef, onion.', 'salami, kinkku, jauheliha, sipuli.', 10.9, NULL, 1, 14, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pizzat-15', 'pizzat', '16. House Special', '16. House Special', 'Ham, salami, bacon, kebab meat.', 'kinkku, salami, pekoni, kebabliha.', 10.9, NULL, 1, 15, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pizzat-16', 'pizzat', '17. Godfather', '17. Kummisetä', 'Ham, mushroom, shrimp, asparagus, double cheese, garlic.', 'kinkku, herkkusieni, katkarapu, parsa, tuplajuusto, valkosipuli.', 10.9, NULL, 1, 16, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pizzat-17', 'pizzat', '18. House Owner''s Special', '18. Talon Special', 'Ham, salami, bacon, egg, sour cream.', 'kinkku, salami, pekoni, kananmuna, smetana.', 10.9, NULL, 1, 17, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pizzat-18', 'pizzat', '19. Sour Cream Pizza', '19. Smetanapizza', 'Kebab meat, jalapeño, feta cheese, onion, tomato, sour cream, garlic.', 'kebabliha, jalapeno, fetajuusto, sipuli, tomaatti, smetana, valkosipuli.', 10.9, NULL, 1, 18, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pizzat-19', 'pizzat', '20. Seaside Pizza', '20. Rantapizza', 'Shrimp, feta cheese, onion, blue cheese, sour cream, garlic.', 'katkarapu, fetajuusto, sipuli, aurajuusto, smetana, valkosipuli.', 10.9, NULL, 1, 19, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pizzat-20', 'pizzat', '21. Fantasia', '21. Fantasia', '4 toppings of your choice.', 'neljä (4) täytettä oman valinnan mukaan.', 10.9, NULL, 1, 20, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('uutuus-pizzat-0', 'uutuus-pizzat', 'UP1. Texas Style BBQ', 'UP1. Texas Style BBQ', 'Chicken, bacon, onion, BBQ sauce, mozzarella.', 'kana, pekoni, sipuli, BBQ-kastike, mozzarella.', 11.9, NULL, 1, 21, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('uutuus-pizzat-1', 'uutuus-pizzat', 'UP2. Chicken BBQ', 'UP2. Chicken BBQ', 'Chicken, pineapple, onion, bell pepper, BBQ sauce, mozzarella.', 'kana, ananas, sipuli, paprika, BBQ-kastike, mozzarella.', 11.9, NULL, 1, 22, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('uutuus-pizzat-2', 'uutuus-pizzat', 'UP3. Chicken Mexico', 'UP3. Chicken Mexico', 'Chicken, pineapple, jalapeño, taco sauce, mozzarella.', 'kana, ananas, jalapeno, taco-kastike, mozzarella.', 11.9, NULL, 1, 23, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('uutuus-pizzat-3', 'uutuus-pizzat', 'UP4. Sofia BBQ', 'UP4. Sofia BBQ', 'Ham, kebab meat, onion, bell pepper, BBQ sauce, mozzarella.', 'kinkku, kebabliha, sipuli, paprika, BBQ-kastike, mozzarella.', 11.9, NULL, 1, 24, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pesto-pizzat-0', 'pesto-pizzat', 'PE1. Pesto Special', 'PE1. Pesto Special', 'Salami, bacon, pesto, arugula.', 'salami, pekoni, pesto, rucola.', 11.9, NULL, 1, 25, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pesto-pizzat-1', 'pesto-pizzat', 'PE2. Hot Chicken Pesto', 'PE2. Hot Chicken Pesto', 'Chicken, feta cheese, jalapeño, cherry tomato, pesto.', 'kana, feta, jalapeno, kirsikkatomaatti, pesto.', 11.9, NULL, 1, 26, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pesto-pizzat-2', 'pesto-pizzat', 'PE3. Pesto Veggie', 'PE3. Pesto Vege', 'Feta cheese, mushroom, bell pepper, pesto, arugula.', 'feta, herkkusieni, paprika, pesto, rucola.', 11.9, NULL, 1, 27, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pesto-pizzat-3', 'pesto-pizzat', 'PE4. Pesto Deluxe', 'PE4. Pesto Deluxe', 'Shrimp, feta cheese, cherry tomato, arugula, pesto.', 'katkarapu, feta, kirsikkatomaatti, rucola, pesto.', 11.9, NULL, 1, 28, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('rucola-pizzat-0', 'rucola-pizzat', 'U1. Padrino', 'U1. Padrino', 'Ham, pineapple, blue cheese, pepperoni, arugula.', 'kinkku, ananas, aurajuusto, peperoni, rucola.', 11.9, NULL, 1, 29, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('rucola-pizzat-1', 'rucola-pizzat', 'U2. Pizza al Ragu', 'U2. Pizza al Ragu', 'Chicken, pineapple, bell pepper, feta cheese, arugula.', 'kana, ananas, paprika, fetajuusto, rucola.', 11.9, NULL, 1, 30, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('rucola-pizzat-2', 'rucola-pizzat', 'U3. Della Casa', 'U3. Della Casa', 'Mushroom, bell pepper, olives, feta cheese, arugula.', 'herkkusieni, paprika, oliivi, fetajuusto, rucola.', 11.9, NULL, 1, 31, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('rucola-pizzat-3', 'rucola-pizzat', 'U4. Cappadocia', 'U4. Cappadocia', 'Kebab meat, jalapeño, tomato, sour cream, arugula.', 'kebabliha, jalapeno, tomaatti, smetana, rucola.', 11.9, NULL, 1, 32, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('rucola-pizzat-4', 'rucola-pizzat', 'U5. Della Chef', 'U5. Della Chef', 'Kebab meat, salami, bell pepper, BBQ sauce, arugula.', 'kebabliha, salami, paprika, BBQ-kastike, rucola.', 11.9, NULL, 1, 33, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('rucola-pizzat-5', 'rucola-pizzat', 'U6. Indigo', 'U6. Indigo', 'Cherry tomato, mozzarella, feta cheese, sour cream, arugula.', 'kirsikkatomaatti, mozzarella, fetajuusto, smetana, rucola.', 11.9, NULL, 1, 34, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('vikingos-pizzat-0', 'vikingos-pizzat', 'T1. Da Mario Zone', 'T1. Da Mario Zone', 'Chicken, blue cheese, bell pepper, BBQ sauce, lettuce, garlic or salad dressing.', 'kana, aurajuusto, paprika, BBQ-kastike, salaatti, valkosipuli- tai salaattikastike.', 11.9, NULL, 0, 35, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('vikingos-pizzat-1', 'vikingos-pizzat', 'T2. Vikings Zone', 'T2. Vikings Zone', 'Blue cheese, pepperoni sausage, onion, lettuce, garlic or salad dressing.', 'aurajuusto, pepperonimakkara, sipuli, salaatti, valkosipuli- tai salaattikastike.', 11.9, NULL, 0, 36, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('vikingos-pizzat-2', 'vikingos-pizzat', 'T3. Spazio Zone', 'T3. Spazio Zone', 'Pineapple, onion, roasted chicken, taco sauce, lettuce, garlic or salad dressing.', 'ananas, sipuli, paahdettu broileri, tacokastike, salaatti, valkosipuli- tai salaattikastike.', 11.9, NULL, 0, 37, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('vikingos-pizzat-3', 'vikingos-pizzat', 'T4. Mama Zone', 'T4. Mama Zone', 'Bell pepper, onion, lettuce, light feta cheese, olives, garlic or salad dressing.', 'paprika, sipuli, salaatti, kevyt fetajuusto, oliivi, valkosipuli- tai salaattikastike.', 11.9, NULL, 0, 38, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('vikingos-pizzat-4', 'vikingos-pizzat', 'T5. Hermanni Zone', 'T5. Hermanni Zone', 'Pepperoni sausage, kebab meat, lettuce, garlic or salad dressing.', 'pepperonimakkara, kebabliha, salaatti, valkosipuli- tai salaattikastike.', 11.9, NULL, 0, 39, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('vegaanipizza-0', 'vegaanipizza', 'VP1. Vöner Pizza', 'VP1. Vönerpizza', 'Vöner, red onion, cherry tomato, chili, vegan cheese.', 'vöner, punasipuli, kirsikkatomaatti, chili, vegaanijuusto.', 11.9, 'Vegan', 0, 40, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('vegaanipizza-1', 'vegaanipizza', 'VP2. Vegan For Life', 'VP2. Vegan For Life', 'Fresh mushroom, bell pepper, capers, red onion, vegan cheese.', 'tuore herkkusieni, paprika, kapris, punasipuli, vegaanijuusto.', 11.9, 'Vegan', 0, 41, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('vegaanipizza-2', 'vegaanipizza', 'VP3. Green Pizza', 'VP3. Green Pizza', 'Cherry tomato, bell pepper, olives, red onion, fresh mushroom, vegan cheese.', 'kirsikkatomaatti, paprika, oliivi, punasipuli, tuore herkkusieni, vegaanijuusto.', 11.9, 'Vegan', 0, 42, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('vegaanipizza-3', 'vegaanipizza', 'VP4. Vöner Mexicano', 'VP4. Vöner Mexicano', 'Vöner, jalapeño, pineapple, garlic, vegan cheese.', 'vöner, jalapeno, ananas, valkosipuli, vegaanijuusto.', 11.9, 'Vegan', 0, 43, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('vegaanipizza-4', 'vegaanipizza', 'VP5. Vegan Fantasia', 'VP5. Vegan Fantasia', '4 toppings of your choice, vegan cheese.', 'neljä (4) täytettä valintasi mukaan, vegaanijuusto.', 13.9, 'Vegan', 0, 44, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('voner-0', 'voner', 'V1. Vöner in Pita Bread', 'V1. Vöner Pita', 'Vöner, lettuce & sauces in pita bread.', 'vöner, salaatti & kastikkeet pitaleivän sisällä.', 11.9, NULL, 0, 45, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('voner-1', 'voner', 'V2. Vöner with Fries', 'V2. Vöner Ranskalaisilla', 'Vöner, lettuce, fries & sauces.', 'vöner, salaatti, ranskalaiset & kastikkeet.', 11.9, NULL, 0, 46, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('voner-2', 'voner', 'V3. Vöner Iskender', 'V3. Vöner Iskender', 'Vöner over chopped bread, lettuce, garlic yogurt & sauces.', 'vöner, paloiteltua leipää, salaatti, valkosipulijogurtti & kastikkeet.', 11.9, NULL, 0, 47, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('voner-3', 'voner', 'V4. Vöner with Wedge Potatoes', 'V4. Vöner Lohkoperunoilla', 'Vöner, wedge potatoes, lettuce & sauces.', 'vöner, lohkoperunat, salaatti & kastikkeet.', 11.9, NULL, 0, 48, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('voner-4', 'voner', 'V5. Vöner with Rice', 'V5. Vöner Riisillä', 'Vöner, rice, lettuce & sauces.', 'vöner, riisi, salaatti & kastikkeet.', 11.9, NULL, 0, 49, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('voner-5', 'voner', 'V6. Vöner Wrap', 'V6. Vöner Rulla', 'Vöner rolled in bread with lettuce & sauces.', 'rullattuna leivän sisälle vöner, salaatti & kastikkeet.', 11.9, NULL, 0, 50, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('voner-6', 'voner', 'V7. Vöner with Extra Salad', 'V7. Vöner Salatilla', 'Vöner, a generous portion of lettuce & sauces.', 'vöner, runsas salaatti & kastikkeet.', 11.9, NULL, 0, 51, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('voner-7', 'voner', 'V8. Vöner with Creamy Potatoes', 'V8. Vöner Kermaperunoilla', 'Vöner, creamy potatoes, lettuce & sauces.', 'vöner, kermaperunat, salaatti & kastikkeet.', 11.9, NULL, 0, 52, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-0', 'kebabit', '1. In Bread', '1. Leivällä', 'In bread, served fresh.', 'Leivässä, tuoreena tarjoiltuna.', 11.9, NULL, 0, 53, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-1', 'kebabit', '2. With Rice', '2. Riisillä', 'With rice.', 'Riisillä.', 11.9, NULL, 0, 54, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-2', 'kebabit', '3. With Fries', '3. Ranskalaisilla', 'With fries.', 'Ranskalaisilla.', 11.9, NULL, 0, 55, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-3', 'kebabit', '4. With Wedge Potatoes', '4. Lohkoperunoilla', 'With wedge potatoes.', 'Lohkoperunoilla.', 11.9, NULL, 0, 56, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-4', 'kebabit', '5. With Creamy Potatoes', '5. Kermaperunoilla', 'With creamy potatoes.', 'Kermaperunoilla.', 11.9, NULL, 0, 57, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-5', 'kebabit', '6. With Garlic Creamy Potatoes', '6. Valkosipulikermaperunoilla', 'With garlic creamy potatoes.', 'Valkosipulikermaperunoilla.', 11.9, NULL, 0, 58, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-6', 'kebabit', '7. Wrap', '7. Riulla', 'Wrap.', 'Rullana.', 11.9, NULL, 0, 59, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-7', 'kebabit', '8. Wrap with Blue Cheese', '8. Rulla aurajuustolla', 'Wrap with blue cheese.', 'Rulla, aurajuusto.', 11.9, NULL, 0, 60, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-8', 'kebabit', '9. Spicy Wrap', '9. Tulinen Rulla', 'Wrap with jalapeño.', 'Rulla, jalapeno.', 11.9, NULL, 0, 61, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-9', 'kebabit', '10. Special Wrap', '10. Special Rulla', 'Wrap with bell pepper, onion.', 'Rulla, paprika, sipuli.', 11.9, NULL, 0, 62, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-10', 'kebabit', '11. With Salad', '11. Salaatilla', 'With salad, feta cheese, olives.', 'Salaatti, fetajuusto, oliivi.', 11.9, NULL, 0, 63, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('kebabit-11', 'kebabit', '12. Iskender', '12. Iskender', 'Chicken kebab or kebab, iskender style.', 'Kana kebab / kebab.', 11.9, NULL, 0, 64, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('burgerit-0', 'burgerit', 'H1. Hamburger', 'H1. Hampurilainen', '1x 120 g patty.', '1x 120g pihvi.', 8.3, NULL, 0, 65, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('burgerit-0-ateria', 'burgerit', 'H1. Hamburger — Meal', 'H1. Hampurilainen — Ateria', '1x 120 g patty. Includes fries and a 0.33 L drink.', '1x 120g pihvi. Sisältää ranskalaiset ja 0,33 l juoman.', 10.5, NULL, 0, 66, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('burgerit-1', 'burgerit', 'H2. Cheeseburger', 'H2. Juustohampurilainen', '1x 120 g patty, cheese.', '1x 120g pihvi, juusto.', 8.8, NULL, 0, 67, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('burgerit-1-ateria', 'burgerit', 'H2. Cheeseburger — Meal', 'H2. Juustohampurilainen — Ateria', '1x 120 g patty, cheese. Includes fries and a 0.33 L drink.', '1x 120g pihvi, juusto. Sisältää ranskalaiset ja 0,33 l juoman.', 11.7, NULL, 0, 68, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('burgerit-2', 'burgerit', 'H3. Double Burger', 'H3. Kerroshampurilainen', '2x 120 g patty, cheese.', '2x 120g pihvi, juusto.', 10.5, NULL, 0, 69, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('burgerit-2-ateria', 'burgerit', 'H3. Double Burger — Meal', 'H3. Kerroshampurilainen — Ateria', '2x 120 g patty, cheese. Includes fries and a 0.33 L drink.', '2x 120g pihvi, juusto. Sisältää ranskalaiset ja 0,33 l juoman.', 12.7, NULL, 0, 70, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('burgerit-3', 'burgerit', 'H4. Bacon Burger', 'H4. Pekoni Burger', '1x 120 g patty, bacon, cheese.', '1x 120g pihvi, pekoni, juusto.', 10.0, NULL, 0, 71, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('burgerit-3-ateria', 'burgerit', 'H4. Bacon Burger — Meal', 'H4. Pekoni Burger — Ateria', '1x 120 g patty, bacon, cheese. Includes fries and a 0.33 L drink.', '1x 120g pihvi, pekoni, juusto. Sisältää ranskalaiset ja 0,33 l juoman.', 11.9, NULL, 0, 72, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('burgerit-4', 'burgerit', 'H5. Super Burger', 'H5. Super Burger', '3x 120 g patty, bacon, cheese, egg.', '3x 120g pihvi, pekoni, juusto, kananmuna.', 14.3, NULL, 0, 73, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('burgerit-4-ateria', 'burgerit', 'H5. Super Burger — Meal', 'H5. Super Burger — Ateria', '3x 120 g patty, bacon, cheese, egg. Includes fries and a 0.33 L drink.', '3x 120g pihvi, pekoni, juusto, kananmuna. Sisältää ranskalaiset ja 0,33 l juoman.', 16.9, NULL, 0, 74, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('burgerit-5', 'burgerit', 'H6. Hot Burger', 'H6. Hot Burger', '2x 120 g patty, cheese, jalapeño, pineapple, hot sauce.', '2x 120g pihvi, juusto, jalapeno, ananas, hot sauce.', 11.9, NULL, 0, 75, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('burgerit-5-ateria', 'burgerit', 'H6. Hot Burger — Meal', 'H6. Hot Burger — Ateria', '2x 120 g patty, cheese, jalapeño, pineapple, hot sauce. Includes fries and a 0.33 L drink.', '2x 120g pihvi, juusto, jalapeno, ananas, hot sauce. Sisältää ranskalaiset ja 0,33 l juoman.', 13.9, NULL, 0, 76, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('burgerit-6', 'burgerit', 'H7. Fries Only', 'H7. Pelkät Ranskalaiset', NULL, NULL, 6.3, NULL, 0, 77, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('sides-0', 'sides', 'Mozzarella Sticks', 'Mozzarellatikut', '4 pc mozzarella sticks + dip', '4 kpl mozzarellatikkuja + dippi', 5.7, NULL, 0, 78, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('sides-1', 'sides', 'Jalapeño Poppers', 'Jalapeno poppers', '4 pc jalapeño poppers + dip', '4 kpl jalapeno-poppereita + dippi', 5.7, NULL, 0, 79, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('sides-2', 'sides', 'Onion Rings', 'Sipulirenkaat', '6 pc onion rings + dip', '6 kpl sipulirenkaita + dippi', 4.7, NULL, 0, 80, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('sides-3-3pc', 'sides', 'W4. Crispy Chicken 3 pc', 'W4. Crispy chicken 3kpl', 'Crispy chicken breast strips + dip', 'Kanan sisäfilettä + dippi', 7.4, NULL, 0, 81, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('sides-3-6pc', 'sides', 'W4. Crispy Chicken 6 pc', 'W4. Crispy chicken 6kpl', 'Crispy chicken breast strips + dip', 'Kanan sisäfilettä + dippi', 12.4, NULL, 0, 82, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('hot-wings-0', 'hot-wings', 'W1. Regular + Choice of Dip', 'W1. Normaali + valitse dippi', '10 pc wings, choice of dip', '10 kpl siipiä', 10.4, NULL, 0, 83, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('hot-wings-1', 'hot-wings', 'W2. Large Portion + Choice of Dip', 'W2. Iso Annos + valitse dippi', '16 pc wings, choice of dip', '16 kpl siipiä', 13.0, NULL, 0, 84, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('hot-wings-2', 'hot-wings', 'W3. Hot Wings Meal + Choice of Dip', 'W3. Hot Wings Ateria + valitse dippi', '7 pc wings + fries, choice of dip', '7 kpl siipiä + ranskalaiset', 11.9, NULL, 0, 85, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('falafelt-0', 'falafelt', 'F1. Falafel with Fries', 'F1. Falafel Ranskalaisilla', 'With fries.', 'Ranskalaisilla.', 10.7, NULL, 0, 86, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('falafelt-1', 'falafelt', 'F2. With Wedge Potatoes', 'F2. Lohkoperunoilla', 'With wedge potatoes.', 'Lohkoperunoilla.', 12.2, NULL, 0, 87, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('falafelt-2', 'falafelt', 'F3. With Creamy Potatoes', 'F3. Kermaperunoilla', 'With creamy potatoes.', 'Kermaperunoilla.', 10.9, NULL, 0, 88, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('falafelt-3', 'falafelt', 'F4. With Garlic Potatoes', 'F4. Valkosipuliperunoilla', 'With garlic potatoes.', 'Valkosipuliperunoilla.', 10.9, NULL, 0, 89, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('falafelt-4', 'falafelt', 'F5. With Waffle-Cut Potatoes', 'F5. Ristikkoperunoilla', 'With waffle-cut potatoes.', 'Ristikkoperunoilla.', 11.9, NULL, 0, 90, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('falafelt-5', 'falafelt', 'F6. With Rice', 'F6. Riisillä', 'With rice.', 'Riisillä.', 10.3, NULL, 0, 91, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('falafelt-6', 'falafelt', 'F7. With Pita Bread', 'F7. Pitaleivällä', 'With pita bread.', 'Pitaleivällä.', 9.8, NULL, 0, 92, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('falafelt-7', 'falafelt', 'F8. Special Falafel', 'F8. Special Falafel', 'Special style.', 'Special.', 11.2, NULL, 0, 93, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('falafelt-8', 'falafelt', 'F9. Falafel Wrap', 'F9. Falafel Rulla', 'As a wrap.', 'Rullana.', 10.4, NULL, 0, 94, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pihvit-0', 'pihvit', 'P1. Herb Butter Steak', 'P1. Lehtipihvi', 'Beef sirloin steak, herb butter.', 'Naudan ulkofileepihvi, maustevoi.', 13.9, NULL, 0, 95, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pihvit-1', 'pihvit', 'P2. Pepper Steak', 'P2. Pippuripihvi', 'Beef sirloin steak, pepper sauce.', 'Naudan ulkofileepihvi, pippurikastike.', 13.9, NULL, 0, 96, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pihvit-2', 'pihvit', 'P3. Onion Steak', 'P3. Sipulipihvi', 'Beef sirloin steak, fried onion.', 'Naudan ulkofileepihvi, paistettu sipuli.', 13.9, NULL, 0, 97, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('pihvit-3', 'pihvit', 'P4. Grill Steak', 'P4. Grillipihvi', 'Beef sirloin steak, grilled tomato.', 'Naudan ulkofileepihvi, paistettu tomaatti.', 13.9, NULL, 0, 98, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('salaatit-0', 'salaatit', 'S1. Greek Salad', 'S1. Kreikkalainen salaatti', 'Feta cheese, onion, olives, lemon.', 'fetajuusto, sipuli, oliivi, sitruuna.', 11.9, NULL, 0, 99, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('salaatit-1', 'salaatit', 'S2. Tuna Salad', 'S2. Tonnikalasalaatti', 'Tuna, shrimp, lemon.', 'tonnikala, katkarapu, sitruuna.', 11.9, NULL, 0, 100, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('salaatit-2', 'salaatit', 'S3. Chicken Salad', 'S3. Kanasalaatti', 'Chicken, feta cheese, onion, lemon.', 'kana, fetajuusto, sipuli, sitruuna.', 11.9, NULL, 0, 101, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('salaatit-3', 'salaatit', 'S4. Ham Salad', 'S4. Kinkkusalaatti', 'Ham, pineapple, onion, lemon.', 'kinkku, ananas, sipuli, sitruuna.', 11.9, NULL, 0, 102, 1);
INSERT INTO products (id, category_id, name, name_fi, description, description_fi, price, tag, has_toppings, sort_order, active) VALUES ('salaatit-4', 'salaatit', 'S5. Build-Your-Own Salad', 'S5. Salaatti 4:llä täytteellä', '4 toppings of your choice.', 'neljä täytettä oman valinnan mukaan.', 11.9, NULL, 0, 103, 1);

-- Size option groups + options (per-product)
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pizzat-0', 'Size', 'size', 0, 'pizzat-0');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pizzat-1', 'Size', 'size', 0, 'pizzat-1');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pizzat-2', 'Size', 'size', 0, 'pizzat-2');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pizzat-3', 'Size', 'size', 0, 'pizzat-3');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pizzat-4', 'Size', 'size', 0, 'pizzat-4');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pizzat-5', 'Size', 'size', 0, 'pizzat-5');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pizzat-6', 'Size', 'size', 0, 'pizzat-6');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pizzat-7', 'Size', 'size', 0, 'pizzat-7');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pizzat-8', 'Size', 'size', 0, 'pizzat-8');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pizzat-9', 'Size', 'size', 0, 'pizzat-9');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pizzat-10', 'Size', 'size', 0, 'pizzat-10');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pizzat-11', 'Size', 'size', 0, 'pizzat-11');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pizzat-12', 'Size', 'size', 0, 'pizzat-12');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pizzat-13', 'Size', 'size', 0, 'pizzat-13');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pizzat-14', 'Size', 'size', 0, 'pizzat-14');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pizzat-15', 'Size', 'size', 0, 'pizzat-15');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pizzat-16', 'Size', 'size', 0, 'pizzat-16');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pizzat-17', 'Size', 'size', 0, 'pizzat-17');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pizzat-18', 'Size', 'size', 0, 'pizzat-18');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pizzat-19', 'Size', 'size', 0, 'pizzat-19');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pizzat-20', 'Size', 'size', 0, 'pizzat-20');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-uutuus-pizzat-0', 'Size', 'size', 0, 'uutuus-pizzat-0');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-uutuus-pizzat-1', 'Size', 'size', 0, 'uutuus-pizzat-1');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-uutuus-pizzat-2', 'Size', 'size', 0, 'uutuus-pizzat-2');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-uutuus-pizzat-3', 'Size', 'size', 0, 'uutuus-pizzat-3');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pesto-pizzat-0', 'Size', 'size', 0, 'pesto-pizzat-0');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pesto-pizzat-1', 'Size', 'size', 0, 'pesto-pizzat-1');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pesto-pizzat-2', 'Size', 'size', 0, 'pesto-pizzat-2');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-pesto-pizzat-3', 'Size', 'size', 0, 'pesto-pizzat-3');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-rucola-pizzat-0', 'Size', 'size', 0, 'rucola-pizzat-0');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-rucola-pizzat-1', 'Size', 'size', 0, 'rucola-pizzat-1');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-rucola-pizzat-2', 'Size', 'size', 0, 'rucola-pizzat-2');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-rucola-pizzat-3', 'Size', 'size', 0, 'rucola-pizzat-3');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-rucola-pizzat-4', 'Size', 'size', 0, 'rucola-pizzat-4');
INSERT INTO option_groups (id, title, kind, sort_order, product_id) VALUES ('size-rucola-pizzat-5', 'Size', 'size', 0, 'rucola-pizzat-5');
INSERT INTO option_groups (id, title, title_fi, kind, sort_order) VALUES ('toppings', 'Extra toppings', 'Lisätäytteet', 'topping', 0);
INSERT INTO option_groups (id, title, title_fi, kind, sort_order) VALUES ('base', 'Crust', 'Pohja', 'base', 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-0-pannu', 'size-pizzat-0', 'Pannu', 'Pannu', 5.6, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-0-perhe', 'size-pizzat-0', 'Perhe', 'Perhe', 9.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-1-pannu', 'size-pizzat-1', 'Pannu', 'Pannu', 5.6, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-1-perhe', 'size-pizzat-1', 'Perhe', 'Perhe', 9.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-2-pannu', 'size-pizzat-2', 'Pannu', 'Pannu', 5.6, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-2-perhe', 'size-pizzat-2', 'Perhe', 'Perhe', 9.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-3-pannu', 'size-pizzat-3', 'Pannu', 'Pannu', 5.6, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-3-perhe', 'size-pizzat-3', 'Perhe', 'Perhe', 9.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-4-pannu', 'size-pizzat-4', 'Pannu', 'Pannu', 5.6, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-4-perhe', 'size-pizzat-4', 'Perhe', 'Perhe', 9.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-5-pannu', 'size-pizzat-5', 'Pannu', 'Pannu', 5.6, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-5-perhe', 'size-pizzat-5', 'Perhe', 'Perhe', 9.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-6-pannu', 'size-pizzat-6', 'Pannu', 'Pannu', 5.6, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-6-perhe', 'size-pizzat-6', 'Perhe', 'Perhe', 9.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-7-pannu', 'size-pizzat-7', 'Pannu', 'Pannu', 5.6, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-7-perhe', 'size-pizzat-7', 'Perhe', 'Perhe', 9.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-8-pannu', 'size-pizzat-8', 'Pannu', 'Pannu', 5.6, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-8-perhe', 'size-pizzat-8', 'Perhe', 'Perhe', 9.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-9-pannu', 'size-pizzat-9', 'Pannu', 'Pannu', 5.6, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-9-perhe', 'size-pizzat-9', 'Perhe', 'Perhe', 9.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-10-pannu', 'size-pizzat-10', 'Pannu', 'Pannu', 5.6, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-10-perhe', 'size-pizzat-10', 'Perhe', 'Perhe', 9.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-11-pannu', 'size-pizzat-11', 'Pannu', 'Pannu', 5.6, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-11-perhe', 'size-pizzat-11', 'Perhe', 'Perhe', 9.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-12-pannu', 'size-pizzat-12', 'Pannu', 'Pannu', 5.6, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-12-perhe', 'size-pizzat-12', 'Perhe', 'Perhe', 9.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-13-pannu', 'size-pizzat-13', 'Pannu', 'Pannu', 5.6, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-13-perhe', 'size-pizzat-13', 'Perhe', 'Perhe', 9.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-14-pannu', 'size-pizzat-14', 'Pannu', 'Pannu', 5.6, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-14-perhe', 'size-pizzat-14', 'Perhe', 'Perhe', 9.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-15-pannu', 'size-pizzat-15', 'Pannu', 'Pannu', 5.6, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-15-perhe', 'size-pizzat-15', 'Perhe', 'Perhe', 9.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-16-pannu', 'size-pizzat-16', 'Pannu', 'Pannu', 5.6, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-16-perhe', 'size-pizzat-16', 'Perhe', 'Perhe', 9.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-17-pannu', 'size-pizzat-17', 'Pannu', 'Pannu', 5.6, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-17-perhe', 'size-pizzat-17', 'Perhe', 'Perhe', 9.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-18-pannu', 'size-pizzat-18', 'Pannu', 'Pannu', 5.6, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-18-perhe', 'size-pizzat-18', 'Perhe', 'Perhe', 9.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-19-pannu', 'size-pizzat-19', 'Pannu', 'Pannu', 5.6, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-19-perhe', 'size-pizzat-19', 'Perhe', 'Perhe', 9.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-20-pannu', 'size-pizzat-20', 'Pannu', 'Pannu', 5.6, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pizzat-20-perhe', 'size-pizzat-20', 'Perhe', 'Perhe', 9.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('uutuus-pizzat-0-pannu', 'size-uutuus-pizzat-0', 'Pannu', 'Pannu', 8.0, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('uutuus-pizzat-0-perhe', 'size-uutuus-pizzat-0', 'Perhe', 'Perhe', 10.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('uutuus-pizzat-1-pannu', 'size-uutuus-pizzat-1', 'Pannu', 'Pannu', 8.0, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('uutuus-pizzat-1-perhe', 'size-uutuus-pizzat-1', 'Perhe', 'Perhe', 10.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('uutuus-pizzat-2-pannu', 'size-uutuus-pizzat-2', 'Pannu', 'Pannu', 8.0, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('uutuus-pizzat-2-perhe', 'size-uutuus-pizzat-2', 'Perhe', 'Perhe', 10.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('uutuus-pizzat-3-pannu', 'size-uutuus-pizzat-3', 'Pannu', 'Pannu', 8.0, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('uutuus-pizzat-3-perhe', 'size-uutuus-pizzat-3', 'Perhe', 'Perhe', 10.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pesto-pizzat-0-perhe', 'size-pesto-pizzat-0', 'Perhe', 'Perhe', 10.0, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pesto-pizzat-1-perhe', 'size-pesto-pizzat-1', 'Perhe', 'Perhe', 10.0, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pesto-pizzat-2-perhe', 'size-pesto-pizzat-2', 'Perhe', 'Perhe', 10.0, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('pesto-pizzat-3-perhe', 'size-pesto-pizzat-3', 'Perhe', 'Perhe', 10.0, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('rucola-pizzat-0-perhe', 'size-rucola-pizzat-0', 'Perhe', 'Perhe', 10.0, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('rucola-pizzat-1-perhe', 'size-rucola-pizzat-1', 'Perhe', 'Perhe', 10.0, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('rucola-pizzat-2-perhe', 'size-rucola-pizzat-2', 'Perhe', 'Perhe', 10.0, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('rucola-pizzat-3-perhe', 'size-rucola-pizzat-3', 'Perhe', 'Perhe', 10.0, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('rucola-pizzat-4-perhe', 'size-rucola-pizzat-4', 'Perhe', 'Perhe', 10.0, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('rucola-pizzat-5-perhe', 'size-rucola-pizzat-5', 'Perhe', 'Perhe', 10.0, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-ham', 'toppings', 'Ham', 'kinkku', 2.0, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-salami', 'toppings', 'Salami', 'salami', 2.0, 1);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-pineapple', 'toppings', 'Pineapple', 'ananas', 2.0, 2);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-onion', 'toppings', 'Onion', 'sipuli', 2.0, 3);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-olives', 'toppings', 'Olives', 'oliivi', 2.0, 4);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-blue-cheese', 'toppings', 'Blue cheese', 'aurajuusto', 2.0, 5);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-bbq-sauce', 'toppings', 'BBQ sauce', 'BBQ-kastike', 2.0, 6);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-chili', 'toppings', 'Chili', 'chili', 2.0, 7);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-feta-cheese', 'toppings', 'Feta cheese', 'fetajuusto', 2.0, 8);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-jalapeo', 'toppings', 'Jalapeño', 'jalapeno', 2.0, 9);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-ground-beef', 'toppings', 'Ground beef', 'jauheliha', 2.0, 10);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-mushroom', 'toppings', 'Mushroom', 'herkkusieni', 2.0, 11);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-chicken', 'toppings', 'Chicken', 'kana', 2.0, 12);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-shrimp', 'toppings', 'Shrimp', 'katkarapu', 2.0, 13);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-egg', 'toppings', 'Egg', 'kananmuna', 2.0, 14);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-capers', 'toppings', 'Capers', 'kapris', 2.0, 15);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-kebab-meat', 'toppings', 'Kebab meat', 'kebab', 2.0, 16);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-bell-pepper', 'toppings', 'Bell pepper', 'paprika', 2.0, 17);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-asparagus', 'toppings', 'Asparagus', 'parsa', 2.0, 18);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-bacon', 'toppings', 'Bacon', 'pekoni', 2.0, 19);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-sour-cream', 'toppings', 'Sour cream', 'smetana', 2.0, 20);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-tomato', 'toppings', 'Tomato', 'tomaatti', 2.0, 21);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-pepperoni-sausage', 'toppings', 'Pepperoni sausage', 'pepperonimakkara', 2.0, 22);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-mussels', 'toppings', 'Mussels', 'simpukka', 2.0, 23);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-tuna', 'toppings', 'Tuna', 'tonnikala', 2.0, 24);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-arugula', 'toppings', 'Arugula', 'rucola', 2.0, 25);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-mozzarella', 'toppings', 'Mozzarella', 'mozzarella', 2.0, 26);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-double-cheese', 'toppings', 'Double cheese', 'tuplajuusto', 2.0, 27);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-garlic', 'toppings', 'Garlic', 'valkosipuli', 2.0, 28);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('toppings-taco-sauce', 'toppings', 'Taco sauce', 'taco-kastike', 2.0, 29);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('base-classic', 'base', 'Classic crust', 'Normaali pohja', 0.0, 0);
INSERT INTO options (id, group_id, label, label_fi, price_delta, sort_order) VALUES ('base-gluten-free', 'base', 'Gluten-free crust', 'Gluteeniton pohja', 4.0, 1);

-- Addons (dips + drinks)
INSERT INTO addons (id, type, name, name_fi, price, active, sort_order) VALUES ('dip-regular-mayonnaise', 'dip', 'Regular mayonnaise', 'Norm. majoneesi', 2.0, 1, 0);
INSERT INTO addons (id, type, name, name_fi, price, active, sort_order) VALUES ('dip-garlic-mayonnaise', 'dip', 'Garlic mayonnaise', 'Valkosipulimajoneesi', 2.0, 1, 1);
INSERT INTO addons (id, type, name, name_fi, price, active, sort_order) VALUES ('dip-paprika-mayonnaise', 'dip', 'Paprika mayonnaise', 'Paprikamajoneesi', 2.0, 1, 2);
INSERT INTO addons (id, type, name, name_fi, price, active, sort_order) VALUES ('dip-curry-mayonnaise', 'dip', 'Curry mayonnaise', 'Currymajoneesi', 2.0, 1, 3);
INSERT INTO addons (id, type, name, name_fi, price, active, sort_order) VALUES ('dip-chili-mayonnaise', 'dip', 'Chili mayonnaise', 'Chilimajoneesi', 2.0, 1, 4);
INSERT INTO addons (id, type, name, name_fi, price, active, sort_order) VALUES ('dip-blue-cheese-mayonnaise', 'dip', 'Blue cheese mayonnaise', 'Blue cheese majoneesi', 2.0, 1, 5);
INSERT INTO addons (id, type, name, name_fi, price, active, sort_order) VALUES ('dip-sour-cream-mayonnaise', 'dip', 'Sour cream mayonnaise', 'Sour cream majoneesi', 2.0, 1, 6);
INSERT INTO addons (id, type, name, name_fi, price, active, sort_order) VALUES ('drink-033-l', 'drink', '0.33 L', '0,33 L', 3.5, 1, 0);
INSERT INTO addons (id, type, name, name_fi, price, active, sort_order) VALUES ('drink-15-l', 'drink', '1.5 L', '1,5 L', 5.9, 1, 1);
INSERT INTO addons (id, type, name, name_fi, price, active, sort_order) VALUES ('drink-1-l-milk', 'drink', '1 L Milk', '1 L Maito', 3.7, 1, 2);

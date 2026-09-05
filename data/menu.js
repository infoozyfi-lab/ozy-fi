// All menu data for ozy.fi — pizzas, kebabs, burgers, salads and schnitzels.
// Each category carries a `image` field used as the demo product photo
// for every item inside it (served via a hotlink image API, see README).

const img = (q, w = 900, h = 700) =>
  `https://www.sourcesplash.com/i/random?q=${encodeURIComponent(q)}&w=${w}&h=${h}`;

export const CATEGORIES = [
  { id: 'pizzat', title: 'Pizzas', sub: "Classic tomato base · price varies with toppings", image: img('pepperoni pizza') },
  { id: 'bbq', title: 'BBQ Pizza', sub: 'Smoky BBQ sauce', image: img('bbq chicken pizza') },
  { id: 'pesto', title: 'Pesto Pizza', sub: 'Fresh basil pesto', image: img('pesto pizza basil') },
  { id: 'rucola', title: 'Arugula Pizza', sub: 'Topped with fresh arugula', image: img('arugula pizza') },
  { id: 'vikings', title: 'Vikings Pizza', sub: 'With garlic or salad dressing', image: img('pizza garlic') },
  { id: 'vegaani', title: 'Vegan Pizzas', sub: '100% plant-based cheese', image: img('vegan pizza vegetables') },
  { id: 'voner', title: 'Vöner', sub: 'Options: rice, fries, wedges, creamy-, garlic- or blue-cheese potatoes', image: img('doner kebab wrap') },
  { id: 'leikkeet', title: 'Schnitzels', sub: 'Options: rice, fries, wedges, creamy-, garlic- or blue-cheese potatoes', image: img('schnitzel plate') },
  { id: 'broileri', title: 'Chicken', sub: 'Chicken fillet · double meat +4.00 € · includes chili, pickle, tomato, lettuce, salad dressing, curry sauce', image: img('grilled chicken wrap') },
  { id: 'kebab', title: 'Kebab', sub: 'Double kebab +4.00 € · includes chili, pickle, tomato, lettuce, salad dressing', image: img('kebab wrap') },
  { id: 'kanakebab', title: 'Chicken Kebab', sub: 'Double chicken kebab +4.00 € · includes chili, pickle, tomato, lettuce, salad dressing, curry sauce', image: img('chicken kebab pita') },
  { id: 'salaatit', title: 'Salads', sub: 'Cucumber, tomato and iceberg lettuce in all', image: img('greek salad bowl') },
  { id: 'burgerit', title: 'Burgers', sub: 'Lettuce, tomato, pickle and burger sauce always included. Meals include fries and a 0.33 l drink.', image: img('cheeseburger') },
];

const catImage = (id) => CATEGORIES.find((c) => c.id === id).image;

export const ITEMS = [
  // Pizzas
  { name: '1. Bolognese', price: 9.90, toppings: true, cat: 'pizzat', desc: 'Ground beef.' },
  { name: '2. Americano', price: 10.20, toppings: true, cat: 'pizzat', desc: 'Ham, pineapple, blue cheese.' },
  { name: '3. Frutti', price: 10.20, toppings: true, cat: 'pizzat', desc: 'Tuna, shrimp, mussels.' },
  { name: '4. Vegetariana', price: 10.90, toppings: true, cat: 'pizzat', tag: 'Vegetarian', desc: 'Olives, mushroom, onion, tomato, bell pepper.' },
  { name: '5. Julia', price: 10.50, toppings: true, cat: 'pizzat', desc: 'Ham, pineapple, shrimp, blue cheese.' },
  { name: '6. Empire Special', price: 10.90, toppings: true, cat: 'pizzat', desc: 'Shrimp, ham, salami, onion, garlic.' },
  { name: '7. Mexicano', price: 10.20, toppings: true, cat: 'pizzat', tag: 'Spicy', desc: 'Jalapeño, onion, pepperoni.' },
  { name: '8. Opera Special', price: 10.50, toppings: true, cat: 'pizzat', desc: 'Ham, tuna, salami, onion.' },
  { name: '9. Pepperoni', price: 10.20, toppings: true, cat: 'pizzat', desc: 'Pepperoni, onion, ground beef.' },
  { name: '10. Quattro', price: 10.50, toppings: true, cat: 'pizzat', desc: 'Ham, mushroom, shrimp, pineapple.' },
  { name: '11. Romeo', price: 10.50, toppings: true, cat: 'pizzat', desc: 'Salami, pineapple, shrimp, blue cheese.' },
  { name: '12. Papa Special', price: 10.90, toppings: true, cat: 'pizzat', desc: 'Salami, bell pepper, onion, olives, blue cheese.' },
  { name: '13. Kebab Pizza', price: 10.90, toppings: true, cat: 'pizzat', desc: 'Kebab meat, onion, chili, tomato, blue cheese.' },
  { name: '14. Ozy Special', price: 10.90, toppings: true, cat: 'pizzat', tag: 'Signature', desc: 'Ham, salami, onion, kebab meat, garlic.' },
  { name: '15. Dillinger', price: 10.50, toppings: true, cat: 'pizzat', desc: 'Salami, ham, ground beef, onion.' },
  { name: '16. House Special', price: 10.50, toppings: true, cat: 'pizzat', desc: 'Ham, salami, bacon, kebab meat.' },
  { name: '17. Godfather', price: 11.20, toppings: true, cat: 'pizzat', desc: 'Ham, mushroom, shrimp, asparagus, double cheese, garlic.' },
  { name: "18. Owner's Special", price: 11.20, toppings: true, cat: 'pizzat', desc: 'Ham, salami, bacon, egg, sour cream, garlic.' },
  { name: '19. Sour Cream Pizza', price: 11.50, toppings: true, cat: 'pizzat', desc: 'Kebab meat, jalapeño, feta, onion, tomato, sour cream, garlic.' },
  { name: '20. Seaside Pizza', price: 11.20, toppings: true, cat: 'pizzat', desc: 'Shrimp, feta, onion, blue cheese, sour cream, garlic.' },
  { name: '21. Fantasia', price: 10.50, toppings: true, cat: 'pizzat', desc: 'Choose any four (4) toppings.', id: 'build-your-own-pizza' },

  // BBQ
  { name: 'B1. Texas Style BBQ', price: 10.90, toppings: true, cat: 'bbq', desc: 'Chicken, bacon, onion, BBQ sauce, mozzarella.' },
  { name: 'B2. Chicken BBQ', price: 11.20, toppings: true, cat: 'bbq', desc: 'Chicken, pineapple, onion, bell pepper, BBQ sauce, mozzarella.' },
  { name: 'B3. Fantasia', price: 10.50, toppings: true, cat: 'bbq', desc: 'Choose any four (4) toppings.' },

  // Pesto
  { name: 'PE1. Hot Chicken Pesto', price: 10.90, toppings: true, cat: 'pesto', tag: 'Spicy', desc: 'Chicken, feta, jalapeño, cherry tomato, pesto.' },
  { name: 'PE2. Pesto Veggie', price: 10.90, toppings: true, cat: 'pesto', tag: 'Vegetarian', desc: 'Feta, onion, mushroom, bell pepper, pesto.' },
  { name: 'PE3. Fantasia', price: 10.50, toppings: true, cat: 'pesto', desc: 'Choose any four (4) toppings.' },

  // Rucola
  { name: 'U1. Indigo', price: 10.90, toppings: true, cat: 'rucola', desc: 'Cherry tomato, mozzarella, feta, sour cream, arugula.' },
  { name: 'U2. Della Chef', price: 10.90, toppings: true, cat: 'rucola', desc: 'Kebab meat, salami, bell pepper, BBQ sauce, arugula.' },
  { name: 'U3. Fantasia', price: 10.50, toppings: true, cat: 'rucola', desc: 'Choose any four (4) toppings.' },

  // Vikings
  { name: 'T1. Mama Zone', price: 11.20, toppings: true, cat: 'vikings', desc: 'Bell pepper, onion, lettuce, light feta, olives, garlic or salad dressing.' },
  { name: 'T2. Ozy Zone', price: 10.50, toppings: true, cat: 'vikings', tag: 'Signature', desc: 'Pepperoni, kebab meat, lettuce, garlic or salad dressing.' },
  { name: 'T3. Fantasia', price: 10.50, toppings: true, cat: 'vikings', desc: 'Choose any four (4) toppings.' },

  // Vegan
  { name: 'VP1. Vöner Pizza', price: 10.90, toppings: true, cat: 'vegaani', tag: 'Vegan', desc: 'Vöner, red onion, cherry tomato, chili, vegan cheese.' },
  { name: 'VP2. Vegan For Life', price: 10.90, toppings: true, cat: 'vegaani', tag: 'Vegan', desc: 'Fresh mushroom, bell pepper, capers, red onion, vegan cheese.' },
  { name: 'VP3. Green Pizza', price: 11.20, toppings: true, cat: 'vegaani', tag: 'Vegan', desc: 'Cherry tomato, bell pepper, olives, red onion, mushroom, vegan cheese.' },
  { name: 'VP4. Vöner Mexicano', price: 10.90, toppings: true, cat: 'vegaani', tag: 'Vegan', desc: 'Vöner, jalapeño, pineapple, garlic, vegan cheese.' },
  { name: 'VP5. Vegan Fantasia', price: 10.90, toppings: true, cat: 'vegaani', tag: 'Vegan', desc: 'Choose four (4) toppings + vegan cheese.' },

  // Vöner
  { name: 'V1. Vöner in Bread', price: 8.90, toppings: false, cat: 'voner', desc: 'Vöner, lettuce & sauces in pita bread.' },
  { name: 'V3. Vöner Iskender', price: 9.90, toppings: false, cat: 'voner', desc: 'Vöner over chopped bread, lettuce, garlic mayo & sauces.' },
  { name: 'V6. Vöner Wrap', price: 8.90, toppings: false, cat: 'voner', desc: 'Vöner rolled in bread with lettuce & sauces.' },

  // Schnitzels
  { name: 'L1. Onion Schnitzel', price: 13.90, toppings: false, cat: 'leikkeet', desc: 'Fried onion, fried tomato, lettuce, choice of potatoes.' },
  { name: 'L2. Hawaiian Schnitzel', price: 13.90, toppings: false, cat: 'leikkeet', desc: 'Fried pineapple, fried tomato, lettuce, choice of potatoes.' },
  { name: 'L4. Wiener Schnitzel', price: 13.90, toppings: false, cat: 'leikkeet', desc: 'Anchovy, lemon, fried tomato, lettuce, choice of potatoes.' },
  { name: 'L5. Swiss Schnitzel', price: 14.90, toppings: false, cat: 'leikkeet', desc: 'Ham, cheese, lettuce, fried tomato, choice of potatoes.' },
  { name: "L6. Hunter's Schnitzel", price: 14.90, toppings: false, cat: 'leikkeet', desc: 'Mushroom sauce, lettuce, fried tomato, choice of potatoes.' },

  // Chicken
  { name: '1. In Bread', price: 8.90, toppings: false, cat: 'broileri', desc: 'In pita bread, served fresh.' },
  { name: '2. Wrap', price: 8.90, toppings: false, cat: 'broileri', desc: 'Rolled in flatbread.' },
  { name: '3. Iskender', price: 9.90, toppings: false, cat: 'broileri', desc: 'Over chopped bread, with garlic mayo.' },

  // Kebab
  { name: '1. In Bread', price: 7.90, toppings: false, cat: 'kebab', desc: 'In pita bread, served fresh.' },
  { name: '2. Wrap', price: 7.90, toppings: false, cat: 'kebab', desc: 'Rolled in flatbread.' },
  { name: '3. Iskender', price: 8.90, toppings: false, cat: 'kebab', desc: 'Over chopped bread, with garlic mayo.' },

  // Chicken Kebab
  { name: '1. In Bread', price: 8.90, toppings: false, cat: 'kanakebab', desc: 'In pita bread, served fresh.' },
  { name: '2. Wrap', price: 8.90, toppings: false, cat: 'kanakebab', desc: 'Rolled in flatbread.' },
  { name: '3. Iskender', price: 9.90, toppings: false, cat: 'kanakebab', desc: 'Over chopped bread, with garlic mayo.' },

  // Salads
  { name: 'S1. Greek Salad', price: 7.90, toppings: false, cat: 'salaatit', desc: 'Feta, onion, olives, lemon.' },
  { name: 'S2. Tuna Salad', price: 8.90, toppings: false, cat: 'salaatit', desc: 'Tuna, shrimp, lemon.' },
  { name: 'S3. Chicken Salad', price: 8.90, toppings: false, cat: 'salaatit', desc: 'Chicken, pineapple, feta, onion, lemon.' },
  { name: 'S4. Ham Salad', price: 8.90, toppings: false, cat: 'salaatit', desc: 'Ham, pineapple, blue cheese, lemon.' },
  { name: 'S5. Build-Your-Own Salad', price: 9.90, toppings: false, cat: 'salaatit', desc: 'Choose four toppings.' },

  // Burgers
  { name: 'H1. Burger', price: 6.90, toppings: false, cat: 'burgerit', desc: '1 × 120 g patty.' },
  { name: 'H2. Cheeseburger', price: 7.90, toppings: false, cat: 'burgerit', desc: '1 × 120 g patty, cheese.' },
  { name: 'H3. Double Burger', price: 10.90, toppings: false, cat: 'burgerit', desc: '2 × 120 g patty, cheese.' },
  { name: 'H4. Bacon Burger', price: 10.90, toppings: false, cat: 'burgerit', desc: '1 × 120 g patty, bacon, cheese.' },
  { name: 'H5. Super Burger', price: 14.90, toppings: false, cat: 'burgerit', tag: 'Big appetite', desc: '3 × 120 g patty, bacon, cheese, egg.' },
  { name: 'H6. Hot Burger', price: 12.90, toppings: false, cat: 'burgerit', tag: 'Spicy', desc: '2 × 120 g patty, cheese, jalapeño, pineapple, hot sauce.' },
  { name: 'H7. Fries Only', price: 3.90, toppings: false, cat: 'burgerit', desc: 'Classic French fries.' },
].map((it, i) => ({
  id: it.id || `${it.cat}-${i}`,
  image: catImage(it.cat),
  ...it,
}));

export const TOPPING_PRICE = 1.5;
export const SIZE_LARGE_UPCHARGE = 3.5;
export const TOPPINGS = ['Extra cheese', 'Pepperoni', 'Mushroom', 'Onion', 'Bacon', 'Jalapeño', 'Olives', 'Pineapple', 'Ham', 'Garlic'];
export const BASE_OPTIONS = [
  { id: 'classic', label: 'Classic pizza base', delta: 0 },
  { id: 'thin', label: 'Thin crispy base', delta: 0 },
  { id: 'gf', label: 'Gluten-free base', delta: 2.0 },
];
export const SAUCE_OPTIONS = [
  { id: 'tomato', label: 'Tomato sauce', delta: 0 },
  { id: 'bbq', label: 'BBQ sauce', delta: 0 },
  { id: 'garlic', label: 'Garlic cream sauce', delta: 0.5 },
];
export const CHEESE_OPTIONS = [
  { id: 'normal', label: 'Normal cheese', delta: 0 },
  { id: 'double', label: 'Double cheese', delta: 1.5 },
];

// Extra "More fillings" catalogue — grouped like Kotipizza's builder.
// Each item can be added multiple times (qty stepper) at its own price.
export const FILLING_CATEGORIES = [
  {
    id: 'meats',
    title: 'Meats',
    icon: '🥓',
    items: [
      { id: 'f-pepperoni', label: 'Pepperoni', price: 1.50 },
      { id: 'f-ham', label: 'Ham', price: 1.50 },
      { id: 'f-bacon', label: 'Bacon', price: 1.50 },
      { id: 'f-kebab', label: 'Kebab meat', price: 2.00 },
      { id: 'f-chicken', label: 'Chicken', price: 2.00 },
      { id: 'f-meatball', label: 'Meatballs', price: 1.80 },
      { id: 'f-salami', label: 'Salami', price: 1.50 },
    ],
  },
  {
    id: 'vegetables',
    title: 'Vegetables',
    icon: '🍍',
    items: [
      { id: 'f-onion', label: 'Onion', price: 0.70 },
      { id: 'f-red-onion', label: 'Red onion (after the oven)', price: 0.70 },
      { id: 'f-mushroom', label: 'Mushroom', price: 0.90 },
      { id: 'f-bell-pepper', label: 'Bell pepper', price: 0.90 },
      { id: 'f-olives', label: 'Olives', price: 0.90 },
      { id: 'f-pineapple', label: 'Pineapple', price: 0.90 },
      { id: 'f-jalapeno', label: 'Jalapeño', price: 0.90 },
      { id: 'f-red-chili', label: 'Red chili (after the oven)', price: 0.90 },
      { id: 'f-cherry-tomato', label: 'Cherry tomato', price: 1.00 },
      { id: 'f-arugula', label: 'Arugula', price: 1.00 },
    ],
  },
  {
    id: 'cheese',
    title: 'Cheese',
    icon: '🧀',
    items: [
      { id: 'f-mozzarella', label: 'Extra mozzarella', price: 1.50 },
      { id: 'f-blue-cheese', label: 'Blue cheese', price: 1.50 },
      { id: 'f-feta', label: 'Feta', price: 1.50 },
      { id: 'f-aura', label: 'Aura® cheese', price: 1.00 },
      { id: 'f-vegan-cheese', label: 'Vegan cheese', price: 1.80 },
    ],
  },
  {
    id: 'marine',
    title: 'Marine',
    icon: '🐟',
    badge: 'MSC',
    items: [
      { id: 'f-tuna', label: 'Tuna', price: 1.90 },
      { id: 'f-shrimp', label: 'Shrimp', price: 2.20 },
      { id: 'f-mussels', label: 'Mussels', price: 2.00 },
      { id: 'f-anchovy', label: 'Anchovy', price: 1.90 },
    ],
  },
  {
    id: 'spices',
    title: 'Spices',
    icon: '🧄',
    items: [
      { id: 'f-garlic', label: 'Garlic', price: 0.50 },
      { id: 'f-chili-flakes', label: 'Chili flakes', price: 0.30 },
      { id: 'f-oregano', label: 'Oregano', price: 0.30 },
      { id: 'f-black-pepper', label: 'Black pepper', price: 0.30 },
    ],
  },
];

export const ALL_FILLINGS = FILLING_CATEGORIES.flatMap((c) => c.items);

export const SAUCE_STRIPE_OPTIONS = [
  { id: 'none', label: 'No sauce stripes', delta: 0, color: 'transparent' },
  { id: 'bbq-stripe', label: 'Barbeque sauce', delta: 0, color: '#5b2312' },
  { id: 'garlic-stripe', label: 'Garlic sauce', delta: 0, color: '#efe6c8' },
  { id: 'sriracha-stripe', label: 'Sriracha', delta: 0.50, color: '#c0392b' },
  { id: 'ranch-stripe', label: 'Ranch', delta: 0.50, color: '#f2edd8' },
];

export const DIP_OPTIONS = [
  { id: 'none', label: 'No dip', delta: 0 },
  { id: 'garlic-dip', label: 'Garlic dip', delta: 1.00 },
  { id: 'bbq-dip', label: 'BBQ dip', delta: 1.00 },
  { id: 'blue-cheese-dip', label: 'Blue cheese dip', delta: 1.20 },
  { id: 'sweet-chili-dip', label: 'Sweet chili dip', delta: 1.00 },
];

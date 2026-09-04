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
  { name: 'T1. Mama Zone', price: 11.

// ── Canonical menu data — single source of truth ──────────────────
// Imported by both the storefront (RaniMahal.jsx) and the backend
// (create-checkout.js, api/images/list.js, lib/orders.js) so prices,
// item ids and the tax rate can never drift between client and server.

export const TAX_RATE = 0.08375;

// spiceProfile:
//   "adjustable" — full Mild/Medium/Spicy selector (sauce curries and tandoori-cooked dishes alike)
//   "mild"       — Korma-style (incl. Malai/cream sauces) — always mild, fixed
//   "hot"        — Vindaloo-style (incl. Phaal) — always spicy, fixed
//   "none"       — no spice concept (bread, rice, drinks, sides, soup, salad)
export const MENU_ITEMS = [
  // Appetizers
  { id:"item-samosa",        name:"Samosa",                   price:7.75,  desc:"Triangular pastry stuffed with potatoes, green peas and spices",                                             badge:null,              spiceProfile:"none" },
  { id:"item-pakora",        name:"Pakora",                   price:6.50,  desc:"Vegetable fritters with onion, potato, spinach and cauliflower",                                             badge:null,              spiceProfile:"none" },
  { id:"item-mixed-app",     name:"Mixed Appetizers",         price:9.95,  desc:"Assorted samosa, mixed pakoras and papad",                                                                   badge:null,              spiceProfile:"none" },
  { id:"item-papad",         name:"Papad",                    price:3.95,  desc:"Thin lentil wafer with cracked black pepper",                                                                badge:null,              spiceProfile:"none" },
  { id:"item-masala-dosa",   name:"Masala Dosa",              price:10.95, desc:"Thin rice crepe filled with spiced potato and peas, served with coconut chutney and sambar",                badge:"bestseller",      spiceProfile:"none" },
  { id:"item-gobi-manchurian",name:"Gobi Manchurian",         price:10.95, desc:"Cauliflower florets tossed in garlic-tomato sauce with medium spices",                                      badge:"chef",            spiceProfile:"adjustable" },
  { id:"item-ragada",        name:"Ragada Patties",           price:9.95,  desc:"Spiced potato patties layered with chickpeas and herbs",                                                     badge:null,              spiceProfile:"none" },
  { id:"item-meat-samosa",   name:"Meat Samosa",              price:7.95,  desc:"Triangular pastry stuffed with ground lamb and fresh house seasoning",                                       badge:null,              spiceProfile:"none" },
  { id:"item-seek-kabab",    name:"Seek Kabab",               price:11.95, desc:"Kashmiri-style minced lamb with aromatic herbs and spices, roasted in tandoor",                              badge:"chef",            spiceProfile:"adjustable" },
  { id:"item-chicken-malai", name:"Chicken Malai Kabab",      price:10.95, desc:"Chunks of chicken marinated in ginger, garlic, white pepper and yogurt",                                    badge:"chef",            spiceProfile:"adjustable" },
  { id:"item-shrimp-bagari", name:"Shrimp Bagari",            price:13.95, desc:"Shrimp tempered with mustard seeds, curry leaves, in tomato sauce with caramelized onions",                 badge:null,              spiceProfile:"adjustable" },
  { id:"item-rani-offering", name:"Rani Ki Offering",         price:13.95, desc:"Chicken kabab, seek kabab, chicken tikka, shrimp tikka, papad and chicken wings",                           badge:"chef",            spiceProfile:"adjustable" },
  { id:"item-keema-dosa",    name:"Keema Dosa",               price:12.95, desc:"Thin rice crepe filled with ground lamb, served with fresh house coconut chutney and sambar",               badge:"bestseller",      spiceProfile:"none" },
  // Soups & Salads
  { id:"item-mulligatawny",  name:"Mulligatawny Soup",        price:5.95,  desc:"Traditional soup made with lentils, vegetables, herbs and ground spices",                                   badge:null,              spiceProfile:"none" },
  { id:"item-tomato-soup",   name:"Tomato Soup",              price:5.95,  desc:"Cream of fresh tomatoes, garnished with roasted bread croutons and fresh ground spices",                    badge:null,              spiceProfile:"none" },
  { id:"item-chicken-soup",  name:"Chicken Soup",             price:5.95,  desc:"Flavored with onion, ginger, garlic and garnished with coriander leaves",                                   badge:null,              spiceProfile:"none" },
  { id:"item-salad",         name:"Chef's Special Salad",     price:7.95,  desc:"Tomato, cucumber, green pepper, onion and carrot with homemade dressing",                                   badge:null,              spiceProfile:"none" },
  // Chicken
  { id:"item-ctm",           name:"Chicken Tikka Masala",     price:19.95, desc:"Boneless white meat simmered in tomato cream sauce with garlic, ginger and bell pepper",                    badge:"bestseller",      spiceProfile:"adjustable" },
  { id:"item-makhni",        name:"Chicken Makhni",           price:19.95, desc:"Tandoori chicken with chopped tomatoes, green pepper and butter — classic butter chicken",                  badge:"bestseller",      spiceProfile:"adjustable" },
  { id:"item-korma-c",       name:"Chicken Korma",            price:19.95, desc:"Skinless chicken blended with mild spices in a creamy cashew nut sauce",                                    badge:null,              spiceProfile:"mild" },
  { id:"item-sagwala",       name:"Chicken Tikka Sagwala",    price:19.95, desc:"White meat chicken with tomatoes and creamy spinach sauce",                                                  badge:null,              spiceProfile:"adjustable" },
  { id:"item-vindaloo-c",    name:"Chicken Vindaloo",         price:19.95, desc:"Chicken cooked with potatoes in a very spicy Goan sauce",                                                   badge:"spicy",           spiceProfile:"hot" },
  { id:"item-madras-c",      name:"Chicken Madras",           price:19.95, desc:"Boneless chicken in a tangy coconut stew flavored with ginger and curry leaves",                            badge:"spicy",           spiceProfile:"adjustable" },
  { id:"item-jalfreazy-c",   name:"Chicken Jalfreazy",        price:19.95, desc:"Boneless white meat cooked with onions, tomatoes and bell pepper",                                          badge:"spicy",           spiceProfile:"adjustable" },
  { id:"item-do-paiza-c",    name:"Chicken Do Paiza",         price:19.95, desc:"Boneless chicken with garlic, ginger, seasoned onions and bell pepper",                                     badge:null,              spiceProfile:"adjustable" },
  { id:"item-biriyani-c",    name:"Chicken Biriyani",         price:19.95, desc:"Aromatic long-grain basmati cooked with chicken, dry mixed fruits, nuts, blended herbs and fragrant saffron",badge:"bestseller",     spiceProfile:"adjustable" },
  { id:"item-bhuna-c",       name:"Chicken Bhuna",            price:19.95, desc:"Boneless chicken with garlic, ginger, onion, bell peppers and tomatoes in gravy",                           badge:null,              spiceProfile:"adjustable" },
  { id:"item-curry-c",       name:"Chicken Curry",            price:19.95, desc:"Skinless chicken cooked in traditional Kashmiri masala",                                                    badge:null,              spiceProfile:"adjustable" },
  // Lamb
  { id:"item-rogan",         name:"Lamb Rogan Josh",          price:26.95, desc:"Tender cubes in traditional Kashmiri masala — paprika, royal cumin, cardamom, clove and onion gravy",      badge:"bestseller",      spiceProfile:"adjustable" },
  { id:"item-sag-l",         name:"Lamb Sag",                 price:26.95, desc:"Boneless chunks of lamb in a delicately spiced spinach sauce",                                              badge:null,              spiceProfile:"adjustable" },
  { id:"item-korma-l",       name:"Lamb Korma",               price:26.95, desc:"Lamb blended with mild spices in a creamy cashew nut sauce",                                                badge:null,              spiceProfile:"mild" },
  { id:"item-do-paiza-l",    name:"Lamb Do Paiza",            price:26.95, desc:"Lamb with fresh chopped onions, garlic, ginger, coriander and medium spices",                               badge:null,              spiceProfile:"adjustable" },
  { id:"item-kadai",         name:"Kadai Lamb",               price:26.95, desc:"Tender cubes with bell pepper, tomatoes and onions tempered with hot chilies and ground spices",             badge:"spicy",           spiceProfile:"adjustable" },
  { id:"item-vindaloo-l",    name:"Lamb Vindaloo",            price:26.95, desc:"Boneless lamb cooked with potatoes in a hot vindaloo sauce",                                                badge:"spicy",           spiceProfile:"hot" },
  { id:"item-boti",          name:"Boti Kabab Masala",        price:26.95, desc:"Lamb kabab slow cooked in tandoor then simmered in tomato cream sauce with garlic, ginger and bell pepper", badge:"chef",            spiceProfile:"adjustable" },
  { id:"item-phaal",         name:"Lamb Phaal",               price:26.95, desc:"Lamb cooked with a blend of chilies, onions, tomatoes and spices",                                          badge:"spicy",           spiceProfile:"hot" },
  { id:"item-biriyani-l",    name:"Lamb Biriyani",            price:26.95, desc:"Cubes of lamb cooked with saffron rice, mixed dry fruits, nuts, pistachios and ghee",                       badge:"bestseller",      spiceProfile:"adjustable" },
  { id:"item-lamb-chops",    name:"Lamb Chops",               price:33.95, desc:"Marinated in mixed spices and baked in the tandoori clay oven",                                             badge:"chef",            spiceProfile:"adjustable" },
  // Tandoori
  { id:"item-tandoori-chicken",name:"Tandoori Chicken",       price:17.95, desc:"Skinless chicken marinated in yogurt, ginger and freshly ground spices, baked in clay oven",               badge:"bestseller",      spiceProfile:"adjustable" },
  { id:"item-chicken-tikka", name:"Chicken Tikka",            price:18.95, desc:"Boneless chicken breast marinated in yogurt, ginger and spices, cooked in clay oven",                      badge:null,              spiceProfile:"adjustable" },
  { id:"item-lamb-tikka",    name:"Lamb Tikka",               price:23.95, desc:"Cubes of lamb marinated in yogurt, fresh lemon juice, garlic, ginger and spices, roasted in clay oven",    badge:null,              spiceProfile:"adjustable" },
  { id:"item-tandoori-fish", name:"Tandoori Fish",            price:20.95, desc:"Marinated King Fish slow cooked in the tandoor clay oven",                                                  badge:null,              spiceProfile:"adjustable" },
  { id:"item-shrimp-tandoori",name:"Shrimp Tandoori",         price:24.95, desc:"Jumbo shrimp marinated in yogurt, ginger, garlic and spices, baked in tandoori oven",                      badge:null,              spiceProfile:"adjustable" },
  { id:"item-tandoori-medley",name:"Tandoori Medley",         price:27.95, desc:"Lamb tikka, chicken kabab, tandoori shrimp, seek kabab and tandoori chicken",                               badge:"chef",            spiceProfile:"adjustable" },
  { id:"item-lobster",       name:"Tandoori Lobster — 10 oz", price:39.95, desc:"One marinated succulent lobster slow cooked in the tandoori clay oven",                                     badge:"chef",            spiceProfile:"adjustable" },
  { id:"item-paneer-tikka",  name:"Paneer Tikka",             price:19.95, desc:"Homemade cottage cheese in a subtle cardamom marinade, grilled in tandoori clay oven",                      badge:null,              spiceProfile:"adjustable" },
  // Seafood
  { id:"item-shrimp-korma",  name:"Shrimp Korma",             price:24.95, desc:"Jumbo shrimp gently simmered in coconut milk with mild spices and creamy cashew nut sauce",                badge:null,              spiceProfile:"mild" },
  { id:"item-tandoori-shrimp-masala",name:"Tandoori Shrimp Masala",price:24.95,desc:"Shrimp tikka from the tandoor, simmered in tomato cream sauce with garlic, ginger and bell pepper",    badge:null,              spiceProfile:"adjustable" },
  { id:"item-shrimp-bhuna",  name:"Shrimp Bhuna",             price:24.95, desc:"Jumbo shrimp with garlic, ginger, onions, bell peppers and tomatoes in gravy",                             badge:null,              spiceProfile:"adjustable" },
  { id:"item-shrimp-manglorian",name:"Shrimp Manglorian",     price:24.95, desc:"Jumbo shrimp in a tangy coconut stew flavored with ginger and curry leaves",                               badge:null,              spiceProfile:"adjustable" },
  { id:"item-fish-curry",    name:"Manglorian Fish Curry",    price:20.95, desc:"Fish cooked in a tangy coconut stew with ginger and curry leaves",                                          badge:null,              spiceProfile:"adjustable" },
  { id:"item-shrimp-sag",    name:"Shrimp Sag",               price:24.95, desc:"Jumbo shrimp cooked in a mild spinach sauce",                                                               badge:null,              spiceProfile:"adjustable" },
  { id:"item-shrimp-vindaloo",name:"Shrimp Vindaloo",         price:24.95, desc:"A Goan specialty — shrimp cooked with potato in a very hot spicy sauce",                                   badge:"spicy",           spiceProfile:"hot" },
  { id:"item-shrimp-malai",  name:"Shrimp Malai",             price:24.95, desc:"Jumbo shrimp in mild garlic, ginger, cashew-almond cream sauce, cooked in the tandoor",                    badge:null,              spiceProfile:"mild" },
  { id:"item-shrimp-biriyani",name:"Shrimp Biriyani",         price:24.95, desc:"Jumbo shrimp cooked with saffron rice, almonds, pistachios and coriander leaves",                          badge:null,              spiceProfile:"adjustable" },
  // Medley
  { id:"item-dhaba",         name:"Dhaba Medley",             price:27.95, desc:"Prepared first in the tandoori oven, then cooked with ginger, onions, tomatoes and curry leaves",           badge:null,              spiceProfile:"adjustable" },
  { id:"item-sag-medley",    name:"Sag Medley",               price:27.95, desc:"Creamy spinach sauce",                                                                                      badge:null,              spiceProfile:"adjustable" },
  { id:"item-masala-medley", name:"Masala Medley",            price:27.95, desc:"Tomato cream sauce with garlic, ginger and bell pepper — the classic tikka masala sauce",                  badge:"bestseller",      spiceProfile:"adjustable" },
  { id:"item-vindaloo-medley",name:"Vindaloo Medley",         price:27.95, desc:"Extra spicy sauce cooked with potatoes and an assortment of spices",                                        badge:"spicy",           spiceProfile:"hot" },
  { id:"item-biriyani-medley",name:"Biriyani Medley",         price:27.95, desc:"Aromatic long-grain basmati with dry mixed fruits, nuts, blended herbs, spices and fragrant saffron",      badge:null,              spiceProfile:"adjustable" },
  { id:"item-korma-medley",  name:"Korma Medley",             price:27.95, desc:"Simmered in coconut milk, blended with mild spices and a creamy cashew nut sauce",                         badge:null,              spiceProfile:"mild" },
  { id:"item-bhuna-medley",  name:"Bhuna Medley",             price:27.95, desc:"Cooked with garlic, ginger, onion, bell peppers and tomatoes in a thick gravy",                            badge:null,              spiceProfile:"adjustable" },
  { id:"item-madras-medley", name:"Madras Medley",            price:27.95, desc:"Tangy coconut stew flavored with ginger and curry leaves",                                                  badge:null,              spiceProfile:"adjustable" },
  // Vegetarian
  { id:"item-aloo-gobi",     name:"Aloo Gobi",                price:17.95, desc:"Cauliflower, potato and tomato in a delicately spiced light gravy",                                         badge:null,              spiceProfile:"adjustable" },
  { id:"item-baingan",       name:"Baingan Bhurtha",          price:17.95, desc:"Eggplant broiled over charcoal, peeled, mashed and sautéed with chopped onions",                           badge:null,              spiceProfile:"adjustable" },
  { id:"item-chana-masala",  name:"Chana Masala",             price:17.95, desc:"Chickpeas cooked with spiced tomatoes, onions, ginger and garlic",                                          badge:null,              spiceProfile:"adjustable" },
  { id:"item-palak-paneer",  name:"Palak Paneer",             price:17.95, desc:"Homemade cheese cubes in a delicately spiced spinach gravy",                                                badge:"bestseller",      spiceProfile:"adjustable" },
  { id:"item-malai-kofta",   name:"Malai Kofta",              price:18.95, desc:"Cottage cheese and potato balls stuffed with nuts and fruits, in mildly spiced cashew-almond cream sauce", badge:null,              spiceProfile:"mild" },
  { id:"item-shahi-paneer",  name:"Shahi Paneer Tikka Masala",price:21.95, desc:"Cottage cheese in tomato cream sauce enriched with fresh green spices",                                    badge:null,              spiceProfile:"adjustable" },
  { id:"item-navaratan",     name:"Navaratan Korma",          price:17.95, desc:"Assorted vegetables in a mildly spiced creamy cashew and almond sauce",                                     badge:null,              spiceProfile:"mild" },
  { id:"item-dal-maharani",  name:"Dal Maharani Makhni",      price:14.95, desc:"Black lentil — slow cooked overnight, finished with butter and cream",                                      badge:null,              spiceProfile:"adjustable" },
  { id:"item-dal-tarka",     name:"Dal Tarka",                price:13.95, desc:"Yellow lentil tempered with cumin, garlic and spices",                                                      badge:null,              spiceProfile:"adjustable" },
  { id:"item-veg-biriyani",  name:"Vegetable Biriyani",       price:17.95, desc:"Aromatic basmati cooked Hyderabadi style with seasonal vegetables, spices and saffron",                    badge:null,              spiceProfile:"adjustable" },
  { id:"item-chana-sag",     name:"Chana Sag",                price:18.95, desc:"Chickpeas cooked in a medium spiced spinach gravy",                                                         badge:null,              spiceProfile:"adjustable" },
  // Breads
  { id:"item-naan",          name:"Naan",                     price:4.75,  desc:"Classic unleavened Indian bread baked in the tandoori clay oven",                                           badge:null,              spiceProfile:"none" },
  { id:"item-onion-naan",    name:"Onion Naan",               price:5.20,  desc:"Stuffed with chopped onions, green pepper and red pepper",                                                  badge:null,              spiceProfile:"none" },
  { id:"item-garlic-naan",   name:"Garlic Naan",              price:5.20,  desc:"Stuffed with ground garlic and cilantro",                                                                   badge:"bestseller",      spiceProfile:"none" },
  { id:"item-rani-naan",     name:"Rani Ki Special Naan",     price:6.20,  desc:"Bread stuffed with minced chicken tikka and coriander leaves",                                              badge:"chef",            spiceProfile:"none" },
  { id:"item-peshwari",      name:"Peshwari Naan",            price:6.20,  desc:"Stuffed with nuts, raisins and cherries — a sweet, rich bread",                                            badge:null,              spiceProfile:"none" },
  { id:"item-poori",         name:"Poori",                    price:5.75,  desc:"A puffed whole wheat bread",                                                                                badge:null,              spiceProfile:"none" },
  { id:"item-chapathi",      name:"Chapathi",                 price:5.25,  desc:"Thin dry whole wheat bread",                                                                                badge:null,              spiceProfile:"none" },
  { id:"item-aloo-paratha",  name:"Aloo Paratha",             price:7.20,  desc:"Paratha stuffed with potatoes, ginger, garlic and coriander leaves",                                       badge:null,              spiceProfile:"none" },
  { id:"item-keema-paratha", name:"Keema Paratha",            price:8.20,  desc:"Paratha stuffed with ground lamb, ginger, garlic, onion and tomatoes",                                     badge:null,              spiceProfile:"none" },
  // Sides
  { id:"item-mango-chutney", name:"Mango Chutney",            price:4.50,  desc:"Sweet and tangy mango preserve",                                                                            badge:null,              spiceProfile:"none" },
  { id:"item-mixed-pickles", name:"Mixed Pickles",            price:4.50,  desc:"Assorted Indian pickled vegetables",                                                                        badge:null,              spiceProfile:"none" },
  { id:"item-raita",         name:"Raita",                    price:4.50,  desc:"Chilled yogurt with cucumber and spices — cooling accompaniment",                                           badge:null,              spiceProfile:"none" },
  { id:"item-rice",          name:"Basmati Rice",             price:5.50,  desc:"Aromatic long-grain basmati rice",                                                                          badge:null,              spiceProfile:"none" },
  { id:"item-masala-sauce",  name:"Masala Sauce",             price:5.50,  desc:"Extra tikka masala sauce on the side",                                                                      badge:null,              spiceProfile:"none" },
  // Drinks
  { id:"item-mango-lassi",   name:"Mango Lassi",              price:5.95,  desc:"Traditional Indian drink with mango and yogurt",                                                            badge:"bestseller",      spiceProfile:"none" },
  { id:"item-sweet-lassi",   name:"Sweet Lassi",              price:5.95,  desc:"Refreshing yogurt-based drink, sweetened to perfection",                                                    badge:null,              spiceProfile:"none" },
  { id:"item-nemkin-lassi",  name:"Nemkin Lassi",             price:6.00,  desc:"Savory salted yogurt drink with cumin",                                                                     badge:null,              spiceProfile:"none" },
  { id:"item-nimbu-pani",    name:"Nimbu Pani",               price:6.00,  desc:"Refreshing blend of lemon juice, water, sugar and a touch of salt",                                        badge:null,              spiceProfile:"none" },
  { id:"item-root-beer",     name:"Root Beer",                price:5.95,  desc:"Smooth, classic root beer with a rich frothy head",                                                         badge:null,              spiceProfile:"none" },
  { id:"item-san-pellegrino",name:"San Pellegrino",           price:5.95,  desc:"Sparkling mineral water",                                                                                   badge:null,              spiceProfile:"none" },
  { id:"item-poland-spring", name:"Poland Spring",            price:4.50,  desc:"Still water",                                                                                               badge:null,              spiceProfile:"none" },
  { id:"item-juices",        name:"Fresh Juice",              price:4.50,  desc:"Freshly prepared, blending a variety of fruits",                                                            badge:null,              spiceProfile:"none" },
  { id:"item-soda",          name:"Soda",                     price:2.50,  desc:"Assorted carbonated beverages",                                                                             badge:null,              spiceProfile:"none" },
  { id:"item-tea-coffee",    name:"Tea or Coffee",            price:2.50,  desc:"Hot brewed tea or coffee",                                                                                  badge:null,              spiceProfile:"none" },
];

export const ITEM_MAP = Object.fromEntries(MENU_ITEMS.map(i => [i.id, i]));

// ── Quick-add items (upsell chips) ─────────────────────────────────
export const QA = {
  "qa-garlic-naan":   { name:"Garlic Naan",          price:5.20, note:"Most popular — ordered at nearly every table", star:true },
  "qa-peshwari":      { name:"Peshwari Naan",         price:6.20, note:"Sweet & nutty — a natural contrast to spice" },
  "qa-onion-naan":    { name:"Onion Naan",            price:5.20, note:"Savoury and aromatic" },
  "qa-rani-naan":     { name:"Rani Ki Special Naan",  price:6.20, note:"Stuffed with chicken tikka — a house signature" },
  "qa-aloo-paratha":  { name:"Aloo Paratha",          price:7.20, note:"Hearty potato-stuffed flatbread" },
  "qa-plain-naan":    { name:"Plain Naan",            price:4.75, note:"Classic — perfect for scooping" },
  "qa-keema-paratha": { name:"Keema Paratha",         price:8.20, note:"Lamb-stuffed — echoes your dish" },
  "qa-raita":         { name:"Raita",                 price:4.50, note:"Chilled yogurt — the classic cool-down" },
  "qa-mango-chutney": { name:"Mango Chutney",         price:4.50, note:"Sweet and tangy — balances the heat" },
  "qa-mango-lassi":   { name:"Mango Lassi",           price:5.95, note:"Our most-ordered drink — guests love it", star:true },
  "qa-sweet-lassi":   { name:"Sweet Lassi",           price:5.95, note:"Refreshing yogurt drink" },
  "qa-nimbu-pani":    { name:"Nimbu Pani",            price:6.00, note:"Fresh lemon water — light and cleansing" },
};

// ── Combined lookup for server-side price/id validation ───────────
// Every id a cart line item can carry (baseId), mapped to its canonical
// name + price. create-checkout.js validates against this — never trusts
// a client-submitted price or name.
export const VALID_ITEMS = {
  ...Object.fromEntries(MENU_ITEMS.map(i => [i.id, { name:i.name, price:i.price }])),
  ...Object.fromEntries(Object.entries(QA).map(([id, i]) => [id, { name:i.name, price:i.price }])),
};

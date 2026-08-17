// ── Canonical menu data — single source of truth ──────────────────
// Imported by both the storefront (RaniMahal.jsx) and the backend
// (create-checkout.js, api/images/list.js, lib/orders.js) so prices,
// item ids and the tax rate can never drift between client and server.
//
// This is also the source of truth for the marketing site (a separate
// deployment) — it fetches /api/menu rather than hand-maintaining its
// own copy of items/prices/descriptions.

export const TAX_RATE = 0.08375;

// spiceProfile:
//   "adjustable" — full Mild/Medium/Spicy selector (sauce curries and tandoori-cooked dishes alike)
//   "mild"       — Korma-style (incl. Malai/cream sauces) — always mild, fixed
//   "hot"        — Vindaloo-style (incl. Phaal) — always spicy, fixed
//   "none"       — no spice concept (bread, rice, drinks, sides, soup, salad)
export const MENU_ITEMS = [
  // Appetizers
  { id:"item-samosa",        name:"Samosa",                   price:7.95,  desc:"Triangular pastry stuffed with potatoes, green peas and spices",                                             badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-pakora",        name:"Pakora",                   price:6.50,  desc:"Vegetable fritters with onion, potato, spinach and cauliflower",                                             badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-mixed-app",     name:"Mixed Appetizers",         price:10.95, desc:"Assorted samosa, mixed pakoras and papad",                                                                   badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-papad",         name:"Papad",                    price:3.95,  desc:"Thin lentil wafer with cracked black pepper",                                                                badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-masala-dosa",   name:"Masala Dosa",              price:11.95, desc:"Thin rice crepe filled with spiced potato and peas, served with coconut chutney and sambar",                badge:"bestseller",      spiceProfile:"none",       veg:true  },
  { id:"item-gobi-manchurian",name:"Gobi Manchurian",         price:11.95, desc:"Cauliflower florets tossed in garlic-tomato sauce with medium spices",                                      badge:"chef",            spiceProfile:"adjustable", veg:true  },
  { id:"item-ragada",        name:"Ragada Patties",           price:10.95, desc:"Spiced potato patties layered with chickpeas and herbs",                                                     badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-meat-samosa",   name:"Meat Samosa",              price:8.50,  desc:"Triangular pastry stuffed with ground lamb and fresh house seasoning",                                       badge:null,              spiceProfile:"none",       veg:false },
  { id:"item-seek-kabab",    name:"Seek Kabab",               price:11.95, desc:"Kashmiri-style minced lamb with aromatic herbs and spices, roasted in tandoor",                              badge:"chef",            spiceProfile:"adjustable", veg:false },
  { id:"item-chicken-malai", name:"Chicken Malai Kabab",      price:11.95, desc:"Chunks of chicken marinated in ginger, garlic, white pepper and yogurt",                                    badge:"chef",            spiceProfile:"adjustable", veg:false },
  { id:"item-shrimp-bagari", name:"Shrimp Bagari",            price:13.95, desc:"Shrimp tempered with mustard seeds, curry leaves, in tomato sauce with caramelized onions",                 badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-rani-offering", name:"Rani Ki Offering",         price:13.95, desc:"Chicken kabab, seek kabab, chicken tikka, shrimp tikka, papad and chicken wings",                           badge:"chef",            spiceProfile:"adjustable", veg:false },
  { id:"item-keema-dosa",    name:"Keema Dosa",               price:13.95, desc:"Thin rice crepe filled with ground lamb, served with fresh house coconut chutney and sambar",               badge:"bestseller",      spiceProfile:"none",       veg:false },
  // Soups & Salads
  { id:"item-mulligatawny",  name:"Mulligatawny Soup",        price:5.95,  desc:"Traditional soup made with lentils, vegetables, herbs and ground spices",                                   badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-tomato-soup",   name:"Tomato Soup",              price:5.95,  desc:"Cream of fresh tomatoes, garnished with roasted bread croutons and fresh ground spices",                    badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-chicken-soup",  name:"Chicken Soup",             price:5.95,  desc:"Flavored with onion, ginger, garlic and garnished with coriander leaves",                                   badge:null,              spiceProfile:"none",       veg:false },
  { id:"item-salad",         name:"Chef's Special Salad",     price:7.95,  desc:"Tomato, cucumber, green pepper, onion and carrot with homemade dressing",                                   badge:null,              spiceProfile:"none",       veg:true  },
  // Chicken
  { id:"item-ctm",           name:"Chicken Tikka Masala",     price:21.95, desc:"Boneless white meat simmered in tomato cream sauce with garlic, ginger and bell pepper",                    badge:"bestseller",      spiceProfile:"adjustable", veg:false },
  { id:"item-makhni",        name:"Chicken Makhni",           price:20.95, desc:"Tandoori chicken with chopped tomatoes, green pepper and butter — classic butter chicken",                  badge:"bestseller",      spiceProfile:"adjustable", veg:false },
  { id:"item-korma-c",       name:"Chicken Korma",            price:20.95, desc:"Skinless chicken blended with mild spices in a creamy cashew nut sauce",                                    badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-sagwala",       name:"Chicken Tikka Sagwala",    price:20.95, desc:"White meat chicken with tomatoes and creamy spinach sauce",                                                  badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-vindaloo-c",    name:"Chicken Vindaloo",         price:20.95, desc:"Chicken cooked with potatoes in a very spicy Goan sauce",                                                   badge:"spicy",           spiceProfile:"hot",        veg:false },
  { id:"item-madras-c",      name:"Chicken Madras",           price:20.95, desc:"Boneless chicken in a tangy coconut stew flavored with ginger and curry leaves",                            badge:"spicy",           spiceProfile:"adjustable", veg:false },
  { id:"item-jalfreazy-c",   name:"Chicken Jalfreazy",        price:20.95, desc:"Boneless white meat cooked with onions, tomatoes and bell pepper",                                          badge:"spicy",           spiceProfile:"adjustable", veg:false },
  { id:"item-do-paiza-c",    name:"Chicken Do Paiza",         price:20.95, desc:"Boneless chicken with garlic, ginger, seasoned onions and bell pepper",                                     badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-biriyani-c",    name:"Chicken Biriyani",         price:20.95, desc:"Aromatic long-grain basmati cooked with chicken, dry mixed fruits, nuts, blended herbs and fragrant saffron",badge:"bestseller",     spiceProfile:"adjustable", veg:false },
  { id:"item-bhuna-c",       name:"Chicken Bhuna",            price:20.95, desc:"Boneless chicken with garlic, ginger, onion, bell peppers and tomatoes in gravy",                           badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-curry-c",       name:"Chicken Curry",            price:20.95, desc:"Skinless chicken cooked in traditional Kashmiri masala",                                                    badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-kanda-curry-c", name:"Chicken Kanda Curry",      price:20.95, desc:"Boneless chicken cooked with onions in a traditional home-style curry",                                     badge:null,              spiceProfile:"adjustable", veg:false },
  // Lamb
  { id:"item-rogan",         name:"Lamb Rogan Josh",          price:25.95, desc:"Tender cubes in traditional Kashmiri masala — paprika, royal cumin, cardamom, clove and onion gravy",      badge:"bestseller",      spiceProfile:"adjustable", veg:false },
  { id:"item-sag-l",         name:"Lamb Sag",                 price:26.95, desc:"Boneless chunks of lamb in a delicately spiced spinach sauce",                                              badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-korma-l",       name:"Lamb Korma",               price:26.95, desc:"Lamb blended with mild spices in a creamy cashew nut sauce",                                                badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-do-paiza-l",    name:"Lamb Do Paiza",            price:26.95, desc:"Lamb with fresh chopped onions, garlic, ginger, coriander and medium spices",                               badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-kadai",         name:"Kadai Lamb",               price:26.95, desc:"Tender cubes with bell pepper, tomatoes and onions tempered with hot chilies and ground spices",             badge:"spicy",           spiceProfile:"adjustable", veg:false },
  { id:"item-vindaloo-l",    name:"Lamb Vindaloo",            price:26.95, desc:"Boneless lamb cooked with potatoes in a hot vindaloo sauce",                                                badge:"spicy",           spiceProfile:"hot",        veg:false },
  { id:"item-boti",          name:"Boti Kabab Masala",        price:28.95, desc:"Lamb kabab slow cooked in tandoor then simmered in tomato cream sauce with garlic, ginger and bell pepper", badge:"chef",            spiceProfile:"adjustable", veg:false },
  { id:"item-phaal",         name:"Lamb Phaal",               price:26.95, desc:"Lamb cooked with a blend of chilies, onions, tomatoes and spices",                                          badge:"spicy",           spiceProfile:"hot",        veg:false },
  { id:"item-biriyani-l",    name:"Lamb Biriyani",            price:26.95, desc:"Cubes of lamb cooked with saffron rice, mixed dry fruits, nuts, pistachios and ghee",                       badge:"bestseller",      spiceProfile:"adjustable", veg:false },
  { id:"item-lamb-chops",    name:"Lamb Chops",               price:33.95, desc:"Marinated in mixed spices and baked in the tandoori clay oven",                                             badge:"chef",            spiceProfile:"adjustable", veg:false },
  { id:"item-lamb-madras",   name:"Lamb Madras",              price:26.95, desc:"Boneless lamb in a tangy coconut stew flavored with ginger and curry leaves",                                badge:"spicy",           spiceProfile:"adjustable", veg:false },
  { id:"item-goat-curry",    name:"Goat Curry",               price:28.95, desc:"Bone-in goat simmered in a traditional home-style curry",                                                   badge:null,              spiceProfile:"adjustable", veg:false },
  // Tandoori
  { id:"item-tandoori-chicken",name:"Tandoori Chicken",       price:19.95, desc:"Skinless chicken marinated in yogurt, ginger and freshly ground spices, baked in clay oven",               badge:"bestseller",      spiceProfile:"adjustable", veg:false },
  { id:"item-chicken-tikka", name:"Chicken Tikka",            price:20.95, desc:"Boneless chicken breast marinated in yogurt, ginger and spices, cooked in clay oven",                      badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-lamb-tikka",    name:"Lamb Tikka",               price:26.95, desc:"Cubes of lamb marinated in yogurt, fresh lemon juice, garlic, ginger and spices, roasted in clay oven",    badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-tandoori-fish", name:"Tandoori Fish",            price:24.95, desc:"Marinated King Fish slow cooked in the tandoor clay oven",                                                  badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-shrimp-tandoori",name:"Shrimp Tandoori",         price:24.95, desc:"Jumbo shrimp marinated in yogurt, ginger, garlic and spices, baked in tandoori oven",                      badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-tandoori-medley",name:"Tandoori Medley",         price:27.95, desc:"Lamb tikka, chicken kabab, tandoori shrimp, seek kabab and tandoori chicken",                               badge:"chef",            spiceProfile:"adjustable", veg:false },
  { id:"item-lobster",       name:"Tandoori Lobster — 10 oz", price:39.95, desc:"One marinated succulent lobster slow cooked in the tandoori clay oven",                                     badge:"chef",            spiceProfile:"adjustable", veg:false },
  { id:"item-paneer-tikka",  name:"Paneer Tikka",             price:21.95, desc:"Homemade cottage cheese in a subtle cardamom marinade, grilled in tandoori clay oven",                      badge:null,              spiceProfile:"adjustable", veg:true  },
  // Seafood
  { id:"item-shrimp-korma",  name:"Shrimp Korma",             price:24.95, desc:"Jumbo shrimp gently simmered in coconut milk with mild spices and creamy cashew nut sauce",                badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-tandoori-shrimp-masala",name:"Tandoori Shrimp Masala",price:24.95,desc:"Shrimp tikka from the tandoor, simmered in tomato cream sauce with garlic, ginger and bell pepper",    badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-shrimp-bhuna",  name:"Shrimp Bhuna",             price:24.95, desc:"Jumbo shrimp with garlic, ginger, onions, bell peppers and tomatoes in gravy",                             badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-shrimp-manglorian",name:"Shrimp Manglorian",     price:24.95, desc:"Jumbo shrimp in a tangy coconut stew flavored with ginger and curry leaves",                               badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-fish-curry",    name:"Manglorian Fish Curry",    price:20.95, desc:"Fish cooked in a tangy coconut stew with ginger and curry leaves",                                          badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-shrimp-sag",    name:"Shrimp Sag",               price:24.95, desc:"Jumbo shrimp cooked in a mild spinach sauce",                                                               badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-shrimp-vindaloo",name:"Shrimp Vindaloo",         price:24.95, desc:"A Goan specialty — shrimp cooked with potato in a very hot spicy sauce",                                   badge:"spicy",           spiceProfile:"hot",        veg:false },
  { id:"item-shrimp-malai",  name:"Shrimp Malai",             price:24.95, desc:"Jumbo shrimp in mild garlic, ginger, cashew-almond cream sauce, cooked in the tandoor",                    badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-shrimp-biriyani",name:"Shrimp Biriyani",         price:24.95, desc:"Jumbo shrimp cooked with saffron rice, almonds, pistachios and coriander leaves",                          badge:null,              spiceProfile:"adjustable", veg:false },
  // Medley
  { id:"item-dhaba",         name:"Dhaba Medley",             price:28.95, desc:"Prepared first in the tandoori oven, then cooked with ginger, onions, tomatoes and curry leaves",           badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-sag-medley",    name:"Sag Medley",               price:28.95, desc:"Creamy spinach sauce",                                                                                      badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-masala-medley", name:"Masala Medley",            price:28.95, desc:"Tomato cream sauce with garlic, ginger and bell pepper — the classic tikka masala sauce",                  badge:"bestseller",      spiceProfile:"adjustable", veg:false },
  { id:"item-vindaloo-medley",name:"Vindaloo Medley",         price:27.95, desc:"Extra spicy sauce cooked with potatoes and an assortment of spices",                                        badge:"spicy",           spiceProfile:"hot",        veg:false },
  { id:"item-biriyani-medley",name:"Biriyani Medley",         price:28.95, desc:"Aromatic long-grain basmati with dry mixed fruits, nuts, blended herbs, spices and fragrant saffron",      badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-korma-medley",  name:"Korma Medley",             price:28.95, desc:"Simmered in coconut milk, blended with mild spices and a creamy cashew nut sauce",                         badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-bhuna-medley",  name:"Bhuna Medley",             price:28.95, desc:"Cooked with garlic, ginger, onion, bell peppers and tomatoes in a thick gravy",                            badge:null,              spiceProfile:"adjustable", veg:false },
  { id:"item-madras-medley", name:"Madras Medley",            price:28.95, desc:"Tangy coconut stew flavored with ginger and curry leaves",                                                  badge:null,              spiceProfile:"adjustable", veg:false },
  // Vegetarian
  { id:"item-aloo-gobi",     name:"Aloo Gobi",                price:17.95, desc:"Cauliflower, potato and tomato in a delicately spiced light gravy",                                         badge:null,              spiceProfile:"adjustable", veg:true  },
  { id:"item-baingan",       name:"Baingan Bhurtha",          price:17.95, desc:"Eggplant broiled over charcoal, peeled, mashed and sautéed with chopped onions",                           badge:null,              spiceProfile:"adjustable", veg:true  },
  { id:"item-chana-masala",  name:"Chana Masala",             price:17.95, desc:"Chickpeas cooked with spiced tomatoes, onions, ginger and garlic",                                          badge:null,              spiceProfile:"adjustable", veg:true  },
  { id:"item-palak-paneer",  name:"Palak Paneer",             price:17.95, desc:"Homemade cheese cubes in a delicately spiced spinach gravy",                                                badge:"bestseller",      spiceProfile:"adjustable", veg:true  },
  { id:"item-malai-kofta",   name:"Malai Kofta",              price:18.95, desc:"Cottage cheese and potato balls stuffed with nuts and fruits, in mildly spiced cashew-almond cream sauce", badge:null,              spiceProfile:"adjustable", veg:true  },
  { id:"item-shahi-paneer",  name:"Shahi Paneer Tikka Masala",price:21.95, desc:"Cottage cheese in tomato cream sauce enriched with fresh green spices",                                    badge:null,              spiceProfile:"adjustable", veg:true  },
  { id:"item-navaratan",     name:"Navaratan Korma",          price:18.95, desc:"Assorted vegetables in a mildly spiced creamy cashew and almond sauce",                                     badge:null,              spiceProfile:"adjustable", veg:true  },
  { id:"item-dal-maharani",  name:"Dal Maharani Makhni",      price:13.95, desc:"Black lentil — slow cooked overnight, finished with butter and cream",                                      badge:null,              spiceProfile:"adjustable", veg:true  },
  { id:"item-dal-tarka",     name:"Dal Tarka",                price:13.95, desc:"Yellow lentil tempered with cumin, garlic and spices",                                                      badge:null,              spiceProfile:"adjustable", veg:true  },
  { id:"item-veg-biriyani",  name:"Vegetable Biriyani",       price:17.95, desc:"Aromatic basmati cooked Hyderabadi style with seasonal vegetables, spices and saffron",                    badge:null,              spiceProfile:"adjustable", veg:true  },
  { id:"item-chana-sag",     name:"Chana Sag",                price:18.95, desc:"Chickpeas cooked in a medium spiced spinach gravy",                                                         badge:null,              spiceProfile:"adjustable", veg:true  },
  { id:"item-sabji-lajawaab",name:"Sabji Lajawaab",           price:17.95, desc:"Mixed seasonal vegetables in a house special sauce",                                                        badge:null,              spiceProfile:"adjustable", veg:true  },
  { id:"item-broccoli-jalfreazy",name:"Broccoli Jalfreazy",   price:17.95, desc:"Broccoli cooked with onions, tomatoes and bell pepper",                                                     badge:null,              spiceProfile:"adjustable", veg:true  },
  { id:"item-sabji-masala",  name:"Sabji Masala",             price:17.95, desc:"Mixed vegetables in a tomato cream masala sauce",                                                           badge:null,              spiceProfile:"adjustable", veg:true  },
  { id:"item-bhindi-mafaz",  name:"Bhindi Mafaz",             price:17.95, desc:"Okra stuffed and cooked with onions and spices",                                                            badge:null,              spiceProfile:"adjustable", veg:true  },
  { id:"item-aloo-gobi-palak",name:"Aloo Gobi Palak",         price:17.95, desc:"Potato and cauliflower cooked in a spiced spinach gravy",                                                   badge:null,              spiceProfile:"adjustable", veg:true  },
  { id:"item-rani-ki-avial", name:"Rani Ki Avial",            price:17.95, desc:"South Indian style mixed vegetables in coconut and yogurt sauce",                                          badge:"chef",            spiceProfile:"adjustable", veg:true  },
  { id:"item-mushroom-masala",name:"Mushroom Masala",         price:18.95, desc:"Mushrooms in a tomato cream masala sauce",                                                                  badge:null,              spiceProfile:"adjustable", veg:true  },
  { id:"item-mutter-paneer", name:"Mutter Paneer",            price:18.95, desc:"Homemade cottage cheese and green peas in a spiced tomato gravy",                                          badge:null,              spiceProfile:"adjustable", veg:true  },
  // Breads
  { id:"item-naan",          name:"Naan",                     price:4.95,  desc:"Classic unleavened Indian bread baked in the tandoori clay oven",                                           badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-onion-naan",    name:"Onion Naan",               price:5.50,  desc:"Stuffed with chopped onions, green pepper and red pepper",                                                  badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-garlic-naan",   name:"Garlic Naan",              price:5.50,  desc:"Stuffed with ground garlic and cilantro",                                                                   badge:"bestseller",      spiceProfile:"none",       veg:true  },
  { id:"item-rani-naan",     name:"Rani Ki Special Naan",     price:6.25,  desc:"Bread stuffed with minced chicken tikka and coriander leaves",                                              badge:"chef",            spiceProfile:"none",       veg:false },
  { id:"item-peshwari",      name:"Peshwari Naan",            price:6.25,  desc:"Stuffed with nuts, raisins and cherries — a sweet, rich bread",                                            badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-poori",         name:"Poori",                    price:6.25,  desc:"A puffed whole wheat bread",                                                                                badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-chapathi",      name:"Chapathi",                 price:5.50,  desc:"Thin dry whole wheat bread",                                                                                badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-aloo-paratha",  name:"Aloo Paratha",             price:7.25,  desc:"Paratha stuffed with potatoes, ginger, garlic and coriander leaves",                                       badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-keema-paratha", name:"Keema Paratha",            price:8.50,  desc:"Paratha stuffed with ground lamb, ginger, garlic, onion and tomatoes",                                     badge:null,              spiceProfile:"none",       veg:false },
  // Sides
  { id:"item-mango-chutney", name:"Mango Chutney",            price:4.50,  desc:"Sweet and tangy mango preserve",                                                                            badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-mixed-pickles", name:"Mixed Pickles",            price:4.50,  desc:"Assorted Indian pickled vegetables",                                                                        badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-raita",         name:"Raita",                    price:4.50,  desc:"Chilled yogurt with cucumber and spices — cooling accompaniment",                                           badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-rice",          name:"Basmati Rice",             price:5.50,  desc:"Aromatic long-grain basmati rice",                                                                          badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-masala-sauce",  name:"Masala Sauce",             price:5.95,  desc:"Extra tikka masala sauce on the side",                                                                      badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-hot-sauce",     name:"Hot Sauce",                price:4.95,  desc:"Extra house hot sauce on the side",                                                                         badge:null,              spiceProfile:"none",       veg:true  },
  // Drinks
  { id:"item-mango-lassi",   name:"Mango Lassi",              price:5.95,  desc:"Traditional Indian drink with mango and yogurt",                                                            badge:"bestseller",      spiceProfile:"none",       veg:true  },
  { id:"item-sweet-lassi",   name:"Sweet Lassi",              price:5.95,  desc:"Refreshing yogurt-based drink, sweetened to perfection",                                                    badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-nemkin-lassi",  name:"Nemkin Lassi",             price:6.00,  desc:"Savory salted yogurt drink with cumin",                                                                     badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-nimbu-pani",    name:"Nimbu Pani",               price:6.00,  desc:"Refreshing blend of lemon juice, water, sugar and a touch of salt",                                        badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-root-beer",     name:"Root Beer",                price:5.95,  desc:"Smooth, classic root beer with a rich frothy head",                                                         badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-san-pellegrino",name:"San Pellegrino",           price:5.95,  desc:"Sparkling mineral water",                                                                                   badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-poland-spring", name:"Poland Spring",            price:4.50,  desc:"Still water",                                                                                               badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-tea-coffee",    name:"Tea or Coffee",            price:2.50,  desc:"Hot brewed tea or coffee",                                                                                  badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-ice-tea",       name:"Ice Tea",                  price:3.25,  desc:"Chilled brewed iced tea",                                                                                   badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-coke",          name:"Coke",                     price:2.50,  desc:"Classic Coca-Cola",                                                                                         badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-diet-coke",     name:"Diet Coke",                price:2.75,  desc:"Diet Coca-Cola",                                                                                            badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-sprite",        name:"Sprite",                   price:2.75,  desc:"Lemon-lime soda",                                                                                           badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-ginger-ale",    name:"Ginger Ale",               price:2.50,  desc:"Crisp ginger ale",                                                                                          badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-club-soda",     name:"Club Soda",                price:2.50,  desc:"Sparkling club soda",                                                                                       badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-tonic",         name:"Tonic",                    price:2.25,  desc:"Tonic water",                                                                                               badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-cranberry-juice",name:"Cranberry Juice",         price:4.50,  desc:"Chilled cranberry juice",                                                                                   badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-apple-juice",   name:"Apple Juice",              price:4.50,  desc:"Chilled apple juice",                                                                                       badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-orange-juice",  name:"Orange Juice",             price:4.50,  desc:"Chilled orange juice",                                                                                      badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-pineapple-juice",name:"Pineapple Juice",         price:4.50,  desc:"Chilled pineapple juice",                                                                                   badge:null,              spiceProfile:"none",       veg:true  },
  { id:"item-mango-juice",   name:"Mango Juice",              price:4.50,  desc:"Chilled mango juice",                                                                                       badge:null,              spiceProfile:"none",       veg:true  },
];

export const ITEM_MAP = Object.fromEntries(MENU_ITEMS.map(i => [i.id, i]));

// ── Category/subsection structure — drives both the storefront's nav and
// the marketing site's menu page grouping. ──────────────────────────
export const SECTIONS = [
  { id:"appetizers", eyebrow:"To start",                 title:"Appetizers",         note:"",                                                                  subsections:[{ label:"Vegetarian", ids:["item-samosa","item-pakora","item-mixed-app","item-papad","item-masala-dosa","item-gobi-manchurian","item-ragada"] },{ label:"Non-Vegetarian", ids:["item-meat-samosa","item-seek-kabab","item-chicken-malai","item-shrimp-bagari","item-rani-offering","item-keema-dosa"] }] },
  { id:"soups",      eyebrow:"Light courses",            title:"Soups & Salads",     note:"",                                                                  subsections:[{ label:"", ids:["item-mulligatawny","item-tomato-soup","item-chicken-soup","item-salad"] }] },
  { id:"breads",     eyebrow:"From the oven",            title:"Breads",              note:"",                                                                  subsections:[{ label:"", ids:["item-naan","item-onion-naan","item-garlic-naan","item-rani-naan","item-peshwari","item-poori","item-chapathi","item-aloo-paratha","item-keema-paratha"] }] },
  { id:"medley",     eyebrow:"Chicken, lamb and shrimp", title:"Medley",              note:"A delicate combination of chicken, lamb and shrimp — served with basmati rice", subsections:[{ label:"", ids:["item-dhaba","item-sag-medley","item-masala-medley","item-vindaloo-medley","item-biriyani-medley","item-korma-medley","item-bhuna-medley","item-madras-medley"] }] },
  { id:"tandoori",   eyebrow:"Clay oven specialties",    title:"Tandoori",            note:"All entrees served with aromatic basmati rice",                    subsections:[{ label:"", ids:["item-tandoori-chicken","item-chicken-tikka","item-lamb-tikka","item-tandoori-fish","item-shrimp-tandoori","item-tandoori-medley","item-lobster","item-paneer-tikka"] }] },
  { id:"chicken",    eyebrow:"Entrees",                  title:"Chicken",             note:"All entrees served with aromatic basmati rice",                    subsections:[{ label:"", ids:["item-ctm","item-makhni","item-korma-c","item-sagwala","item-vindaloo-c","item-madras-c","item-jalfreazy-c","item-do-paiza-c","item-biriyani-c","item-bhuna-c","item-curry-c","item-kanda-curry-c"] }] },
  { id:"lamb",       eyebrow:"Entrees",                  title:"Lamb",                note:"All entrees served with aromatic basmati rice",                    subsections:[{ label:"", ids:["item-rogan","item-sag-l","item-korma-l","item-do-paiza-l","item-kadai","item-vindaloo-l","item-boti","item-phaal","item-biriyani-l","item-lamb-chops","item-lamb-madras","item-goat-curry"] }] },
  { id:"seafood",    eyebrow:"From the sea",             title:"Seafood",             note:"All entrees served with aromatic basmati rice",                    subsections:[{ label:"", ids:["item-shrimp-korma","item-tandoori-shrimp-masala","item-shrimp-bhuna","item-shrimp-manglorian","item-fish-curry","item-shrimp-sag","item-shrimp-vindaloo","item-shrimp-malai","item-shrimp-biriyani"] }] },
  { id:"vegetarian", eyebrow:"Entrees",                  title:"Vegetarian",          note:"All entrees served with aromatic basmati rice",                    subsections:[{ label:"", ids:["item-aloo-gobi","item-baingan","item-chana-masala","item-palak-paneer","item-malai-kofta","item-shahi-paneer","item-navaratan","item-dal-maharani","item-dal-tarka","item-veg-biriyani","item-chana-sag","item-sabji-lajawaab","item-broccoli-jalfreazy","item-sabji-masala","item-bhindi-mafaz","item-aloo-gobi-palak","item-rani-ki-avial","item-mushroom-masala","item-mutter-paneer"] }] },
  { id:"sides",      eyebrow:"On the side",              title:"Sides & Condiments",  note:"",                                                                  subsections:[{ label:"", ids:["item-mango-chutney","item-mixed-pickles","item-raita","item-rice","item-masala-sauce","item-hot-sauce"] }] },
  { id:"drinks",     eyebrow:"To drink",                 title:"Drinks",              note:"",                                                                  subsections:[{ label:"", ids:["item-mango-lassi","item-sweet-lassi","item-nemkin-lassi","item-nimbu-pani","item-root-beer","item-san-pellegrino","item-poland-spring","item-tea-coffee","item-ice-tea","item-coke","item-diet-coke","item-sprite","item-ginger-ale","item-club-soda","item-tonic","item-cranberry-juice","item-apple-juice","item-orange-juice","item-pineapple-juice","item-mango-juice"] }] },
];

// ── Catering packages (Catering.jsx) ────────────────────────────────
// Deliberately NOT added to any SECTIONS group — these must never appear
// in normal storefront browsing, only via the catering page's own "add to
// cart" buttons (?add=catering-essentials:18 style redirect into
// RaniMahal.jsx, same mechanism as any other item preload). Price is
// per-person; quantity IS the guest headcount, not a plate count — see
// MAX_CATERING_QTY_PER_LINE in create-checkout.js, which raises the normal
// 25-per-line abuse cap specifically for these ids so a real 100-guest
// wedding order isn't rejected as if it were 100 identical appetizers.
export const CATERING_ITEMS = [
  { id:"catering-essentials",       name:"Essentials Catering (per person)",                  price:19.99, desc:"Samosa/pakora, 2 mains (choice of chicken + Palak Paneer), dal, rice, garlic naan, raita. Minimum 15 guests.", badge:null, spiceProfile:"none", veg:false },
  { id:"catering-signature",        name:"Signature Catering — poultry & veg (per person)",   price:27.99, desc:"2 apps, 3 mains (no lamb/seafood), dal, rice, 2 naans, raita + chutney. Minimum 20 guests.",                 badge:null, spiceProfile:"none", veg:false },
  { id:"catering-signature-seafood",name:"Signature Catering — with seafood (per person)",    price:34.99, desc:"Same as Signature, one main swapped for a seafood dish. Minimum 20 guests.",                                  badge:null, spiceProfile:"none", veg:false },
  { id:"catering-signature-lamb",   name:"Signature Catering — with lamb (per person)",       price:39.99, desc:"Same as Signature, includes Lamb Rogan Josh. Minimum 20 guests.",                                             badge:null, spiceProfile:"none", veg:false },
  { id:"catering-feast",            name:"Rani Feast Catering — no lamb (per person)",        price:44.95, desc:"Tandoori starter, 4 mains incl. seafood, biryani, dal, 3 naans, raita, chutney, salad. Minimum 20 guests.",   badge:null, spiceProfile:"none", veg:false },
  { id:"catering-feast-lamb",       name:"Rani Feast Catering — with lamb (per person)",      price:49.95, desc:"Same as Rani Feast, includes Lamb Rogan Josh. Minimum 20 guests.",                                            badge:null, spiceProfile:"none", veg:false },
];

// { catering-item-id: minimum guest count } — enforced client-side in
// Catering.jsx before the "Add to Cart" button is even clickable. The
// site's order minimum (CATERING_ORDER_MINIMUM below) is derived FROM
// these numbers, not the other way around — Essentials' 15-guest minimum
// (15 x $19.99 = $299.85) IS the floor by construction, not a separate
// number that could drift from it.
export const CATERING_MINIMUMS = {
  "catering-essentials": 15,
  "catering-signature": 20,
  "catering-signature-seafood": 20,
  "catering-signature-lamb": 20,
  "catering-feast": 20,
  "catering-feast-lamb": 20,
};

export const CATERING_ITEM_IDS = new Set(CATERING_ITEMS.map(i => i.id));

// Presentation-layer grouping of CATERING_ITEMS into the 3 packages
// customers actually pick from — same relationship as MENU_ITEMS/SECTIONS
// above (flat pricing data + a separate grouping for display). Shared by
// Catering.jsx (this repo's own /order/catering page) and
// api/catering-packages.js (which the marketing site fetches, the same
// way it already fetches /api/menu instead of hand-copying items) — one
// definition, so a price/description change can never drift between the
// two surfaces. `photoId` picks one real menu-item photo (via
// /api/images/list-style KV lookups) to represent the package; `tiers`
// references CATERING_ITEMS ids for price/minimum, never repeats a number.
export const CATERING_PACKAGES = [
  {
    name: "Essentials",
    blurb: "Office lunches, small team meetings",
    items: ["Samosa or Vegetable Pakora", "Chicken Tikka Masala or Chicken Makhni + Palak Paneer", "Dal Maharani Makhni", "Basmati Rice", "Garlic Naan", "Raita"],
    photoId: "item-ctm",
    tierIds: ["catering-essentials"],
  },
  {
    name: "Signature",
    blurb: "Private parties, milestone celebrations, larger office events",
    items: ["Samosa + Chicken Malai Kabab", "3 mains, always including Palak Paneer", "Dal Maharani Makhni", "Basmati Rice", "Garlic + Onion Naan", "Raita + Mango Chutney"],
    photoId: "item-chicken-malai",
    tierIds: ["catering-signature", "catering-signature-seafood", "catering-signature-lamb"],
  },
  {
    name: "Rani Feast",
    blurb: "Weddings, large celebrations, the full tandoor experience",
    items: ["Tandoori Chicken or Chicken Tikka starter", "4 mains including a seafood option", "Chicken or Vegetable Biryani", "Dal Maharani Makhni", "Garlic, Onion + Peshwari Naan", "Raita, Mango Chutney + Chef's Special Salad"],
    photoId: "item-tandoori-chicken",
    tierIds: ["catering-feast", "catering-feast-lamb"],
  },
];

export const CATERING_TIER_LABELS = {
  "catering-essentials": null,
  "catering-signature": "Poultry & Veg",
  "catering-signature-seafood": "With Seafood",
  "catering-signature-lamb": "With Lamb",
  "catering-feast": "No Lamb",
  "catering-feast-lamb": "With Lamb",
};

// The order minimum isn't an arbitrary round number — it's exactly what
// the cheapest real package at its own minimum guest count costs. Computed
// here (not hardcoded on either consuming page) so it's identical on both
// Catering.jsx and the marketing site's /catering page by construction.
export const CATERING_ORDER_MINIMUM = Math.min(
  ...CATERING_PACKAGES.flatMap(p => p.tierIds.map(id => CATERING_BY_ID(id).price * CATERING_MINIMUMS[id]))
);

function CATERING_BY_ID(id) {
  return CATERING_ITEMS.find(i => i.id === id);
}

// Merged into ITEM_MAP (not just VALID_ITEMS) so RaniMahal.jsx's cart
// lookups and its `?add=` item-preload handler — both keyed off ITEM_MAP,
// not SECTIONS — recognize catering ids too. Safe to do: every ITEM_MAP
// consumer looks up a specific known id (a cart entry, or an id already
// listed in SECTIONS); nothing enumerates ITEM_MAP itself to build a
// browsable list, so this can't leak catering items into normal menu
// browsing the way adding them to SECTIONS would.
CATERING_ITEMS.forEach(i => { ITEM_MAP[i.id] = i; });

// ── Quick-add items (upsell chips) ─────────────────────────────────
export const QA = {
  "qa-garlic-naan":   { name:"Garlic Naan",          price:5.50, note:"Most popular — ordered at nearly every table", star:true },
  "qa-peshwari":      { name:"Peshwari Naan",         price:6.25, note:"Sweet & nutty — a natural contrast to spice" },
  "qa-onion-naan":    { name:"Onion Naan",            price:5.50, note:"Savoury and aromatic" },
  "qa-rani-naan":     { name:"Rani Ki Special Naan",  price:6.25, note:"Stuffed with chicken tikka — a house signature" },
  "qa-aloo-paratha":  { name:"Aloo Paratha",          price:7.25, note:"Hearty potato-stuffed flatbread" },
  "qa-plain-naan":    { name:"Plain Naan",            price:4.95, note:"Classic — perfect for scooping" },
  "qa-keema-paratha": { name:"Keema Paratha",         price:8.50, note:"Lamb-stuffed — echoes your dish" },
  "qa-raita":         { name:"Raita",                 price:4.50, note:"Chilled yogurt — the classic cool-down" },
  "qa-mango-chutney": { name:"Mango Chutney",         price:4.50, note:"Sweet and tangy — balances the heat" },
  "qa-mango-lassi":   { name:"Mango Lassi",           price:5.95, note:"Our most-ordered drink — guests love it", star:true },
  "qa-sweet-lassi":   { name:"Sweet Lassi",           price:5.95, note:"Refreshing yogurt drink" },
  "qa-nimbu-pani":    { name:"Nimbu Pani",            price:6.00, note:"Fresh lemon water — light and cleansing" },
  "qa-samosa":        { name:"Samosa",                price:7.95, note:"A great starter while your order fires" },
  "qa-pakora":        { name:"Pakora",                price:6.50, note:"Crispy vegetable fritters — a table favorite" },
};

// ── Combined lookup for server-side price/id validation ───────────
// Every id a cart line item can carry (baseId), mapped to its canonical
// name + price. create-checkout.js validates against this — never trusts
// a client-submitted price or name.
export const VALID_ITEMS = {
  ...Object.fromEntries(MENU_ITEMS.map(i => [i.id, { name:i.name, price:i.price }])),
  ...Object.fromEntries(Object.entries(QA).map(([id, i]) => [id, { name:i.name, price:i.price }])),
  ...Object.fromEntries(CATERING_ITEMS.map(i => [i.id, { name:i.name, price:i.price }])),
};

// Regular menu lines cap at 25 (see create-checkout.js's own MAX_QTY_PER_LINE
// — nobody legitimately orders 26+ of one appetizer, and that cap is a real
// anti-abuse fix). Catering quantity IS the guest headcount, not a plate
// count, so it needs real room — 500 comfortably covers even a large
// wedding while still bounding the number for sanity/overflow reasons.
const MAX_QTY_PER_LINE = 25;
const MAX_CATERING_QTY_PER_LINE = 500;

// Lightweight re-pricing for non-payment paths (e.g. draft-cart capture for
// abandoned-cart recovery) — validates baseId/qty and re-prices from
// VALID_ITEMS same as checkout, but doesn't touch the Stripe/checkout
// pipeline itself. Returns null items are dropped rather than erroring,
// since a draft is best-effort messaging data, not a charge.
export function priceCartItems(items) {
  const validated = [];
  for (const raw of Array.isArray(items) ? items : []) {
    const canonical = VALID_ITEMS[raw?.baseId];
    if (!canonical) continue;
    const qty = Number.isInteger(raw.qty) ? raw.qty : Math.round(Number(raw.qty));
    const maxQty = CATERING_ITEM_IDS.has(raw?.baseId) ? MAX_CATERING_QTY_PER_LINE : MAX_QTY_PER_LINE;
    if (!Number.isFinite(qty) || qty < 1 || qty > maxQty) continue;
    validated.push({ baseId: raw.baseId, name: canonical.name, price: canonical.price, qty });
  }
  const subtotal = validated.reduce((s, i) => s + i.price * i.qty, 0);
  return { items: validated, subtotal: parseFloat(subtotal.toFixed(2)) };
}

export const INIT_PRODUCTS = [
  { id: '1', name: 'Glitter Paint Set', price: 14.99, emoji: '🎨', desc: '12 vibrant colors', cat: 'Arts & Crafts', stock: 15, minStock: 3, sku: 'TOY-001', sales: 24, active: true, worldId: 'jungle' },
  { id: '2', name: 'Dino Figure Pack',  price: 9.99,  emoji: '🦕', desc: '6 detailed dinos',   cat: 'Figures',       stock: 2,  minStock: 5, sku: 'TOY-002', sales: 41, active: true, worldId: 'jungle' },
  { id: '3', name: 'Marble Run Kit',    price: 24.99, emoji: '🔮', desc: '48 pieces',           cat: 'Building',      stock: 8,  minStock: 3, sku: 'TOY-003', sales: 17, active: true, worldId: 'jungle' },
  { id: '4', name: 'Stamp Set',         price: 12.99, emoji: '🌟', desc: '20 stamps',           cat: 'Arts & Crafts', stock: 20, minStock: 4, sku: 'TOY-004', sales: 12, active: true, worldId: 'planet' },
  { id: '5', name: 'Space Puzzle',      price: 17.99, emoji: '🚀', desc: '500 pieces',          cat: 'Puzzles',       stock: 4,  minStock: 5, sku: 'TOY-005', sales: 9,  active: true, worldId: 'planet' },
  { id: '6', name: 'Clay Studio',       price: 19.99, emoji: '🏺', desc: 'Rainbow clay set',   cat: 'Arts & Crafts', stock: 11, minStock: 3, sku: 'TOY-006', sales: 19, active: true, worldId: 'artist' },
  { id: '7', name: 'Sticker Book',      price: 6.99,  emoji: '🌈', desc: '500 stickers',        cat: 'Arts & Crafts', stock: 3,  minStock: 5, sku: 'TOY-007', sales: 33, active: true, worldId: 'artist' },
  { id: '8', name: 'Robot Kit',         price: 29.99, emoji: '🤖', desc: 'Build your bot',      cat: 'Building',      stock: 6,  minStock: 3, sku: 'TOY-008', sales: 28, active: true, worldId: 'jungle' },
];

export const INIT_CATEGORIES = [
  { id: 'c1', name: 'Arts & Crafts', emoji: '🎨' },
  { id: 'c2', name: 'Figures',       emoji: '🦕' },
  { id: 'c3', name: 'Building',      emoji: '🔧' },
  { id: 'c4', name: 'Puzzles',       emoji: '🧩' },
];

export const INIT_ORDERS = [
  { id: 'ORD-001', customer: 'Anna M.', items: [{ name: 'Dino Figure Pack', qty: 2, price: 9.99 }, { name: 'Stamp Set', qty: 1, price: 12.99 }], total: 32.97, status: 'delivered', date: '2026-04-28' },
  { id: 'ORD-002', customer: 'Tom K.',  items: [{ name: 'Robot Kit', qty: 1, price: 29.99 }], total: 29.99, status: 'shipped', date: '2026-04-28' },
  { id: 'ORD-003', customer: 'Lisa P.', items: [{ name: 'Sticker Book', qty: 1, price: 6.99 }, { name: 'Clay Studio', qty: 1, price: 19.99 }], total: 26.98, status: 'pending', date: '2026-04-27' },
  { id: 'ORD-004', customer: 'Max B.',  items: [{ name: 'Marble Run Kit', qty: 1, price: 24.99 }], total: 24.99, status: 'delivered', date: '2026-04-27' },
  { id: 'ORD-005', customer: 'Sara V.', items: [{ name: 'Space Puzzle', qty: 1, price: 17.99 }, { name: 'Glitter Paint Set', qty: 1, price: 14.99 }], total: 32.98, status: 'pending', date: '2026-04-26' },
];

export const makeZones = (products) => ({
  wall:    Array.from({ length: 21 }, (_, i) => ({ id: `w${i + 1}`, type: 'wall',    num: i + 1, productId: products[i % products.length]?.id || null })),
  pyramid: Array.from({ length: 7 },  (_, i) => ({ id: `p${i + 1}`, type: 'pyramid', num: i + 1, productId: products[i]?.id || null })),
  circle:  Array.from({ length: 3 },  (_, i) => ({ id: `c${i + 1}`, type: 'circle',  num: i + 1, productId: products[i]?.id || null })),
});

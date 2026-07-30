// Default shop catalog — overridden when WaWi syncs via productStore
export const ISLAND_PRODUCTS = [
  { id: '1', name: 'Glitter Paint Set', price: 14.99, emoji: '🎨', description: '12 colors', worldId: 'jungle' },
  { id: '2', name: 'Dino Figure Pack',  price: 9.99,  emoji: '🦕', description: '6 dinos', worldId: 'jungle' },
  { id: '3', name: 'Marble Run Kit',    price: 24.99, emoji: '🔮', description: '48 pieces', worldId: 'jungle' },
  { id: '4', name: 'Stamp Set',         price: 12.99, emoji: '🌟', description: '20 stamps', worldId: 'planet' },
  { id: '5', name: 'Space Puzzle',      price: 17.99, emoji: '🚀', description: '500 pieces', worldId: 'planet' },
  { id: '6', name: 'Clay Studio',       price: 19.99, emoji: '🏺', description: 'Rainbow clay', worldId: 'artist' },
  { id: '7', name: 'Sticker Book',      price: 6.99,  emoji: '🌈', description: '500 stickers', worldId: 'artist' },
  { id: '8', name: 'Robot Kit',         price: 29.99, emoji: '🤖', description: 'Build your bot', worldId: 'jungle' },
];

export const SPACE_PRODUCTS = [
  { id: 's1', name: 'Alien Slime Goo',     price: 8.99,  emoji: '👽', description: 'Glows in the dark', worldId: 'planet' },
  { id: 's2', name: 'Galaxy Marble Set',   price: 13.99, emoji: '🪐', description: '9 planet marbles', worldId: 'planet' },
  { id: 's3', name: 'Comet Catcher Net',   price: 11.49, emoji: '☄️', description: 'Catch falling stars', worldId: 'planet' },
  { id: 's4', name: 'UFO Flyer Toy',       price: 19.99, emoji: '🛸', description: 'Spins & lights up', worldId: 'planet' },
  { id: 's5', name: 'Astronaut Figure',    price: 15.99, emoji: '🧑‍🚀', description: 'Posable suit', worldId: 'planet' },
  { id: 's6', name: 'Meteor Shower Lamp',  price: 22.99, emoji: '🌠', description: 'Projects stars', worldId: 'planet' },
  { id: 's7', name: 'Black Hole Fidget',   price: 7.49,  emoji: '🌀', description: 'Spinning vortex toy', worldId: 'planet' },
  { id: 's8', name: 'Star Cluster Puzzle', price: 18.49, emoji: '✨', description: '750 piece galaxy', worldId: 'planet' },
];

export const UNDERWATER_PRODUCTS = [
  { id: 'u1', name: 'Bubble Blower Kit',   price: 9.99,  emoji: '🫧', description: 'Endless foam fun', worldId: 'underwater' },
  { id: 'u2', name: 'Coral Building Set',  price: 16.49, emoji: '🪸', description: 'Build a reef', worldId: 'underwater' },
  { id: 'u3', name: 'Submarine Toy',       price: 21.99, emoji: '🚤', description: 'Wind-up diver', worldId: 'underwater' },
  { id: 'u4', name: 'Seashell Stamp Pack', price: 8.49,  emoji: '🐚', description: '12 ocean stamps', worldId: 'underwater' },
  { id: 'u5', name: 'Mermaid Figure',      price: 14.99, emoji: '🧜‍♀️', description: 'Poseable fins', worldId: 'underwater' },
  { id: 'u6', name: 'Treasure Chest Bank', price: 18.99, emoji: '🏴‍☠️', description: 'Coins go splash', worldId: 'underwater' },
  { id: 'u7', name: 'Jellyfish Lamp',      price: 24.99, emoji: '🎐', description: 'Soft glow nightlight', worldId: 'underwater' },
  { id: 'u8', name: 'Ocean Puzzle',        price: 17.49, emoji: '🐠', description: '500 piece reef', worldId: 'underwater' },
];

export const QUICK_SHOP_PRODUCTS = [
  ...ISLAND_PRODUCTS.filter(p => p.worldId !== 'planet'),
  ...UNDERWATER_PRODUCTS,
];

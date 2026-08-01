import { ISLAND_PRODUCTS, SPACE_PRODUCTS, UNDERWATER_PRODUCTS } from './products';

export const SHOP_SYNC_KEY = 'islandstore_shop_sync';
export const WAWI_STATE_KEY = 'islandstore_wawi_state';
export const SYNC_EVENT = 'islandstore-sync';

const FALLBACK_ISLAND = ISLAND_PRODUCTS;
const FALLBACK_SPACE = SPACE_PRODUCTS;
const FALLBACK_UNDERWATER = UNDERWATER_PRODUCTS;

export function wawiToShopProduct(p) {
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    emoji: p.emoji,
    description: p.desc || p.description || '',
    worldId: p.worldId,
    active: p.active !== false,
  };
}

function buildZoneMap(zones) {
  if (!zones) return null;
  const map = {};
  [...(zones.wall || []), ...(zones.pyramid || []), ...(zones.circle || [])].forEach(z => {
    if (z.productId) map[z.id] = { type: z.type, num: z.num, productId: z.productId };
  });
  return Object.keys(map).length ? map : null;
}

export function buildCatalogFromWaWi(wawiProducts, zones) {
  const active = wawiProducts.filter(p => p.active !== false);
  const shopProducts = active.map(wawiToShopProduct);
  const spaceProducts = shopProducts.filter(p => p.worldId === 'planet');
  const underwaterProducts = shopProducts.filter(p => p.worldId === 'underwater');
  const islandProducts = shopProducts.filter(p => p.worldId !== 'planet' && p.worldId !== 'underwater');

  return {
    islandProducts: islandProducts.length ? islandProducts : FALLBACK_ISLAND,
    spaceProducts: spaceProducts.length ? spaceProducts : FALLBACK_SPACE,
    underwaterProducts: underwaterProducts.length ? underwaterProducts : FALLBACK_UNDERWATER,
    quickShopProducts: shopProducts.length ? shopProducts : [...FALLBACK_ISLAND, ...FALLBACK_UNDERWATER],
    zoneAssignments: buildZoneMap(zones),
    syncedAt: new Date().toISOString(),
  };
}

export function getDefaultCatalog() {
  return {
    islandProducts: FALLBACK_ISLAND,
    spaceProducts: FALLBACK_SPACE,
    underwaterProducts: FALLBACK_UNDERWATER,
    quickShopProducts: [...FALLBACK_ISLAND, ...FALLBACK_UNDERWATER],
    zoneAssignments: null,
    syncedAt: null,
  };
}

export function loadShopCatalog() {
  try {
    const raw = localStorage.getItem(SHOP_SYNC_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* use defaults */ }
  return null;
}

export function resolveShopCatalog() {
  const loaded = loadShopCatalog();
  if (!loaded) return getDefaultCatalog();
  // Older sync payloads may lack underwater — fill from fallbacks
  return {
    ...getDefaultCatalog(),
    ...loaded,
    underwaterProducts: (loaded.underwaterProducts && loaded.underwaterProducts.length)
      ? loaded.underwaterProducts
      : FALLBACK_UNDERWATER,
  };
}

export function syncWaWiToShop(wawiProducts, zones) {
  const catalog = buildCatalogFromWaWi(wawiProducts, zones);
  localStorage.setItem(SHOP_SYNC_KEY, JSON.stringify(catalog));
  window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: catalog }));
  return catalog;
}

export function loadWaWiState() {
  try {
    const raw = localStorage.getItem(WAWI_STATE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* use defaults */ }
  return null;
}

export function saveWaWiState(state) {
  localStorage.setItem(WAWI_STATE_KEY, JSON.stringify(state));
}

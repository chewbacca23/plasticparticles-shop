import { ISLAND_PRODUCTS, SPACE_PRODUCTS } from './products';

export const SHOP_SYNC_KEY = 'islandstore_shop_sync';
export const WAWI_STATE_KEY = 'islandstore_wawi_state';
export const SYNC_EVENT = 'islandstore-sync';

const FALLBACK_ISLAND = ISLAND_PRODUCTS;
const FALLBACK_SPACE = SPACE_PRODUCTS;

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
  const islandProducts = shopProducts.filter(p => p.worldId !== 'planet');
  const spaceProducts = shopProducts.filter(p => p.worldId === 'planet');

  return {
    islandProducts: islandProducts.length ? islandProducts : FALLBACK_ISLAND,
    spaceProducts: spaceProducts.length ? spaceProducts : FALLBACK_SPACE,
    quickShopProducts: shopProducts.length ? shopProducts : FALLBACK_ISLAND,
    zoneAssignments: buildZoneMap(zones),
    syncedAt: new Date().toISOString(),
  };
}

export function getDefaultCatalog() {
  return {
    islandProducts: FALLBACK_ISLAND,
    spaceProducts: FALLBACK_SPACE,
    quickShopProducts: FALLBACK_ISLAND,
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
  return loadShopCatalog() || getDefaultCatalog();
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

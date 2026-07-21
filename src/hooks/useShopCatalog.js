import { useCallback, useEffect, useState } from 'react';
import { SYNC_EVENT, resolveShopCatalog } from '../data/productStore';

export function useShopCatalog() {
  const [catalog, setCatalog] = useState(resolveShopCatalog);

  const refresh = useCallback(() => {
    setCatalog(resolveShopCatalog());
  }, []);

  useEffect(() => {
    const onSync = (e) => setCatalog(e.detail || resolveShopCatalog());
    const onStorage = (e) => {
      if (e.key === 'islandstore_shop_sync') refresh();
    };
    window.addEventListener(SYNC_EVENT, onSync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SYNC_EVENT, onSync);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);

  return {
    catalog,
    islandProducts: catalog.islandProducts,
    spaceProducts: catalog.spaceProducts,
    quickShopProducts: catalog.quickShopProducts,
    zoneAssignments: catalog.zoneAssignments,
    syncedAt: catalog.syncedAt,
    refresh,
  };
}

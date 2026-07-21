import React, { useState } from 'react';
import { useShopCatalog } from '../hooks/useShopCatalog';
import '../shop/loadPressStartFont';
import LandingScreen from '../shop/LandingScreen';
import QuickShop from '../shop/QuickShop';
import CharacterSelect from '../shop/CharacterSelect';
import GameView from '../shop/GameView';

export default function Shop() {
  const { islandProducts, spaceProducts, quickShopProducts, syncedAt } = useShopCatalog();
  const [mode, setMode] = useState(null);
  const [character, setCharacter] = useState(null);

  if (!mode) {
    return (
      <>
        {syncedAt && (
          <div style={{ position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)', background: '#1D9E75', color: '#000', fontSize: '0.7rem', padding: '4px 12px', borderRadius: 20, zIndex: 999, fontFamily: 'system-ui,sans-serif' }}>
            ✓ Synced from WaWi · {new Date(syncedAt).toLocaleString()}
          </div>
        )}
        <LandingScreen onGame={() => setMode('game')} onShop={() => setMode('shop')} />
      </>
    );
  }

  if (mode === 'shop') {
    return <QuickShop products={quickShopProducts} onBack={() => setMode(null)} />;
  }

  if (!character) {
    return <CharacterSelect onSelect={setCharacter} onBack={() => setMode(null)} />;
  }

  return (
    <GameView
      character={character}
      islandProducts={islandProducts}
      spaceProducts={spaceProducts}
      onSwitchCharacter={() => setCharacter(null)}
    />
  );
}

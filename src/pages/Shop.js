import React, { useState } from 'react';
import { useShopCatalog } from '../hooks/useShopCatalog';
import '../shop/loadPressStartFont';
import LandingScreen from '../shop/LandingScreen';
import QuickShop from '../shop/QuickShop';
import CharacterSelect from '../shop/CharacterSelect';
import GameView from '../shop/GameView';
import { saveCharacter } from '../shop/characterStore';

export default function Shop() {
  const { islandProducts, spaceProducts, underwaterProducts, quickShopProducts, syncedAt } = useShopCatalog();
  const [mode, setMode] = useState(null);
  // `character` holds the full personalization: { id, name, color, hat }.
  const [character, setCharacter] = useState(null);

  const chooseCharacter = (choice) => setCharacter(saveCharacter(choice));

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
    return <CharacterSelect onSelect={chooseCharacter} onBack={() => setMode(null)} />;
  }

  return (
    <GameView
      character={character.id}
      customization={character}
      islandProducts={islandProducts}
      spaceProducts={spaceProducts}
      underwaterProducts={underwaterProducts}
      onSwitchCharacter={() => setCharacter(null)}
    />
  );
}

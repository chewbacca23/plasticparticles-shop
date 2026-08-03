import React, { useState } from 'react';
import { useShopCatalog } from '../hooks/useShopCatalog';
import '../shop/loadPressStartFont';
import LandingScreen from '../shop/LandingScreen';
import QuickShop from '../shop/QuickShop';
import CharacterSelect from '../shop/CharacterSelect';
import GameView from '../shop/GameView';
import { saveCharacter } from '../shop/characterStore';
import { isWorldUnlocked, loadVisitedWorlds } from '../shop/worldUnlockStore';

export default function Shop() {
  const { islandProducts, spaceProducts, underwaterProducts, quickShopProducts, syncedAt } = useShopCatalog();
  const [mode, setMode] = useState(null);
  // `character` holds the full personalization: { id, name, color, hat }.
  const [character, setCharacter] = useState(null);
  const [startWorld, setStartWorld] = useState('island');
  const [visitedWorlds, setVisitedWorlds] = useState(loadVisitedWorlds);

  const chooseCharacter = (choice) => setCharacter(saveCharacter(choice));

  const startAdventure = (world = 'island') => {
    const wanted = world === 'space' || world === 'underwater' ? world : 'island';
    // Only warp to worlds you've already reached the long way
    setStartWorld(isWorldUnlocked(visitedWorlds, wanted) ? wanted : 'island');
    setMode('game');
  };

  if (!mode) {
    return (
      <>
        {syncedAt && (
          <div style={{ position: 'fixed', top: 8, left: '50%', transform: 'translateX(-50%)', background: '#1D9E75', color: '#000', fontSize: '0.7rem', padding: '4px 12px', borderRadius: 20, zIndex: 999, fontFamily: 'system-ui,sans-serif' }}>
            ✓ Synced from WaWi · {new Date(syncedAt).toLocaleString()}
          </div>
        )}
        <LandingScreen
          onGame={startAdventure}
          onShop={() => setMode('shop')}
          visitedWorlds={visitedWorlds}
        />
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
      startWorld={startWorld}
      visitedWorlds={visitedWorlds}
      onWorldVisit={setVisitedWorlds}
      onSwitchCharacter={() => setCharacter(null)}
    />
  );
}

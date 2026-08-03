import React, { useState } from 'react';

const WORLDS = [
  { id: 'island',     emoji: '🌴', label: 'ISLAND',     col: '#1D9E75' },
  { id: 'space',      emoji: '🌕', label: 'LUNAR',      col: '#9A9AAA' },
  { id: 'underwater', emoji: '🫧', label: 'UNDERWATER', col: '#0B6E99' },
];

export default function LandingScreen({ onGame, onShop }) {
  const [hovered, setHovered] = useState(null);
  const [warpHov, setWarpHov] = useState(null);

  return (
    <div style={{
      width: '100%', minHeight: '100vh', background: '#0a0a0f',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Press Start 2P',monospace",
      padding: '2rem', boxSizing: 'border-box', position: 'relative', overflow: 'hidden',
    }}>
      <style>{`
        @keyframes floatDot{from{transform:translateY(0)}to{transform:translateY(-14px)}}
        @keyframes titlePulse{from{text-shadow:0 0 20px #FFD700aa}to{text-shadow:0 0 50px #FFD700ff,0 0 100px #FFD70066}}
        @keyframes cardFloat{from{transform:translateY(0) scale(1.04)}to{transform:translateY(-10px) scale(1.04)}}
      `}</style>

      {[...Array(22)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute', width: 3 + (i % 5) * 2, height: 3 + (i % 5) * 2, borderRadius: '50%',
          background: i % 3 === 0 ? '#7F77DD22' : i % 3 === 1 ? '#FF6EB422' : '#FFD70022',
          left: `${(i * 41 + 7) % 100}%`, top: `${(i * 57 + 3) % 100}%`,
          animation: `floatDot ${2 + (i % 4)}s ease-in-out ${i * 0.25}s infinite alternate`,
        }} />
      ))}

      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <div style={{ fontSize: '0.5rem', letterSpacing: '0.3em', color: '#7F77DD', marginBottom: '1rem', textTransform: 'uppercase' }}>
          🌴 Island Store
        </div>
        <div style={{ fontSize: 'clamp(1rem,3vw,1.4rem)', color: '#FFD700', animation: 'titlePulse 2s ease-in-out infinite alternate', lineHeight: 1.6, letterSpacing: '0.05em' }}>
          CHOOSE YOUR PATH
        </div>
        <div style={{ color: '#555', marginTop: '1rem', fontSize: '0.5rem', letterSpacing: '0.1em' }}>
          HOW DO YOU WANT TO SHOP TODAY?
        </div>
      </div>

      <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          { id: 'game', emoji: '🎮', suit: 'ADVENTURE MODE', name: 'Play the Game', desc: 'Explore the island as Milo or Cat. Hit boxes to discover products. Old school fun!', btn: 'START GAME', btnHov: '▶ LETS PLAY!', col: '#7F77DD' },
          { id: 'shop', emoji: '🛍️', suit: 'QUICK SHOP MODE', name: 'Browse & Buy', desc: "No time for games? No problem. Browse all products at a glance. Fast & easy checkout!", btn: 'QUICK SHOP', btnHov: '▶ SHOW ME!', col: '#1D9E75' },
        ].map(card => {
          const isHov = hovered === card.id;
          return (
            <div key={card.id}
              onMouseEnter={() => setHovered(card.id)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => card.id === 'game' ? onGame('island') : onShop()}
              style={{
                cursor: 'pointer', width: 220,
                background: isHov ? `linear-gradient(145deg,${card.col}22,${card.col}44)` : 'rgba(255,255,255,0.03)',
                border: `3px solid ${isHov ? card.col : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 4, padding: '2rem 1.5rem', textAlign: 'center',
                transition: 'all 0.2s',
                animation: isHov ? 'cardFloat 1s ease-in-out infinite alternate' : 'none',
                boxShadow: isHov ? `0 0 30px ${card.col}66` : 'none',
              }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem', filter: isHov ? `drop-shadow(0 0 10px ${card.col})` : 'none', transition: 'filter 0.2s' }}>{card.emoji}</div>
              <div style={{ display: 'inline-block', background: card.col, color: '#000', fontSize: '0.45rem', fontWeight: 'bold', letterSpacing: '0.1em', padding: '4px 10px', marginBottom: '0.75rem' }}>{card.suit}</div>
              <div style={{ color: '#fff', margin: '0.75rem 0 0.5rem', fontSize: '0.9rem' }}>{card.name}</div>
              <div style={{ color: '#888', fontSize: '0.45rem', lineHeight: 1.8, marginBottom: '1.5rem' }}>{card.desc}</div>
              <div style={{ padding: '0.6rem 1rem', background: isHov ? card.col : 'transparent', border: `2px solid ${card.col}`, color: isHov ? '#000' : card.col, fontSize: '0.45rem', letterSpacing: '0.1em', transition: 'all 0.2s' }}>
                {isHov ? card.btnHov : card.btn}
              </div>
            </div>
          );
        })}
      </div>

      {/* Instant warp — skip the long walk / cloud flight */}
      <div style={{ marginTop: '2.75rem', textAlign: 'center', zIndex: 1 }}>
        <div style={{ fontSize: '0.4rem', letterSpacing: '0.2em', color: '#666', marginBottom: '0.9rem' }}>
          ⚡ WARP STRAIGHT TO A WORLD
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {WORLDS.map(w => {
            const hot = warpHov === w.id;
            return (
              <button
                key={w.id}
                type="button"
                onMouseEnter={() => setWarpHov(w.id)}
                onMouseLeave={() => setWarpHov(null)}
                onClick={() => onGame(w.id)}
                style={{
                  cursor: 'pointer', fontFamily: 'inherit',
                  padding: '0.85rem 1.1rem', minWidth: 120,
                  background: hot ? `${w.col}33` : 'rgba(255,255,255,0.03)',
                  border: `2px solid ${hot ? w.col : '#333'}`,
                  color: hot ? '#fff' : '#bbb',
                  boxShadow: hot ? `0 0 18px ${w.col}55` : 'none',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ fontSize: '1.4rem', marginBottom: 6 }}>{w.emoji}</div>
                <div style={{ fontSize: '0.45rem', letterSpacing: '0.12em', color: w.col }}>{w.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ color: '#333', fontSize: '0.35rem', marginTop: '3rem', letterSpacing: '0.15em' }}>
        🌴 ISLAND STORE — TOYS WITH A TROPICAL TWIST
      </div>
    </div>
  );
}

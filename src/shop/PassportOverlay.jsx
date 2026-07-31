import React, { useState } from 'react';
import { countDiscovered, isDiscovered, isRewardUnlocked, REWARDS } from './passportStore';

const REWARD_BADGES = [
  { id: REWARDS.ISLAND_HAT,  emoji: '🎩', label: 'Top Hat' },
  { id: REWARDS.SPACE_TRACK, emoji: '🌟', label: 'Starlight Track' },
  { id: REWARDS.FINALE,      emoji: '🏆', label: 'Island Master' },
];

export default function PassportOverlay({ open, onClose, passport, worlds }) {
  const [page, setPage] = useState(0);
  if (!open) return null;

  const world = worlds[page] || worlds[0];
  const found = countDiscovered(passport, world?.products || []);
  const total = (world?.products || []).length;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.72)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      fontFamily: "'Press Start 2P', monospace",
    }}>
      <div style={{
        width: 'min(560px, 100%)', maxHeight: '90vh', overflow: 'auto',
        background: 'linear-gradient(160deg,#1a1638,#0a0a0f)',
        border: '4px solid #FFD700', borderRadius: 10, padding: 20, color: '#fff',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#FFD700' }}>📖 ISLAND PASSPORT</div>
          <button onClick={onClose} style={{
            background: 'transparent', border: '2px solid #555', color: '#aaa',
            padding: '6px 10px', fontFamily: 'inherit', fontSize: 8, cursor: 'pointer',
          }}>CLOSE</button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {worlds.map((w, i) => (
            <button key={w.id} onClick={() => setPage(i)} style={{
              padding: '8px 10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 7,
              background: page === i ? w.color : 'transparent',
              color: page === i ? '#000' : '#ccc',
              border: `2px solid ${w.color}`,
            }}>
              {w.emoji} {w.label}
            </button>
          ))}
        </div>

        {world && (
          <>
            <div style={{ fontSize: 8, color: world.color, marginBottom: 12, lineHeight: 1.8 }}>
              {world.emoji} {world.label.toUpperCase()} — {found}/{total} STAMPS
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
              gap: 10, marginBottom: 18,
            }}>
              {(world.products || []).map(p => {
                const stamped = isDiscovered(passport, p.id);
                return (
                  <div key={p.id} style={{
                    border: `2px solid ${stamped ? world.color : '#333'}`,
                    background: stamped ? `${world.color}22` : 'rgba(255,255,255,0.03)',
                    padding: 10, textAlign: 'center', minHeight: 84,
                    opacity: stamped ? 1 : 0.45,
                  }}>
                    <div style={{ fontSize: 22, filter: stamped ? 'none' : 'grayscale(1)' }}>
                      {stamped ? (p.emoji || '🎁') : '❔'}
                    </div>
                    <div style={{ fontSize: 6, marginTop: 8, lineHeight: 1.5, color: stamped ? '#fff' : '#666' }}>
                      {stamped ? p.name : '???'}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div style={{ borderTop: '2px solid #333', paddingTop: 14 }}>
          <div style={{ fontSize: 7, color: '#888', marginBottom: 10, letterSpacing: '0.1em' }}>REWARDS</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {REWARD_BADGES.map(r => {
              const unlocked = isRewardUnlocked(passport, r.id);
              return (
                <div key={r.id} style={{
                  padding: '8px 10px', border: `2px solid ${unlocked ? '#FFD700' : '#333'}`,
                  color: unlocked ? '#FFD700' : '#555', fontSize: 7, lineHeight: 1.6,
                }}>
                  {r.emoji} {r.label}{unlocked ? '' : ' (locked)'}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

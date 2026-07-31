import React, { useState } from 'react';
import { COLORS, HATS, loadCharacter } from './characterStore';
import { isRewardUnlocked, loadPassport, REWARDS } from './passportStore';

const CHARACTERS = [
  { id: 'milo', emoji: '🧑', label: 'MILO', defaultColor: '#7F77DD', defaultName: 'Milo' },
  { id: 'cat',  emoji: '🐱', label: 'CAT',  defaultColor: '#FF6EB4', defaultName: 'Cat' },
];

export default function CharacterSelect({ onSelect, onBack }) {
  const saved = loadCharacter();
  const passport = loadPassport();
  const tophatUnlocked = isRewardUnlocked(passport, REWARDS.ISLAND_HAT);

  const [id, setId] = useState(saved?.id || 'milo');
  const [name, setName] = useState(saved?.name || 'Milo');
  const [color, setColor] = useState(saved?.color || '#7F77DD');
  const [hat, setHat] = useState(saved?.hat || 'none');
  const [hov, setHov] = useState(null);

  const pickCharacter = (c) => {
    setId(c.id);
    setName(c.defaultName);
    setColor(c.defaultColor);
  };

  const availableHats = HATS.filter(h => !h.reward || tophatUnlocked || h.id === hat);

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0f', color: '#fff',
      fontFamily: "'Press Start 2P', monospace",
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', boxSizing: 'border-box',
    }}>
      <button onClick={onBack} style={{
        position: 'absolute', top: 16, left: 16, background: 'transparent',
        border: '2px solid #444', color: '#888', padding: '8px 14px',
        fontFamily: 'inherit', fontSize: 8, cursor: 'pointer',
      }}>← BACK</button>

      <div style={{ fontSize: 8, letterSpacing: '0.25em', color: '#7F77DD', marginBottom: 12 }}>WHO ARE YOU?</div>
      <div style={{ fontSize: 'clamp(0.9rem,2.5vw,1.2rem)', color: '#FFD700', marginBottom: 28, textAlign: 'center', lineHeight: 1.6 }}>
        PICK YOUR ADVENTURER
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 28 }}>
        {CHARACTERS.map(c => {
          const active = id === c.id;
          return (
            <button key={c.id} onClick={() => pickCharacter(c)}
              onMouseEnter={() => setHov(c.id)} onMouseLeave={() => setHov(null)}
              style={{
                width: 160, padding: '1.4rem 1rem', cursor: 'pointer',
                background: active || hov === c.id ? `${c.defaultColor}33` : 'rgba(255,255,255,0.03)',
                border: `3px solid ${active ? c.defaultColor : 'rgba(255,255,255,0.1)'}`,
                color: '#fff', fontFamily: 'inherit', borderRadius: 4,
                boxShadow: active ? `0 0 24px ${c.defaultColor}66` : 'none',
              }}>
              <div style={{ fontSize: 48, marginBottom: 10 }}>{c.emoji}</div>
              <div style={{ fontSize: 10, color: c.defaultColor }}>{c.label}</div>
            </button>
          );
        })}
      </div>

      <div style={{ width: 'min(420px, 100%)', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <label style={{ fontSize: 7, color: '#888', letterSpacing: '0.1em' }}>
          NAME
          <input
            value={name}
            maxLength={12}
            onChange={e => setName(e.target.value)}
            style={{
              display: 'block', width: '100%', marginTop: 8, boxSizing: 'border-box',
              background: '#14122e', border: '2px solid #26215C', color: '#FFD700',
              padding: '10px 12px', fontFamily: 'inherit', fontSize: 10, outline: 'none',
            }}
          />
        </label>

        <div style={{ fontSize: 7, color: '#888', letterSpacing: '0.1em' }}>COLOR</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} title={c}
              style={{
                width: 28, height: 28, borderRadius: 4, background: c, cursor: 'pointer',
                border: color === c ? '3px solid #FFD700' : '2px solid #333',
              }}
            />
          ))}
        </div>

        <div style={{ fontSize: 7, color: '#888', letterSpacing: '0.1em' }}>HAT</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {availableHats.map(h => (
            <button key={h.id} onClick={() => setHat(h.id)}
              style={{
                padding: '8px 10px', cursor: 'pointer', fontFamily: 'inherit', fontSize: 8,
                background: hat === h.id ? '#26215C' : 'transparent',
                border: `2px solid ${hat === h.id ? '#FFD700' : '#333'}`, color: '#fff',
              }}>
              {h.emoji} {h.label}
            </button>
          ))}
          {!tophatUnlocked && (
            <span style={{ fontSize: 7, color: '#555', alignSelf: 'center' }}>🎩 locked — find every island toy</span>
          )}
        </div>

        <button
          onClick={() => onSelect({ id, name: name.trim() || (id === 'cat' ? 'Cat' : 'Milo'), color, hat })}
          style={{
            marginTop: 12, padding: '14px 18px', cursor: 'pointer',
            background: color, color: '#000', border: '3px solid #26215C',
            fontFamily: 'inherit', fontSize: 10, letterSpacing: '0.1em',
          }}
        >
          ▶ ENTER THE ISLAND
        </button>
      </div>
    </div>
  );
}

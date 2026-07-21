import React, { useEffect, useRef, useState } from 'react';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { useCart } from '../context/CartContext';
import { PAYPAL_OPTIONS } from '../config/paypal';
import CartPanel from '../components/CartPanel';
import { TRACKS, startMusic, stopMusic } from './audio';
import { H } from './constants';
import { useGameLoop } from './useGameLoop';

export default function GameView({
  character,
  islandProducts,
  spaceProducts,
  onSwitchCharacter,
}) {
  const canvasRef = useRef(null);
  const keysRef = useRef({});
  const animRef = useRef(null);
  const springboardsRef = useRef([{ x: 1300, y: 762, w: 60, h: 18, bounced: false }]);
  const setPopupRef = useRef(null);
  const setWorldRef = useRef(null);
  const { addToCart, cartCount } = useCart();

  const [musicOn, setMusicOn] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState('island');
  const [score, setScore] = useState(0);
  const [popup, setPopup] = useState(null);
  const [popupPos] = useState({ left: '30%', top: '20%' });
  const [showCart, setShowCart] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [world, setWorld] = useState('island');

  const loading = islandProducts.length === 0;

  setPopupRef.current = setPopup;
  setWorldRef.current = setWorld;

  useEffect(() => {
    const trackId = world === 'space' ? 'space' : 'island';
    setSelectedTrack(trackId);
    if (musicOn) startMusic(trackId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  useEffect(() => () => stopMusic(), []);

  useGameLoop({
    canvasRef, keysRef, animRef, springboardsRef,
    setPopupRef, setWorldRef,
    character, loading, islandProducts, spaceProducts, showCart, setScore,
  });

  useEffect(() => {
    const onKey = (e) => {
      keysRef.current[e.key] = e.type === 'keydown';
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, []);

  const handleAddToCart = (product) => {
    addToCart(product);
    setScore(s => s + 50);
    setPopup(null);
  };

  const setKey = (key, val) => { keysRef.current[key] = val; };

  const toggleMusic = () => {
    if (!musicOn) { startMusic(selectedTrack); setMusicOn(true); }
    else { stopMusic(); setMusicOn(false); }
  };

  const handleTrackChange = (e) => {
    const t = e.target.value;
    setSelectedTrack(t);
    if (musicOn) startMusic(t);
  };

  const handleSwitchCharacter = () => {
    stopMusic();
    setMusicOn(false);
    onSwitchCharacter();
  };

  return (
    <PayPalScriptProvider options={PAYPAL_OPTIONS}>
      <div style={{ fontFamily: "'Press Start 2P',monospace", background: '#0a0a0f', minHeight: '100vh', padding: '1rem' }}>
        <div style={{ position: 'relative', width: '100%', overflow: 'hidden', border: '4px solid #26215C', borderRadius: 8 }}>
          {loading
            ? <div style={{ background: '#87CEEB', height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#26215C', fontSize: 12 }}>LOADING THE ISLAND...</div>
            : <canvas ref={canvasRef} width={1400} height={H} style={{ display: 'block', width: '100%', height: 'auto', imageRendering: 'pixelated' }} />
          }
          <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>
            <div style={{ background: 'rgba(0,0,0,0.6)', color: '#FFD700', padding: '6px 10px', fontSize: 8, border: '2px solid #26215C' }}>SCORE: {score}</div>
            <div style={{ display: 'flex', gap: '8px', pointerEvents: 'all' }}>
              <div style={{ background: character === 'cat' ? '#FF6EB4' : '#7F77DD', color: '#000', padding: '6px 10px', fontSize: 7, fontWeight: 'bold' }}>
                {character === 'cat' ? '🐱 CAT' : '🧑 MILO'}
              </div>
              <button onClick={toggleMusic} style={{ background: musicOn ? '#1D9E75' : 'rgba(0,0,0,0.6)', color: musicOn ? '#fff' : '#aaa', border: '2px solid #26215C', padding: '6px 10px', fontFamily: 'inherit', fontSize: 7, cursor: 'pointer' }}>
                {musicOn ? '🎵 ON' : '🔇 OFF'}
              </button>
              <select value={selectedTrack} onChange={handleTrackChange}
                style={{ background: 'rgba(0,0,0,0.7)', color: '#FFD700', border: '2px solid #26215C', padding: '6px 8px', fontFamily: 'inherit', fontSize: 7, cursor: 'pointer', outline: 'none' }}>
                {TRACKS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <button onClick={handleSwitchCharacter} style={{ background: 'rgba(0,0,0,0.6)', color: '#aaa', border: '2px solid #26215C', padding: '6px 10px', fontFamily: 'inherit', fontSize: 7, cursor: 'pointer' }}>
                ↩ SWITCH
              </button>
              <button onClick={() => setShowCart(true)} style={{ background: '#7F77DD', color: '#fff', border: '3px solid #26215C', padding: '6px 14px', fontFamily: 'inherit', fontSize: 8, cursor: 'pointer' }}>
                CART ({cartCount})
              </button>
            </div>
          </div>
          {popup && (
            <div style={{ position: 'absolute', left: popupPos.left, top: popupPos.top, background: '#fff', border: '4px solid #26215C', padding: 16, width: 230, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 4 }}>
              <div style={{ fontSize: 36, textAlign: 'center' }}>{popup.emoji || '🎁'}</div>
              <div style={{ fontSize: 8, color: '#26215C', lineHeight: 1.6 }}>{popup.name}</div>
              <div style={{ fontSize: 11, color: '#D85A30', fontWeight: 'bold' }}>€{Number(popup.price).toFixed(2)}</div>
              {popup.description && <div style={{ fontSize: 7, color: '#666', lineHeight: 1.6 }}>{popup.description}</div>}
              <button onClick={() => handleAddToCart(popup)} style={{ background: '#7F77DD', color: '#fff', border: '2px solid #26215C', padding: '8px 10px', fontFamily: 'inherit', fontSize: 8, cursor: 'pointer' }}>+ ADD TO CART</button>
              <button onClick={() => setPopup(null)} style={{ background: '#888', color: '#fff', border: '2px solid #444', padding: '6px 10px', fontFamily: 'inherit', fontSize: 8, cursor: 'pointer' }}>CLOSE</button>
            </div>
          )}
        </div>
        {showWelcome && (
          <div style={{ background: '#26215C', border: '3px solid #7F77DD', padding: '14px 20px', margin: '10px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderRadius: 4 }}>
            <span style={{ fontSize: 7, color: '#fff', lineHeight: 2 }}>WALK THROUGH THE ISLAND TO DISCOVER PRODUCTS — USE ARROW KEYS! 🟡 SPRINGBOARD = MEGA JUMP! WALK TO THE SIGN TO BLAST OFF TO SPACE WORLD! 🚀</span>
            <button onClick={() => setShowWelcome(false)} style={{ background: 'none', border: 'none', color: '#7F77DD', fontFamily: 'inherit', fontSize: 12, cursor: 'pointer', marginLeft: 16 }}>x</button>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '10px 0' }}>
          {[['<', 'ArrowLeft'], ['^', 'ArrowUp'], ['>', 'ArrowRight']].map(([label, key]) => (
            <button key={key}
              onTouchStart={e => { e.preventDefault(); setKey(key, true); }} onTouchEnd={() => setKey(key, false)}
              onMouseDown={() => setKey(key, true)} onMouseUp={() => setKey(key, false)}
              style={{ background: '#26215C', color: '#fff', border: '2px solid #7F77DD', width: 60, height: 60, fontSize: 20, cursor: 'pointer', borderRadius: 8, fontFamily: 'inherit' }}>
              {label}
            </button>
          ))}
        </div>
        <CartPanel open={showCart} onClose={() => setShowCart(false)} variant="pixel" closeLabel="KEEP PLAYING" />
      </div>
    </PayPalScriptProvider>
  );
}

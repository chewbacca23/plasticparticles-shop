import React, { useEffect, useRef, useState } from 'react';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { useCart } from '../context/CartContext';
import { PAYPAL_OPTIONS } from '../config/paypal';
import CartPanel from '../components/CartPanel';
import { TRACKS, startMusic, stopMusic, playUnlockSound, playPageFlipSound } from './audio';
import { H } from './constants';
import { useGameLoop } from './useGameLoop';
import PassportOverlay from './PassportOverlay';
import {
  loadPassport, savePassport, withDiscovery, withReward, withSeen, isDiscovered,
  isRewardUnlocked, countDiscovered, hasUnseenStamps, REWARDS,
} from './passportStore';
import { isWorldUnlocked, withWorldVisit } from './worldUnlockStore';

// Milestone reward copy shown in the celebratory toast.
const REWARD_TOASTS = {
  [REWARDS.ISLAND_HAT]:  { icon: '🎩', title: 'TOP HAT UNLOCKED!', msg: 'Wear it from the character select screen.' },
  [REWARDS.SPACE_TRACK]: { icon: '🌟', title: 'BONUS TRACK UNLOCKED!', msg: 'Pick "Starlight" from the music menu.' },
  [REWARDS.FINALE]:      { icon: '🏆', title: 'ISLAND MASTER! You found every toy!', msg: 'A rainbow finale aura now shines around you!' },
};

const PASSPORT_WORLDS = [
  { id: 'island',     label: 'Island',     emoji: '🌴', color: '#1D9E75' },
  { id: 'space',      label: 'Lunar',      emoji: '🌕', color: '#9A9AAA' },
  { id: 'underwater', label: 'Underwater', emoji: '🫧', color: '#0B6E99' },
];

export default function GameView({
  character,
  customization,
  islandProducts,
  spaceProducts,
  underwaterProducts = [],
  startWorld = 'island',
  visitedWorlds,
  onWorldVisit,
  onSwitchCharacter,
}) {
  const canvasRef = useRef(null);
  const keysRef = useRef({});
  const animRef = useRef(null);
  const springboardsRef = useRef([{ x: 1672, y: 962, w: 60, h: 18, bounced: false }]);
  const setPopupRef = useRef(null);
  const setWorldRef = useRef(null);
  const warpRef = useRef(null);
  const { cart, addToCart, cartCount } = useCart();

  // Live cart snapshot for the RAF game loop (avoids restarting the loop on every add)
  const cartRef = useRef(cart);
  cartRef.current = cart;

  // Live customization snapshot for the RAF loop (mirrors cartRef; no loop restart on change)
  const customizationRef = useRef(customization);
  customizationRef.current = customization;

  // ── Island Passport state ──────────────────────────────────────────────
  const [passport, setPassport] = useState(loadPassport);
  const [showPassport, setShowPassport] = useState(false);
  const [toast, setToast] = useState(null);

  // Refs bridging the RAF loop → React (mirrors setPopupRef/cartRef pattern).
  const recordDiscoveryRef = useRef(null);   // loop calls this when a popup reveals
  const pausedRef = useRef(false);            // freeze player movement behind overlays
  const celebrateRef = useRef({ pending: 0, finale: 0 }); // loop-drawn confetti requests
  const finaleRef = useRef(false);            // gates the grand-finale aura in the loop

  const worlds = PASSPORT_WORLDS.map(w => ({
    ...w,
    products: w.id === 'space' ? spaceProducts
      : w.id === 'underwater' ? underwaterProducts
      : islandProducts,
  }));
  const allProducts = [...islandProducts, ...spaceProducts, ...underwaterProducts];
  const overallFound = countDiscovered(passport, allProducts);
  const overallTotal = allProducts.length;

  // Feature 1: pulse the HUD badge when there are stamps the player hasn't
  // looked at in the book yet. Opening the book clears it (see openPassport).
  const hasUnseen = hasUnseenStamps(passport);

  // Feature 2: gate the in-canvas finale aura behind the fully-completed reward.
  finaleRef.current = isRewardUnlocked(passport, REWARDS.FINALE);

  // Open the book: play the page-flip SFX and clear the "NEW!" pulse watermark.
  const openPassport = () => {
    playPageFlipSound();
    setPassport(prev => {
      const next = withSeen(prev); // watermark = current total discovered
      savePassport(next);
      return next;
    });
    setShowPassport(true);
  };

  // Record a discovery (occasional event → safe to touch React state).
  // Detects world-completion milestones and grants persistent rewards.
  const handleDiscover = (product) => {
    if (!product || product.id == null) return;
    setPassport(prev => {
      if (isDiscovered(prev, product.id)) return prev; // already stamped → no churn
      let next = withDiscovery(prev, product.id);
      const unlocked = [];
      if (!isRewardUnlocked(next, REWARDS.ISLAND_HAT) && islandProducts.length &&
          countDiscovered(next, islandProducts) === islandProducts.length) {
        next = withReward(next, REWARDS.ISLAND_HAT);
        unlocked.push(REWARDS.ISLAND_HAT);
      }
      if (!isRewardUnlocked(next, REWARDS.SPACE_TRACK) && spaceProducts.length &&
          countDiscovered(next, spaceProducts) === spaceProducts.length) {
        next = withReward(next, REWARDS.SPACE_TRACK);
        unlocked.push(REWARDS.SPACE_TRACK);
      }
      // Grand finale: every toy across every world discovered.
      const allNow = [...islandProducts, ...spaceProducts, ...underwaterProducts];
      let finaleJustUnlocked = false;
      if (!isRewardUnlocked(next, REWARDS.FINALE) && allNow.length &&
          countDiscovered(next, allNow) === allNow.length) {
        next = withReward(next, REWARDS.FINALE);
        finaleJustUnlocked = true;
      }
      savePassport(next);
      if (finaleJustUnlocked) {
        // Bigger, longer celebration — supersedes the per-world toast/burst.
        playUnlockSound();
        if (celebrateRef.current) celebrateRef.current.finale += 1;
        setTimeout(() => setToast(REWARD_TOASTS[REWARDS.FINALE]), 0);
      } else if (unlocked.length) {
        playUnlockSound();
        if (celebrateRef.current) celebrateRef.current.pending += 1;
        const rewardId = unlocked[unlocked.length - 1];
        setTimeout(() => setToast(REWARD_TOASTS[rewardId]), 0);
      }
      return next;
    });
  };
  recordDiscoveryRef.current = handleDiscover;

  // Auto-dismiss the celebratory toast.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const availableTracks = TRACKS.filter(t => !t.locked || isRewardUnlocked(passport, t.reward));

  const charName = (customization && customization.name) || (character === 'cat' ? 'Cat' : 'Milo');
  const charColor = (customization && customization.color) || (character === 'cat' ? '#FF6EB4' : '#7F77DD');

  const [musicOn, setMusicOn] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState('island');
  const [score, setScore] = useState(0);
  const [popup, setPopup] = useState(null);
  const [popupPos] = useState({ left: '30%', top: '20%' });
  const [showCart, setShowCart] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [world, setWorld] = useState(() => {
    try {
      const boot = new URLSearchParams(window.location.search).get('world');
      if ((boot === 'underwater' || boot === 'space' || boot === 'island') && isWorldUnlocked(visitedWorlds, boot)) {
        return boot;
      }
    } catch { /* ignore */ }
    if ((startWorld === 'underwater' || startWorld === 'space') && isWorldUnlocked(visitedWorlds, startWorld)) {
      return startWorld;
    }
    return 'island';
  });

  const requestWarp = (to) => {
    if (!to || to === world) return;
    if (!isWorldUnlocked(visitedWorlds, to)) return;
    warpRef.current = to;
    setWorld(to);
  };

  const markWorldVisited = (worldId) => {
    const next = withWorldVisit(visitedWorlds, worldId);
    if (next !== visitedWorlds) onWorldVisit?.(next);
  };
  const visitWorldRef = useRef(markWorldVisited);
  visitWorldRef.current = markWorldVisited;
  const visitedRef = useRef(visitedWorlds);
  visitedRef.current = visitedWorlds;

  // Freeze player movement while the cart or passport overlay is open.
  pausedRef.current = showCart || showPassport;

  const loading = islandProducts.length === 0;

  setPopupRef.current = setPopup;
  setWorldRef.current = setWorld;

  useEffect(() => {
    const trackId = world === 'space' ? 'space' : world === 'underwater' ? 'underwater' : 'island';
    setSelectedTrack(trackId);
    if (musicOn) startMusic(trackId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  useEffect(() => () => stopMusic(), []);

  useGameLoop({
    canvasRef, keysRef, animRef, springboardsRef,
    setPopupRef, setWorldRef, cartRef, customizationRef,
    recordDiscoveryRef, pausedRef, celebrateRef, finaleRef, warpRef, visitWorldRef, visitedRef,
    character, loading, islandProducts, spaceProducts, underwaterProducts,
    showCart, setScore, startWorld,
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
        <style>{`
          @keyframes passportNewPulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.22); opacity: 0.72; }
          }
        `}</style>
        <div style={{ position: 'relative', width: '100%', overflow: 'hidden', border: '4px solid #26215C', borderRadius: 8 }}>
          {loading
            ? <div style={{ background: '#87CEEB', height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#26215C', fontSize: 12 }}>LOADING THE ISLAND...</div>
            : <canvas ref={canvasRef} width={1400} height={H} style={{ display: 'block', width: '100%', height: 'auto', imageRendering: 'pixelated' }} />
          }
          <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', pointerEvents: 'all' }}>
              <div style={{ background: 'rgba(0,0,0,0.6)', color: '#FFD700', padding: '6px 10px', fontSize: 8, border: '2px solid #26215C' }}>SCORE: {score}</div>
              {PASSPORT_WORLDS.map(w => {
                const unlocked = isWorldUnlocked(visitedWorlds, w.id);
                return (
                  <button
                    key={w.id}
                    type="button"
                    disabled={!unlocked}
                    title={unlocked ? `Warp to ${w.label}` : `Reach ${w.label} first`}
                    onClick={() => requestWarp(w.id)}
                    style={{
                      background: world === w.id ? w.color : 'rgba(0,0,0,0.55)',
                      color: !unlocked ? '#555' : world === w.id ? '#000' : '#ddd',
                      border: `2px solid ${world === w.id ? '#FFD700' : '#26215C'}`,
                      padding: '5px 8px', fontFamily: 'inherit', fontSize: 7,
                      cursor: unlocked ? 'pointer' : 'not-allowed',
                      opacity: unlocked ? 1 : 0.45,
                    }}
                  >
                    {unlocked ? w.emoji : '🔒'} {w.label.toUpperCase()}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '8px', pointerEvents: 'all' }}>
              <div style={{ background: charColor, color: '#000', padding: '6px 10px', fontSize: 7, fontWeight: 'bold', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {character === 'cat' ? '🐱' : '🧑'} {charName.toUpperCase()}
              </div>
              <button onClick={toggleMusic} style={{ background: musicOn ? '#1D9E75' : 'rgba(0,0,0,0.6)', color: musicOn ? '#fff' : '#aaa', border: '2px solid #26215C', padding: '6px 10px', fontFamily: 'inherit', fontSize: 7, cursor: 'pointer' }}>
                {musicOn ? '🎵 ON' : '🔇 OFF'}
              </button>
              <select value={selectedTrack} onChange={handleTrackChange}
                style={{ background: 'rgba(0,0,0,0.7)', color: '#FFD700', border: '2px solid #26215C', padding: '6px 8px', fontFamily: 'inherit', fontSize: 7, cursor: 'pointer', outline: 'none' }}>
                {availableTracks.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <button onClick={handleSwitchCharacter} style={{ background: 'rgba(0,0,0,0.6)', color: '#aaa', border: '2px solid #26215C', padding: '6px 10px', fontFamily: 'inherit', fontSize: 7, cursor: 'pointer' }}>
                ↩ SWITCH
              </button>
              <button onClick={openPassport} title="Island Passport" style={{ position: 'relative', background: '#FFD700', color: '#000', border: '3px solid #26215C', padding: '6px 12px', fontFamily: 'inherit', fontSize: 8, cursor: 'pointer' }}>
                📖 {overallFound}/{overallTotal}
                {hasUnseen && (
                  <span style={{
                    position: 'absolute', top: -9, right: -9, background: '#D85A30', color: '#fff',
                    border: '2px solid #FFD700', borderRadius: 6, padding: '2px 4px', fontSize: 6,
                    lineHeight: 1, fontFamily: 'inherit', pointerEvents: 'none',
                    animation: 'passportNewPulse 1s ease-in-out infinite',
                    boxShadow: '0 0 8px rgba(216,90,48,0.9)',
                  }}>NEW!</span>
                )}
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
            <span style={{ fontSize: 7, color: '#fff', lineHeight: 2 }}>WALK THE ISLAND FOR TOYS — 🟡 SPRINGBOARD = MEGA JUMP! 🌕 LUNAR SIGN UP HIGH — 🫧 DIVE BUOY BY THE SHORE FOR UNDERWATER TOYS — SURFACE BACK TO THE ARTIST LOUNGE!</span>
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
        <PassportOverlay open={showPassport} onClose={() => setShowPassport(false)} passport={passport} worlds={worlds} />
        {toast && (
          <div style={{ position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 600, background: 'linear-gradient(160deg,#14122e,#0a0a0f)', border: '3px solid #FFD700', borderRadius: 10, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 0 30px #FFD70088', fontFamily: "'Press Start 2P',monospace", maxWidth: '90vw' }}>
            <div style={{ fontSize: 26 }}>{toast.icon}</div>
            <div style={{ lineHeight: 1.7 }}>
              <div style={{ fontSize: 9, color: '#FFD700' }}>{toast.title}</div>
              <div style={{ fontSize: 7, color: '#fff', marginTop: 5 }}>{toast.msg}</div>
            </div>
          </div>
        )}
      </div>
    </PayPalScriptProvider>
  );
}

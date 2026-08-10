import { useEffect } from 'react';
import milo1 from '../milo1.png';
import milo2 from '../milo2.png';
import milo3 from '../milo3.png';
import islandBg from '../Artboard_1.png';
import { seededColor, seededLightColor } from '../utils/colors';
import { playSpringSound, playCubeHitSound, playPickupSound } from './audio';
import {
  W, H, GRAVITY, JUMP, GROUND_Y, rectsOverlap, PZ, PYRAMID_PLATFORMS,
  SPACE_W_TOTAL, SPACE_ZONES, ASTEROID_PLATFORMS, GRAVITY_SPACE, JUMP_SPACE, LUNAR_Y,
  UNDERWATER_W_TOTAL, UNDERWATER_ZONES, CORAL_PLATFORMS, GRAVITY_WATER, JUMP_WATER,
  SEABED_Y, WATER_SPRINGBOARDS,
} from './constants';

export function useGameLoop({
  canvasRef, keysRef, animRef, springboardsRef,
  setPopupRef, setWorldRef, cartRef, customizationRef,
  recordDiscoveryRef, pausedRef, celebrateRef, finaleRef, warpRef, visitWorldRef, visitedRef,
  character, loading, islandProducts, spaceProducts, underwaterProducts = [],
  showCart, setScore, startWorld = 'island',
}) {
  useEffect(() => {
    if (!character || loading || islandProducts.length === 0) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const bg     = new Image(); bg.src = islandBg;
    const mf     = [new Image(), new Image(), new Image()];
    const miloSrcs = [milo1, milo2, milo3];
    miloSrcs.forEach((src, i) => {
      mf[i].src = src;
      mf[i].onerror = () => {
        // Retry once after a short delay (HMR can briefly 404 a module URL)
        setTimeout(() => { if (mf[i].naturalWidth === 0) mf[i].src = src + (src.includes('?') ? '&' : '?') + 'r=' + Date.now(); }, 120);
      };
    });
    const isCat = character === 'cat';
    const TILE  = 32;
    const ground = Array.from({length:200},(_,i)=>({x:i*TILE,y:GROUND_Y,w:TILE,h:30}));

    const zones = PZ.map((z,i) => ({
      ...z, product: islandProducts[i % islandProducts.length],
      triggered:false, glowTimer:0, active:false, hit:false, growing:0, bounceY:0,
    }));

    const player = {x:60, y:GROUND_Y-35, w:36, h:52, vx:0, vy:0, onGround:false, dir:1, frame:0, frameTimer:0, moving:false, airPeakY:GROUND_Y};
    // Sky parachute — deploys on high island falls (springboard / cloud drop)
    const parachute = { open: false, amount: 0 };
    const springboards = springboardsRef.current;
    const waterSprings = WATER_SPRINGBOARDS.map(s => ({ ...s, bounced: false }));

    let cameraX=0, targetCameraX=0, camWobbleX=0, camWobbleY=0;
    let wobbleTime=0, scoreLocal=0, lastTime=0, introTimer=0, introDone=false;
    let greetTimer=0;               // counts up once the intro finishes → greeting bubble
    const GREET_DUR=190;            // ~3.2s at 60fps

    let currentWorld = 'island';
    const ISLAND_WIDTH = 4500, SPACE_WIDTH = SPACE_W_TOTAL, WATER_WIDTH = UNDERWATER_W_TOTAL;
    const waterCatalog = (underwaterProducts && underwaterProducts.length) ? underwaterProducts : spaceProducts;

    const islandSign  = {x:4280, y:160, w:120, h:180, glow:0};
    // Portal sits on the uneven moon floor (y filled in after terrain helper exists)
    const spacePortal = {x:120,  y:0, w:60,  h:100, glow:0};
    // Dive buoy near the left shore — enter the underwater toy cove
    const divePortal  = {x:420,  y:GROUND_Y-110,  w:70,  h:90,  glow:0};
    // Surface portal back to the Artist Lounge (island hub)
    const loungePortal = {x:WATER_WIDTH-220, y:420, w:90, h:110, glow:0};

    const spaceZones = SPACE_ZONES.map((z,i) => ({
      ...z, product: spaceProducts[i % Math.max(spaceProducts.length,1)],
      hit:false, growing:0, bounceY:0, bumping:false,
    }));
    const waterZones = UNDERWATER_ZONES.map((z,i) => ({
      ...z, product: waterCatalog[i % Math.max(waterCatalog.length,1)],
      hit:false, growing:0, bounceY:0, bumping:false,
    }));
    const bubbles = Array.from({length:50}, () => ({
      x: Math.random()*WATER_WIDTH, y: Math.random()*H,
      r: 2+Math.random()*5, speed: 0.4+Math.random()*1.2, wobble: Math.random()*Math.PI*2,
    }));
    // Breath bubbles from Milo's mask/helmet in space & underwater
    const breathBubbles = [];
    let breathTimer = 0;

    const worldWidthOf = (w) => w==='space' ? SPACE_WIDTH : w==='underwater' ? WATER_WIDTH : ISLAND_WIDTH;

    // Deterministic 0..1 hash — keeps terrain stable across reloads
    const terrainHash = (n) => {
      const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return s - Math.floor(s);
    };
    const lunarHash = terrainHash;
    // Walkable asymmetric lunar surface (mild hills, uneven spans — not a flat line)
    const lunarTerrain = (() => {
      const pts = [];
      let x = -80;
      while (x < SPACE_WIDTH + 160) {
        const span = 50 + lunarHash(x * 0.11 + 0.4) * 145;
        const rise =
          (lunarHash(x * 0.061 + 2.1) - 0.32) * 68 +
          (lunarHash(x * 0.017 + 9.3) - 0.5) * 38 +
          (lunarHash(x * 0.004 + 1.7) - 0.5) * 48;
        const y = Math.max(LUNAR_Y - 100, Math.min(LUNAR_Y + 40, LUNAR_Y - rise));
        pts.push({ x, y });
        x += span;
      }
      return pts;
    })();
    const lunarSurfaceY = (wx) => {
      const pts = lunarTerrain;
      if (wx <= pts[0].x) return pts[0].y;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        if (wx <= b.x) {
          const t = (wx - a.x) / Math.max(1, b.x - a.x);
          const s = t * t * (3 - 2 * t);
          return a.y + (b.y - a.y) * s;
        }
      }
      return pts[pts.length - 1].y;
    };
    // Walkable uneven seabed — deliberately ASYMMETRIC ridges
    // (steep cliff one side, long gentle run-out the other — not mirrored dunes)
    const seabedTerrain = (() => {
      const pts = [];
      let x = -100;
      let i = 0;
      pts.push({ x, y: SEABED_Y + 40 });
      while (x < WATER_WIDTH + 200) {
        const h = terrainHash(i * 2.17 + 0.4);
        const h2 = terrainHash(i * 5.91 + 1.2);
        const h3 = terrainHash(i * 0.73 + 8.8);
        // Feature type: tall peak / low hump / shelf / hole
        let peakY;
        if (h < 0.2) peakY = 510 + h2 * 50;          // tall ridge
        else if (h < 0.45) peakY = 620 + h2 * 70;     // medium dune
        else if (h < 0.65) peakY = 740 + h2 * 40;     // low shelf
        else if (h < 0.82) peakY = 880 + h2 * 50;     // shallow dip
        else peakY = 920 + h2 * 30;                   // deep trough floor

        // KEY: left flank width ≠ right flank width (often wildly)
        const steepLeft = h3 < 0.55;
        const steepW = 28 + h2 * 55;                  // short cliff face
        const gentleW = 120 + h * 260;                // long run-out
        const leftW = steepLeft ? steepW : gentleW;
        const rightW = steepLeft ? gentleW : steepW;

        const approachY = Math.min(950, Math.max(peakY + 40, 780 + h2 * 140));
        x += 20 + h * 50;
        pts.push({ x, y: approachY });

        x += leftW;
        pts.push({ x, y: peakY });

        const exitY = Math.min(950, Math.max(peakY + 30, 800 + h3 * 140));
        x += rightW;
        pts.push({ x, y: exitY });

        // Occasional flat ledge before next feature (breaks rhythm)
        if (h2 > 0.6) {
          x += 40 + h3 * 90;
          pts.push({ x, y: exitY + (h - 0.5) * 20 });
        }
        i += 1;
      }
      return pts;
    })();
    const seabedSurfaceY = (wx) => {
      const pts = seabedTerrain;
      if (wx <= pts[0].x) return pts[0].y;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        if (wx <= b.x) {
          const t = (wx - a.x) / Math.max(1, b.x - a.x);
          // Cliffs stay linear (sharp); gentle flanks use smoothstep
          const steep = Math.abs(b.y - a.y) / Math.max(1, b.x - a.x) > 0.65;
          const s = steep ? t : t * t * (3 - 2 * t);
          return a.y + (b.y - a.y) * s;
        }
      }
      return pts[pts.length - 1].y;
    };
    const spawnYOf = (w, x = 250) => {
      if (w === 'space') return lunarSurfaceY(x) - 52;
      if (w === 'underwater') return seabedSurfaceY(x) - 52;
      return GROUND_Y - 35;
    };

    // Boot world from prop or ?world= — only if already unlocked by prior visits
    try {
      const visitedNow = () => (visitedRef && visitedRef.current) || { island: true };
      const unlocked = (id) => id === 'island' || !!visitedNow()[id];
      const bootQ = new URLSearchParams(window.location.search).get('world');
      const boot = (bootQ === 'underwater' || bootQ === 'space' || bootQ === 'island')
        ? bootQ
        : (startWorld === 'underwater' || startWorld === 'space' || startWorld === 'island')
          ? startWorld
          : 'island';
      if (boot !== 'island' && unlocked(boot)) {
        currentWorld = boot;
        introDone = true;
        introTimer = 999;
        player.x = 280;
        player.y = spawnYOf(boot, 280);
        player.airPeakY = player.y;
        cameraX = Math.max(0, player.x - W * 0.35);
        targetCameraX = cameraX;
        setWorldRef.current?.(boot);
      }
    } catch { /* ignore */ }

    function warpTo(to) {
      if (!to || to === currentWorld) return;
      const visitedNow = (visitedRef && visitedRef.current) || { island: true };
      if (to !== 'island' && !visitedNow[to]) return;
      currentWorld = to;
      introDone = true;
      introTimer = 999;
      transition = null;
      player.x = to === 'island' ? 560 : 280;
      player.y = spawnYOf(to, player.x);
      player.vx = 0; player.vy = 0;
      player.airPeakY = player.y;
      player.onGround = true;
      parachute.open = false; parachute.amount = 0;
      cameraX = Math.max(0, player.x - W * 0.35);
      targetCameraX = cameraX;
      setWorldRef.current?.(to);
    }

    // Sparse reef plantlife — short tufts so dune silhouette stays obvious
    const seaPlants = Array.from({ length: 70 }, (_, i) => {
      const kind = i % 5; // 0-1 kelp, 2-3 grass, 4 fan
      const x = 40 + (i * 97 + (i % 7) * 31) % (WATER_WIDTH - 80);
      return {
        kind,
        x,
        yOff: kind === 4 ? (i % 3) * 6 : (i % 4) * 3,
        h: kind < 2 ? 48 + (i % 5) * 12 : kind < 4 ? 22 + (i % 4) * 8 : 32 + (i % 3) * 10,
        sway: 0.35 + (i % 8) * 0.1,
        phase: i * 0.37,
        hue: kind < 2 ? 140 + (i % 6) * 7 : kind < 4 ? 90 + (i % 7) * 9 : 320 + (i % 5) * 12,
      };
    });
    // Reef critters — fish, seabed crabs, occasional jellyfish (decorative)
    const seaFish = Array.from({ length: 28 }, (_, i) => ({
      x: (i * 127 + 40) % WATER_WIDTH,
      y: 180 + (i % 7) * 85 + (i % 3) * 20,
      vx: (i % 2 === 0 ? 1 : -1) * (0.55 + (i % 5) * 0.18),
      amp: 6 + (i % 4) * 3,
      phase: i * 0.7,
      size: 10 + (i % 4) * 3,
      hue: [28, 195, 45, 320, 210, 55][i % 6],
    }));
    const seaCrabs = Array.from({ length: 10 }, (_, i) => {
      const home = 120 + i * 340 + (i % 3) * 40;
      return {
        x: home,
        yOff: 6,
        vx: (i % 2 === 0 ? 1 : -1) * (0.35 + (i % 4) * 0.12),
        range: 90 + (i % 5) * 30,
        home,
        phase: i * 1.1,
        size: 11 + (i % 3) * 2,
      };
    });
    const seaJellies = Array.from({ length: 5 }, (_, i) => ({
      x: 280 + i * 650,
      y: 120 + (i % 3) * 160,
      vy: -0.18 - (i % 3) * 0.05,
      drift: 0.25 + (i % 2) * 0.1,
      phase: i * 1.4,
      size: 16 + (i % 3) * 6,
      pulse: 0.8 + (i % 4) * 0.15,
    }));
    // Shells & pebbles scattered along the uneven sand
    const seaDebris = Array.from({ length: 40 }, (_, i) => {
      const x = 50 + (i * 89 + terrainHash(i * 2.1) * 60) % (WATER_WIDTH - 80);
      return {
        x,
        yOff: 4 + terrainHash(i + 3) * 14,
        kind: i % 3, // 0 shell, 1 pebble, 2 starfish
        w: 6 + terrainHash(i + 5) * 10,
        rot: terrainHash(i + 7) * Math.PI,
      };
    });
    // Seat springboards on the dunes
    for (const s of waterSprings) {
      s.y = seabedSurfaceY(s.x + s.w * 0.5) - s.h;
    }

    const stars = Array.from({length:140}, () => ({
      x: Math.random()*SPACE_WIDTH, y: Math.random()*(H*0.55),
      r: 0.6+Math.random()*1.8, tw: Math.random()*Math.PI*2,
      speed: 0.2+Math.random()*0.5, parallax: 0.25+Math.random()*0.35,
    }));
    // Distant Earth hanging in the lunar sky
    const earth = { x: SPACE_WIDTH * 0.72, y: 160, r: 110 };
    // Far hills — uneven widths/heights so the skyline stays asymmetric
    const lunarHills = Array.from({ length: 16 }, (_, i) => {
      const x = -120 + i * (210 + lunarHash(i * 3.7) * 160);
      return {
        x,
        y: LUNAR_Y - (30 + lunarHash(i * 1.9) * 90),
        w: 160 + lunarHash(i * 2.3) * 220,
        h: 40 + lunarHash(i * 4.1) * 95,
        parallax: 0.38 + lunarHash(i * 0.8) * 0.22,
        shade: 0.48 + lunarHash(i * 5.2) * 0.28,
        skew: (lunarHash(i * 6.1) - 0.5) * 0.55,
      };
    });
    // Surface craters & rocks sit on the uneven regolith
    const lunarCraters = Array.from({ length: 36 }, (_, i) => {
      const x = 40 + (i * 97 + lunarHash(i) * 80) % (SPACE_WIDTH - 80);
      return {
        x,
        yOff: 6 + (i % 5) * 8,
        rx: 12 + lunarHash(i + 2) * 22,
        ry: 4 + lunarHash(i + 5) * 6,
      };
    });
    const lunarRocks = Array.from({ length: 26 }, (_, i) => {
      const x = 30 + (i * 151 + lunarHash(i + 8) * 70) % (SPACE_WIDTH - 60);
      return {
        x,
        yOff: 4 + lunarHash(i + 3) * 10,
        w: 8 + lunarHash(i + 4) * 14,
        h: 6 + lunarHash(i + 6) * 12,
      };
    });
    // Little (and not-so-little) alien critters that wander the uneven moon surface
    const lunarAliens = Array.from({ length: 14 }, (_, i) => {
      const x = 80 + (i * 240 + lunarHash(i * 1.3) * 120) % (SPACE_WIDTH - 120);
      // Size mix: tiny → medium, plus one absolute unit
      let size;
      if (i === 0) size = 38;                         // the big one 👾
      else if (i === 7) size = 26;                     // chunky buddy
      else {
        const tier = Math.floor(lunarHash(i * 3.1 + 0.7) * 4); // 0..3
        size = [7, 10, 13, 17][tier];
      }
      return {
        x,
        home: x,
        target: x + (lunarHash(i + 2) - 0.5) * 220,
        vx: 0,
        pause: Math.floor(lunarHash(i + 4) * 40),
        phase: i * 1.3,
        size,
        kind: i % 3, // 0 green antenna, 1 purple blob, 2 grey big-eyes
        hop: 0,
      };
    });
    spacePortal.y = lunarSurfaceY(spacePortal.x) - 100;

    let transition = null;
    function startTransition(toWorld, targetX) {
      transition = {phase:'shake', timer:0, fromWorld:currentWorld, toWorld, targetX};
    }

    const clouds = [
      {x:200,y:190,w:280,h:90,speed:0.5,dir:1,opacity:0.85},
      {x:600,y:190,w:240,h:80,speed:0.8,dir:-1,opacity:0.6},
      {x:1000,y:190,w:320,h:100,speed:0.4,dir:1,opacity:0.75},
      {x:1400,y:160,w:220,h:75,speed:1.0,dir:-1,opacity:0.5},
      {x:1800,y:190,w:300,h:95,speed:0.6,dir:1,opacity:0.9},
      {x:2200,y:180,w:350,h:110,speed:0.35,dir:-1,opacity:0.65},
      {x:2600,y:190,w:260,h:85,speed:0.9,dir:1,opacity:0.45},
      {x:3000,y:170,w:310,h:100,speed:0.55,dir:-1,opacity:0.8},
      {x:400,y:190,w:280,h:90,speed:0.7,dir:1,opacity:0.55},
      {x:900,y:190,w:330,h:105,speed:0.45,dir:-1,opacity:0.7},
      {x:1300,y:190,w:250,h:80,speed:0.65,dir:1,opacity:0.4},
      {x:1700,y:190,w:360,h:115,speed:0.5,dir:-1,opacity:0.95},
      {x:2100,y:190,w:290,h:92,speed:0.75,dir:1,opacity:0.6},
      {x:2500,y:190,w:340,h:108,speed:0.42,dir:-1,opacity:0.5},
      {x:2900,y:190,w:270,h:86,speed:0.88,dir:1,opacity:0.78},
      {x:3200,y:190,w:320,h:102,speed:0.58,dir:-1,opacity:0.42},
      {x:3500,y:190,w:300,h:96,speed:0.62,dir:1,opacity:0.88},
    ];

    function roundRect(ctx,x,y,w,h,r) {
      r = Math.min(r,w/2,h/2);
      ctx.beginPath();
      ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
      ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
      ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
      ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y);
      ctx.closePath();
    }

    // Live personalization (name / color / hat) read from the ref each frame,
    // mirroring how cartRef feeds the balloons — no React re-render per frame.
    const defColor = isCat ? '#FF6EB4' : '#7F77DD';
    const defName  = isCat ? 'Cat' : 'Milo';
    function currentCustom() {
      const c = (customizationRef && customizationRef.current) || {};
      return { name: c.name || defName, color: c.color || defColor, hat: c.hat || 'none' };
    }
    function hexToRgba(hex, a) {
      const h = (hex || defColor).replace('#','');
      const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
      return `rgba(${r},${g},${b},${a})`;
    }

    // Hat drawn in screen space above the head so it stays upright regardless of facing.
    function drawHat(cx, headTopY, color, hatId) {
      if (!hatId || hatId === 'none') return;
      ctx.save();
      ctx.textAlign='center'; ctx.textBaseline='alphabetic';
      if (hatId === 'cap' || hatId === 'crown' || hatId === 'tophat') {
        ctx.font='20px sans-serif';
        const emoji = hatId === 'cap' ? '🧢' : hatId === 'crown' ? '👑' : '🎩';
        ctx.fillText(emoji, cx, headTopY + 9);
      } else if (hatId === 'party') {
        const baseY = headTopY + 6, apexY = headTopY - 16, hw = 11;
        ctx.beginPath(); ctx.moveTo(cx-hw, baseY); ctx.lineTo(cx+hw, baseY); ctx.lineTo(cx, apexY); ctx.closePath();
        ctx.fillStyle = color; ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,0.85)'; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(cx-hw*0.6, baseY-6); ctx.lineTo(cx+hw*0.4, baseY-6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx-hw*0.32, (baseY+apexY)/2); ctx.lineTo(cx+hw*0.18, (baseY+apexY)/2); ctx.stroke();
        ctx.strokeStyle='rgba(0,0,0,0.22)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(cx-hw, baseY); ctx.lineTo(cx, apexY); ctx.lineTo(cx+hw, baseY); ctx.stroke();
        ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx, apexY-1, 3, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
      ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    }

    // Pixel-styled nameplate whose bottom edge rests at bottomY.
    function drawNameplate(cx, bottomY, name, color) {
      ctx.save();
      ctx.font="8px 'Press Start 2P',monospace";
      ctx.textAlign='center'; ctx.textBaseline='middle';
      const label = name.slice(0, 12);
      const tw = ctx.measureText(label).width;
      const h = 15, w = tw + 12, x = cx - w/2, y = bottomY - h;
      ctx.fillStyle='rgba(10,10,15,0.78)'; roundRect(ctx,x,y,w,h,3); ctx.fill();
      ctx.strokeStyle=color; ctx.lineWidth=1.5; roundRect(ctx,x,y,w,h,3); ctx.stroke();
      ctx.fillStyle='#fff'; ctx.shadowColor=color; ctx.shadowBlur=4;
      ctx.fillText(label, cx, y + h/2 + 0.5);
      ctx.shadowBlur=0; ctx.restore();
      ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    }

    // Non-intrusive greeting speech bubble shown briefly after the intro.
    function drawGreeting(sx, sy, name, color) {
      const t = greetTimer / GREET_DUR;
      let alpha = 1;
      if (t < 0.08) alpha = t / 0.08;
      else if (t > 0.7) alpha = Math.max(0, (1 - t) / 0.3);
      if (alpha <= 0) return;
      const text = `Let's go, ${name.slice(0,12)}!`;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font="8px 'Press Start 2P',monospace";
      ctx.textAlign='left'; ctx.textBaseline='middle';
      const tw = ctx.measureText(text).width;
      const h = 20, w = tw + 16;
      const x = Math.min(Math.max(sx + player.w + 6, 6), W - w - 6);
      const y = Math.max(sy - 26, 6);
      ctx.fillStyle='#fff'; roundRect(ctx,x,y,w,h,5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x+8,y+h); ctx.lineTo(x+20,y+h); ctx.lineTo(x+6,y+h+8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle=color; ctx.lineWidth=2; roundRect(ctx,x,y,w,h,5); ctx.stroke();
      ctx.fillStyle='#26215C'; ctx.fillText(text, x+8, y+h/2+1);
      ctx.restore();
      ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    }

    // Grand-finale aura: a rotating rainbow shimmer wrapped in a pulsing golden
    // glow. Shown briefly after every toy is found (finaleRef holds an "until" timestamp).
    const FINALE_RAINBOW = ['#FF6EB4','#FFD700','#1D9E75','#4FC3F7','#7F77DD','#D85A30'];
    function drawFinaleAura(sx, sy, fade = 1) {
      if (fade <= 0.02) return;
      const cx = sx + player.w/2, cy = sy + player.h*0.55;
      const pulse = 0.5 + Math.sin(wobbleTime*4)*0.5;
      ctx.save();
      ctx.globalAlpha = fade;
      // Pulsing golden halo.
      const glow = ctx.createRadialGradient(cx, cy, 3, cx, cy, player.w*1.6);
      glow.addColorStop(0, `rgba(255,215,0,${0.30+pulse*0.18})`);
      glow.addColorStop(0.6, `rgba(255,215,0,${0.10+pulse*0.08})`);
      glow.addColorStop(1, 'rgba(255,215,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.ellipse(cx, cy, player.w*1.6, player.h*1.0, 0, 0, Math.PI*2); ctx.fill();
      // Rotating rainbow arcs.
      ctx.lineWidth = 3;
      for (let i = 0; i < FINALE_RAINBOW.length; i++) {
        const a = wobbleTime*2.4 + i*(Math.PI*2/FINALE_RAINBOW.length);
        ctx.strokeStyle = FINALE_RAINBOW[i];
        ctx.globalAlpha = fade * (0.5 + pulse*0.3);
        ctx.beginPath();
        ctx.ellipse(cx, cy, player.w*1.12, player.h*0.72, a, a, a + Math.PI*0.7);
        ctx.stroke();
      }
      // Sparkle motes orbiting the character.
      ctx.globalAlpha = fade * 0.85;
      for (let s = 0; s < 6; s++) {
        const ang = wobbleTime*3 + s*(Math.PI*2/6);
        const rad = player.w*1.15 + Math.sin(wobbleTime*5 + s)*4;
        const px = cx + Math.cos(ang)*rad, py = cy + Math.sin(ang)*rad*0.65;
        ctx.fillStyle = FINALE_RAINBOW[(s+1) % FINALE_RAINBOW.length];
        ctx.beginPath(); ctx.arc(px, py, 2 + pulse*1.5, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    const drawCharacter = (ox,oy) => {
      const sx = player.x-ox, sy = player.y-oy;
      const frame = mf[player.frame];
      // `complete` is true for broken images too — naturalWidth catches failed loads
      const frameOk = frame && frame.complete && frame.naturalWidth > 0;
      const { name, color, hat } = currentCustom();

      // finaleRef.current = expiry timestamp (ms); fades out in the last 2s
      const finaleUntil = finaleRef && finaleRef.current;
      if (finaleUntil && typeof finaleUntil === 'number' && performance.now() < finaleUntil) {
        const remaining = finaleUntil - performance.now();
        const fade = remaining < 2000 ? remaining / 2000 : 1;
        drawFinaleAura(sx, sy, fade);
      }

      // Soft aura in the chosen theme color behind the sprite (reads on both worlds).
      ctx.save();
      const acx = sx + player.w/2, acy = sy + player.h*0.55;
      const aura = ctx.createRadialGradient(acx, acy, 2, acx, acy, player.w);
      aura.addColorStop(0, hexToRgba(color, 0.32));
      aura.addColorStop(1, hexToRgba(color, 0));
      ctx.fillStyle = aura;
      ctx.beginPath(); ctx.ellipse(acx, acy, player.w, player.h*0.72, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();

      ctx.save();
      if (frameOk) {
        if (player.dir === -1) {
          ctx.translate(sx+player.w,0); ctx.scale(-1,1);
          ctx.drawImage(frame,0,sy,player.w,player.h);
          if (isCat) { ctx.globalAlpha=0.42; ctx.fillStyle=color; ctx.fillRect(4,sy+16,player.w-8,player.h-20); ctx.globalAlpha=1; }
        } else {
          ctx.drawImage(frame,sx,sy,player.w,player.h);
          if (isCat) { ctx.globalAlpha=0.42; ctx.fillStyle=color; ctx.fillRect(sx+4,sy+16,player.w-8,player.h-20); ctx.globalAlpha=1; }
        }
      } else {
        // Fallback body so a broken/missing PNG never crashes the loop
        ctx.fillStyle = color;
        roundRect(ctx, sx+6, sy+10, player.w-12, player.h-14, 8); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(sx+player.w/2, sy+14, 10, 0, Math.PI*2); ctx.fill();
      }
      ctx.restore();

      const cx = sx + player.w/2;
      const needsGear = currentWorld === 'space' || currentWorld === 'underwater';
      if (needsGear) {
        // Bigger breath helmet / dive mask — glass circle around the whole head
        const hx = cx, hy = sy + 14;
        const hr = currentWorld === 'space' ? 26 : 24;
        ctx.save();
        if (currentWorld === 'space') {
          // Opaque space helmet dome
          ctx.fillStyle = 'rgba(200,220,255,0.22)';
          ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = 'rgba(230,240,255,0.9)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI*2); ctx.stroke();
          ctx.strokeStyle = 'rgba(120,140,180,0.75)'; ctx.lineWidth = 3.5;
          ctx.beginPath(); ctx.arc(hx, hy+3, hr+3, 0.15, Math.PI-0.15); ctx.stroke();
          // Visor glint
          ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(hx-6, hy-5, hr*0.45, -2.2, -0.6); ctx.stroke();
        } else {
          // Clear dive mask + snorkel vibe
          ctx.fillStyle = 'rgba(160,220,255,0.18)';
          ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = 'rgba(40,90,120,0.9)'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(hx, hy, hr, 0, Math.PI*2); ctx.stroke();
          ctx.fillStyle = '#2a6a8a';
          ctx.fillRect(hx + (player.dir === -1 ? -hr-5 : hr-2), hy-3, 7, 5);
          ctx.fillRect(hx + (player.dir === -1 ? -hr-7 : hr+3), hy-18, 3.5, 18);
        }
        ctx.restore();
      }

      // Parachute canopy + risers when falling from the sky
      if (parachute.amount > 0.05) {
        const a = parachute.amount;
        const top = sy - 6 - 30 * a;
        const spread = 40 * a;
        const sway = Math.sin(wobbleTime * 2.4) * 4 * a;
        ctx.save();
        // Canopy dome
        ctx.fillStyle = `rgba(210,55,70,${0.88 * a})`;
        ctx.beginPath();
        ctx.moveTo(cx - spread + sway, top + 14 * a);
        ctx.quadraticCurveTo(cx + sway, top - 20 * a, cx + spread + sway, top + 14 * a);
        ctx.quadraticCurveTo(cx + sway, top + 24 * a, cx - spread + sway, top + 14 * a);
        ctx.fill();
        // Panel stripes
        ctx.strokeStyle = `rgba(255,230,200,${0.55 * a})`;
        ctx.lineWidth = 1.5;
        for (let i = -2; i <= 2; i++) {
          const px = cx + sway + i * (spread * 0.28);
          ctx.beginPath();
          ctx.moveTo(cx + sway, top - 8 * a);
          ctx.lineTo(px, top + 16 * a);
          ctx.stroke();
        }
        ctx.fillStyle = `rgba(255,210,80,${0.9 * a})`;
        ctx.beginPath();
        ctx.arc(cx + sway, top - 6 * a, 3.5 * a, 0, Math.PI * 2); ctx.fill();
        // Risers to shoulders
        ctx.strokeStyle = `rgba(50,35,25,${0.6 * a})`;
        ctx.lineWidth = 1.4; ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx - spread * 0.85 + sway, top + 14 * a);
        ctx.lineTo(cx - 10, sy + 16);
        ctx.moveTo(cx + spread * 0.85 + sway, top + 14 * a);
        ctx.lineTo(cx + 10, sy + 16);
        ctx.moveTo(cx - spread * 0.35 + sway, top + 16 * a);
        ctx.lineTo(cx - 4, sy + 14);
        ctx.moveTo(cx + spread * 0.35 + sway, top + 16 * a);
        ctx.lineTo(cx + 4, sy + 14);
        ctx.stroke();
        ctx.restore();
      }

      drawHat(cx, sy, color, hat);
      const plateBottom = sy - (hat && hat !== 'none' ? 20 : 6) - (parachute.amount > 0.4 ? 36 * parachute.amount : 0);
      drawNameplate(cx, plateBottom, name, color);
    };

    const drawColoredCube = (sx,sy,w,h,num) => {
      const seed='item-'+num, col=seededColor(seed), light=seededLightColor(seed);
      ctx.fillStyle=col; roundRect(ctx,sx,sy,w,h,Math.round(w*0.18)); ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.28)'; roundRect(ctx,sx+w*0.08,sy+h*0.07,w*0.84,h*0.28,Math.round(w*0.12)); ctx.fill();
      ctx.strokeStyle=light; ctx.lineWidth=Math.max(2,w*0.07); roundRect(ctx,sx,sy,w,h,Math.round(w*0.18)); ctx.stroke();
      ctx.strokeStyle='rgba(0,0,0,0.25)'; ctx.lineWidth=1.5; roundRect(ctx,sx+2,sy+2,w-4,h-4,Math.round(w*0.14)); ctx.stroke();
      ctx.fillStyle='#fff'; ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=3;
      ctx.font=`bold ${Math.round(w*0.42)}px 'Press Start 2P',monospace`;
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(num,sx+w/2,sy+h/2);
      ctx.shadowBlur=0; ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    };

    // ── Cart toys that ride along with the character ──────────────────────────
    // Balloons on strings that trail behind Milo with a springy, laggy follow.
    const MAX_TOYS      = 7;     // most-recent balloons shown at once
    const PER_ITEM_CAP  = 3;     // don't render a whole swarm of one identical toy
    const SPRING        = 0.055; // pull toward the anchor (higher = snappier)
    const DAMP          = 0.86;  // velocity damping (lower = more drag/lag)
    let toys            = [];    // { key, emoji, x, y, vx, vy, phase, pop }
    let toyOverflow     = 0;     // hidden extra units → shown as a "+N" bubble
    let toysSeeded      = false; // skip pop SFX for pre-existing cart on mount

    // Build the desired balloon list from the live cart (most-recent first).
    function desiredToys() {
      const cart = (cartRef && cartRef.current) || [];
      const desired = [];
      let totalUnits = 0;
      for (const it of cart) totalUnits += it.qty || 0;
      for (let i = cart.length - 1; i >= 0 && desired.length < MAX_TOYS; i--) {
        const it = cart[i];
        const per = Math.min(it.qty || 0, PER_ITEM_CAP);
        for (let n = 0; n < per && desired.length < MAX_TOYS; n++) {
          desired.push({ key: (it.id ?? it.name) + '#' + n, emoji: it.emoji || '🎁' });
        }
      }
      toyOverflow = Math.max(0, totalUnits - desired.length);
      return desired;
    }

    // Anchor where all balloon strings are tied on the character (hand height).
    function toyAnchor() {
      return { x: player.x + player.w * 0.5, y: player.y + 10 };
    }

    // Rest position for the i-th balloon: a loose bouquet floating up & behind.
    function toyRest(i, count) {
      const a = toyAnchor();
      const spread = (i - (count - 1) / 2) * 15;   // horizontal fan
      const behind = -player.dir * (14 + i * 3);   // trail opposite to travel
      const lift   = 66 + (i % 3) * 12;            // stack upward in tiers
      const bob     = Math.sin(wobbleTime * 2.2 + i * 0.9) * 5;
      const swayAmt = Math.min(Math.abs(player.vx) * 2.2, 16);
      return {
        x: a.x + behind + spread + Math.sin(wobbleTime * 1.3 + i) * 3 - player.dir * swayAmt,
        y: a.y - lift + bob - Math.abs(spread) * 0.18,
      };
    }

    function updateToys(dt) {
      const desired = desiredToys();
      const desiredKeys = new Set(desired.map(d => d.key));
      // Drop balloons no longer in the cart.
      toys = toys.filter(t => desiredKeys.has(t.key));
      const existing = new Map(toys.map(t => [t.key, t]));
      const a = toyAnchor();
      const next = [];
      for (const d of desired) {
        let t = existing.get(d.key);
        if (!t) {
          // New toy pops into existence at the character's hand.
          t = { key: d.key, emoji: d.emoji, x: a.x, y: a.y, vx: 0, vy: -3, phase: Math.random() * Math.PI * 2, pop: 0 };
          if (toysSeeded) playPickupSound();
        }
        t.emoji = d.emoji;
        next.push(t);
      }
      toys = next;
      toysSeeded = true;

      for (let i = 0; i < toys.length; i++) {
        const t = toys[i];
        const rest = toyRest(i, toys.length);
        t.vx = (t.vx + (rest.x - t.x) * SPRING * dt) * DAMP;
        t.vy = (t.vy + (rest.y - t.y) * SPRING * dt) * DAMP;
        t.x += t.vx * dt;
        t.y += t.vy * dt;
        if (t.pop < 1) t.pop = Math.min(1, t.pop + 0.08 * dt);
      }
    }

    const BALLOON_TINTS = ['#FF6EB4','#7F77DD','#4FC3F7','#FFD54F','#81C784','#FF8A65','#BA68C8'];

    function drawToys(ox, oy) {
      if (toys.length === 0) return;
      const a = toyAnchor();
      const ax = a.x - ox, ay = a.y - oy;
      // Draw furthest/highest balloons first so nearer ones overlap on top.
      const order = toys.map((t, i) => i).sort((i, j) => toys[j].y - toys[i].y);
      for (const i of order) {
        const t = toys[i];
        const bx = t.x - ox, by = t.y - oy;
        const pop = t.pop < 1 ? 1.25 - Math.cos(t.pop * Math.PI) * 0.25 : 1; // easeOut pop
        const r = 12 * pop;
        const tint = BALLOON_TINTS[i % BALLOON_TINTS.length];

        // String from the character's hand to the balloon knot.
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo((ax + bx) / 2 + Math.sin(wobbleTime * 2 + i) * 4, (ay + by) / 2, bx, by + r * 1.05);
        ctx.stroke();
        ctx.restore();

        // Balloon body.
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2;
        ctx.fillStyle = tint;
        ctx.beginPath();
        ctx.ellipse(bx, by, r * 0.92, r * 1.08, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        // Highlight.
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.beginPath();
        ctx.ellipse(bx - r * 0.3, by - r * 0.35, r * 0.28, r * 0.4, -0.5, 0, Math.PI * 2);
        ctx.fill();
        // Knot.
        ctx.fillStyle = tint;
        ctx.beginPath();
        ctx.moveTo(bx - 2.5, by + r * 1.02);
        ctx.lineTo(bx + 2.5, by + r * 1.02);
        ctx.lineTo(bx, by + r * 1.02 + 4);
        ctx.closePath(); ctx.fill();
        // Product emoji on the balloon.
        ctx.font = `${Math.round(r * 1.15)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t.emoji, bx, by + 0.5);
        ctx.restore();
      }
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

      // "+N" bubble for the units we didn't render.
      if (toyOverflow > 0) {
        const top = toys.reduce((m, t) => t.y < m.y ? t : m, toys[0]);
        const bx = top.x - ox + 18, by = top.y - oy - 14;
        ctx.save();
        ctx.fillStyle = 'rgba(38,33,92,0.92)';
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(bx, by, 11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = "bold 9px 'Press Start 2P',monospace";
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('+' + toyOverflow, bx, by + 1);
        ctx.restore();
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
    }

    // ── Passport milestone confetti ──────────────────────────────────────────
    // Screen-space burst rendered inside the RAF loop (same pattern as balloons).
    // celebrateRef.current.pending is bumped from React when a reward unlocks — an
    // occasional event, so no per-frame React work is involved.
    const CONFETTI_COLORS = ['#FFD700','#7F77DD','#1D9E75','#D85A30','#FF6EB4','#4FC3F7'];
    let confetti = [];
    // big=true → the grand-finale burst: far more particles, bigger flakes, and a
    // slower fade so the celebration lasts noticeably longer than a per-world one.
    function spawnConfetti(big = false) {
      const count = big ? 260 : 90;
      for (let i = 0; i < count; i++) {
        confetti.push({
          x: Math.random()*W, y: -20 - Math.random()*H*(big ? 0.9 : 0.5),
          vx: (Math.random()-0.5)*(big ? 4 : 3), vy: 2 + Math.random()*(big ? 5 : 4),
          size: (big ? 6 : 5) + Math.random()*(big ? 10 : 7), rot: Math.random()*Math.PI*2,
          vrot: (Math.random()-0.5)*0.3,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length], life: 1,
          fade: big ? 0.008 : 0.02,
        });
      }
    }
    function updateAndDrawConfetti(dt) {
      if (celebrateRef && celebrateRef.current) {
        if (celebrateRef.current.finale > 0) { celebrateRef.current.finale = 0; spawnConfetti(true); }
        if (celebrateRef.current.pending > 0) { celebrateRef.current.pending = 0; spawnConfetti(false); }
      }
      if (confetti.length === 0) return;
      ctx.save();
      for (const c of confetti) {
        c.vy += 0.06*dt; c.x += c.vx*dt; c.y += c.vy*dt; c.rot += c.vrot*dt;
        if (c.y > H*0.7) c.life -= (c.fade || 0.02)*dt;
        ctx.globalAlpha = Math.max(0, c.life);
        ctx.fillStyle = c.color;
        ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot);
        ctx.fillRect(-c.size/2, -c.size/2, c.size, c.size*0.6);
        ctx.restore();
      }
      ctx.restore(); ctx.globalAlpha = 1;
      confetti = confetti.filter(c => c.life > 0 && c.y < H + 40);
    }

    const loop = (ts) => {
      const dt = Math.min((ts-lastTime)/16.67,3); lastTime = ts;

      // HUD / landing warp requests
      if (warpRef && warpRef.current) {
        const to = warpRef.current;
        warpRef.current = null;
        warpTo(to);
      }

      if (!introDone) {
        const SHORE_X = 500+4;
        introTimer += dt;
        player.x = -30+introTimer*2.5; player.vx=2.5; player.dir=1; player.moving=true;
        const standY = GROUND_Y - player.h;
        const rise   = Math.max(0,Math.min(player.x/SHORE_X,1));
        const emerge = Math.max(0,Math.min((player.x-(SHORE_X-220))/220,1));
        const bob    = Math.sin(introTimer*0.2)*2.5*(1-emerge);
        // Keep torso mostly above the waterline while swimming in
        player.y = standY + 10*(1-rise) + bob;
        player.frameTimer += dt;
        if (player.frameTimer>6) { player.frameTimer=0; player.frame=(player.frame+1)%3; }
        if (player.x >= SHORE_X) { introDone=true; player.x=SHORE_X; player.y=standY; player.moving=false; }
      }

      const paused = pausedRef ? pausedRef.current : showCart;
      if (!paused && introDone && !transition) {
        const inSpace = currentWorld==='space';
        const inWater = currentWorld==='underwater';
        const inIsland = currentWorld==='island';
        const grav = inSpace ? GRAVITY_SPACE : inWater ? GRAVITY_WATER : GRAVITY;
        const jumpV = inSpace ? JUMP_SPACE : inWater ? JUMP_WATER : JUMP;
        const activeZones = inSpace ? spaceZones : inWater ? waterZones : zones;
        const worldW = worldWidthOf(currentWorld);
        const floatPlats = inSpace ? ASTEROID_PLATFORMS : inWater ? CORAL_PLATFORMS : null;

        player.moving = false;
        if (keysRef.current['ArrowLeft'])       { player.vx=-3.2; player.dir=-1; player.moving=true; }
        else if (keysRef.current['ArrowRight']) { player.vx= 3.2; player.dir= 1; player.moving=true; }
        else player.vx *= 0.75;

        // Jump-on-cube must run BEFORE the normal jump clears onGround,
        // otherwise standing-on-top never opens the product.
        const jumpPressed = keysRef.current['ArrowUp'] || keysRef.current[' '];
        let openedFromTop = false;
        if (jumpPressed && player.onGround) {
          for (const z of activeZones) {
            if (!z.standingOn || z.hit) continue;
            z.bumping=true; z.bounceY=-10; z.standingOn=false;
            player.vy=jumpV*0.8; player.onGround=false;
            scoreLocal+=100; setScore(scoreLocal);
            playCubeHitSound();
            setTimeout(()=>{z.hit=true;z.growing=0;setPopupRef.current?.(z.product);recordDiscoveryRef?.current?.(z.product);},320);
            openedFromTop = true;
            break;
          }
          if (!openedFromTop) { player.vy=jumpV; player.onGround=false; }
        }

        if (player.moving && player.onGround) { player.frameTimer+=dt; if(player.frameTimer>6){player.frameTimer=0;player.frame=(player.frame+1)%3;} }
        else player.frame = 0;

        player.vy += grav*dt; player.x += player.vx*dt; player.y += player.vy*dt;
        player.x = Math.max(0,Math.min(player.x,worldW-player.w)); player.onGround=false;

        if (inIsland) {
          for (const g of ground) {
            if (rectsOverlap({x:player.x,y:player.y,w:player.w,h:player.h},g)) {
              if (player.vy>=0 && player.y+player.h-g.y<20) { player.y=g.y-player.h; player.vy=0; player.onGround=true; }
              else if (player.vy<0 && g.y+g.h-player.y<20) { player.y=g.y+g.h; player.vy=0.5; }
            }
          }
          for (const plat of PYRAMID_PLATFORMS) {
            if (player.x+player.w>plat.x && player.x<plat.x+plat.w && player.vy>=0 &&
                player.y+player.h>plat.y && player.y+player.h<plat.y+plat.h+20 &&
                (player.y+player.h-player.vy)<=plat.y+4) {
              player.y=plat.y-player.h; player.vy=0; player.onGround=true;
            }
          }
        } else if (floatPlats) {
          for (const plat of floatPlats) {
            const py = plat.baseY+Math.sin(wobbleTime*plat.driftSpeed+plat.phase)*plat.driftRange;
            if (player.x+player.w>plat.x && player.x<plat.x+plat.w && player.vy>=0 &&
                player.y+player.h>py && player.y+player.h<py+plat.h+20 &&
                (player.y+player.h-player.vy)<=py+4) {
              player.y=py-player.h; player.vy=0; player.onGround=true;
            }
          }
          if (inWater) {
            // Stick to the uneven sandy dunes (walk / soft land)
            const gy = seabedSurfaceY(player.x + player.w * 0.5);
            const feet = player.y + player.h;
            if (player.vy >= 0 && feet >= gy - 8 && feet - gy < 90) {
              player.y = gy - player.h; player.vy = 0; player.onGround = true;
            }
            for (const s of waterSprings) {
              // Keep pads seated on the dunes as the surface undulates under them
              s.y = seabedSurfaceY(s.x + s.w * 0.5) - s.h;
              if (rectsOverlap({x:player.x,y:player.y,w:player.w,h:player.h},{x:s.x,y:s.y,w:s.w,h:s.h})) {
                if (player.vy>=0 && player.y+player.h-s.y<22) {
                  player.y=s.y-player.h; player.vy=-30; player.onGround=false;
                  s.bounced=true; playSpringSound();
                  setTimeout(()=>{s.bounced=false;},300);
                }
              }
            }
          } else if (inSpace) {
            // Stick to the uneven lunar hills (walk / soft land)
            const gy = lunarSurfaceY(player.x + player.w * 0.5);
            const feet = player.y + player.h;
            if (player.vy >= 0 && feet >= gy - 6 && feet - gy < 42) {
              player.y = gy - player.h; player.vy = 0; player.onGround = true;
            }
          }
        }

        for (const z of activeZones) {
          if (z.hit) continue;
          if (rectsOverlap({x:player.x,y:player.y,w:player.w,h:player.h},{x:z.x,y:z.y,w:z.w,h:z.h})) {
            const hitFromBelow = player.vy<0 && player.y<z.y+z.h && player.y+player.h>z.y;
            const landingOnTop = player.vy>=0 && player.y+player.h-z.y<15 && player.y+player.h>=z.y;
            if (hitFromBelow) {
              z.bumping=true; z.bounceY=-18; player.vy=2;
              if (z.y+z.h>player.y && z.y<player.y+10) player.y=z.y+z.h+2;
              scoreLocal+=100; setScore(scoreLocal);
              playCubeHitSound();
              setTimeout(()=>{z.hit=true;z.growing=0;setPopupRef.current?.(z.product);recordDiscoveryRef?.current?.(z.product);},320);
            } else if (landingOnTop) {
              player.y=z.y-player.h; player.vy=0; player.onGround=true; z.standingOn=true;
            } else if (player.x+player.w-z.x<15) { player.x=z.x-player.w; player.vx=0; }
              else if (z.x+z.w-player.x<15)      { player.x=z.x+z.w;      player.vx=0; }
          } else {
            if (z.standingOn && !(player.x+player.w>z.x&&player.x<z.x+z.w&&player.y+player.h<=z.y+4))
              z.standingOn=false;
          }
          if (z.bumping&&!z.hit) z.bounceY=Math.min(z.bounceY+1.8,0);
          if (z.hit&&z.growing<1) z.growing=Math.min(z.growing+0.05,1);
        }

        if (inIsland && player.y>GROUND_Y+120) { player.y=GROUND_Y-35; player.vy=0; }

        if (inIsland) {
          for (const s of springboards) {
            if (rectsOverlap({x:player.x,y:player.y,w:player.w,h:player.h},{x:s.x,y:s.y,w:s.w,h:s.h})) {
              if (player.vy>=0 && player.y+player.h-s.y<20) {
                // Stronger bounce so the lower ground still reaches the cloud band
                player.y=s.y-player.h; player.vy=-34; player.onGround=false;
                s.bounced=true; playSpringSound();
                setTimeout(()=>{s.bounced=false;},300);
              }
            }
          }
          for (const c of clouds) {
            c.x += c.speed*c.dir;
            if (c.x<0||c.x+c.w>ISLAND_WIDTH) c.dir*=-1;
            // Wider/thicker landing pad + swept feet check so fast falls don't tunnel through
            const ct={x:c.x+c.w*0.08,y:c.y+c.h*0.28,w:c.w*0.84,h:18};
            const feet=player.y+player.h;
            const prevFeet=feet-player.vy*dt;
            if (player.x+player.w>ct.x && player.x<ct.x+ct.w && player.vy>=0 &&
                feet>ct.y && feet<ct.y+ct.h+28 && prevFeet<=ct.y+10) {
              player.y=ct.y-player.h; player.vy=0; player.onGround=true; player.x+=c.speed*c.dir;
            }
          }
          islandSign.glow = (Math.sin(wobbleTime*2)+1)/2;
          divePortal.glow = (Math.sin(wobbleTime*2.4)+1)/2;
          if (rectsOverlap({x:player.x,y:player.y,w:player.w,h:player.h},islandSign)) startTransition('space',250);
          if (rectsOverlap({x:player.x,y:player.y,w:player.w,h:player.h},divePortal)) startTransition('underwater',220);
        } else if (inSpace) {
          spacePortal.glow = (Math.sin(wobbleTime*2)+1)/2;
          if (rectsOverlap({x:player.x,y:player.y,w:player.w,h:player.h},spacePortal)) startTransition('island',4200);
        } else if (inWater) {
          loungePortal.glow = (Math.sin(wobbleTime*2)+1)/2;
          // Surface back to the Artist Lounge (island shore)
          if (rectsOverlap({x:player.x,y:player.y,w:player.w,h:player.h},loungePortal)) startTransition('island',560);
        }

        // Sky parachute — after landings so we know if feet are planted
        if (player.onGround) {
          player.airPeakY = player.y;
        } else {
          player.airPeakY = Math.min(player.airPeakY, player.y);
        }
        // Only after a true sky peak (springboard / clouds), not a normal ground jump
        if (inIsland && !player.onGround && player.vy > 1.2 && player.airPeakY < 400) {
          parachute.open = true;
        }
        if (!inIsland || player.onGround) parachute.open = false;
        if (parachute.open) {
          parachute.amount = Math.min(1, parachute.amount + 0.09 * dt);
          if (player.vy > 2.5) player.vy = 2.5;
          player.x += Math.sin(wobbleTime * 2.2) * 0.4 * dt;
          player.x = Math.max(0, Math.min(player.x, worldW - player.w));
        } else {
          parachute.amount = Math.max(0, parachute.amount - 0.14 * dt);
        }

        targetCameraX = Math.max(0,Math.min(player.x-220,worldW-W));
        cameraX += (targetCameraX-cameraX)*0.08*dt;
        wobbleTime += dt*0.04;
        const wi = player.moving?1.2:0.4;
        camWobbleX = Math.sin(wobbleTime*1.3)*wi;
        camWobbleY = Math.sin(wobbleTime*2.1)*wi*0.6;

        // Periodic breath bubbles from the mask/helmet
        if (inSpace || inWater) {
          breathTimer += dt;
          if (breathTimer > 18) {
            breathTimer = 0;
            const count = 2 + (Math.random()*2|0);
            for (let i=0;i<count;i++) {
              breathBubbles.push({
                x: player.x + player.w*0.55 + (Math.random()-0.5)*10,
                y: player.y + 8 + Math.random()*6,
                r: 2 + Math.random()*3.5,
                vy: -(0.6 + Math.random()*1.1),
                life: 50 + Math.random()*30,
                wobble: Math.random()*Math.PI*2,
              });
            }
          }
        } else if (breathBubbles.length) {
          breathBubbles.length = 0;
          breathTimer = 0;
        }
      }

      if (transition) {
        transition.timer += dt;
        const t = transition;
        if (t.phase==='shake') {
          camWobbleX=(Math.random()-0.5)*14; camWobbleY=(Math.random()-0.5)*14;
          if (t.timer>26) { t.phase='suck'; t.timer=0; }
        } else if (t.phase==='suck') {
          camWobbleX*=0.9; camWobbleY*=0.9;
          if (t.timer>22) { t.phase='flying'; t.timer=0; }
        } else if (t.phase==='flying') {
          if (t.timer>50) {
            currentWorld=t.toWorld;
            setWorldRef.current?.(t.toWorld);
            visitWorldRef?.current?.(t.toWorld);
            player.x=t.targetX; player.y=spawnYOf(t.toWorld, t.targetX);
            player.vx=0; player.vy=0;
            player.airPeakY=player.y;
            parachute.open=false; parachute.amount=0;
            const ww=worldWidthOf(t.toWorld);
            cameraX=Math.max(0,Math.min(player.x-220,ww-W)); targetCameraX=cameraX;
            t.phase='arrive'; t.timer=0;
          }
        } else if (t.phase==='arrive') {
          camWobbleX*=0.85; camWobbleY*=0.85;
          if (t.timer>30) transition=null;
        }
      }

      const ox=Math.round(cameraX+camWobbleX), oy=Math.round(camWobbleY);
      ctx.clearRect(0,0,W,H);

      // ── Draw background ──
      if (currentWorld==='island') {
        if (bg.complete && bg.naturalWidth>0) {
          ctx.drawImage(bg,-ox,0,ISLAND_WIDTH,H);
        } else {
          ctx.fillStyle='#87CEEB'; ctx.fillRect(0,0,W,H);
        }
      } else if (currentWorld==='underwater') {
        // Clear blue water all the way down — sand body draws the dunes on top
        const waterGrad=ctx.createLinearGradient(0,0,0,H);
        waterGrad.addColorStop(0,'#4db8d9'); waterGrad.addColorStop(0.4,'#2a8fb5');
        waterGrad.addColorStop(0.75,'#176a88'); waterGrad.addColorStop(1,'#0d4a5c');
        ctx.fillStyle=waterGrad; ctx.fillRect(0,0,W,H);
        // Chunking sand dunes — high-contrast body so hills read at a glance
        {
          const sandGrad=ctx.createLinearGradient(0,500,0,H);
          sandGrad.addColorStop(0,'#f0e0b8'); sandGrad.addColorStop(0.35,'#e0c990');
          sandGrad.addColorStop(0.7,'#c9a86a'); sandGrad.addColorStop(1,'#8f6f3e');
          ctx.fillStyle=sandGrad;
          ctx.beginPath();
          ctx.moveTo(-4, H + 2);
          for (let sx = -4; sx <= W + 4; sx += 5) {
            ctx.lineTo(sx, seabedSurfaceY(sx + ox));
          }
          ctx.lineTo(W + 4, H + 2);
          ctx.closePath();
          ctx.fill();
          // Bright crest so the silhouette pops against blue water
          ctx.strokeStyle = 'rgba(255,248,220,0.95)';
          ctx.lineWidth = 4;
          ctx.beginPath();
          for (let sx = -4; sx <= W + 4; sx += 5) {
            const sy = seabedSurfaceY(sx + ox);
            if (sx === -4) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
          ctx.stroke();
          // Dark under-lip for depth
          ctx.strokeStyle = 'rgba(110,80,40,0.45)';
          ctx.lineWidth = 8;
          ctx.beginPath();
          for (let sx = -4; sx <= W + 4; sx += 5) {
            const sy = seabedSurfaceY(sx + ox) + 5;
            if (sx === -4) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
          ctx.stroke();
          // Cliff faces — shade only the STEEP flank so left/right asymmetry reads
          for (let sx = 0; sx < W; sx += 4) {
            const y0 = seabedSurfaceY(sx + ox);
            const y1 = seabedSurfaceY(sx + ox + 8);
            const slope = (y1 - y0) / 8; // + = dropping to the right
            if (Math.abs(slope) < 0.7) continue;
            const depth = Math.min(70, Math.abs(slope) * 36);
            ctx.fillStyle = slope > 0
              ? 'rgba(90,60,30,0.38)'   // right-facing cliff (drop to the right)
              : 'rgba(90,60,30,0.28)';  // left-facing cliff
            ctx.beginPath();
            ctx.moveTo(sx, y0);
            ctx.lineTo(sx + 8, y1);
            ctx.lineTo(sx + 8, y1 + depth);
            ctx.lineTo(sx, y0 + depth);
            ctx.closePath();
            ctx.fill();
          }
          // Sand mottling that follows the dunes
          ctx.fillStyle='rgba(255,236,190,0.55)';
          for (let s=0;s<22;s++) {
            const wx = ((s * 163 + ox * 0.15) % WATER_WIDTH + WATER_WIDTH) % WATER_WIDTH;
            const sx = wx - ox;
            if (sx < -40 || sx > W + 40) continue;
            const sy = seabedSurfaceY(wx) + 16 + (s % 4) * 12;
            ctx.beginPath(); ctx.ellipse(sx, sy, 18 + (s % 3) * 5, 6, 0, 0, Math.PI * 2); ctx.fill();
          }
        }
        // Warm surface light shafts
        for (let i=0;i<7;i++) {
          const lx=((i*240+wobbleTime*14)%(W+220))-110;
          const shaft=ctx.createLinearGradient(lx,0,lx+50,H*0.75);
          shaft.addColorStop(0,'rgba(255,250,200,0.18)'); shaft.addColorStop(1,'rgba(255,250,200,0)');
          ctx.fillStyle=shaft; ctx.beginPath();
          ctx.moveTo(lx,0); ctx.lineTo(lx+80,0); ctx.lineTo(lx+30,H*0.75); ctx.lineTo(lx-35,H*0.75); ctx.closePath(); ctx.fill();
        }
        // Shells & pebbles on the dunes
        for (const d of seaDebris) {
          const dx = d.x - ox;
          if (dx < -30 || dx > W + 30) continue;
          const dy = seabedSurfaceY(d.x) + d.yOff;
          if (d.kind === 0) {
            ctx.fillStyle = '#f0e0c8';
            ctx.beginPath(); ctx.ellipse(dx, dy, d.w, d.w * 0.55, d.rot, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = 'rgba(180,140,100,0.5)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(dx, dy, d.w * 0.55, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
          } else if (d.kind === 1) {
            ctx.fillStyle = '#9a8a70';
            ctx.beginPath();
            ctx.moveTo(dx, dy + 3);
            ctx.lineTo(dx + d.w * 0.3, dy - d.w * 0.4);
            ctx.lineTo(dx + d.w, dy + 2);
            ctx.closePath(); ctx.fill();
          } else {
            ctx.fillStyle = '#e87850';
            for (let a = 0; a < 5; a++) {
              const ang = d.rot + a * (Math.PI * 2 / 5);
              ctx.beginPath();
              ctx.ellipse(dx + Math.cos(ang) * 4, dy + Math.sin(ang) * 3, 4, 2, ang, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.beginPath(); ctx.arc(dx, dy, 2.5, 0, Math.PI * 2); ctx.fill();
          }
        }
        // Plantlife — sway gently for a living shallow reef
        for (const p of seaPlants) {
          const px=p.x-ox;
          if (px<-60||px>W+60) continue;
          const baseY = seabedSurfaceY(p.x) - p.yOff;
          const lean=Math.sin(wobbleTime*p.sway+p.phase)*12;
          if (p.kind < 2) {
            // Tall kelp ribbons
            ctx.strokeStyle=`hsla(${p.hue},55%,38%,0.9)`;
            ctx.lineWidth=5; ctx.lineCap='round';
            ctx.beginPath();
            ctx.moveTo(px,baseY);
            ctx.quadraticCurveTo(px+lean*0.6,baseY-p.h*0.45,px+lean,baseY-p.h);
            ctx.stroke();
            ctx.strokeStyle=`hsla(${p.hue},60%,48%,0.85)`;
            ctx.lineWidth=3;
            ctx.beginPath();
            ctx.moveTo(px+6,baseY);
            ctx.quadraticCurveTo(px+6+lean*0.5,baseY-p.h*0.5,px+6+lean*0.85,baseY-p.h*0.85);
            ctx.stroke();
            // Leaf pads along the stalk
            ctx.fillStyle=`hsla(${p.hue},50%,42%,0.8)`;
            for (let n=0;n<4;n++) {
              const t=(n+1)/5;
              const lx=px+lean*t, ly=baseY-p.h*t;
              ctx.beginPath(); ctx.ellipse(lx+8,ly,14,5,lean*0.04,0,Math.PI*2); ctx.fill();
            }
          } else if (p.kind < 4) {
            // Seagrass tufts
            ctx.strokeStyle=`hsla(${p.hue},48%,40%,0.85)`;
            ctx.lineWidth=2.5; ctx.lineCap='round';
            for (let b=0;b<5;b++) {
              const ox2=(b-2)*5;
              ctx.beginPath();
              ctx.moveTo(px+ox2,baseY);
              ctx.quadraticCurveTo(px+ox2+lean*0.4,baseY-p.h*0.55,px+ox2+lean*0.7+(b%2?4:-3),baseY-p.h);
              ctx.stroke();
            }
          } else {
            // Soft coral fan / anemone
            ctx.fillStyle=`hsla(${p.hue},65%,55%,0.75)`;
            for (let a=0;a<7;a++) {
              const ang=-Math.PI/2+(a-3)*0.22+lean*0.01;
              const len=p.h*(0.7+((a%3)*0.1));
              ctx.beginPath();
              ctx.moveTo(px,baseY);
              ctx.quadraticCurveTo(
                px+Math.cos(ang)*len*0.45,
                baseY+Math.sin(ang)*len*0.45,
                px+Math.cos(ang)*len,
                baseY+Math.sin(ang)*len
              );
              ctx.lineTo(px+Math.cos(ang)*len*0.9+3,baseY+Math.sin(ang)*len*0.9);
              ctx.closePath(); ctx.fill();
            }
            ctx.fillStyle=`hsla(${p.hue},70%,62%,0.9)`;
            ctx.beginPath(); ctx.arc(px,baseY-4,8,0,Math.PI*2); ctx.fill();
          }
        }
        // Re-stroke the dune crest above plantlife so hills stay readable
        {
          ctx.strokeStyle = 'rgba(255,236,190,0.7)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (let sx = -4; sx <= W + 4; sx += 6) {
            const sy = seabedSurfaceY(sx + ox);
            if (sx === -4) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
          ctx.stroke();
          ctx.strokeStyle = 'rgba(180,140,90,0.35)';
          ctx.lineWidth = 6;
          ctx.beginPath();
          for (let sx = -4; sx <= W + 4; sx += 6) {
            const sy = seabedSurfaceY(sx + ox) + 3;
            if (sx === -4) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
          ctx.stroke();
        }
        // Crabs scuttle along the dunes
        for (const c of seaCrabs) {
          c.x += c.vx * dt;
          if (c.x > c.home + c.range || c.x < c.home - c.range) c.vx *= -1;
          const cx = c.x - ox;
          if (cx < -40 || cx > W + 40) continue;
          const cy = seabedSurfaceY(c.x) - c.yOff;
          const bob = Math.abs(Math.sin(wobbleTime * 6 + c.phase)) * 1.5;
          const s = c.size;
          const dir = c.vx >= 0 ? 1 : -1;
          // Body
          ctx.fillStyle = '#c45a2e';
          ctx.beginPath(); ctx.ellipse(cx, cy - bob, s, s * 0.55, 0, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#e07840';
          ctx.beginPath(); ctx.ellipse(cx, cy - bob - 2, s * 0.7, s * 0.35, 0, 0, Math.PI * 2); ctx.fill();
          // Eyes
          ctx.fillStyle = '#1a1208';
          ctx.beginPath(); ctx.arc(cx - 4, cy - bob - s * 0.55, 1.8, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(cx + 4, cy - bob - s * 0.55, 1.8, 0, Math.PI * 2); ctx.fill();
          // Claws
          ctx.strokeStyle = '#a84820'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(cx - s * 0.7, cy - bob);
          ctx.quadraticCurveTo(cx - s * 1.3, cy - bob - 8, cx - s * 1.1 + dir * 2, cy - bob - 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx + s * 0.7, cy - bob);
          ctx.quadraticCurveTo(cx + s * 1.3, cy - bob - 8, cx + s * 1.1 + dir * 2, cy - bob - 2);
          ctx.stroke();
          // Legs
          ctx.strokeStyle = '#8a3a18'; ctx.lineWidth = 2;
          for (let L = 0; L < 3; L++) {
            const lx = cx + (L - 1) * 5;
            const kick = Math.sin(wobbleTime * 7 + c.phase + L) * 3 * dir;
            ctx.beginPath();
            ctx.moveTo(lx, cy - bob + 2);
            ctx.lineTo(lx + kick, cy + 5);
            ctx.stroke();
          }
        }
        // Fish swim mid-water
        for (const f of seaFish) {
          f.x += f.vx * dt;
          if (f.x < -40) f.x = WATER_WIDTH + 20;
          if (f.x > WATER_WIDTH + 40) f.x = -20;
          const fy = f.y + Math.sin(wobbleTime * 1.4 + f.phase) * f.amp;
          const fx = f.x - ox;
          if (fx < -50 || fx > W + 50) continue;
          const s = f.size;
          const dir = f.vx >= 0 ? 1 : -1;
          ctx.fillStyle = `hsl(${f.hue},70%,55%)`;
          ctx.beginPath();
          ctx.ellipse(fx, fy, s, s * 0.55, 0, 0, Math.PI * 2); ctx.fill();
          // Tail
          ctx.beginPath();
          ctx.moveTo(fx - dir * s * 0.85, fy);
          ctx.lineTo(fx - dir * s * 1.45, fy - s * 0.45);
          ctx.lineTo(fx - dir * s * 1.45, fy + s * 0.45);
          ctx.closePath(); ctx.fill();
          // Fin
          ctx.fillStyle = `hsl(${f.hue},65%,45%)`;
          ctx.beginPath();
          ctx.moveTo(fx - dir * 2, fy);
          ctx.lineTo(fx + dir * 2, fy - s * 0.75);
          ctx.lineTo(fx + dir * 6, fy);
          ctx.closePath(); ctx.fill();
          // Eye + stripe
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(fx + dir * s * 0.35, fy - 2, 2.2, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#111';
          ctx.beginPath(); ctx.arc(fx + dir * s * 0.4, fy - 2, 1.1, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = `hsla(${f.hue},80%,35%,0.5)`; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(fx - dir * 2, fy + 2); ctx.lineTo(fx + dir * s * 0.2, fy + 2); ctx.stroke();
        }
        // Occasional jellyfish — slow pulse drift
        for (const j of seaJellies) {
          j.y += j.vy * dt;
          j.x += Math.sin(wobbleTime * j.drift + j.phase) * 0.35 * dt;
          if (j.y < 40) { j.y = seabedSurfaceY(j.x) - 120; j.x = (j.x + 400) % WATER_WIDTH; }
          const jx = j.x - ox;
          if (jx < -60 || jx > W + 60) continue;
          const pulse = 1 + Math.sin(wobbleTime * j.pulse + j.phase) * 0.12;
          const bell = j.size * pulse;
          ctx.fillStyle = 'rgba(255,180,220,0.35)';
          ctx.beginPath();
          ctx.ellipse(jx, j.y, bell, bell * 0.65, 0, Math.PI, 0); ctx.fill();
          ctx.fillStyle = 'rgba(255,210,235,0.45)';
          ctx.beginPath();
          ctx.ellipse(jx, j.y + 2, bell * 0.7, bell * 0.4, 0, Math.PI, 0); ctx.fill();
          ctx.strokeStyle = 'rgba(255,200,230,0.55)'; ctx.lineWidth = 1.5; ctx.lineCap = 'round';
          for (let t = 0; t < 5; t++) {
            const tx = jx + (t - 2) * (bell * 0.28);
            const sway = Math.sin(wobbleTime * 1.6 + j.phase + t) * 4;
            ctx.beginPath();
            ctx.moveTo(tx, j.y + 2);
            ctx.quadraticCurveTo(tx + sway, j.y + bell * 0.9, tx - sway * 0.5, j.y + bell * 1.6);
            ctx.stroke();
          }
        }
        for (const b of bubbles) {
          b.y -= b.speed*dt; b.wobble += dt*0.05;
          if (b.y < -10) { b.y = H-100; b.x = Math.random()*WATER_WIDTH; }
          const bx=b.x-ox+Math.sin(b.wobble)*6;
          if (bx<-10||bx>W+10) continue;
          ctx.strokeStyle=`rgba(220,245,255,${0.4+Math.sin(b.wobble)*0.25})`;
          ctx.lineWidth=1.5; ctx.beginPath(); ctx.arc(bx,b.y,b.r,0,Math.PI*2); ctx.stroke();
        }
      } else {
        // Lunar landscape — starfield sky over grey moon surface
        const skyGrad=ctx.createLinearGradient(0,0,0,H);
        skyGrad.addColorStop(0,'#050508'); skyGrad.addColorStop(0.45,'#0c0c14');
        skyGrad.addColorStop(0.72,'#1a1820'); skyGrad.addColorStop(1,'#2a2a30');
        ctx.fillStyle=skyGrad; ctx.fillRect(0,0,W,H);
        // Stars (upper sky only)
        for (const st of stars) {
          const sx=st.x-ox*st.parallax;
          if (sx<-5||sx>W+5) continue;
          st.tw+=st.speed*dt*0.05;
          const tw=0.5+Math.sin(st.tw)*0.5;
          ctx.fillStyle=`rgba(255,255,255,${0.25+tw*0.7})`;
          ctx.beginPath(); ctx.arc(sx,st.y,st.r,0,Math.PI*2); ctx.fill();
        }
        // Distant Earth
        {
          const ex=earth.x-ox*0.2, ey=earth.y;
          if (ex>-earth.r*2 && ex<W+earth.r*2) {
            const eg=ctx.createRadialGradient(ex-18,ey-14,8,ex,ey,earth.r);
            eg.addColorStop(0,'#7ec8ff'); eg.addColorStop(0.45,'#2a6fd4');
            eg.addColorStop(0.75,'#1a4a9a'); eg.addColorStop(1,'#0a1a40');
            ctx.fillStyle=eg;
            ctx.beginPath(); ctx.arc(ex,ey,earth.r,0,Math.PI*2); ctx.fill();
            // Soft cloud swirls
            ctx.fillStyle='rgba(255,255,255,0.28)';
            ctx.beginPath(); ctx.ellipse(ex-20,ey-10,34,12,-0.3,0,Math.PI*2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(ex+25,ey+18,28,9,0.4,0,Math.PI*2); ctx.fill();
            // Night side crescent shadow
            ctx.fillStyle='rgba(0,0,0,0.35)';
            ctx.beginPath(); ctx.arc(ex+28,ey,earth.r*0.92,0,Math.PI*2); ctx.fill();
            // Thin atmosphere rim
            ctx.strokeStyle='rgba(160,210,255,0.45)'; ctx.lineWidth=3;
            ctx.beginPath(); ctx.arc(ex,ey,earth.r+2,0,Math.PI*2); ctx.stroke();
          }
        }
        // Far asymmetric hills (parallax skyline)
        for (const hill of lunarHills) {
          const hx=hill.x-ox*hill.parallax;
          if (hx<-hill.w||hx>W+hill.w) continue;
          const shade=Math.floor(52*hill.shade);
          const peakX = hx + hill.w * (0.35 + hill.skew * 0.25);
          const midX = hx + hill.w * (0.62 + hill.skew * 0.15);
          ctx.fillStyle=`rgb(${shade},${shade},${shade+8})`;
          ctx.beginPath();
          ctx.moveTo(hx, LUNAR_Y + 40);
          ctx.quadraticCurveTo(hx + hill.w * 0.18, hill.y + hill.h * 0.2, peakX, hill.y);
          ctx.quadraticCurveTo(midX, hill.y + hill.h * 0.15, hx + hill.w, LUNAR_Y + 40);
          ctx.closePath(); ctx.fill();
        }
        // Walkable hilly regolith — sample the asymmetric surface across the viewport
        {
          const dustGrad=ctx.createLinearGradient(0,LUNAR_Y-80,0,H);
          dustGrad.addColorStop(0,'#6e6e76'); dustGrad.addColorStop(0.4,'#8a8a92');
          dustGrad.addColorStop(1,'#585860');
          ctx.fillStyle=dustGrad;
          ctx.beginPath();
          ctx.moveTo(-4, H + 2);
          for (let sx = -4; sx <= W + 4; sx += 6) {
            ctx.lineTo(sx, lunarSurfaceY(sx + ox));
          }
          ctx.lineTo(W + 4, H + 2);
          ctx.closePath();
          ctx.fill();
          // Lit ridge edge along the hills
          ctx.strokeStyle = 'rgba(190,190,200,0.42)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          for (let sx = -4; sx <= W + 4; sx += 6) {
            const sy = lunarSurfaceY(sx + ox);
            if (sx === -4) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
          }
          ctx.stroke();
        }
        // Craters on the uneven surface
        for (const c of lunarCraters) {
          const cx=c.x-ox;
          if (cx<-50||cx>W+50) continue;
          const cy = lunarSurfaceY(c.x) + c.yOff;
          ctx.fillStyle='rgba(40,40,48,0.45)';
          ctx.beginPath(); ctx.ellipse(cx,cy,c.rx,c.ry,0,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle='rgba(200,200,210,0.25)'; ctx.lineWidth=1.5;
          ctx.beginPath(); ctx.ellipse(cx,cy-1,c.rx*0.95,c.ry*0.7,0,Math.PI,0); ctx.stroke();
        }
        // Scattered surface rocks
        for (const r of lunarRocks) {
          const rx=r.x-ox;
          if (rx<-20||rx>W+20) continue;
          const ry = lunarSurfaceY(r.x) - r.yOff;
          ctx.fillStyle='#4a4a52';
          ctx.beginPath();
          ctx.moveTo(rx,ry+r.h);
          ctx.lineTo(rx+r.w*0.15,ry);
          ctx.lineTo(rx+r.w*0.85,ry+2);
          ctx.lineTo(rx+r.w,ry+r.h);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle='rgba(160,160,170,0.35)';
          ctx.fillRect(rx+r.w*0.2,ry+2,r.w*0.45,3);
        }
        // Little aliens wander the lunar hills at random
        for (const a of lunarAliens) {
          if (a.pause > 0) {
            a.pause -= dt;
            a.vx *= 0.85;
          } else {
            const dx = a.target - a.x;
            if (Math.abs(dx) < 6) {
              // Arrived — chill, then pick a new random stroll
              a.pause = 50 + lunarHash(a.x * 0.02 + wobbleTime * 0.01) * 90;
              const roam = 80 + lunarHash(a.phase + wobbleTime * 0.02) * 200;
              a.target = Math.max(40, Math.min(SPACE_WIDTH - 40, a.home + (lunarHash(a.x + a.pause) - 0.5) * 2 * roam));
              a.vx = 0;
            } else {
              // Big lumber, tiny scurry
              const speed = Math.max(0.18, 0.55 - a.size * 0.008);
              a.vx = Math.sign(dx) * speed;
              a.x += a.vx * dt;
            }
          }
          // Tiny hop when cresting a steep bit
          const gy = lunarSurfaceY(a.x);
          const gyNext = lunarSurfaceY(a.x + a.vx * 8);
          if (Math.abs(gyNext - gy) > 10) a.hop = Math.min(1, a.hop + 0.15 * dt);
          else a.hop = Math.max(0, a.hop - 0.08 * dt);

          const ax = a.x - ox;
          if (ax < -40 || ax > W + 40) continue;
          const bob = Math.abs(Math.sin(wobbleTime * 5 + a.phase)) * (1.2 + a.size * 0.04) + a.hop * (4 + a.size * 0.15);
          const s = a.size;
          const ay = gy - Math.max(3, s * 0.12) - bob;
          const dir = a.vx >= 0 ? 1 : -1;

          if (a.kind === 0) {
            // Classic little green — round head, antenna, stubby legs
            ctx.strokeStyle = '#6ecf5a'; ctx.lineWidth = Math.max(1.5, s * 0.08);
            ctx.beginPath();
            ctx.moveTo(ax, ay - s * 1.1);
            ctx.lineTo(ax, ay - s * 1.55);
            ctx.stroke();
            ctx.fillStyle = '#8dff6a';
            ctx.beginPath(); ctx.arc(ax, ay - s * 1.6, Math.max(2, s * 0.12), 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#5bbf48';
            ctx.beginPath(); ctx.ellipse(ax, ay - s * 0.35, s * 0.55, s * 0.75, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#7ae868';
            ctx.beginPath(); ctx.ellipse(ax, ay - s * 0.85, s * 0.5, s * 0.45, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1a2a10';
            ctx.beginPath(); ctx.ellipse(ax - 0.28 * s * dir, ay - s * 0.9, s * 0.14, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(ax + 0.16 * s * dir, ay - s * 0.9, s * 0.14, s * 0.18, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(ax - 0.24 * s * dir, ay - s * 0.95, Math.max(0.8, s * 0.05), 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(ax + 0.2 * s * dir, ay - s * 0.95, Math.max(0.8, s * 0.05), 0, Math.PI * 2); ctx.fill();
            // Legs
            ctx.strokeStyle = '#4a9a3a'; ctx.lineWidth = Math.max(2, s * 0.1); ctx.lineCap = 'round';
            const kick = Math.sin(wobbleTime * 6 + a.phase) * (s * 0.2) * (Math.abs(a.vx) > 0.05 ? dir : 0);
            ctx.beginPath(); ctx.moveTo(ax - s * 0.2, ay); ctx.lineTo(ax - s * 0.2 + kick, ay + s * 0.35); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ax + s * 0.2, ay); ctx.lineTo(ax + s * 0.2 - kick, ay + s * 0.35); ctx.stroke();
          } else if (a.kind === 1) {
            // Purple hop-blob with twin antennae
            ctx.fillStyle = '#9b6bdb';
            ctx.beginPath(); ctx.ellipse(ax, ay - s * 0.35, s * 0.7, s * 0.55 + a.hop * 2, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#c49bff';
            ctx.beginPath(); ctx.ellipse(ax, ay - s * 0.55, s * 0.45, s * 0.3, 0, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#b88aef'; ctx.lineWidth = Math.max(1.5, s * 0.08);
            ctx.beginPath(); ctx.moveTo(ax - s * 0.25, ay - s * 0.7); ctx.quadraticCurveTo(ax - s * 0.5, ay - s * 1.3, ax - s * 0.3, ay - s * 1.45); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ax + s * 0.25, ay - s * 0.7); ctx.quadraticCurveTo(ax + s * 0.5, ay - s * 1.3, ax + s * 0.3, ay - s * 1.45); ctx.stroke();
            ctx.fillStyle = '#ffb0ef';
            ctx.beginPath(); ctx.arc(ax - s * 0.3, ay - s * 1.45, Math.max(2, s * 0.12), 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(ax + s * 0.3, ay - s * 1.45, Math.max(2, s * 0.12), 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1a1028';
            ctx.beginPath(); ctx.arc(ax - s * 0.2, ay - s * 0.45, Math.max(2, s * 0.12), 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(ax + s * 0.2, ay - s * 0.45, Math.max(2, s * 0.12), 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(ax - s * 0.16, ay - s * 0.5, Math.max(0.7, s * 0.04), 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(ax + s * 0.24, ay - s * 0.5, Math.max(0.7, s * 0.04), 0, Math.PI * 2); ctx.fill();
          } else {
            // Tiny grey — big eyes, skinny limbs
            ctx.fillStyle = '#c8c8d0';
            ctx.beginPath(); ctx.ellipse(ax, ay - s * 0.55, s * 0.4, s * 0.7, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#e8e8f0';
            ctx.beginPath(); ctx.ellipse(ax, ay - s * 1.05, s * 0.55, s * 0.5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#1a1a28';
            ctx.beginPath(); ctx.ellipse(ax - 0.2 * s * dir, ay - s * 1.05, s * 0.2, s * 0.24, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(ax + 0.14 * s * dir, ay - s * 1.05, s * 0.2, s * 0.24, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#7ec8ff';
            ctx.beginPath(); ctx.arc(ax - 0.16 * s * dir, ay - s * 1.1, Math.max(1, s * 0.07), 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(ax + 0.16 * s * dir, ay - s * 1.1, Math.max(1, s * 0.07), 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#a0a0aa'; ctx.lineWidth = Math.max(1.5, s * 0.08); ctx.lineCap = 'round';
            const kick = Math.sin(wobbleTime * 5.5 + a.phase) * (s * 0.25) * (Math.abs(a.vx) > 0.05 ? 1 : 0.2);
            ctx.beginPath(); ctx.moveTo(ax - s * 0.12, ay - s * 0.2); ctx.lineTo(ax - s * 0.35, ay - s * 0.6); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ax + s * 0.12, ay - s * 0.2); ctx.lineTo(ax + s * 0.35, ay - s * 0.6); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ax - s * 0.12, ay); ctx.lineTo(ax - s * 0.12 + kick * dir, ay + s * 0.35); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(ax + s * 0.12, ay); ctx.lineTo(ax + s * 0.12 - kick * dir, ay + s * 0.35); ctx.stroke();
          }
        }
      }

      // ── Draw zones ──
      const zonesToDraw = currentWorld==='island' ? zones : currentWorld==='underwater' ? waterZones : spaceZones;
      if (currentWorld==='space') {
        for (const plat of ASTEROID_PLATFORMS) {
          const py=plat.baseY+Math.sin(wobbleTime*plat.driftSpeed+plat.phase)*plat.driftRange;
          const sx=plat.x-ox;
          if (sx<-plat.w||sx>W+plat.w) continue;
          // Lunar rock shelf / crater rim
          ctx.fillStyle='#5a5a64';
          roundRect(ctx,sx,py,plat.w,plat.h,10); ctx.fill();
          ctx.fillStyle='#7a7a84';
          roundRect(ctx,sx+5,py+3,plat.w-10,plat.h*0.32,6); ctx.fill();
          // Crater dimples on the ledge
          ctx.fillStyle='rgba(30,30,36,0.5)';
          for (let k=0;k<3;k++) {
            ctx.beginPath();
            ctx.ellipse(sx+22+k*(plat.w/3.4),py+plat.h*0.55,7,3.5,0,0,Math.PI*2); ctx.fill();
          }
          // Lit rim edge
          ctx.strokeStyle='#a8a8b4'; ctx.lineWidth=2;
          roundRect(ctx,sx,py,plat.w,plat.h,10); ctx.stroke();
          // Tiny dust sparkles
          ctx.fillStyle='rgba(220,220,230,0.35)';
          ctx.fillRect(sx+12,py+6,3,2); ctx.fillRect(sx+plat.w-18,py+8,2,2);
        }
      } else if (currentWorld==='underwater') {
        for (const plat of CORAL_PLATFORMS) {
          const py=plat.baseY+Math.sin(wobbleTime*plat.driftSpeed+plat.phase)*plat.driftRange;
          const sx=plat.x-ox;
          if (sx<-plat.w||sx>W+plat.w) continue;
          ctx.fillStyle='#1f6b63'; roundRect(ctx,sx,py,plat.w,plat.h,12); ctx.fill();
          ctx.fillStyle='#2f9e8f'; roundRect(ctx,sx+6,py+3,plat.w-12,plat.h*0.35,8); ctx.fill();
          // Coral nubs + little seagrass tufts on each ledge
          ctx.fillStyle='#d85a70';
          for (let k=0;k<3;k++) {
            ctx.beginPath();
            ctx.ellipse(sx+18+k*(plat.w/3.2),py-6,5,10,0,0,Math.PI*2); ctx.fill();
          }
          ctx.strokeStyle='#6bcf5a'; ctx.lineWidth=2; ctx.lineCap='round';
          for (let g=0;g<4;g++) {
            const gx=sx+14+g*(plat.w/4.2);
            const lean=Math.sin(wobbleTime*0.9+plat.phase+g)*5;
            ctx.beginPath(); ctx.moveTo(gx,py); ctx.quadraticCurveTo(gx+lean*0.5,py-18,gx+lean,py-32); ctx.stroke();
          }
          ctx.strokeStyle='#7fd9c8'; ctx.lineWidth=2; roundRect(ctx,sx,py,plat.w,plat.h,12); ctx.stroke();
        }
        // Underwater springboards on the seabed
        for (const s of waterSprings) {
          const sx=s.x-ox;
          if (sx<-s.w||sx>W) continue;
          ctx.fillStyle='#0d4a5c'; ctx.fillRect(sx,s.y+10,s.w,10);
          ctx.strokeStyle='#7fd9ff'; ctx.lineWidth=2.5;
          for (let i=0;i<3;i++){
            ctx.beginPath();
            ctx.moveTo(sx+s.w*0.28,s.y+12-i*4);
            ctx.lineTo(sx+s.w*0.72,s.y+12-i*4);
            ctx.stroke();
          }
          ctx.fillStyle=s.bounced?'#3ecfff':'#1aa6d6';
          ctx.fillRect(sx,s.y,s.w,8);
          ctx.fillStyle='rgba(200,245,255,0.45)'; ctx.fillRect(sx,s.y,s.w,3);
        }
      }
      for (let zi=0; zi<zonesToDraw.length; zi++) {
        const z=zonesToDraw[zi];
        const sx=z.x-ox, sy=(z.hit||z.bumping)?z.y+z.bounceY:z.y;
        if (sx<-200||sx>W+200) continue;
        if (z.hit&&z.growing>0) {
          const scale=1+z.growing*4, ew=z.w*scale, eh=z.h*scale;
          const ex=sx+z.w/2-ew/2, ey=sy+z.h/2-eh/2;
          ctx.fillStyle=currentWorld==='space'?'rgba(230,220,255,0.97)'
            : currentWorld==='underwater'?'rgba(200,245,255,0.97)':'rgba(255,245,200,0.97)';
          ctx.fillRect(ex,ey,ew,eh); ctx.strokeStyle='#26215C'; ctx.lineWidth=3; ctx.strokeRect(ex,ey,ew,eh);
          if (z.growing>0.8 && z.product) {
            ctx.fillStyle='#26215C'; ctx.textAlign='center';
            ctx.font='bold '+Math.round(ew/5)+'px sans-serif'; ctx.fillText(z.product.emoji||'🎁',ex+ew/2,ey+eh*0.35);
            ctx.font='bold '+Math.round(ew/10)+'px sans-serif'; ctx.fillText(z.product.name,ex+ew/2,ey+eh*0.58);
            ctx.fillStyle='#D85A30'; ctx.font='bold '+Math.round(ew/9)+'px sans-serif';
            ctx.fillText('€'+Number(z.product.price).toFixed(2),ex+ew/2,ey+eh*0.75); ctx.textAlign='left';
          }
        } else if (!z.hit) {
          drawColoredCube(sx,sy,z.w,z.h,zi+1);
        }
      }

      // ── Island-only overlays ──
      if (currentWorld==='island') {
        for (const c of clouds) {
          const sx=c.x-ox;
          if (sx<-c.w||sx>W) continue;
          ctx.fillStyle=`rgba(255,255,255,${c.opacity})`;
          ctx.beginPath();
          ctx.ellipse(sx+c.w*0.5,c.y+c.h*0.6,c.w*0.5,c.h*0.4,0,0,Math.PI*2);
          ctx.ellipse(sx+c.w*0.3,c.y+c.h*0.45,c.w*0.3,c.h*0.38,0,0,Math.PI*2);
          ctx.ellipse(sx+c.w*0.72,c.y+c.h*0.45,c.w*0.26,c.h*0.35,0,0,Math.PI*2);
          ctx.fill();
        }
        for (const s of springboards) {
          const sx=s.x-ox;
          if (sx<-s.w||sx>W) continue;
          ctx.fillStyle='#8B4513'; ctx.fillRect(sx,s.y+10,s.w,10);
          ctx.strokeStyle='#C0C0C0'; ctx.lineWidth=3;
          for (let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(sx+s.w*0.3,s.y+12-i*4);ctx.lineTo(sx+s.w*0.7,s.y+12-i*4);ctx.stroke();}
          ctx.fillStyle=s.bounced?'#FF6B00':'#FF9500'; ctx.fillRect(sx,s.y,s.w,8);
          ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.fillRect(sx,s.y,s.w,3);
        }

        // ── Spectacular portal sign ──
        const signSx = islandSign.x-ox;
        if (signSx>-200&&signSx<W+200) {
          const glow=islandSign.glow;
          const cx=signSx+islandSign.w/2, cy=islandSign.y+islandSign.h*0.38;
          ctx.save();
          const halo=ctx.createRadialGradient(cx,cy,0,cx,cy,120+glow*30);
          halo.addColorStop(0,`rgba(127,119,221,${0.18+glow*0.15})`); halo.addColorStop(1,'rgba(127,119,221,0)');
          ctx.fillStyle=halo; ctx.beginPath(); ctx.arc(cx,cy,150,0,Math.PI*2); ctx.fill();
          for (let r=0;r<3;r++) {
            const radius=52+r*18,speed=(r+1)*0.7,alpha=0.5+glow*0.4-r*0.1;
            ctx.strokeStyle=r===0?`rgba(180,160,255,${alpha})`:r===1?`rgba(100,200,255,${alpha})`:`rgba(255,180,255,${alpha})`;
            ctx.lineWidth=4-r;
            ctx.beginPath(); ctx.ellipse(cx,cy,radius,radius*0.35,wobbleTime*speed*(r%2===0?1:-1),0,Math.PI*2); ctx.stroke();
          }
          const pg=ctx.createRadialGradient(cx,cy,0,cx,cy,50);
          pg.addColorStop(0,`rgba(180,100,255,${0.5+glow*0.4})`); pg.addColorStop(1,'rgba(0,0,0,0)');
          ctx.fillStyle=pg; ctx.beginPath(); ctx.ellipse(cx,cy,50,18,0,0,Math.PI*2); ctx.fill();
          for (let p=0;p<8;p++) {
            const angle=wobbleTime*1.2+p*(Math.PI*2/8);
            const pr=65+Math.sin(wobbleTime*2+p)*12;
            ctx.fillStyle=`rgba(255,220,255,${0.4+Math.sin(wobbleTime*3+p)*0.4})`;
            ctx.beginPath(); ctx.arc(cx+Math.cos(angle)*pr,cy+Math.sin(angle)*pr*0.35,2.5,0,Math.PI*2); ctx.fill();
          }
          ctx.shadowColor=`rgba(127,119,221,${0.6+glow*0.4})`; ctx.shadowBlur=20+glow*20;
          ctx.fillStyle='#6b4a2f'; ctx.fillRect(cx-7,islandSign.y+islandSign.h*0.6,14,islandSign.h*0.4);
          ctx.fillStyle='#8a5d36'; ctx.save();
          ctx.translate(cx,islandSign.y+islandSign.h*0.72); ctx.rotate(Math.sin(wobbleTime*1.2)*0.05);
          ctx.fillRect(-52,-22,104,44); ctx.strokeStyle='#4a3320'; ctx.lineWidth=3; ctx.strokeRect(-52,-22,104,44);
          ctx.font='bold 26px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
          ctx.fillStyle=`rgba(220,200,255,${0.8+glow*0.2})`; ctx.fillText('🌕',0,0); ctx.restore();
          ctx.fillStyle=`rgba(220,200,255,${0.85+glow*0.15})`;
          ctx.font="bold 9px 'Press Start 2P',monospace"; ctx.textAlign='center';
          ctx.fillText('LUNAR WORLD',cx,islandSign.y-18);
          ctx.fillStyle=`rgba(255,255,255,${0.6+glow*0.3})`;
          ctx.font="bold 7px 'Press Start 2P',monospace";
          ctx.fillText('WALK IN TO BLAST OFF →',cx,islandSign.y-4);
          ctx.restore(); ctx.textAlign='left';
        }

        // ── Dive buoy → Underwater Cove ──
        const diveSx = divePortal.x-ox;
        if (diveSx>-140&&diveSx<W+140) {
          const glow=divePortal.glow;
          const cx=diveSx+divePortal.w/2;
          ctx.save();
          ctx.shadowColor=`rgba(60,180,220,${0.5+glow*0.4})`; ctx.shadowBlur=18+glow*14;
          ctx.fillStyle='#c45c26'; ctx.fillRect(cx-5,divePortal.y+20,10,divePortal.h-20);
          ctx.fillStyle=`rgba(30,140,200,${0.75+glow*0.2})`;
          ctx.beginPath(); ctx.arc(cx,divePortal.y+18,22,0,Math.PI*2); ctx.fill();
          ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx-6,divePortal.y+12,5,0,Math.PI*2); ctx.fill();
          ctx.fillStyle=`rgba(180,240,255,${0.7+glow*0.3})`;
          ctx.font="bold 8px 'Press Start 2P',monospace"; ctx.textAlign='center';
          ctx.fillText('🫧 DIVE',cx,divePortal.y-10);
          ctx.fillStyle=`rgba(255,255,255,${0.55+glow*0.3})`;
          ctx.font="bold 6px 'Press Start 2P',monospace";
          ctx.fillText('UNDERWATER',cx,divePortal.y+2);
          ctx.restore(); ctx.textAlign='left';
        }
      } else if (currentWorld==='space') {
        // Space portal back home
        const sx=spacePortal.x-ox;
        if (sx>-120&&sx<W+120) {
          const glow=spacePortal.glow;
          ctx.save();
          ctx.shadowColor=`rgba(255,210,90,${0.5+glow*0.5})`; ctx.shadowBlur=22+glow*16;
          const ringY=spacePortal.y+spacePortal.h/2+Math.sin(wobbleTime*1.8)*8;
          ctx.strokeStyle=`rgba(180,255,255,${0.6+glow*0.4})`; ctx.lineWidth=6;
          ctx.beginPath(); ctx.ellipse(sx+spacePortal.w/2,ringY,spacePortal.w/2,spacePortal.h/2,0,0,Math.PI*2); ctx.stroke();
          ctx.strokeStyle=`rgba(255,180,255,${0.4+glow*0.3})`; ctx.lineWidth=3;
          ctx.beginPath(); ctx.ellipse(sx+spacePortal.w/2,ringY,spacePortal.w/2-8,spacePortal.h/2-8,wobbleTime,0,Math.PI*2); ctx.stroke();
          ctx.fillStyle='#fff'; ctx.font="bold 8px 'Press Start 2P',monospace"; ctx.textAlign='center';
          ctx.fillText('🌴 HOME',sx+spacePortal.w/2,spacePortal.y-12);
          ctx.restore(); ctx.textAlign='left';
        }
      } else if (currentWorld==='underwater') {
        // Surface portal → Artist Lounge (island)
        const sx=loungePortal.x-ox;
        if (sx>-160&&sx<W+160) {
          const glow=loungePortal.glow;
          const cx=sx+loungePortal.w/2;
          const cy=loungePortal.y+loungePortal.h/2+Math.sin(wobbleTime*1.6)*6;
          ctx.save();
          ctx.shadowColor=`rgba(255,180,90,${0.45+glow*0.45})`; ctx.shadowBlur=20+glow*16;
          ctx.strokeStyle=`rgba(255,210,120,${0.65+glow*0.3})`; ctx.lineWidth=5;
          ctx.beginPath(); ctx.ellipse(cx,cy,loungePortal.w/2,loungePortal.h/2,0,0,Math.PI*2); ctx.stroke();
          ctx.strokeStyle=`rgba(100,220,255,${0.45+glow*0.3})`; ctx.lineWidth=3;
          ctx.beginPath(); ctx.ellipse(cx,cy,loungePortal.w/2-10,loungePortal.h/2-10,-wobbleTime,0,Math.PI*2); ctx.stroke();
          ctx.fillStyle='#fff'; ctx.font="bold 7px 'Press Start 2P',monospace"; ctx.textAlign='center';
          ctx.fillText('🎨 ARTIST LOUNGE',cx,loungePortal.y-16);
          ctx.fillStyle=`rgba(200,240,255,${0.7+glow*0.25})`;
          ctx.font="bold 6px 'Press Start 2P',monospace";
          ctx.fillText('SURFACE ↑',cx,loungePortal.y-4);
          ctx.restore(); ctx.textAlign='left';
        }
      }

      // ── Ocean intro ──
      if (!introDone) {
        const SHORE_X=500+4;
        const waterLine=GROUND_Y-20, miloScreenX=player.x-ox;
        const emerge=Math.max(0,Math.min((player.x-(SHORE_X-220))/220,1));
        // Keep the sea on the left — stop at the shore instead of flooding the whole canvas
        const shoreScreenX=SHORE_X-ox;
        const oceanW=Math.max(0,Math.min(W,shoreScreenX+36));

        // Deep water behind Milo (left side only)
        ctx.fillStyle='rgba(15,60,140,0.92)';
        ctx.fillRect(0,waterLine,oceanW,H-waterLine);
        ctx.fillStyle='rgba(30,100,180,0.55)';
        ctx.fillRect(0,waterLine,oceanW,H-waterLine);

        // Soft shore fade so the water doesn't hard-cut into the sand
        if (oceanW>0 && oceanW<W) {
          const fade=ctx.createLinearGradient(oceanW-40,0,oceanW+20,0);
          fade.addColorStop(0,'rgba(30,100,180,0.45)');
          fade.addColorStop(1,'rgba(30,100,180,0)');
          ctx.fillStyle=fade;
          ctx.fillRect(oceanW-40,waterLine,60,H-waterLine);
        }

        // Draw Milo fully first so he is never hidden behind wave blobs
        drawCharacter(ox,oy);

        // Soft water veil over his submerged legs (clears as he emerges)
        const veilTop=waterLine + (player.y+player.h-waterLine)*emerge*0.15;
        const veilAlpha=0.55*(1-emerge*0.85);
        const veilW=Math.min(player.w+28,Math.max(0,oceanW-(miloScreenX-14)));
        if (veilW>0) {
          ctx.fillStyle=`rgba(20,80,160,${veilAlpha})`;
          ctx.fillRect(miloScreenX-14,veilTop,veilW,H-veilTop);
        }

        // Subtle foam crest at the surface — only over the ocean span
        ctx.fillStyle=`rgba(180,220,255,${0.35+0.25*(1-emerge)})`;
        for (let i=0;i<18;i++) {
          const wx=((i*95+introTimer*2.2)%(oceanW+80))-40;
          if (wx< -20 || wx>oceanW+10) continue;
          const wr=10+(i%3)*3;
          ctx.beginPath();
          ctx.ellipse(wx,waterLine+2,wr,3.5,0,0,Math.PI*2);
          ctx.fill();
        }
        // Thin highlight along the water surface
        ctx.fillStyle=`rgba(200,230,255,${0.4+0.3*emerge})`;
        ctx.fillRect(0,waterLine,oceanW,2);
      }

      if (introDone) {
        drawCharacter(ox,oy);
        // Breath bubbles rising from the helmet/mask
        for (let i=breathBubbles.length-1;i>=0;i--) {
          const b=breathBubbles[i];
          b.life -= dt; b.y += b.vy*dt; b.wobble += dt*0.08;
          b.x += Math.sin(b.wobble)*0.35*dt;
          if (b.life <= 0 || b.y < -20) { breathBubbles.splice(i,1); continue; }
          const bx=b.x-ox, by=b.y-oy;
          if (bx<-20||bx>W+20) continue;
          const a=Math.max(0.15, Math.min(0.7, b.life/50));
          ctx.strokeStyle=`rgba(210,235,255,${a})`;
          ctx.lineWidth=1.4;
          ctx.beginPath(); ctx.arc(bx,by,b.r,0,Math.PI*2); ctx.stroke();
          ctx.fillStyle=`rgba(255,255,255,${a*0.25})`;
          ctx.beginPath(); ctx.arc(bx-b.r*0.25,by-b.r*0.25,b.r*0.35,0,Math.PI*2); ctx.fill();
        }
        updateToys(dt);
        drawToys(ox,oy);
        if (greetTimer < GREET_DUR) {
          greetTimer += dt;
          const cc = currentCustom();
          drawGreeting(player.x-ox, player.y-oy, cc.name, cc.color);
        }
      }
      updateAndDrawConfetti(dt);
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
    // Refs are stable; restart only when world catalog / character / cart UI changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character, loading, islandProducts, spaceProducts, underwaterProducts, showCart, setScore, startWorld]);
}
import { useEffect } from 'react';
import milo1 from '../milo1.png';
import milo2 from '../milo2.png';
import milo3 from '../milo3.png';
import islandBg from '../Artboard_1.svg';
import { seededColor, seededLightColor } from '../utils/colors';
import { playSpringSound, playCubeHitSound, playPickupSound } from './audio';
import {
  W, H, GRAVITY, JUMP, GROUND_Y, rectsOverlap, PZ, PYRAMID_PLATFORMS,
  SPACE_W_TOTAL, SPACE_ZONES, ASTEROID_PLATFORMS, GRAVITY_SPACE, JUMP_SPACE,
} from './constants';

export function useGameLoop({
  canvasRef, keysRef, animRef, springboardsRef,
  setPopupRef, setWorldRef, cartRef, customizationRef,
  recordDiscoveryRef, pausedRef, celebrateRef, finaleRef,
  character, loading, islandProducts, spaceProducts, showCart, setScore,
}) {
  useEffect(() => {
    if (!character || loading || islandProducts.length === 0) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const bg     = new Image(); bg.src = islandBg;
    const mf     = [new Image(), new Image(), new Image()];
    mf[0].src = milo1; mf[1].src = milo2; mf[2].src = milo3;
    const isCat = character === 'cat';
    const TILE  = 32;
    const ground = Array.from({length:200},(_,i)=>({x:i*TILE,y:GROUND_Y,w:TILE,h:30}));

    const zones = PZ.map((z,i) => ({
      ...z, product: islandProducts[i % islandProducts.length],
      triggered:false, glowTimer:0, active:false, hit:false, growing:0, bounceY:0,
    }));

    const player = {x:60, y:GROUND_Y-35, w:36, h:52, vx:0, vy:0, onGround:false, dir:1, frame:0, frameTimer:0, moving:false};
    const springboards = springboardsRef.current;

    let cameraX=0, targetCameraX=0, camWobbleX=0, camWobbleY=0;
    let wobbleTime=0, scoreLocal=0, lastTime=0, introTimer=0, introDone=false;
    let greetTimer=0;               // counts up once the intro finishes → greeting bubble
    const GREET_DUR=190;            // ~3.2s at 60fps

    let currentWorld = 'island';
    const ISLAND_WIDTH = 4500, SPACE_WIDTH = SPACE_W_TOTAL;

    const islandSign  = {x:4280, y:160, w:120, h:180, glow:0};
    const spacePortal = {x:120,  y:600,           w:60,  h:100, glow:0};

    const spaceZones = SPACE_ZONES.map((z,i) => ({
      ...z, product: spaceProducts[i % spaceProducts.length],
      hit:false, growing:0, bounceY:0, bumping:false,
    }));

    const stars = Array.from({length:160}, () => ({
      x: Math.random()*SPACE_WIDTH, y: Math.random()*(H-100),
      r: 0.6+Math.random()*1.8, tw: Math.random()*Math.PI*2,
      speed: 0.2+Math.random()*0.5, parallax: 0.3+Math.random()*0.4,
    }));
    const nebulae = Array.from({length:6}, (_,i) => ({
      x: i*(SPACE_WIDTH/6)+Math.random()*300, y: 150+Math.random()*500,
      r: 180+Math.random()*220, hue: [280,200,320,190,260,310][i], parallax: 0.15,
    }));

    let transition = null;
    function startTransition(toWorld, targetX) {
      transition = {phase:'shake', timer:0, fromWorld:currentWorld, toWorld, targetX};
    }

    const clouds = [
      {x:200,y:150,w:280,h:90,speed:0.5,dir:1,opacity:0.85},
      {x:600,y:150,w:240,h:80,speed:0.8,dir:-1,opacity:0.6},
      {x:1000,y:150,w:320,h:100,speed:0.4,dir:1,opacity:0.75},
      {x:1400,y:120,w:220,h:75,speed:1.0,dir:-1,opacity:0.5},
      {x:1800,y:150,w:300,h:95,speed:0.6,dir:1,opacity:0.9},
      {x:2200,y:140,w:350,h:110,speed:0.35,dir:-1,opacity:0.65},
      {x:2600,y:150,w:260,h:85,speed:0.9,dir:1,opacity:0.45},
      {x:3000,y:130,w:310,h:100,speed:0.55,dir:-1,opacity:0.8},
      {x:400,y:150,w:280,h:90,speed:0.7,dir:1,opacity:0.55},
      {x:900,y:150,w:330,h:105,speed:0.45,dir:-1,opacity:0.7},
      {x:1300,y:150,w:250,h:80,speed:0.65,dir:1,opacity:0.4},
      {x:1700,y:150,w:360,h:115,speed:0.5,dir:-1,opacity:0.95},
      {x:2100,y:150,w:290,h:92,speed:0.75,dir:1,opacity:0.6},
      {x:2500,y:150,w:340,h:108,speed:0.42,dir:-1,opacity:0.5},
      {x:2900,y:150,w:270,h:86,speed:0.88,dir:1,opacity:0.78},
      {x:3200,y:150,w:320,h:102,speed:0.58,dir:-1,opacity:0.42},
      {x:3500,y:150,w:300,h:96,speed:0.62,dir:1,opacity:0.88},
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
    // glow. Only drawn once the player has discovered EVERY toy (gated by
    // finaleRef, set from React). Sits behind the sprite like the normal aura.
    const FINALE_RAINBOW = ['#FF6EB4','#FFD700','#1D9E75','#4FC3F7','#7F77DD','#D85A30'];
    function drawFinaleAura(sx, sy) {
      const cx = sx + player.w/2, cy = sy + player.h*0.55;
      const pulse = 0.5 + Math.sin(wobbleTime*4)*0.5;
      ctx.save();
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
        ctx.globalAlpha = 0.5 + pulse*0.3;
        ctx.beginPath();
        ctx.ellipse(cx, cy, player.w*1.12, player.h*0.72, a, a, a + Math.PI*0.7);
        ctx.stroke();
      }
      // Sparkle motes orbiting the character.
      ctx.globalAlpha = 0.85;
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
      if (!frame.complete) return;
      const { name, color, hat } = currentCustom();

      if (finaleRef && finaleRef.current) drawFinaleAura(sx, sy);

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
      if (player.dir === -1) {
        ctx.translate(sx+player.w,0); ctx.scale(-1,1);
        ctx.drawImage(frame,0,sy,player.w,player.h);
        if (isCat) { ctx.globalAlpha=0.42; ctx.fillStyle=color; ctx.fillRect(4,sy+16,player.w-8,player.h-20); ctx.globalAlpha=1; }
      } else {
        ctx.drawImage(frame,sx,sy,player.w,player.h);
        if (isCat) { ctx.globalAlpha=0.42; ctx.fillStyle=color; ctx.fillRect(sx+4,sy+16,player.w-8,player.h-20); ctx.globalAlpha=1; }
      }
      ctx.restore();

      const cx = sx + player.w/2;
      drawHat(cx, sy, color, hat);
      const plateBottom = sy - (hat && hat !== 'none' ? 20 : 6);
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

      if (!introDone) {
        const SHORE_X = 500+4;
        introTimer += dt;
        player.x = -30+introTimer*0.35; player.vx=2.5; player.dir=1; player.moving=true; /*DEBUG_SLOW*/
        player.frameTimer += dt;
        if (player.frameTimer>6) { player.frameTimer=0; player.frame=(player.frame+1)%3; }
        if (player.x >= SHORE_X) { introDone=true; player.x=SHORE_X; player.moving=false; }
      }

      const paused = pausedRef ? pausedRef.current : showCart;
      if (!paused && introDone && !transition) {
        const inSpace  = currentWorld==='space';
        const grav     = inSpace ? GRAVITY_SPACE : GRAVITY;
        const jumpV    = inSpace ? JUMP_SPACE    : JUMP;
        const activeZones = inSpace ? spaceZones : zones;
        const worldW   = inSpace ? SPACE_WIDTH : ISLAND_WIDTH;

        player.moving = false;
        if (keysRef.current['ArrowLeft'])       { player.vx=-3.2; player.dir=-1; player.moving=true; }
        else if (keysRef.current['ArrowRight']) { player.vx= 3.2; player.dir= 1; player.moving=true; }
        else player.vx *= 0.75;
        if ((keysRef.current['ArrowUp']||keysRef.current[' ']) && player.onGround) { player.vy=jumpV; player.onGround=false; }
        if (player.moving && player.onGround) { player.frameTimer+=dt; if(player.frameTimer>6){player.frameTimer=0;player.frame=(player.frame+1)%3;} }
        else player.frame = 0;

        player.vy += grav*dt; player.x += player.vx*dt; player.y += player.vy*dt;
        player.x = Math.max(0,Math.min(player.x,worldW-player.w)); player.onGround=false;

        if (!inSpace) {
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
        } else {
          for (const plat of ASTEROID_PLATFORMS) {
            const py = plat.baseY+Math.sin(wobbleTime*plat.driftSpeed+plat.phase)*plat.driftRange;
            if (player.x+player.w>plat.x && player.x<plat.x+plat.w && player.vy>=0 &&
                player.y+player.h>py && player.y+player.h<py+plat.h+20 &&
                (player.y+player.h-player.vy)<=py+4) {
              player.y=py-player.h; player.vy=0; player.onGround=true;
            }
          }
          if (player.y>1300) { player.y=400; player.vy=0; }
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
          if (z.standingOn&&!z.hit&&(keysRef.current['ArrowUp']||keysRef.current[' '])&&player.onGround) {
            z.bumping=true; z.bounceY=-10; z.standingOn=false;
            player.vy=jumpV*0.8; player.onGround=false;
            scoreLocal+=100; setScore(scoreLocal);
            playCubeHitSound();
            setTimeout(()=>{z.hit=true;z.growing=0;setPopupRef.current?.(z.product);recordDiscoveryRef?.current?.(z.product);},320);
          }
          if (z.bumping&&!z.hit) z.bounceY=Math.min(z.bounceY+1.8,0);
          if (z.hit&&z.growing<1) z.growing=Math.min(z.growing+0.05,1);
        }

        if (!inSpace && player.y>GROUND_Y+120) { player.y=GROUND_Y-35; player.vy=0; }

        if (!inSpace) {
          for (const s of springboards) {
            if (rectsOverlap({x:player.x,y:player.y,w:player.w,h:player.h},{x:s.x,y:s.y,w:s.w,h:s.h})) {
              if (player.vy>=0 && player.y+player.h-s.y<20) {
                player.y=s.y-player.h; player.vy=-28; player.onGround=false;
                s.bounced=true; playSpringSound();
                setTimeout(()=>{s.bounced=false;},300);
              }
            }
          }
          for (const c of clouds) {
            c.x += c.speed*c.dir;
            if (c.x<0||c.x+c.w>ISLAND_WIDTH) c.dir*=-1;
            const ct={x:c.x+c.w*0.1,y:c.y+c.h*0.2,w:c.w*0.8,h:10};
            if (rectsOverlap({x:player.x,y:player.y,w:player.w,h:player.h},ct)) {
              if (player.vy>=0&&player.y+player.h-ct.y<20) {
                player.y=ct.y-player.h; player.vy=0; player.onGround=true; player.x+=c.speed*c.dir;
              }
            }
          }
          islandSign.glow = (Math.sin(wobbleTime*2)+1)/2;
          if (rectsOverlap({x:player.x,y:player.y,w:player.w,h:player.h},islandSign)) startTransition('space',250);
        } else {
          spacePortal.glow = (Math.sin(wobbleTime*2)+1)/2;
          if (rectsOverlap({x:player.x,y:player.y,w:player.w,h:player.h},spacePortal)) startTransition('island',4200);
        }

        targetCameraX = Math.max(0,Math.min(player.x-220,worldW-W));
        cameraX += (targetCameraX-cameraX)*0.08*dt;
        wobbleTime += dt*0.04;
        const wi = player.moving?1.2:0.4;
        camWobbleX = Math.sin(wobbleTime*1.3)*wi;
        camWobbleY = Math.sin(wobbleTime*2.1)*wi*0.6;
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
            player.x=t.targetX; player.y=t.toWorld==='space'?450:GROUND_Y-35;
            player.vx=0; player.vy=0;
            const ww=t.toWorld==='space'?SPACE_WIDTH:ISLAND_WIDTH;
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
      } else {
        const skyGrad=ctx.createLinearGradient(0,0,0,H);
        skyGrad.addColorStop(0,'#0a0420'); skyGrad.addColorStop(0.55,'#160a3a'); skyGrad.addColorStop(1,'#2a0f4a');
        ctx.fillStyle=skyGrad; ctx.fillRect(0,0,W,H);
        for (const n of nebulae) {
          const nx=n.x-ox*n.parallax;
          if (nx<-n.r*2||nx>W+n.r*2) continue;
          const grad=ctx.createRadialGradient(nx,n.y,0,nx,n.y,n.r);
          grad.addColorStop(0,`hsla(${n.hue},85%,60%,0.22)`); grad.addColorStop(1,`hsla(${n.hue},85%,60%,0)`);
          ctx.fillStyle=grad; ctx.beginPath(); ctx.arc(nx,n.y,n.r,0,Math.PI*2); ctx.fill();
        }
        for (const st of stars) {
          const sx=st.x-ox*st.parallax;
          if (sx<-5||sx>W+5) continue;
          st.tw+=st.speed*dt*0.05;
          const tw=0.5+Math.sin(st.tw)*0.5;
          ctx.fillStyle=`rgba(255,255,255,${0.3+tw*0.7})`;
          ctx.beginPath(); ctx.arc(sx,st.y,st.r,0,Math.PI*2); ctx.fill();
        }
      }

      // ── Draw zones ──
      const zonesToDraw = currentWorld==='island' ? zones : spaceZones;
      if (currentWorld==='space') {
        for (const plat of ASTEROID_PLATFORMS) {
          const py=plat.baseY+Math.sin(wobbleTime*plat.driftSpeed+plat.phase)*plat.driftRange;
          const sx=plat.x-ox;
          if (sx<-plat.w||sx>W+plat.w) continue;
          ctx.fillStyle='#5b4a6e'; roundRect(ctx,sx,py,plat.w,plat.h,14); ctx.fill();
          ctx.fillStyle='rgba(255,255,255,0.12)'; roundRect(ctx,sx+6,py+4,plat.w-12,plat.h*0.35,8); ctx.fill();
          ctx.strokeStyle='#8a78a8'; ctx.lineWidth=2; roundRect(ctx,sx,py,plat.w,plat.h,14); ctx.stroke();
        }
      }
      for (let zi=0; zi<zonesToDraw.length; zi++) {
        const z=zonesToDraw[zi];
        const sx=z.x-ox, sy=(z.hit||z.bumping)?z.y+z.bounceY:z.y;
        if (sx<-200||sx>W+200) continue;
        if (z.hit&&z.growing>0) {
          const scale=1+z.growing*4, ew=z.w*scale, eh=z.h*scale;
          const ex=sx+z.w/2-ew/2, ey=sy+z.h/2-eh/2;
          ctx.fillStyle=currentWorld==='space'?'rgba(230,220,255,0.97)':'rgba(255,245,200,0.97)';
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
          ctx.fillStyle=`rgba(220,200,255,${0.8+glow*0.2})`; ctx.fillText('🚀',0,0); ctx.restore();
          ctx.fillStyle=`rgba(220,200,255,${0.85+glow*0.15})`;
          ctx.font="bold 9px 'Press Start 2P',monospace"; ctx.textAlign='center';
          ctx.fillText('SPACE WORLD',cx,islandSign.y-18);
          ctx.fillStyle=`rgba(255,255,255,${0.6+glow*0.3})`;
          ctx.font="bold 7px 'Press Start 2P',monospace";
          ctx.fillText('WALK IN TO BLAST OFF →',cx,islandSign.y-4);
          ctx.restore(); ctx.textAlign='left';
        }
      } else {
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
      }

      // ── Ocean intro ──
      if (!introDone) {
        const SHORE_X=500+4;
        const waterLine=GROUND_Y-20, miloScreenX=player.x-ox;
        const shoreProgress=Math.min(player.x/SHORE_X,1);
        const shoreScreenX=SHORE_X-ox;
        ctx.fillStyle='rgba(15,60,140,0.92)';
        ctx.fillRect(0,waterLine,Math.max(shoreScreenX+60,W),H-waterLine);
        ctx.fillStyle='rgba(30,100,180,0.75)';
        ctx.fillRect(0,waterLine,Math.max(shoreScreenX+40,W),H-waterLine);
        ctx.fillStyle='rgba(80,160,220,0.25)';
        for (let row=0;row<4;row++) ctx.fillRect(0,waterLine+10+row*18,Math.max(shoreScreenX+40,W),8);
        ctx.fillStyle='rgba(120,200,255,0.35)';
        for (let w=0;w<12;w++) {
          ctx.beginPath();
          ctx.ellipse((w*130+introTimer*1.2)%(W+200)-100,waterLine+6,30+w*4,5,0,0,Math.PI*2);
          ctx.fill();
        }
        const clipTopFinal=player.y+player.h*Math.max(0,1-shoreProgress);
        ctx.save();
        ctx.beginPath();
        ctx.rect(miloScreenX-10,clipTopFinal-oy,player.w+20,waterLine-clipTopFinal+oy);
        ctx.clip();
        drawCharacter(ox,oy);
        ctx.restore();
      }

      if (introDone) {
        drawCharacter(ox,oy);
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
  }, [character, loading, islandProducts, spaceProducts, showCart, setScore]);
}
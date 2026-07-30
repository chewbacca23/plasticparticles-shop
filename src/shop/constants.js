export const W = 1400;
export const H = 1000;
export const GRAVITY = 0.5;
export const JUMP = -16;

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ─── Zone layout ───────────────────────────────────────────────────────────
export const CW = 44;
export const CH = 44;
export const GAP = 8;

// Ground level — matches the actual sand/floor in Artboard_1.png at H=1000
export const GROUND_Y = 830;
export const PLAYER_H = 52;

// WALL ZONE — raised higher so Milo walks under freely and can jump to hit
const WALL_Y = GROUND_Y - PLAYER_H - CH - 80;
export const WALL_ZONES = Array.from({ length: 21 }, (_, i) => ({
  x: 500 + i * (CW + GAP), y: WALL_Y, w: CW, h: CH,
  type: 'wall', number: i + 1, product: null,
}));

// PYRAMID ZONE — 3 tiers above the actual pyramid artwork
const PYR_BASE_X    = 1820;
const PYR_STAGE_GAP = PLAYER_H + CH + 20;

// Bottom tier raised higher too
const PYR_Y1 = GROUND_Y - PLAYER_H - CH - 80;
const PYR_Y2 = PYR_Y1 - PYR_STAGE_GAP;
const PYR_Y3 = PYR_Y2 - PYR_STAGE_GAP;

const pyrTiers = [
  { count: 7, y: PYR_Y1 },
  { count: 5, y: PYR_Y2 },
  { count: 3, y: PYR_Y3 },
];

const pyramidZones = [];
pyrTiers.forEach(({ count, y }, row) => {
  const totalW  = count * CW + (count - 1) * GAP;
  const baseW   = 7 * CW + 6 * GAP;
  const offsetX = (baseW - totalW) / 2;
  for (let i = 0; i < count; i++) {
    pyramidZones.push({
      x: PYR_BASE_X + offsetX + i * (CW + GAP), y,
      w: CW, h: CH, type: 'pyramid', number: pyramidZones.length + 1, product: null, tier: row,
    });
  }
});

export const PYRAMID_PLATFORMS = pyrTiers.map(({ count, y }) => {
  const totalW  = count * CW + (count - 1) * GAP;
  const baseW   = 7 * CW + 6 * GAP;
  const offsetX = (baseW - totalW) / 2;
  return { x: PYR_BASE_X + offsetX, y, w: totalW, h: CH };
});

// BUS ZONE — moved right to sit above the actual bus in the artwork, raised same as wall
const BUS_Y = GROUND_Y - PLAYER_H - CH - 80;
export const BUS_ZONES = Array.from({ length: 10 }, (_, i) => ({
  x: 2700 + i * (CW + GAP), y: BUS_Y, w: CW, h: CH,
  type: 'bus', number: i + 1, product: null,
}));

export const PZ = [...WALL_ZONES, ...pyramidZones, ...BUS_ZONES];

// ─── Space World ────────────────────────────────────────────────────────────
export const SPACE_W_TOTAL = 4000;

// Asteroids first — cubes are placed relative to these so every product is reachable
export const ASTEROID_PLATFORMS = Array.from({ length: 12 }, (_, i) => ({
  x: 180 + i * 310,
  baseY: 650 - (i % 3) * 150,
  w: 140 + (i % 2) * 30, h: 36,
  driftSpeed: 0.3 + (i % 5) * 0.08,
  driftRange: 22 + (i % 3) * 8,
  phase: i * 0.85,
}));

// 18 cubes: one above each platform, plus 6 higher secondaries on even platforms
export const SPACE_ZONES = (() => {
  const zones = [];
  ASTEROID_PLATFORMS.forEach((plat) => {
    zones.push({
      x: plat.x + plat.w / 2 - CW / 2,
      y: plat.baseY - CH - 90,
      w: CW, h: CH, type: 'space', number: zones.length + 1, product: null,
    });
  });
  ASTEROID_PLATFORMS.filter((_, i) => i % 2 === 0).forEach((plat) => {
    zones.push({
      x: plat.x + 18,
      y: plat.baseY - CH - 170,
      w: CW, h: CH, type: 'space', number: zones.length + 1, product: null,
    });
  });
  return zones;
})();

export const GRAVITY_SPACE = 0.16;
export const JUMP_SPACE    = -13;

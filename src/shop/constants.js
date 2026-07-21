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
export const GROUND_Y = 780;
export const PLAYER_H = 52;

const WALL_Y = GROUND_Y - PLAYER_H - CH - 160;
export const WALL_ZONES = Array.from({ length: 21 }, (_, i) => ({
  x: 500 + i * (CW + GAP), y: WALL_Y, w: CW, h: CH,
  type: 'wall', number: i + 1, product: null,
}));

const PYR_BASE_X    = 1820;
const PYR_STAGE_GAP = PLAYER_H + CH + 20;
// Pyramid cubes: bottom tier above the pyramid artwork top (~y=380 in screenshot)
const PYR_Y1 = 520;  // bottom tier — above pyramid artwork
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

// BUS cubes — same height as wall cubes so figures show through
const BUS_Y = GROUND_Y - PLAYER_H - CH - 160;
export const BUS_ZONES = Array.from({ length: 10 }, (_, i) => ({
  x: 2350 + i * (CW + GAP), y: BUS_Y, w: CW, h: CH,
  type: 'bus', number: i + 1, product: null,
}));

export const PZ = [...WALL_ZONES, ...pyramidZones, ...BUS_ZONES];

export const SPACE_W_TOTAL = 4000;
export const SPACE_ZONES = Array.from({ length: 18 }, (_, i) => ({
  x: 300 + i * 200 + (i % 3) * 30,
  y: 550 + Math.sin(i * 1.3) * 220,
  w: CW, h: CH, type: 'space', number: i + 1, product: null,
}));

export const ASTEROID_PLATFORMS = Array.from({ length: 10 }, (_, i) => ({
  x: 250 + i * 380,
  baseY: 700 - (i % 4) * 130,
  w: 110 + (i % 3) * 30, h: 36,
  driftSpeed: 0.4 + (i % 5) * 0.15,
  driftRange: 40 + (i % 3) * 20,
  phase: i * 0.7,
}));

export const GRAVITY_SPACE = 0.16;
export const JUMP_SPACE = -13;

export function seededColor(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) { h = ((h << 5) - h) + seed.charCodeAt(i); h |= 0; }
  const hue = Math.abs(h) % 360;
  const sat = 55 + Math.abs(h >> 8) % 25;
  const light = 38 + Math.abs(h >> 16) % 18;
  return `hsl(${hue},${sat}%,${light}%)`;
}

export function seededLightColor(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) { h = ((h << 5) - h) + seed.charCodeAt(i); h |= 0; }
  const hue = Math.abs(h) % 360;
  const sat = 45 + Math.abs(h >> 8) % 30;
  const light = 70 + Math.abs(h >> 16) % 15;
  return `hsl(${hue},${sat}%,${light}%)`;
}

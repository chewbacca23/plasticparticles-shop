/**
 * Milo’s six realms — swap titles/copy/art anytime; cube faces stay the doors.
 */
export type MiloRealm = {
  id: string;
  face: 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom';
  title: string;
  kicker: string;
  lead: string;
  detail: string;
  hue: string;
  accent: string;
  /** Which Milo explorer PNG stands in this world */
  figure: 'explorer-a' | 'explorer-b' | 'explorer-c';
  theme: 'underwater' | 'island' | 'moon' | 'sand' | 'cloud' | 'ember';
};

export const MILO_REALMS: MiloRealm[] = [
  {
    id: 'underwater',
    face: 'front',
    title: 'Underwater',
    kicker: 'First realm · cube shrinks, island opens',
    lead: 'Milo swims into the cube. The cube shrinks away and a big island realm opens — hit the numbered packages with his head.',
    detail: 'Same bump as before: jump up into a number and the package opens.',
    hue: '#0a2a38',
    accent: '#5ec4d8',
    figure: 'explorer-a',
    theme: 'underwater',
  },
  {
    id: 'island',
    face: 'right',
    title: 'Island',
    kicker: 'Second realm · warm shore',
    lead: 'Sand under the boots. A single palm leans into the wind. Milo maps the cove like a café stop on tour.',
    detail: 'Salt air, a path inland, and the feeling that the next ride could start from this beach alone.',
    hue: '#1a4050',
    accent: '#e8b86d',
    figure: 'explorer-b',
    theme: 'island',
  },
  {
    id: 'moon',
    face: 'top',
    title: 'Moon',
    kicker: 'Third realm · quiet dust',
    lead: 'No road noise. Only boot prints in pale dust and Earth hanging like a postcard over the horizon.',
    detail: 'Milo stands small against the dark. The cube’s lid opens onto silence — and a view worth the whole climb.',
    hue: '#12161e',
    accent: '#d7e0e8',
    figure: 'explorer-c',
    theme: 'moon',
  },
  {
    id: 'sand',
    face: 'left',
    title: 'Sand Sea',
    kicker: 'Fourth realm · dunes',
    lead: 'Wind writes lines across the dunes. Milo follows a ridge the way he follows a canal path at night.',
    detail: 'Heat shimmer, long shadows, and a horizon that keeps moving — a desert tour without the tarmac.',
    hue: '#3a2a18',
    accent: '#e0a45a',
    figure: 'explorer-a',
    theme: 'sand',
  },
  {
    id: 'cloud',
    face: 'back',
    title: 'Cloud Rail',
    kicker: 'Fifth realm · tracks in the sky',
    lead: 'A thin rail runs through the clouds. Milo rides the carriage of weather — soft, bright, nowhere solid.',
    detail: 'Sun breaks in sheets. The next station might be a summit, or only more sky.',
    hue: '#2a3548',
    accent: '#f0c27a',
    figure: 'explorer-b',
    theme: 'cloud',
  },
  {
    id: 'ember',
    face: 'bottom',
    title: 'Ember Hollow',
    kicker: 'Sixth realm · night glow',
    lead: 'Cracks of orange under black rock. Milo keeps a careful distance — warmth without the burn.',
    detail: 'A campfire planet. Sparks rise like tiny street lamps, and the cube’s floor becomes a door into the dark.',
    hue: '#2a1210',
    accent: '#e85a3a',
    figure: 'explorer-c',
    theme: 'ember',
  },
];

export function miloRealmById(id: string) {
  return MILO_REALMS.find((r) => r.id === id) || null;
}

export function miloRealmByFace(face: string) {
  return MILO_REALMS.find((r) => r.face === face) || null;
}

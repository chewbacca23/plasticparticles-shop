/** Hub cities for SEO landings. Match stores by city name; rides and pins by keywords. */

export type City = {
  slug: string;
  name: string;
  country: string;
  /** Short meta / OG description */
  description: string;
  /** Page lead under the H1 */
  lead: string;
  /** Optional hero image (absolute path under public/) */
  cover?: string;
  /** Match store.data.city (case-insensitive) */
  storeCities: string[];
  /** Match ride title, description, slug, and stood place */
  keywords: string[];
  /** Berlin calendar lives at /calendar */
  hasCalendar?: boolean;
  order: number;
};

export const cities: City[] = [
  {
    slug: 'berlin',
    name: 'Berlin',
    country: 'Germany',
    description:
      'Cycling in Berlin with The Soul Searchers: club rides on the calendar, Kreuzberg kilometres, trusted bike shops, and where we stood in the city.',
    lead: 'Home base. Club rides, café kilometres, and the little mountain that named a bike.',
    cover: '/stories/73b70d9d-2476-4def-a03c-51a582ce4d25.jpg',
    storeCities: ['Berlin'],
    keywords: ['berlin', 'kreuzberg', 'montecruz'],
    hasCalendar: true,
    order: 10,
  },
  {
    slug: 'nice',
    name: 'Nice',
    country: 'France',
    description:
      'Riding Nice and the Alpes-Maritimes: Promenade des Anglais, Col d\'Èze, Café du Cycliste patches, and Tour weekend light on the Baie des Anges.',
    lead: 'Where the Alps meet the sea. Stones on the beach, gold on the promenade, climbs right behind the city.',
    cover: '/stories/nice-baie-des-anges.jpg',
    storeCities: ['Nice'],
    keywords: ['nice', 'èze', 'eze', 'col d', 'baie des anges', 'promenade', 'niçoise', 'nicoise'],
    order: 20,
  },
  {
    slug: 'cologne',
    name: 'Cologne',
    country: 'Germany',
    description:
      'Cologne on two wheels with The Soul Searchers: mates from the Rhine, city pins, and the rides that stick.',
    lead: 'Rhine city energy. A mate who rides for fun and writes it down.',
    cover: '/stories/img_0914.jpeg',
    storeCities: ['Cologne', 'Köln', 'Koln'],
    keywords: ['cologne', 'köln', 'koln', 'christoph'],
    order: 30,
  },
  {
    slug: 'hirrlingen',
    name: 'Hirrlingen',
    country: 'Germany',
    description:
      'Hirrlingen bike stop: Micha’s Radladen, Berlin track roots, and a shop that looks after the bike like it matters.',
    lead: 'A quiet Swabian stop. Honest workshop hands and a Berlin track school in the DNA.',
    storeCities: ['Hirrlingen'],
    keywords: ['hirrlingen', 'micha', 'radladen'],
    order: 40,
  },
];

export function cityBySlug(slug: string): City | undefined {
  return cities.find((city) => city.slug === slug);
}

export function slugifyCityName(name: string): string | undefined {
  const needle = name.trim().toLowerCase();
  if (!needle) return undefined;
  const hit = cities.find(
    (city) =>
      city.name.toLowerCase() === needle ||
      city.storeCities.some((c) => c.toLowerCase() === needle),
  );
  return hit?.slug;
}

function haystack(...parts: Array<string | undefined | null>): string {
  return parts
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function textMatchesCity(city: City, ...parts: Array<string | undefined | null>): boolean {
  const text = haystack(...parts);
  if (!text) return false;
  return city.keywords.some((keyword) => {
    const key = keyword
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
    return text.includes(key);
  });
}

export function storeMatchesCity(city: City, storeCity: string): boolean {
  const needle = storeCity.trim().toLowerCase();
  return city.storeCities.some((c) => c.toLowerCase() === needle);
}

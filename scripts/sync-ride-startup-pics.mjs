#!/usr/bin/env node
/**
 * Put newest ride covers into Site → Home startup pics (home.json).
 *
 * Used by .github/workflows/sync-ride-startup-pics.yml after a ride Save.
 * On the Mac, from the blog checkout:
 *
 *   npm run photos:startup-pics
 *   npm run photos:startup-pics -- --check
 *
 * Does not shrink photos and does not watch a camera roll or drop folder.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cmsSlides,
  mergeStartupPics,
  sameSlides,
  sortRideCovers,
} from '../cloudflare/fresh-home.js';
import { parseMarkdownFile } from '../cloudflare/fresh-ride.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const storiesDir = path.join(root, 'src/content/stories');
const homePath = path.join(root, 'src/content/settings/home.json');
const checkOnly = process.argv.includes('--check');

async function loadRides() {
  const names = (await readdir(storiesDir)).filter((name) => name.endsWith('.md'));
  const rides = [];
  for (const name of names) {
    const raw = await readFile(path.join(storiesDir, name), 'utf8');
    rides.push({
      slug: name.replace(/\.md$/i, ''),
      data: parseMarkdownFile(raw).data,
    });
  }
  return rides;
}

const rides = await loadRides();
const homeRaw = await readFile(homePath, 'utf8');
const home = JSON.parse(homeRaw);
const existing = cmsSlides(home.heroSlides);
const merged = mergeStartupPics(existing, sortRideCovers(rides));

if (sameSlides(merged, existing) && (!merged[0] || home.heroPhoto === merged[0])) {
  console.log('Startup pics already include the current ride covers.');
  process.exit(0);
}

if (checkOnly) {
  console.log('Startup pics would become:');
  for (const photo of merged) console.log(`  ${photo}`);
  process.exit(1);
}

home.heroSlides = merged;
if (merged[0]) home.heroPhoto = merged[0];
await writeFile(homePath, `${JSON.stringify(home, null, 2)}\n`);
console.log('Updated Site → Home startup pics:');
for (const photo of merged) console.log(`  ${photo}`);

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { planRidePhotos } from '../../cloudflare/story-photos.js';

describe('ride note photos', () => {
  it('gives notes the same first photo and in-the-text photos as rides', () => {
    const config = readFileSync('public/admin/config.yml', 'utf8');
    const journal = config.slice(config.indexOf('name: journal'));
    assert.match(journal, /name: cover/);
    assert.match(journal, /Photos in the note/);
    assert.match(journal, /name: gallery/);

    const page = readFileSync('src/pages/journal/[slug].astro', 'utf8');
    assert.match(page, /planRidePhotos/);
    assert.match(page, /galleryMedia/);
    assert.match(page, /plan\.hero/);

    const schema = readFileSync('src/content.config.ts', 'utf8');
    assert.match(schema, /const journal[\s\S]*cover: z\.string\(\)\.optional\(\)/);
  });

  it('puts the first photo on top and weaves the rest into the note', () => {
    const plan = planRidePhotos(
      ['/stories/img_2878.jpg', '/stories/nice-baie-des-anges.jpg'],
      'Packing is the unglamorous half of touring.\n\nHandlebar bag for the things you grab while rolling.',
      '/stories/img_2878.jpg',
    );
    assert.equal(plan.hero, '/stories/img_2878.jpg');
    assert.deepEqual(plan.inside, ['/stories/nice-baie-des-anges.jpg']);
    assert.match(plan.wovenBody, /!\[\]\(\/stories\/nice-baie-des-anges\.jpg\)/);
    assert.doesNotMatch(plan.wovenBody, /img_2878/);
  });
});

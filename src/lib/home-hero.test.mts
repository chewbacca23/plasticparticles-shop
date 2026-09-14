import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveHomeHero } from './home-hero.ts';

describe('resolveHomeHero', () => {
  it('uses the CMS photo when the file is there', () => {
    assert.equal(
      resolveHomeHero('/stories/img_6372.jpeg', ['/stories/nice-baie-des-anges.jpg']),
      '/stories/img_6372.jpeg',
    );
  });

  it('falls back to the newest Now photo when CMS is empty', () => {
    assert.equal(
      resolveHomeHero('', ['/stories/missing-nope.jpg', '/stories/nice-baie-des-anges.jpg']),
      '/stories/nice-baie-des-anges.jpg',
    );
  });

  it('returns null when nothing exists so the sky can show', () => {
    assert.equal(resolveHomeHero('/stories/nope.jpg', ['/stories/also-nope.jpg']), null);
  });
});

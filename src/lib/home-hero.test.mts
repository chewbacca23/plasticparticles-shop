import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_HERO_SLIDES,
  feedWithoutHeroRepeats,
  resolveHomeHero,
  resolveHomeHeroSlides,
} from './home-hero.ts';

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

describe('resolveHomeHeroSlides', () => {
  it('uses the CMS slide list when the files are there', () => {
    assert.deepEqual(
      resolveHomeHeroSlides({
        heroSlides: [
          '/stories/img_6372.jpeg',
          '/stories/img_5940.jpg',
          '/stories/img_1442.jpeg',
          '/stories/img_5956.jpg',
        ],
      }),
      [
        '/stories/img_6372.jpeg',
        '/stories/img_5940.jpg',
        '/stories/img_1442.jpeg',
        '/stories/img_5956.jpg',
      ],
    );
  });

  it('falls back to the default Nice / café / Henrik / moped dia', () => {
    const slides = resolveHomeHeroSlides({});
    assert.equal(slides.length, 4);
    assert.deepEqual(slides, [...DEFAULT_HERO_SLIDES]);
  });

  it('skips missing CMS entries', () => {
    assert.deepEqual(
      resolveHomeHeroSlides({
        heroSlides: ['/stories/nope.jpg', '/stories/img_5940.jpg'],
      }),
      ['/stories/img_5940.jpg'],
    );
  });
});

describe('feedWithoutHeroRepeats', () => {
  it('keeps the café cups and the promenade portrait off Now', () => {
    const slides = [
      '/stories/img_6372.jpeg',
      '/stories/img_5940.jpg',
      '/stories/img_1442.jpeg',
      '/stories/img_5956.jpg',
    ];
    const feed = feedWithoutHeroRepeats(
      [
        { photo: '/stories/img_2878.jpg' },
        { photo: '/stories/img_6344.jpg' },
        { photo: '/stories/img_5940.jpg' },
        { photo: '/stories/nice-promenade-detail.jpg' },
        { photo: '/stories/img_6372.jpeg' },
        { photo: '/stories/nice-baie-des-anges.jpg' },
      ],
      slides,
    );
    assert.deepEqual(
      feed.map((item) => item.photo),
      ['/stories/img_2878.jpg', '/stories/nice-baie-des-anges.jpg'],
    );
  });
});

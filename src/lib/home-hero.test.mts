import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_HERO_SLIDES,
  feedWithoutHeroRepeats,
  resolveHomeHero,
  resolveHomeHeroSlides,
  rotateSlidesForDay,
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
  it('leads with newest Now photos so fans see fresh road shots', () => {
    assert.deepEqual(
      resolveHomeHeroSlides(
        {
          heroSlides: [
            '/stories/img_6372.jpeg',
            '/stories/img_5940.jpg',
          ],
        },
        ['/stories/img_2878.jpg', '/stories/nice-baie-des-anges.jpg'],
      ),
      [
        '/stories/img_2878.jpg',
        '/stories/nice-baie-des-anges.jpg',
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

  it('skips missing CMS entries and still fills from defaults', () => {
    assert.deepEqual(
      resolveHomeHeroSlides({
        heroSlides: ['/stories/nope.jpg', '/stories/img_5940.jpg'],
      }),
      [
        '/stories/img_5940.jpg',
        '/stories/img_6372.jpeg',
        '/stories/img_1442.jpeg',
        '/stories/img_5956.jpg',
      ],
    );
  });

  it('caps the dia at six slides', () => {
    const slides = resolveHomeHeroSlides(
      {},
      [
        '/stories/img_2878.jpg',
        '/stories/nice-baie-des-anges.jpg',
        '/stories/nice-promenade-detail.jpg',
        '/stories/img_6344.jpg',
        '/stories/img_6125.jpg',
        '/stories/img_6072.jpg',
        '/stories/img_6400.jpeg',
      ],
    );
    assert.equal(slides.length, 6);
    assert.equal(slides[0], '/stories/img_2878.jpg');
    assert.ok(!slides.includes('/stories/img_6400.jpeg'));
  });
});

describe('rotateSlidesForDay', () => {
  it('opens on a different slide each calendar day', () => {
    const slides = ['a', 'b', 'c', 'd'];
    const day0 = 0;
    const day1 = 86_400_000;
    const day2 = 86_400_000 * 2;
    assert.deepEqual(rotateSlidesForDay(slides, day0), ['a', 'b', 'c', 'd']);
    assert.deepEqual(rotateSlidesForDay(slides, day1), ['b', 'c', 'd', 'a']);
    assert.deepEqual(rotateSlidesForDay(slides, day2), ['c', 'd', 'a', 'b']);
  });

  it('leaves a single slide alone', () => {
    assert.deepEqual(rotateSlidesForDay(['only'], 86_400_000), ['only']);
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

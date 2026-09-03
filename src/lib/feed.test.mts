import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RIDE_PHOTO_DATE, collectFeed } from './feed.ts';

const present = '/stories/nice-baie-des-anges.jpg';
const presentTwo = '/stories/nice-promenade-detail.jpg';
const flyover = '/stories/img_2878.jpg';

describe('collectFeed', () => {
  it('lists published shots newest first and skips drafts and missing files', () => {
    const feed = collectFeed([
      {
        id: 'older',
        title: 'Older',
        photo: present,
        caption: 'Baie',
        pubDate: new Date('2026-08-01'),
      },
      {
        id: 'draft',
        title: 'Hidden',
        photo: presentTwo,
        pubDate: new Date('2026-09-01'),
        draft: true,
      },
      {
        id: 'gone',
        title: 'Gone',
        photo: '/stories/packed-bike.jpg',
        pubDate: new Date('2026-09-02'),
      },
      {
        id: 'newer',
        title: 'Newer',
        photo: presentTwo,
        caption: 'Promenade',
        pubDate: new Date('2026-08-20'),
      },
    ]);

    assert.deepEqual(
      feed.map((item) => item.id),
      ['shot:newer', 'shot:older'],
    );
    assert.equal(feed[0].caption, 'Promenade');
    assert.equal(feed[0].href, null);
  });

  it('falls back to the title when a shot has no caption', () => {
    const feed = collectFeed([
      {
        id: 'title-only',
        title: 'Patrouille',
        photo: flyover,
        pubDate: new Date('2026-09-02'),
      },
    ]);
    assert.equal(feed[0].caption, 'Patrouille');
  });

  it('fills the grid with ride photos that are not already a shot', () => {
    const feed = collectFeed(
      [
        {
          id: 'nice-shot',
          title: 'Nice',
          photo: present,
          caption: 'From the shot',
          pubDate: new Date('2026-09-02'),
        },
      ],
      [
        {
          id: 'nice',
          headline: 'Nice ride',
          cover: present,
          gallery: [presentTwo, '/stories/packed-bike.jpg'],
        },
        {
          id: 'empty',
          headline: 'Empty tarmac',
          gallery: [],
        },
        {
          id: 'draft-ride',
          headline: 'Hidden ride',
          cover: flyover,
          draft: true,
        },
      ],
    );

    assert.deepEqual(
      feed.map((item) => ({ id: item.id, caption: item.caption, href: item.href })),
      [
        { id: 'shot:nice-shot', caption: 'From the shot', href: null },
        { id: 'ride:nice:1', caption: 'Nice ride', href: '/stories/nice' },
      ],
    );
    assert.equal(feed[1].date.valueOf(), RIDE_PHOTO_DATE.valueOf());
  });

  it('puts a new shot above leftover ride photos', () => {
    const feed = collectFeed(
      [
        {
          id: 'today',
          title: 'Today',
          photo: flyover,
          pubDate: new Date('2026-09-03'),
        },
      ],
      [{ id: 'nice', headline: 'Nice', cover: present }],
    );
    assert.deepEqual(
      feed.map((item) => item.id),
      ['shot:today', 'ride:nice:0'],
    );
  });
});

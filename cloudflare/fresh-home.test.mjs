import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  cmsSlides,
  fillHomeDiaInHtml,
  handleFreshHome,
  isHomePath,
  mergeStartupPics,
  rideCoverFromData,
  rideHrefByPhoto,
  slidesFromHtml,
  sortRideCovers,
  startupPicsFrom,
} from './fresh-home.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('isHomePath', () => {
  it('marks the public home page', () => {
    assert.equal(isHomePath('/'), true);
    assert.equal(isHomePath('/index.html'), true);
    assert.equal(isHomePath('/stories'), false);
    assert.equal(isHomePath('/admin/'), false);
  });
});

describe('ride covers', () => {
  it('uses the cover, or the first gallery shot, and skips drafts', () => {
    assert.equal(
      rideCoverFromData({
        cover: '/stories/new-ride.jpg',
        gallery: ['/stories/other.jpg'],
        draft: false,
      }),
      '/stories/new-ride.jpg',
    );
    assert.equal(
      rideCoverFromData({
        gallery: [{ image: '/stories/first.jpg' }, '/stories/second.jpg'],
      }),
      '/stories/first.jpg',
    );
    assert.equal(rideCoverFromData({ cover: '/stories/hidden.jpg', draft: true }), '');
    assert.equal(rideCoverFromData({ cover: 'https://example.com/nope.jpg' }), '');
  });

  it('sorts newest published ride first', () => {
    assert.deepEqual(
      sortRideCovers([
        { slug: 'older', data: { pubDate: '2026-08-01', cover: '/stories/old.jpg' } },
        { slug: 'newer', data: { pubDate: '2026-09-20', cover: '/stories/new.jpg' } },
        { slug: 'draft', data: { pubDate: '2026-10-01', cover: '/stories/no.jpg', draft: true } },
      ]),
      ['/stories/new.jpg', '/stories/old.jpg'],
    );
  });
});

describe('mergeStartupPics', () => {
  it('prepends a new ride cover and keeps the older dia as fillers', () => {
    assert.deepEqual(
      mergeStartupPics(
        ['/stories/img_6372.jpeg', '/stories/img_5940.jpg', '/stories/img_1442.jpeg'],
        ['/stories/new-climb.jpg', '/stories/img_1442.jpeg'],
      ),
      [
        '/stories/new-climb.jpg',
        '/stories/img_1442.jpeg',
        '/stories/img_6372.jpeg',
        '/stories/img_5940.jpg',
      ],
    );
  });

  it('caps the dia at six slides', () => {
    const slides = mergeStartupPics(
      ['/stories/a.jpg', '/stories/b.jpg', '/stories/c.jpg', '/stories/d.jpg'],
      ['/stories/1.jpg', '/stories/2.jpg', '/stories/3.jpg'],
    );
    assert.equal(slides.length, 6);
    assert.equal(slides[0], '/stories/1.jpg');
    assert.ok(!slides.includes('/stories/d.jpg'));
  });
});

describe('startupPicsFrom', () => {
  it('lets a new ride lead over CMS Site → Home picks', () => {
    const slides = startupPicsFrom(
      [{ slug: 'alps', data: { pubDate: '2026-10-12', cover: '/stories/alps.jpg' } }],
      { heroSlides: ['/stories/img_6372.jpeg', '/stories/img_5940.jpg'] },
      ['/stories/img_6372.jpeg'],
    );
    assert.equal(slides[0], '/stories/alps.jpg');
    assert.ok(slides.includes('/stories/img_6372.jpeg'));
  });

  it('reads object-shaped CMS slides', () => {
    assert.deepEqual(cmsSlides([{ slide: '/stories/img_5940.jpg' }, { image: '/stories/img_5940.jpg' }]), [
      '/stories/img_5940.jpg',
    ]);
  });
});

describe('rideHrefByPhoto', () => {
  it('maps cover and gallery shots to the ride URL', () => {
    assert.deepEqual(
      rideHrefByPhoto([
        {
          slug: 'alps',
          data: {
            pubDate: '2026-10-12',
            headline: 'Alps',
            cover: '/stories/alps.jpg',
            gallery: ['/stories/alps-detail.jpg'],
          },
        },
      ]),
      {
        '/stories/alps.jpg': { href: '/stories/alps', label: 'Alps' },
        '/stories/alps-detail.jpg': { href: '/stories/alps', label: 'Alps' },
      },
    );
  });
});

describe('fillHomeDiaInHtml', () => {
  it('paints a new ride cover onto a stale baked dia', () => {
    const html = fillHomeDiaInHtml(
      `<section class="hero has-photo">
        <div class="sky" data-astro-cid-lcdefpme>
          <div class="hero-dia" data-hero-dia data-count="2" style="--dia-count: 2;" data-astro-cid-lcdefpme>
            <img class="hero-photo" src="/stories/old.jpg" alt="" style="--dia-i: 0;" data-astro-cid-lcdefpme>
            <img class="hero-photo" src="/stories/older.jpg" alt="" style="--dia-i: 1;" data-astro-cid-lcdefpme>
          </div>
        </div>
      </section>`,
      ['/stories/new-climb.jpg', '/stories/old.jpg'],
      { '/stories/new-climb.jpg': { href: '/stories/new-climb', label: 'New climb' } },
    );
    assert.match(html, /data-count="2"/);
    assert.match(html, /src="\/stories\/new-climb\.jpg"/);
    assert.match(html, /data-ride-href="\/stories\/new-climb"/);
    assert.match(html, /class="hero hero--ride-links has-photo"/);
    assert.match(html, /src="\/stories\/old\.jpg"/);
    assert.doesNotMatch(html, /older\.jpg/);
    assert.deepEqual(slidesFromHtml(html), ['/stories/new-climb.jpg', '/stories/old.jpg']);
    assert.match(html, /data-astro-cid-lcdefpme/);
  });

  it('injects a dia when the baked home still has the empty sky', () => {
    const html = fillHomeDiaInHtml(
      `<section class="hero"><div class="sky" data-astro-cid-home>fog</div></section>`,
      ['/stories/new-climb.jpg'],
    );
    assert.match(html, /class="hero has-photo"/);
    assert.match(html, /data-hero-dia/);
    assert.match(html, /src="\/stories\/new-climb\.jpg"/);
  });
});

describe('handleFreshHome', () => {
  it('prepends a GitHub ride cover the baked home does not have yet', async () => {
    globalThis.fetch = async (url) => {
      const href = String(url);
      if (href.includes('/contents/src/content/stories')) {
        return new Response(JSON.stringify([{ type: 'file', name: 'alps.md' }]), { status: 200 });
      }
      if (href.endsWith('/alps.md')) {
        return new Response(
          '---\ntitle: Alps\npubDate: 2026-10-12\ncover: /stories/alps.jpg\ndraft: false\n---\nA climb.\n',
          { status: 200 },
        );
      }
      if (href.endsWith('home.json')) {
        return new Response(JSON.stringify({ heroSlides: ['/stories/img_6372.jpeg'] }), { status: 200 });
      }
      return new Response('nope', { status: 404 });
    };

    const baked = `<section class="hero has-photo"><div class="sky"><div class="hero-dia" data-hero-dia data-count="1" style="--dia-count: 1;">
      <img class="hero-photo" src="/stories/img_6372.jpeg" alt="">
    </div></div></section>`;

    const res = await handleFreshHome(new Request('https://thenewsoulsearchers.de/'), {
      ASSETS: {
        fetch: async () => new Response(baked, { headers: { 'content-type': 'text/html' } }),
      },
    });
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.deepEqual(slidesFromHtml(html)[0], '/stories/alps.jpg');
    assert.match(html, /img_6372\.jpeg/);
    assert.equal(res.headers.get('cache-control'), 'no-store');
  });

  it('leaves a current dia alone', async () => {
    globalThis.fetch = async (url) => {
      const href = String(url);
      if (href.includes('/contents/src/content/stories')) {
        return new Response(JSON.stringify([{ type: 'file', name: 'alps.md' }]), { status: 200 });
      }
      if (href.endsWith('/alps.md')) {
        return new Response('---\ntitle: Alps\npubDate: 2026-10-12\ncover: /stories/alps.jpg\n---\n', {
          status: 200,
        });
      }
      if (href.endsWith('home.json')) {
        return new Response(JSON.stringify({ heroSlides: ['/stories/alps.jpg'] }), { status: 200 });
      }
      return new Response('nope', { status: 404 });
    };

    const baked = `<div class="hero-dia" data-hero-dia data-count="1">
      <img class="hero-photo" src="/stories/alps.jpg" alt="Alps" data-ride-href="/stories/alps">
    </div>`;
    const res = await handleFreshHome(new Request('https://thenewsoulsearchers.de/'), {
      ASSETS: {
        fetch: async () => new Response(baked, { headers: { 'content-type': 'text/html' } }),
      },
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), null);
    const html = await res.text();
    assert.deepEqual(slidesFromHtml(html), ['/stories/alps.jpg']);
    assert.match(html, /data-ride-href="\/stories\/alps"/);
  });

  it('skips non-home paths', async () => {
    assert.equal(
      await handleFreshHome(new Request('https://thenewsoulsearchers.de/stories/alps'), {}),
      null,
    );
  });
});

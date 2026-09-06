import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  escapeHtml,
  galleryPaths,
  githubRawNote,
  githubRawPhoto,
  githubRawRide,
  handleFreshRide,
  journalSlug,
  parseMarkdownFile,
  parseSimpleYaml,
  renderMarkdown,
  renderRidePage,
  staticLooksBehind,
  storyImageName,
  storySlug,
} from './fresh-ride.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const patches = `---
title: The most wonderful Patches
pubDate: 2026-09-04
cover: /stories/img_5940.jpg
gallery:
  - /stories/img_6440-2.jpg
  - image: /stories/img_6441.jpg
headline: the most wonderful patches
description: Write a few lines about this ride.
draft: false
order: 0
---
Sitting in front of me are two small patches from Café du Cycliste in Nice.
`;

describe('path helpers', () => {
  it('accepts a ride slug and a photo name', () => {
    assert.equal(storySlug('/stories/the-most-wonderful-patches'), 'the-most-wonderful-patches');
    assert.equal(storySlug('/stories/img_6440-2.jpg'), '');
    assert.equal(storyImageName('/stories/img_6440-2.jpg'), 'img_6440-2.jpg');
    assert.equal(storyImageName('/stories/the-most-wonderful-patches'), '');
    assert.equal(storyImageName('/stories/../secret.jpg'), '');
    assert.equal(journalSlug('/journal/packing-the-bike'), 'packing-the-bike');
    assert.equal(journalSlug('/journal/img_6440-2.jpg'), '');
    assert.equal(journalSlug('/stories/packing-the-bike'), '');
  });
});

describe('parseMarkdownFile', () => {
  it('reads strings, object gallery items, and the story body', () => {
    const parsed = parseMarkdownFile(patches);
    assert.equal(parsed.data.title, 'The most wonderful Patches');
    assert.equal(parsed.data.draft, false);
    assert.equal(parsed.data.order, 0);
    assert.deepEqual(parsed.data.gallery, [
      '/stories/img_6440-2.jpg',
      { image: '/stories/img_6441.jpg' },
    ]);
    assert.match(parsed.body, /Café du Cycliste/);
  });

  it('parses a YAML list of image objects', () => {
    const yaml = parseSimpleYaml(`gallery:\n  - image: /stories/a.jpg\n  - image: /stories/b.jpg`);
    assert.deepEqual(yaml.gallery, [{ image: '/stories/a.jpg' }, { image: '/stories/b.jpg' }]);
  });
});

describe('galleryPaths', () => {
  it('keeps cover first and flattens { image } entries', () => {
    assert.deepEqual(
      galleryPaths('/stories/cover.jpg', [
        '/stories/a.jpg',
        { image: '/stories/b.jpg' },
        '/stories/cover.jpg',
        { image: '' },
      ]),
      ['/stories/cover.jpg', '/stories/a.jpg', '/stories/b.jpg'],
    );
  });
});

describe('renderMarkdown', () => {
  it('escapes HTML and turns headings into tags', () => {
    const html = renderMarkdown('# Hello\n\nA **bold** line with <em>raw</em>.\n\n## Next');
    assert.match(html, /<h1>Hello<\/h1>/);
    assert.match(html, /<strong>bold<\/strong>/);
    assert.match(html, /&lt;em&gt;raw&lt;\/em&gt;/);
    assert.match(html, /<h2>Next<\/h2>/);
  });

  it('turns a story photo into a figure and keeps a numbered list', () => {
    const html = renderMarkdown(
      'Hello\n\n![](/stories/img_6440-2.jpg)\n\n1. Where you rode\n2. Bike and bags',
    );
    assert.match(html, /<figure><img src="\/stories\/img_6440-2\.jpg"/);
    assert.match(html, /<ol><li>Where you rode<\/li><li>Bike and bags<\/li><\/ol>/);
    assert.doesNotMatch(html, /javascript:/);
    assert.equal(renderMarkdown('![](javascript:alert(1))'), '');
  });
});

describe('renderRidePage', () => {
  it('puts extra photos inside the story, not in a pile at the start', () => {
    const html = renderRidePage({
      slug: 'the-most-wonderful-patches',
      data: parseMarkdownFile(patches).data,
      body: parseMarkdownFile(patches).body,
    });
    const cafe = html.indexOf('Café du Cycliste');
    const cover = html.indexOf('img_5940.jpg');
    const extra = html.indexOf('img_6440-2.jpg');
    assert.ok(cover !== -1 && cafe !== -1 && extra !== -1);
    assert.ok(cover < cafe, 'first photo stays at the top');
    assert.ok(cafe < extra, 'story photos sit after the first paragraph');
    assert.doesNotMatch(html, /class="gallery"/);
    assert.match(html, /class="hero"/);
  });

  it('labels a note page as a ride note', () => {
    const html = renderRidePage({
      slug: 'packing-the-bike',
      data: { title: 'Packing the bike', cover: '/stories/img_2878.jpg' },
      body: 'Packing is the unglamorous half of touring.',
      kind: 'note',
    });
    assert.match(html, />Ride note</);
    assert.match(html, /href="\/journal"/);
    assert.match(html, /img_2878\.jpg/);
  });
});

describe('staticLooksBehind', () => {
  it('treats an empty built page as behind GitHub', () => {
    const empty =
      '<h1>the most wonderful patches</h1><p class="dek">Write a few lines about this ride.</p><div class="prose"></div>';
    const parsed = parseMarkdownFile(patches);
    assert.equal(
      staticLooksBehind(empty, {
        body: parsed.body,
        photos: galleryPaths(parsed.data.cover, parsed.data.gallery),
      }),
      true,
    );
  });

  it('keeps a built page that already has the story and photos', () => {
    const html = renderRidePage({
      slug: 'the-most-wonderful-patches',
      data: parseMarkdownFile(patches).data,
      body: parseMarkdownFile(patches).body,
    });
    const parsed = parseMarkdownFile(patches);
    assert.equal(
      staticLooksBehind(html, {
        body: parsed.body,
        photos: galleryPaths(parsed.data.cover, parsed.data.gallery),
      }),
      false,
    );
  });
});

describe('handleFreshRide', () => {
  it('renders GitHub markdown when the static ride page is empty', async () => {
    globalThis.fetch = async (url) => {
      assert.equal(String(url), githubRawRide('the-most-wonderful-patches'));
      return new Response(patches, { status: 200 });
    };
    const stale = new Response(
      '<h1>the most wonderful patches</h1><div class="prose"></div>',
      { status: 200, headers: { 'content-type': 'text/html' } },
    );
    const res = await handleFreshRide(
      new Request('https://thenewsoulsearchers.de/stories/the-most-wonderful-patches'),
      { ASSETS: { fetch: async () => stale } },
    );
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /Café du Cycliste/);
    assert.match(html, /img_6440-2\.jpg/);
    assert.match(html, /img_6441\.jpg/);
  });

  it('leaves a current Astro ride page alone', async () => {
    const parsed = parseMarkdownFile(patches);
    const current = renderRidePage({
      slug: 'the-most-wonderful-patches',
      data: parsed.data,
      body: parsed.body,
    });
    globalThis.fetch = async () => new Response(patches, { status: 200 });
    const res = await handleFreshRide(
      new Request('https://thenewsoulsearchers.de/stories/the-most-wonderful-patches'),
      {
        ASSETS: {
          fetch: async () =>
            new Response(current, { status: 200, headers: { 'content-type': 'text/html' } }),
        },
      },
    );
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Café du Cycliste/);
  });

  it('serves a missing photo from GitHub when the Worker assets 404', async () => {
    globalThis.fetch = async (url) => {
      assert.equal(String(url), githubRawPhoto('img_6440-2.jpg'));
      return new Response('jpeg-bytes', { status: 200, headers: { 'content-type': 'image/jpeg' } });
    };
    const res = await handleFreshRide(
      new Request('https://thenewsoulsearchers.de/stories/img_6440-2.jpg'),
      { ASSETS: { fetch: async () => new Response('nope', { status: 404 }) } },
    );
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/jpeg');
    assert.equal(await res.text(), 'jpeg-bytes');
  });

  it('skips drafts and unknown paths', async () => {
    globalThis.fetch = async () =>
      new Response('---\ntitle: Hidden\ndraft: true\n---\nsecret\n', { status: 200 });
    const draft = await handleFreshRide(
      new Request('https://thenewsoulsearchers.de/stories/hidden'),
      {},
    );
    assert.equal(draft, null);
    assert.equal(
      await handleFreshRide(new Request('https://thenewsoulsearchers.de/now'), {}),
      null,
    );
  });

  it('fills a ride note from GitHub when the static page has no photos yet', async () => {
    const note = `---
title: Packing the bike for a tour
description: What actually goes in the bags.
pubDate: 2026-08-26
cover: /stories/img_2878.jpg
gallery:
  - /stories/nice-baie-des-anges.jpg
---
Packing is the unglamorous half of touring.
`;
    globalThis.fetch = async (url) => {
      assert.equal(String(url), githubRawNote('packing-the-bike'));
      return new Response(note, { status: 200 });
    };
    const stale = new Response(
      '<h1>Packing the bike for a tour</h1><div class="prose"><p>Packing is the unglamorous half of touring.</p></div>',
      { status: 200, headers: { 'content-type': 'text/html' } },
    );
    const res = await handleFreshRide(
      new Request('https://thenewsoulsearchers.de/journal/packing-the-bike'),
      { ASSETS: { fetch: async () => stale } },
    );
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, />Ride note</);
    assert.match(html, /img_2878\.jpg/);
    assert.match(html, /nice-baie-des-anges\.jpg/);
  });
});

describe('escapeHtml', () => {
  it('does not pass tags through', () => {
    assert.equal(escapeHtml('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  });
});

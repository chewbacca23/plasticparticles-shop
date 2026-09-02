import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { existingMedia, mediaExists } from './media.ts';

// Run from the repo root, so public/ holds the committed Nice photos.
const present = '/stories/nice-baie-des-anges.jpg';

describe('mediaExists', () => {
  it('finds a committed file', () => {
    assert.equal(mediaExists(present), true);
  });

  it('reports a deleted file as missing', () => {
    assert.equal(mediaExists('/stories/packed-bike.jpg'), false);
  });

  it('treats empty and absent values as missing', () => {
    assert.equal(mediaExists(undefined), false);
    assert.equal(mediaExists(null), false);
    assert.equal(mediaExists(''), false);
    assert.equal(mediaExists('/'), false);
  });

  it('accepts paths with or without a leading slash', () => {
    assert.equal(mediaExists(present.slice(1)), true);
  });

  it('decodes percent-escapes, since the CMS escapes spaces', () => {
    assert.equal(mediaExists('/stories/nice-baie-des-anges.jpg'), true);
    assert.equal(mediaExists('/stories/does%20not%20exist.jpg'), false);
    assert.equal(mediaExists('/stories/%ZZ-malformed.jpg'), false);
  });

  it('does not escape public/ via traversal', () => {
    assert.equal(mediaExists('/../package.json'), false);
    assert.equal(mediaExists('/stories/../../package.json'), false);
  });

  it('trusts remote URLs without touching the disk', () => {
    assert.equal(mediaExists('https://example.com/photo.jpg'), true);
    assert.equal(mediaExists('//example.com/photo.jpg'), true);
  });
});

describe('existingMedia', () => {
  it('keeps only files that are still present, in order', () => {
    assert.deepEqual(
      existingMedia([
        '/stories/packed-bike.jpg',
        present,
        undefined,
        '/stories/nice-promenade-detail.jpg',
      ]),
      [present, '/stories/nice-promenade-detail.jpg'],
    );
  });

  it('returns an empty list when every photo was deleted', () => {
    assert.deepEqual(existingMedia(['/stories/notebook.png', '/stories/window-light.png']), []);
  });
});

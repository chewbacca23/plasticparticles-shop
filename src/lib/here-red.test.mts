import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

function hereCollection(hash: string) {
  const text = String(hash || '');
  const match = text.match(/\/collections\/([^/]+)/);
  if (match) return match[1].replace(/[?#].*$/, '');
  if (text.indexOf('/media') !== -1) return 'media';
  return '';
}

describe('here-red', () => {
  it('loads after Decap and paints the open collection red', () => {
    const html = readFileSync('public/admin/index.html', 'utf8');
    assert.match(html, /here-red\.js/);
    assert.ok(
      html.indexOf('decap-cms.js') < html.indexOf('here-red.js'),
      'here-red must load after Decap',
    );
    assert.match(html, /\[data-ss-here\]/);
    assert.match(html, /#ff3b3b/);
    assert.match(html, /That name turns red/);
    assert.match(html, /here-red\.js/);
    const src = readFileSync('public/admin/here-red.js', 'utf8');
    assert.match(src, /data-ss-here/);
    assert.match(src, /#ff3b3b/);
    assert.match(src, /Ride notes/);
    assert.match(src, /hashchange/);
  });

  it('reads Rides, Shots, Ride notes, and Site from the editor hash', () => {
    assert.equal(hereCollection('#/collections/stories'), 'stories');
    assert.equal(hereCollection('#/collections/shots'), 'shots');
    assert.equal(hereCollection('#/collections/journal/entries/packing-the-bike'), 'journal');
    assert.equal(hereCollection('#/collections/settings/entries/imprint'), 'settings');
    assert.equal(hereCollection('#/media'), 'media');
    assert.equal(hereCollection('#/'), '');
    const src = readFileSync('public/admin/here-red.js', 'utf8');
    assert.match(src, /\/collections\//);
    assert.match(src, /hereCollection/);
  });
});

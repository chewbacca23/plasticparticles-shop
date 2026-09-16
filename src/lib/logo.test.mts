import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('site crest', () => {
  it('keeps the lowercase crest PNG on the wire', () => {
    assert.equal(existsSync('public/logo.png'), true);
    assert.equal(existsSync('public/Logo.svg'), false);
    assert.equal(existsSync('public/logo.svg'), false);
    const config = readFileSync('src/site.config.ts', 'utf8');
    assert.match(config, /logo:\s*'\/logo\.png'/);
    const html = readFileSync('public/admin/index.html', 'utf8');
    assert.match(html, /\/logo\.png/);
  });
});

describe('self-hosted fonts', () => {
  it('ships woff2 files and does not call Google Fonts from the layout', () => {
    assert.equal(existsSync('public/fonts/figtree-latin.woff2'), true);
    assert.equal(existsSync('public/fonts/fraunces-latin.woff2'), true);
    const layout = readFileSync('src/layouts/BaseLayout.astro', 'utf8');
    assert.doesNotMatch(layout, /fonts\.googleapis\.com/);
    assert.doesNotMatch(layout, /fonts\.gstatic\.com/);
    assert.match(layout, /\/fonts\/figtree-latin\.woff2/);
  });
});

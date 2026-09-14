import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('site crest', () => {
  it('keeps the lowercase logo files and embeds the new crest', () => {
    assert.equal(existsSync('public/logo.png'), true);
    assert.equal(existsSync('public/Logo.svg'), false);
    const svg = readFileSync('public/logo.svg', 'utf8');
    assert.match(svg, /data:image\/png;base64,/);
    assert.match(svg, /The Soul Searchers/);
    const html = readFileSync('public/admin/index.html', 'utf8');
    assert.match(html, /\/logo\.svg/);
  });
});

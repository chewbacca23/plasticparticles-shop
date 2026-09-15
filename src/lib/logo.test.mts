import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('site crest', () => {
  it('keeps the lowercase crest PNG on the wire', () => {
    assert.equal(existsSync('public/logo.png'), true);
    assert.equal(existsSync('public/Logo.svg'), false);
    const config = readFileSync('src/site.config.ts', 'utf8');
    assert.match(config, /logo:\s*'\/logo\.png'/);
    const html = readFileSync('public/admin/index.html', 'utf8');
    assert.match(html, /\/logo\.png/);
  });
});

import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('woven crest patches', () => {
  it('wires the Patches page, mailto, nav, and editor settings', () => {
    assert.ok(existsSync('src/pages/patches.astro'));
    assert.ok(existsSync('src/content/settings/patches.json'));

    const page = readFileSync('src/pages/patches.astro', 'utf8');
    assert.match(page, /henrik@thenewsoulsearchers\.de/);
    assert.match(page, /subject=.*Patch/);
    assert.match(page, /Email Henrik for a patch/);
    assert.match(page, /woven/i);
    assert.match(page, /50/);

    const saved = JSON.parse(readFileSync('src/content/settings/patches.json', 'utf8'));
    assert.match(String(saved.headline), /woven/i);
    assert.match(String(saved.blurb), /not handmade/i);
    assert.match(String(saved.blurb), /50/);

    const config = readFileSync('public/admin/config.yml', 'utf8');
    assert.match(config, /name: patches/);
    assert.match(config, /label: Patches/);
    assert.match(config, /file: src\/content\/settings\/patches\.json/);

    const header = readFileSync('src/components/SiteHeader.astro', 'utf8');
    assert.match(header, /href: '\/patches'/);
    const footer = readFileSync('src/components/SiteFooter.astro', 'utf8');
    assert.match(footer, /href="\/patches"/);

    const about = readFileSync('src/pages/about.astro', 'utf8');
    assert.match(about, /href="\/patches"/);
    assert.match(about, /Woven crest/);
    assert.match(about, /50/);
  });
});

import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('small shop in the background', () => {
  it('wires the Shop collection, page, mailto, and /patches redirect', () => {
    const schema = readFileSync('src/content.config.ts', 'utf8');
    assert.match(schema, /const shop = defineCollection/);
    assert.match(schema, /collections = \{[^}]*shop/);

    assert.ok(existsSync('src/pages/shop.astro'));
    assert.ok(existsSync('src/content/shop/woven-crest-patch.md'));

    const page = readFileSync('src/pages/shop.astro', 'utf8');
    assert.match(page, /henrik@thenewsoulsearchers\.de/);
    assert.match(page, /getCollection\('shop'/);
    assert.match(page, /A small shop/);

    const product = readFileSync('src/content/shop/woven-crest-patch.md', 'utf8');
    assert.match(product, /woven, not handmade/);
    assert.match(product, /50/);
    assert.match(product, /sent out, worldwide/);
    assert.doesNotMatch(product, /[—–]/);

    const config = readFileSync('public/admin/config.yml', 'utf8');
    assert.match(config, /name: shop/);
    assert.match(config, /label: Shop/);
    assert.match(config, /folder: src\/content\/shop/);
    assert.doesNotMatch(config, /file: src\/content\/settings\/patches\.json/);

    const redirects = readFileSync('astro.config.mjs', 'utf8');
    assert.match(redirects, /['"]\/patches['"]\s*:\s*['"]\/shop['"]/);

    const header = readFileSync('src/components/SiteHeader.astro', 'utf8');
    assert.match(header, /href: '\/shop'/);
    assert.doesNotMatch(header, /href: '\/patches'/);

    const footer = readFileSync('src/components/SiteFooter.astro', 'utf8');
    assert.match(footer, /href="\/shop"/);

    const about = readFileSync('src/pages/about.astro', 'utf8');
    assert.match(about, /href="\/shop"/);
    assert.match(about, /small <a href="\/shop">shop<\/a>/);

    const save = readFileSync('public/admin/publish-click.js', 'utf8');
    assert.match(save, /Save this product/);

    const here = readFileSync('public/admin/here-red.js', 'utf8');
    assert.match(here, /shop: 'shop'/);
  });
});

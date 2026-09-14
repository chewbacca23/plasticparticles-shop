import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { describe, it } from 'node:test';

describe('friends who helped along the ride', () => {
  it('wires the Friends collection in Astro and the editor', () => {
    const schema = readFileSync('src/content.config.ts', 'utf8');
    assert.match(schema, /const friends = defineCollection/);
    assert.match(schema, /collections = \{[^}]*friends/);

    const config = readFileSync('public/admin/config.yml', 'utf8');
    assert.match(config, /name: friends/);
    assert.match(config, /label: Friends/);
    assert.match(config, /Thank-you line/);
    assert.match(config, /folder: src\/content\/friends/);

    assert.ok(existsSync('src/pages/friends.astro'));
    const page = readFileSync('src/pages/friends.astro', 'utf8');
    assert.match(page, /getCollection\('friends'/);
    assert.match(page, /Friends who helped along the ride/);

    const header = readFileSync('src/components/SiteHeader.astro', 'utf8');
    assert.match(header, /href: '\/friends'/);
    const footer = readFileSync('src/components/SiteFooter.astro', 'utf8');
    assert.match(footer, /href="\/friends"/);

    const save = readFileSync('public/admin/publish-click.js', 'utf8');
    assert.match(save, /Save this friend/);

    const here = readFileSync('public/admin/here-red.js', 'utf8');
    assert.match(here, /friends: 'friends'/);
  });
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { isRideMarkdownPath, rideLabelFromMarkdown, slugFromRidePath } from './cms-delete-ride.ts';

describe('isRideMarkdownPath', () => {
  it('accepts a ride file and rejects everything else', () => {
    assert.equal(isRideMarkdownPath('src/content/stories/nice.md'), true);
    assert.equal(isRideMarkdownPath('src/content/stories/the-night-before-a-tour.md'), true);
    assert.equal(isRideMarkdownPath('src/content/journal/nice-french-riviera.md'), false);
    assert.equal(isRideMarkdownPath('src/content/stories/../journal/secret.md'), false);
    assert.equal(isRideMarkdownPath('src/content/stories/.md'), false);
  });
});

describe('rideLabelFromMarkdown', () => {
  it('uses the committed Nice ride headline', () => {
    const raw = readFileSync('src/content/stories/nice.md', 'utf8');
    assert.equal(rideLabelFromMarkdown(raw, 'nice'), 'Nice');
  });

  it('falls back when frontmatter has no title', () => {
    assert.equal(rideLabelFromMarkdown('# just a body\n', 'empty-tarmac'), 'empty-tarmac');
  });
});

describe('slugFromRidePath', () => {
  it('strips the folder and extension', () => {
    assert.equal(slugFromRidePath('src/content/stories/window-light.md'), 'window-light');
  });
});

describe('CMS − Ride wiring', () => {
  it('loads delete-ride.js from the admin page', () => {
    const html = readFileSync('public/admin/index.html', 'utf8');
    assert.match(html, /src="\/admin\/delete-ride\.js"/);
  });

  it('keeps the list button label and ride-folder guard in the CMS script', () => {
    const js = readFileSync('public/admin/delete-ride.js', 'utf8');
    assert.match(js, /− Ride/);
    assert.ok(
      js.includes('src\\/content\\/stories\\/[^./][^/]*\\.md'),
      'delete-ride.js must only target src/content/stories/*.md',
    );
  });
});

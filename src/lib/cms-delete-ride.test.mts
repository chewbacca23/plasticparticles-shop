import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  isRideMarkdownPath,
  isRideMediaRepoPath,
  mediaRepoPathsFromText,
  publicMediaToRepoPath,
  rideLabelFromMarkdown,
  slugFromEntryHref,
  slugFromRidePath,
  unusedMediaPaths,
  uniqueRideSlug,
  newRideMarkdown,
  slugFromRideName,
  todayStamp,
} from './cms-delete-ride.ts';

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

describe('slugFromEntryHref', () => {
  it('reads the slug from a Decap collection link', () => {
    assert.equal(
      slugFromEntryHref('#/collections/stories/entries/empty-tarmac'),
      'empty-tarmac',
    );
    assert.equal(
      slugFromEntryHref(
        'http://localhost:4322/admin/index.html#/collections/stories/entries/the-night-before-a-tour',
      ),
      'the-night-before-a-tour',
    );
    assert.equal(slugFromEntryHref('#/collections/shots/entries/promenade'), '');
  });
});

describe('publicMediaToRepoPath', () => {
  it('maps a CMS photo URL onto public/stories', () => {
    assert.equal(publicMediaToRepoPath('/stories/img_2878.jpg'), 'public/stories/img_2878.jpg');
    assert.equal(publicMediaToRepoPath('"/stories/nice-baie-des-anges.jpg"'), 'public/stories/nice-baie-des-anges.jpg');
    assert.equal(publicMediaToRepoPath('/stories/../secrets.txt'), null);
    assert.equal(publicMediaToRepoPath('/shots/other.jpg'), null);
  });
});

describe('isRideMediaRepoPath', () => {
  it('only allows files in public/stories', () => {
    assert.equal(isRideMediaRepoPath('public/stories/img_2878.jpg'), true);
    assert.equal(isRideMediaRepoPath('public/stories/../package.json'), false);
    assert.equal(isRideMediaRepoPath('src/content/stories/nice.md'), false);
  });
});

describe('mediaRepoPathsFromText', () => {
  it('collects cover and gallery photos from the Nice ride', () => {
    const raw = readFileSync('src/content/stories/nice.md', 'utf8');
    assert.deepEqual(mediaRepoPathsFromText(raw).sort(), [
      'public/stories/nice-baie-des-anges.jpg',
      'public/stories/nice-promenade-detail.jpg',
    ]);
  });
});

describe('unusedMediaPaths', () => {
  it('keeps a photo that a shot still uses', () => {
    assert.deepEqual(
      unusedMediaPaths(
        ['public/stories/nice-baie-des-anges.jpg', 'public/stories/only-this-ride.jpg'],
        ['public/stories/nice-baie-des-anges.jpg'],
      ),
      ['public/stories/only-this-ride.jpg'],
    );
  });
});

describe('CMS − Ride wiring', () => {
  it('loads delete-ride.js from the admin page', () => {
    const html = readFileSync('public/admin/index.html', 'utf8');
    assert.match(html, /src="\/admin\/delete-ride\.js"/);
  });

  it('selects a list card then deletes only the ride folder and unused photos', () => {
    const js = readFileSync('public/admin/delete-ride.js', 'utf8');
    assert.match(js, /− Ride/);
    assert.match(js, /#2fbf62/);
    assert.ok(
      js.includes('src\\/content\\/stories\\/[^./][^/]*\\.md'),
      'delete-ride.js must only target src/content/stories/*.md',
    );
    assert.ok(
      js.includes('public\\/stories\\/[A-Za-z0-9][A-Za-z0-9._-]*'),
      'photo deletes must stay inside public/stories',
    );
    assert.match(js, /Name of this ride/);
    assert.match(js, /isEditorSaveControl/);
  });
});

describe('slugFromRideName', () => {
  it('turns a ride name into a safe filename slug', () => {
    assert.equal(slugFromRideName('Dawn on the ridge'), 'dawn-on-the-ridge');
    assert.equal(slugFromRideName('Über the pass!'), 'uber-the-pass');
    assert.equal(slugFromRideName('../secret'), 'secret');
    assert.equal(slugFromRideName('   '), '');
  });
});

describe('uniqueRideSlug', () => {
  it('adds a number when the name is already a ride', () => {
    assert.equal(uniqueRideSlug('Nice', ['src/content/stories/nice.md']), 'nice-2');
    assert.equal(uniqueRideSlug('Window light', ['src/content/stories/nice.md']), 'window-light');
  });
});

describe('newRideMarkdown', () => {
  it('writes a ride file with the name, today’s date, and room for photos and text', () => {
    const raw = newRideMarkdown('Dawn on the ridge', '2026-09-04');
    assert.match(raw, /^---\n/);
    assert.match(raw, /title: "Dawn on the ridge"/);
    assert.match(raw, /headline: "Dawn on the ridge"/);
    assert.match(raw, /pubDate: 2026-09-04/);
    assert.match(raw, /gallery: \[\]/);
    assert.equal(todayStamp(new Date('2026-09-04T15:00:00')), '2026-09-04');
  });
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  editorThumbSrc,
  isGitHubBlobPostUrl,
  isGitHubContentsImageUrl,
  jpegNameFor,
  shouldAttemptShrink,
  storiesRawUrl,
} from './shrink-photo.ts';

describe('shouldAttemptShrink', () => {
  it('shrinks fat jpegs', () => {
    assert.equal(
      shouldAttemptShrink({
        name: 'ride.jpg',
        type: 'image/jpeg',
        size: 2_400_000,
      }),
      true,
    );
  });

  it('leaves small jpegs', () => {
    assert.equal(
      shouldAttemptShrink({
        name: 'ride.jpg',
        type: 'image/jpeg',
        size: 400_000,
      }),
      false,
    );
  });

  it('always converts iPhone HEIC', () => {
    assert.equal(
      shouldAttemptShrink({
        name: 'IMG_1234.HEIC',
        type: 'image/heic',
        size: 200_000,
      }),
      true,
    );
    assert.equal(
      shouldAttemptShrink({
        name: 'IMG_1234.heif',
        type: '',
        size: 80_000,
      }),
      true,
    );
  });

  it('treats empty-type camera jpegs as images', () => {
    assert.equal(
      shouldAttemptShrink({
        name: 'IMG_1234.JPG',
        type: '',
        size: 3_000_000,
      }),
      true,
    );
  });
});

describe('jpegNameFor', () => {
  it('turns HEIC into jpg so the public site can show it', () => {
    assert.equal(jpegNameFor('IMG_1.HEIC'), 'IMG_1.jpg');
  });
});

describe('storiesRawUrl', () => {
  it('rewrites GitHub contents API thumbs to public raw files', () => {
    assert.equal(
      storiesRawUrl(
        'https://api.github.com/repos/chewbacca23/thenewsoulsearchersblog/contents/public/stories/cafe.jpg?ref=main',
      ),
      'https://raw.githubusercontent.com/chewbacca23/thenewsoulsearchersblog/main/public/stories/cafe.jpg',
    );
  });

  it('rewrites the live editor path that 404s until Cloudflare rebuilds', () => {
    assert.equal(
      storiesRawUrl('/stories/the-most-wonderful-patches.jpg'),
      'https://raw.githubusercontent.com/chewbacca23/thenewsoulsearchersblog/main/public/stories/the-most-wonderful-patches.jpg',
    );
    assert.equal(
      storiesRawUrl('https://thenewsoulsearchers.de/stories/cafe.jpg'),
      'https://raw.githubusercontent.com/chewbacca23/thenewsoulsearchersblog/main/public/stories/cafe.jpg',
    );
  });

  it('ignores unrelated images', () => {
    assert.equal(storiesRawUrl('/favicon.svg'), null);
  });
});

describe('editorThumbSrc', () => {
  it('rewrites live CMS thumbs, not local ones', () => {
    assert.equal(
      editorThumbSrc('/stories/cafe.jpg', 'thenewsoulsearchers.de'),
      'https://raw.githubusercontent.com/chewbacca23/thenewsoulsearchersblog/main/public/stories/cafe.jpg',
    );
    assert.equal(editorThumbSrc('/stories/cafe.jpg', 'localhost'), null);
    assert.equal(
      editorThumbSrc('blob:https://thenewsoulsearchers.de/abc', 'thenewsoulsearchers.de'),
      null,
    );
  });
});

describe('isGitHubContentsImageUrl', () => {
  it('spots the 1 MB preview trap', () => {
    assert.equal(
      isGitHubContentsImageUrl(
        'https://api.github.com/repos/x/y/contents/public/stories/a.jpg',
      ),
      true,
    );
  });
});

describe('isGitHubBlobPostUrl', () => {
  it('matches how Decap actually uploads photos', () => {
    assert.equal(
      isGitHubBlobPostUrl(
        'https://api.github.com/repos/chewbacca23/thenewsoulsearchersblog/git/blobs',
      ),
      true,
    );
  });
});

describe('admin scripts stay wired', () => {
  it('does not wrap fetch or swallow the file picker, so Publish can save', () => {
    const src = readFileSync('public/admin/shrink-on-pick.js', 'utf8');
    assert.doesNotMatch(src, /stopImmediatePropagation/);
    assert.doesNotMatch(src, /window\.fetch\s*=/);
  });

  it('loads the GitHub raw thumb fallback on the CMS page', () => {
    const html = readFileSync('public/admin/index.html', 'utf8');
    assert.match(html, /preview-fallback\.js/);
    const src = readFileSync('public/admin/preview-fallback.js', 'utf8');
    assert.match(src, /raw\.githubusercontent\.com/);
    assert.match(src, /addEventListener\(\s*'error'/);
  });

  it('turns a Publish click into Publish now', () => {
    const html = readFileSync('public/admin/index.html', 'utf8');
    assert.match(html, /publish-click\.js/);
    const src = readFileSync('public/admin/publish-click.js', 'utf8');
    assert.match(src, /publish now/);
    assert.match(src, /already saved on GitHub/i);
  });
});

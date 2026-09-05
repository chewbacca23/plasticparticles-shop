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

  it('puts Looks in the editor bar', () => {
    const html = readFileSync('public/admin/index.html', 'utf8');
    assert.match(html, /class="cms-looks" href="\/looks"/);
    assert.match(html, /class="cms-mail"/);
    assert.match(html, /#\/collections\/settings\/entries\/imprint/);
    assert.match(html, /class="cms-login"/);
    assert.match(html, /Login with GitHub/);
    assert.match(html, /login-gold\.js/);
    assert.match(html, /data-looks="today"/);
    assert.match(html, /Photos in the story/);
    assert.match(html, /Mail and imprint/);
  });

  it('styles the GitHub login page like the site, not Decap’s gray dump', () => {
    const html = readFileSync('public/admin/index.html', 'utf8');
    assert.match(html, /AuthenticationPage/);
    assert.match(html, /LoginButton/);
    assert.match(html, /NetlifyCreditIcon/);
    assert.match(html, /How this editor works/);
    assert.match(html, /<details>/);
    assert.doesNotMatch(html, /background:\s*#eff0f4/);
  });

  it('puts a Save this ride control on the editor and leaves the Publish menu alone', () => {
    const html = readFileSync('public/admin/index.html', 'utf8');
    assert.match(html, /publish-click\.js/);
    assert.match(html, /ride-preview\.js/);
    assert.match(html, /Save this ride/);
    assert.ok(
      html.indexOf('decap-cms.js') < html.indexOf('login-gold.js'),
      'gold login must load after Decap',
    );
    assert.ok(
      html.indexOf('decap-cms.js') < html.indexOf('ride-preview.js'),
      'ride preview must load after Decap',
    );
    const login = readFileSync('public/admin/login-gold.js', 'utf8');
    assert.match(login, /LoginButton/);
    assert.match(login, /startLogin/);
    const src = readFileSync('public/admin/publish-click.js', 'utf8');
    assert.match(src, /Save this ride/);
    assert.match(src, /handleOnPersist/);
    assert.match(src, /data-ss-save-ride/);
    assert.doesNotMatch(src, /text === 'publish'/);
    assert.doesNotMatch(src, /clickPublishNow/);
    const config = readFileSync('public/admin/config.yml', 'utf8');
    assert.match(config, /name: body[\s\S]*required:\s*false/);
    assert.match(config, /name: gallery[\s\S]*required:\s*false/);
    assert.match(config, /Photos in the story/);
    assert.match(config, /First photo/);
    assert.match(config, /Mail and imprint/);
    assert.match(config, /format: json/);
    assert.match(config, /name: email/);
    assert.match(config, /name: order[\s\S]*min:\s*0/);
    assert.match(src, /Save mail and imprint/);
    const preview = readFileSync('public/admin/ride-preview.js', 'utf8');
    assert.match(preview, /ss-ride-preview__hero/);
    assert.match(preview, /ss-ride-preview__story/);
    assert.doesNotMatch(preview, /ss-ride-preview__gallery/);
  });
});

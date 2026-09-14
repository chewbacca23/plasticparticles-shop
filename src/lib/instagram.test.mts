import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cleanHandle,
  instagramBind,
  instagramProfileUrl,
  parseInstagramPost,
} from './instagram.ts';

describe('cleanHandle', () => {
  it('strips @ and profile URLs', () => {
    assert.equal(cleanHandle('@thenewsoulsearchers'), 'thenewsoulsearchers');
    assert.equal(
      cleanHandle('https://www.instagram.com/thenewsoulsearchers/'),
      'thenewsoulsearchers',
    );
  });

  it('rejects empty, junk, and reserved paths', () => {
    assert.equal(cleanHandle(''), null);
    assert.equal(cleanHandle('  '), null);
    assert.equal(cleanHandle('not a handle!'), null);
    assert.equal(cleanHandle('https://www.instagram.com/p/AbC/'), null);
  });
});

describe('parseInstagramPost', () => {
  it('accepts a photo, a reel, and a share link with extra junk', () => {
    assert.deepEqual(parseInstagramPost('https://www.instagram.com/p/CxYz123AbCd/'), {
      permalink: 'https://www.instagram.com/p/CxYz123AbCd/',
      kind: 'p',
    });
    assert.deepEqual(parseInstagramPost('https://www.instagram.com/reel/ReEl456/'), {
      permalink: 'https://www.instagram.com/reel/ReEl456/',
      kind: 'reel',
    });
    assert.deepEqual(
      parseInstagramPost(
        'https://www.instagram.com/thenewsoulsearchers/p/CxYz123AbCd/?igsh=abc',
      ),
      {
        permalink: 'https://www.instagram.com/p/CxYz123AbCd/',
        kind: 'p',
      },
    );
  });

  it('ignores a profile URL and empty paste', () => {
    assert.equal(parseInstagramPost('https://www.instagram.com/thenewsoulsearchers/'), null);
    assert.equal(parseInstagramPost(''), null);
  });
});

describe('instagramBind', () => {
  it('is hidden until a handle is set', () => {
    assert.equal(instagramBind({ handle: '', latestPost: '' }), null);
  });

  it('shows the follow link even before a latest photo is pasted', () => {
    const bound = instagramBind({ handle: 'thenewsoulsearchers' });
    assert.equal(bound?.handle, 'thenewsoulsearchers');
    assert.equal(bound?.profileUrl, instagramProfileUrl('thenewsoulsearchers'));
    assert.equal(bound?.post, null);
  });

  it('pairs the account with the latest photo', () => {
    const bound = instagramBind({
      handle: '@thenewsoulsearchers',
      latestPost: 'https://www.instagram.com/p/CxYz123AbCd/',
    });
    assert.equal(bound?.post?.permalink, 'https://www.instagram.com/p/CxYz123AbCd/');
  });
});

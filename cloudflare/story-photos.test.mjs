import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  bodyImagePaths,
  isImageBlock,
  planRidePhotos,
  safePhotoSrc,
  weaveStoryMarkdown,
} from './story-photos.js';

describe('safePhotoSrc', () => {
  it('keeps a ride photo and drops junk', () => {
    assert.equal(safePhotoSrc('/stories/img_6440-2.jpg'), '/stories/img_6440-2.jpg');
    assert.equal(safePhotoSrc('javascript:alert(1)'), '');
    assert.equal(safePhotoSrc('/stories/../secret.jpg'), '');
    assert.equal(safePhotoSrc('https://evil.example/x.jpg'), '');
  });
});

describe('bodyImagePaths', () => {
  it('reads markdown and html photos in the story', () => {
    assert.deepEqual(
      bodyImagePaths(
        'Hello\n\n![Patches](/stories/img_6440-2.jpg)\n\nMore\n\n<img src="/stories/img_6441.jpg" alt="">',
      ),
      ['/stories/img_6440-2.jpg', '/stories/img_6441.jpg'],
    );
  });
});

describe('isImageBlock', () => {
  it('spots a photo block', () => {
    assert.equal(isImageBlock('![](/stories/img_6440-2.jpg)'), true);
    assert.equal(isImageBlock('Sitting in front of me are two small patches.'), false);
  });
});

describe('weaveStoryMarkdown', () => {
  it('puts extra photos between paragraphs, not in a pile at the start', () => {
    const woven = weaveStoryMarkdown(
      'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.\n\nFourth paragraph.',
      ['/stories/a.jpg', '/stories/b.jpg'],
    );
    assert.equal(
      woven,
      [
        'First paragraph.',
        'Second paragraph.',
        '![](/stories/a.jpg)',
        'Third paragraph.',
        '![](/stories/b.jpg)',
        'Fourth paragraph.',
      ].join('\n\n'),
    );
    assert.ok(woven.indexOf('First paragraph.') < woven.indexOf('/stories/a.jpg'));
  });

  it('leaves the story alone when there are no extra photos', () => {
    assert.equal(weaveStoryMarkdown('Just text.', []), 'Just text.');
  });

  it('uses the photos as the story when there is no text yet', () => {
    assert.equal(
      weaveStoryMarkdown('', ['/stories/a.jpg', '/stories/b.jpg']),
      '![](/stories/a.jpg)\n\n![](/stories/b.jpg)',
    );
  });
});

describe('planRidePhotos', () => {
  it('keeps the first photo at the top and weaves the rest', () => {
    const plan = planRidePhotos(
      ['/stories/cover.jpg', '/stories/a.jpg', '/stories/b.jpg'],
      'One.\n\nTwo.\n\nThree.',
      '/stories/cover.jpg',
    );
    assert.equal(plan.hero, '/stories/cover.jpg');
    assert.deepEqual(plan.inside, ['/stories/a.jpg', '/stories/b.jpg']);
    assert.match(plan.wovenBody, /One\./);
    assert.ok(plan.wovenBody.indexOf('One.') < plan.wovenBody.indexOf('/stories/a.jpg'));
    assert.doesNotMatch(plan.wovenBody, /cover\.jpg/);
  });

  it('does not repeat a photo that is already in the story', () => {
    const plan = planRidePhotos(
      ['/stories/cover.jpg', '/stories/a.jpg'],
      'Hello\n\n![](/stories/a.jpg)\n\nBye',
      '/stories/cover.jpg',
    );
    assert.equal(plan.hero, '/stories/cover.jpg');
    assert.deepEqual(plan.inside, []);
    assert.equal(plan.wovenBody, 'Hello\n\n![](/stories/a.jpg)\n\nBye');
  });

  it('puts the first photo in the story when it is written there', () => {
    const plan = planRidePhotos(
      ['/stories/cover.jpg'],
      'Hello\n\n![](/stories/cover.jpg)',
      '/stories/cover.jpg',
    );
    assert.equal(plan.hero, '');
    assert.deepEqual(plan.inside, []);
  });
});

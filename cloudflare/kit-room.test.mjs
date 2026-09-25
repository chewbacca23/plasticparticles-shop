import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import worker from './cms-oauth-worker.js';
import { handleKitRoom, isKitPath, isKitRoomPath } from './kit-room.js';
import { shouldRecordPath } from './page-looks.js';

describe('kit paths', () => {
  it('marks the room and its pictures, not kitchen', () => {
    assert.equal(isKitPath('/kit'), true);
    assert.equal(isKitPath('/kit/'), true);
    assert.equal(isKitRoomPath('/kit/jersey-white.png'), true);
    assert.equal(isKitRoomPath('/api/kit'), true);
    assert.equal(isKitRoomPath('/kitchen'), false);
    assert.equal(isKitRoomPath('/shop'), false);
  });
});

describe('kit is public', () => {
  it('does not lock the room', async () => {
    assert.equal(await handleKitRoom(new Request('https://thenewsoulsearchers.de/kit'), {}), null);
    assert.equal(
      await handleKitRoom(new Request('https://thenewsoulsearchers.de/kit/jersey-white.png'), {}),
      null,
    );
  });

  it('lets ASSETS serve the kit to anyone', async () => {
    const res = await worker.fetch(new Request('https://thenewsoulsearchers.de/kit'), {
      ASSETS: {
        fetch: async () => new Response('open-kit'),
      },
    });
    assert.equal(res.status, 200);
    assert.equal(await res.text(), 'open-kit');
  });
});

describe('kit looks', () => {
  it('counts the public kit page and skips the pictures', () => {
    assert.equal(shouldRecordPath('/kit'), true);
    assert.equal(shouldRecordPath('/kit/jersey-white.png'), false);
  });
});

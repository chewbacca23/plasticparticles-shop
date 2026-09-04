import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dateValue, newestFirst } from './newest.ts';

describe('dateValue', () => {
  it('turns dates and day strings into milliseconds', () => {
    assert.equal(dateValue(new Date('2026-09-04T00:00:00.000Z')), Date.parse('2026-09-04T00:00:00.000Z'));
    assert.equal(dateValue('2026-09-02'), Date.parse('2026-09-02'));
    assert.equal(dateValue(undefined), 0);
    assert.equal(dateValue('not a date'), 0);
  });
});

describe('newestFirst', () => {
  it('puts the latest ride first and keeps older ones after', () => {
    const rides = newestFirst(
      [
        { headline: 'Empty tarmac', pubDate: '2026-08-26', order: 3 },
        { headline: 'Nice', pubDate: '2026-08-31', order: 4 },
        { headline: 'Tour', pubDate: '2026-09-02', order: 4 },
      ],
      (ride) => ride.pubDate,
      (a, b) => b.order - a.order,
    );
    assert.deepEqual(
      rides.map((ride) => ride.headline),
      ['Tour', 'Nice', 'Empty tarmac'],
    );
  });

  it('breaks a tie on the same day with the extra compare', () => {
    const rides = newestFirst(
      [
        { headline: 'Rest day', pubDate: '2026-08-26', order: 5 },
        { headline: 'Café notes', pubDate: '2026-08-26', order: 6 },
      ],
      (ride) => ride.pubDate,
      (a, b) => b.order - a.order,
    );
    assert.deepEqual(
      rides.map((ride) => ride.headline),
      ['Café notes', 'Rest day'],
    );
  });

  it('puts the Tour ride first among the committed stories', () => {
    const rides = readdirSync('src/content/stories')
      .filter((name) => name.endsWith('.md'))
      .map((name) => {
        const raw = readFileSync(`src/content/stories/${name}`, 'utf8');
        const headline = raw.match(/^headline:\s*(.*)$/m)?.[1]?.trim() ?? name;
        const pubDate = raw.match(/^pubDate:\s*(.*)$/m)?.[1]?.trim();
        const order = Number(raw.match(/^order:\s*(.*)$/m)?.[1] ?? 0);
        return { headline, pubDate, order };
      });
    const sorted = newestFirst(
      rides,
      (ride) => ride.pubDate,
      (a, b) => b.order - a.order,
    );
    assert.equal(sorted[0]?.headline, 'Riding in 45 degrees heat in the Sun');
    assert.equal(sorted[1]?.headline, 'Nice');
  });
});

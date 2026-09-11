import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  fillSiteInHtml,
  handleFreshSite,
  isSitePath,
  parseSiteSettings,
  publicEmail,
  publicImprint,
} from './fresh-site.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('isSitePath', () => {
  it('marks Contact and Imprint', () => {
    assert.equal(isSitePath('/contact'), true);
    assert.equal(isSitePath('/impressum/'), true);
    assert.equal(isSitePath('/imprint'), true);
    assert.equal(isSitePath('/admin/'), false);
  });
});

describe('publicEmail', () => {
  it('uses the saved address', () => {
    assert.equal(publicEmail({ email: 'henrik@thenewsoulsearchers.de' }), 'henrik@thenewsoulsearchers.de');
    assert.equal(publicEmail({ email: '' }), 'hello@thenewsoulsearchers.de');
  });
});

describe('fillSiteInHtml', () => {
  it('writes the saved mail and street into the pages', () => {
    const html = fillSiteInHtml(
      [
        '<a href="mailto:hello@thenewsoulsearchers.de" data-site="email">hello@thenewsoulsearchers.de</a>',
        '<form action="mailto:hello@thenewsoulsearchers.de"></form>',
        '<p data-site="provider">The Soul Searchers<br />Henrik Kürschner<br />Germany</p>',
        '<p data-site="responsible">Henrik Kürschner</p>',
        '<span data-site="phone"></span>',
      ].join(''),
      {
        email: 'henrik@thenewsoulsearchers.de',
        legalName: 'The Soul Searchers',
        responsible: 'Henrik Kürschner',
        street: 'Example 1',
        zipCity: '12345 Berlin',
        country: 'Germany',
        phone: '0123',
      },
    );
    assert.match(html, /mailto:henrik@thenewsoulsearchers\.de/);
    assert.match(html, /data-site="email">henrik@thenewsoulsearchers\.de</);
    assert.match(html, /Example 1/);
    assert.match(html, /12345 Berlin/);
    assert.match(html, /Telefon: 0123/);
  });
});

describe('handleFreshSite', () => {
  it('fills a stale Contact page from GitHub', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ email: 'henrik@thenewsoulsearchers.de' }), { status: 200 });
    const res = await handleFreshSite(new Request('https://thenewsoulsearchers.de/contact/'), {
      ASSETS: {
        fetch: async () =>
          new Response(
            '<a href="mailto:hello@thenewsoulsearchers.de" data-site="email">hello@thenewsoulsearchers.de</a>',
            { headers: { 'content-type': 'text/html' } },
          ),
      },
    });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /henrik@thenewsoulsearchers\.de/);
  });
});

describe('parseSiteSettings', () => {
  it('reads json and survives junk', () => {
    assert.deepEqual(parseSiteSettings('{"email":"a@b.de"}'), { email: 'a@b.de' });
    assert.deepEqual(parseSiteSettings('nope'), {});
  });
});

describe('publicImprint', () => {
  it('keeps empty street empty', () => {
    assert.equal(publicImprint({}).street, '');
    assert.equal(publicImprint({ street: 'A 1' }).street, 'A 1');
  });
});

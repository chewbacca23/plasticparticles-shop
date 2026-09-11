import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  emptySiteMail,
  isSiteSettingsPath,
  parseSiteMailJson,
  SITE_SETTINGS_PATH,
  siteMailFromUnknown,
  siteMailJson,
} from './cms-mail.ts';

describe('siteMailFromUnknown', () => {
  it('keeps the editor fields and trims them', () => {
    const fields = siteMailFromUnknown({
      email: '  henrik@thenewsoulsearchers.de  ',
      legalName: 'The Soul Searchers',
      responsible: 'Henrik Kürschner',
      street: ' Example 1 ',
      zipCity: '12345 Berlin',
      country: 'Germany',
      phone: '',
      extra: 'ignore me',
    });
    assert.equal(fields.email, 'henrik@thenewsoulsearchers.de');
    assert.equal(fields.street, 'Example 1');
    assert.equal(fields.phone, '');
    assert.equal('extra' in fields, false);
  });

  it('fills the usual defaults when the file is empty', () => {
    const fields = siteMailFromUnknown({});
    assert.deepEqual(fields, emptySiteMail());
  });
});

describe('parseSiteMailJson', () => {
  it('reads the committed site.json shape', () => {
    const fields = parseSiteMailJson(readFileSync(SITE_SETTINGS_PATH, 'utf8'));
    assert.equal(fields.legalName, 'The Soul Searchers');
    assert.equal(fields.responsible, 'Henrik Kürschner');
    assert.equal(fields.country, 'Germany');
  });

  it('survives junk JSON', () => {
    assert.deepEqual(parseSiteMailJson('not-json'), emptySiteMail());
  });
});

describe('siteMailJson', () => {
  it('writes the same keys the public pages read', () => {
    const raw = siteMailJson({
      email: 'henrik@thenewsoulsearchers.de',
      legalName: 'The Soul Searchers',
      responsible: 'Henrik Kürschner',
      street: 'Example 1',
      zipCity: '12345 Berlin',
      country: 'Germany',
      phone: '',
    });
    const parsed = JSON.parse(raw);
    assert.equal(parsed.email, 'henrik@thenewsoulsearchers.de');
    assert.equal(parsed.street, 'Example 1');
    assert.equal(parsed.phone, '');
    assert.match(raw, /\n$/);
  });
});

describe('isSiteSettingsPath', () => {
  it('only allows the one settings file', () => {
    assert.equal(isSiteSettingsPath(SITE_SETTINGS_PATH), true);
    assert.equal(isSiteSettingsPath('src/content/settings/instagram.json'), false);
    assert.equal(isSiteSettingsPath('src/content/settings/../stories/nice.md'), false);
  });
});

describe('gold Mail form', () => {
  it('puts a clickable Mail chip and the form on the editor page', () => {
    const html = readFileSync('public/admin/index.html', 'utf8');
    assert.match(html, /id="cms-mail"/);
    assert.match(html, /Mail and imprint/);
    assert.match(html, /position:\s*fixed/);
    assert.match(html, /z-index:\s*2147483000/);
    assert.match(html, /width:\s*9\.25rem/);
    assert.match(html, /font:\s*700 0\.72rem\/1\.15/);
    assert.match(html, /\.cms-mail-panel[\s\S]*right:\s*1\.1rem/);
    assert.match(html, /\.cms-mail[\s\S]*right:\s*1\.1rem/);
    assert.match(html, /data-ss-above-save/);
    assert.match(html, /data-ss-above-mail/);
    assert.match(html, /bottom:\s*3\.15rem/);
    assert.match(html, /bottom:\s*5\.2rem/);
    assert.match(html, /bottom-right/);
    assert.match(html, /\.cms-looks[\s\S]*position:\s*fixed/);
    assert.match(html, /Looks \/ Mail \/ Save stack/);
    assert.doesNotMatch(html, /\.cms-mail[\s\S]*left:\s*1\.1rem;/);
    assert.doesNotMatch(html, /\.cms-mail-panel[\s\S]*inset:\s*0/);
    assert.doesNotMatch(html, /background:\s*rgba\(6, 10, 14, 0\.72\)/);
    assert.doesNotMatch(html, /min-height:\s*3\.4rem/);
    assert.doesNotMatch(html, /min-width:\s*13\.5rem/);
    assert.doesNotMatch(html, /width:\s*12rem/);
    assert.doesNotMatch(html, /button at the bottom-left/);
    assert.match(html, /id="cms-mail-panel"/);
    assert.match(html, /id="cms-mail-email"/);
    assert.match(html, /id="cms-mail-street"/);
    assert.match(html, /id="cms-mail-save"/);
    assert.match(html, /mail-gold\.js/);
    assert.match(html, /data-ss-mail/);
    assert.doesNotMatch(html, /cms-top:not\(\.cms-in\) \.cms-mail/);
    assert.doesNotMatch(html, /#\/collections\/settings\/entries\/imprint/);
    assert.ok(
      html.indexOf('login-gold.js') < html.indexOf('mail-gold.js'),
      'mail form must load after gold login',
    );
  });

  it('saves site.json through GitHub, not Decap’s empty file editor', () => {
    const js = readFileSync('public/admin/mail-gold.js', 'utf8');
    assert.match(js, /src\/content\/settings\/site\.json/);
    assert.match(js, /Save mail and imprint/);
    assert.match(js, /cmsToken/);
    assert.match(js, /persistEntry/);
    assert.match(js, /api\.github\.com/);
    assert.match(js, /document\.body\.appendChild\(mail\)/);
    assert.match(js, /document\.body\.appendChild\(looks\)/);
    assert.match(js, /document\.body\.appendChild\(overlay\)/);
    assert.match(js, /data-ss-above-save/);
    assert.match(js, /data-ss-above-mail/);
    assert.match(js, /stackRightPills/);
    assert.match(js, /data-ss-mail/);
    assert.doesNotMatch(js, /#\/collections\/settings\/entries\/imprint/);
  });
});

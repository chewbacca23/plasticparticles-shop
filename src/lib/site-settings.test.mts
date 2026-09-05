import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanEmail, publicEmail, publicImprint } from './site-settings.ts';

describe('cleanEmail', () => {
  it('keeps a real address and drops junk', () => {
    assert.equal(cleanEmail('henrik@thenewsoulsearchers.de'), 'henrik@thenewsoulsearchers.de');
    assert.equal(cleanEmail('  hello@thenewsoulsearchers.de  '), 'hello@thenewsoulsearchers.de');
    assert.equal(cleanEmail('not-an-email'), '');
    assert.equal(cleanEmail(''), '');
  });
});

describe('publicEmail', () => {
  it('uses the saved address, or the site default', () => {
    assert.equal(publicEmail({ email: 'henrik@thenewsoulsearchers.de' }), 'henrik@thenewsoulsearchers.de');
    assert.equal(publicEmail({ email: '' }), 'hello@thenewsoulsearchers.de');
  });
});

describe('publicImprint', () => {
  it('fills the imprint from the editor fields', () => {
    const imprint = publicImprint({
      email: 'henrik@thenewsoulsearchers.de',
      legalName: 'The Soul Searchers',
      responsible: 'Henrik Kürschner',
      street: 'Example 1',
      zipCity: '12345 Nice-not',
      country: 'Germany',
      phone: '',
    });
    assert.equal(imprint.email, 'henrik@thenewsoulsearchers.de');
    assert.equal(imprint.street, 'Example 1');
    assert.equal(imprint.phone, '');
    assert.equal(imprint.country, 'Germany');
  });
});

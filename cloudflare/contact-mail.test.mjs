import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CONTACT_FROM,
  CONTACT_TO,
  RESEND_FROM,
  contactHtml,
  contactSubject,
  contactText,
  deliverContact,
  handleContactRequest,
  mailReady,
  mailVia,
  parseContactBody,
  validateContact,
} from './contact-mail.js';

describe('parseContactBody', () => {
  it('trims and keeps a clean note', () => {
    const fields = parseContactBody({
      name: '  Ana  ',
      email: ' ana@example.com ',
      message: ' Nice climb. ',
    });
    assert.equal(fields.name, 'Ana');
    assert.equal(fields.email, 'ana@example.com');
    assert.equal(fields.message, 'Nice climb.');
  });

  it('rejects junk email', () => {
    const fields = parseContactBody({ name: 'Ana', email: 'nope', message: 'Hi' });
    assert.equal(fields.email, '');
  });
});

describe('validateContact', () => {
  it('asks for the missing bits', () => {
    assert.match(validateContact({ name: '', email: 'a@b.co', message: 'x' }), /name/i);
    assert.match(validateContact({ name: 'A', email: '', message: 'x' }), /email/i);
    assert.match(validateContact({ name: 'A', email: 'a@b.co', message: '' }), /message/i);
    assert.equal(validateContact({ name: 'A', email: 'a@b.co', message: 'Hi' }), '');
  });
});

describe('mailReady', () => {
  it('spots Resend or the Cloudflare binding', () => {
    assert.equal(mailReady({}), false);
    assert.equal(mailVia({}), 'none');
    assert.equal(mailReady({ RESEND_API_KEY: 're_x' }), true);
    assert.equal(mailVia({ RESEND_API_KEY: 're_x' }), 'resend');
    assert.equal(mailReady({ EMAIL: { async send() {} } }), true);
    assert.equal(mailVia({ EMAIL: { async send() {} } }), 'cloudflare');
  });
});

describe('contact copy', () => {
  it('builds a clear subject and body', () => {
    assert.match(contactSubject('Bruno'), /Bruno/);
    assert.match(
      contactText({ name: 'Bruno', email: 'b@ex.com', message: 'Ventoux was wild.' }),
      /Ventoux was wild/,
    );
    assert.match(contactText({ name: 'Bruno', email: 'b@ex.com', message: 'x' }), /b@ex.com/);
    assert.match(contactHtml({ name: 'Bruno', email: 'b@ex.com', message: '<hi>' }), /&lt;hi&gt;/);
  });
});

describe('deliverContact', () => {
  it('uses the Cloudflare email binding when present', async () => {
    const sent = [];
    const via = await deliverContact(
      {
        EMAIL: {
          async send(payload) {
            sent.push(payload);
          },
        },
      },
      { name: 'Ana', email: 'ana@example.com', message: 'Hello from the road.' },
    );
    assert.equal(via.via, 'cloudflare');
    assert.equal(sent[0].to, CONTACT_TO);
    assert.equal(sent[0].from, CONTACT_FROM);
    assert.equal(sent[0].replyTo, 'ana@example.com');
    assert.match(sent[0].subject, /Ana/);
  });

  it('falls back to Resend when only that key exists', async () => {
    const original = globalThis.fetch;
    let body;
    globalThis.fetch = async (_url, init) => {
      body = JSON.parse(String(init.body));
      return new Response('{}', { status: 200 });
    };
    try {
      const via = await deliverContact(
        { RESEND_API_KEY: 're_test' },
        { name: 'Ana', email: 'ana@example.com', message: 'Hello' },
      );
      assert.equal(via.via, 'resend');
      assert.equal(via.to, CONTACT_TO);
      assert.deepEqual(body.to, [CONTACT_TO]);
      assert.equal(body.from, RESEND_FROM);
      assert.equal(body.reply_to, 'ana@example.com');
    } finally {
      globalThis.fetch = original;
    }
  });

  it('honours CONTACT_INBOX when Henrik reads a different box', async () => {
    const original = globalThis.fetch;
    let body;
    globalThis.fetch = async (_url, init) => {
      body = JSON.parse(String(init.body));
      return new Response('{}', { status: 200 });
    };
    try {
      const via = await deliverContact(
        { RESEND_API_KEY: 're_test', CONTACT_INBOX: 'henrik.personal@example.com' },
        { name: 'Ana', email: 'ana@example.com', message: 'Hello' },
      );
      assert.equal(via.to, 'henrik.personal@example.com');
      assert.deepEqual(body.to, ['henrik.personal@example.com']);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('handleContactRequest', () => {
  it('ignores other paths', async () => {
    const res = await handleContactRequest(new Request('https://x.test/about'), {});
    assert.equal(res, null);
  });

  it('sends a valid note', async () => {
    const sent = [];
    const res = await handleContactRequest(
      new Request('https://x.test/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Ana',
          email: 'ana@example.com',
          message: 'The descent was the best part.',
        }),
      }),
      {
        EMAIL: {
          async send(payload) {
            sent.push(payload);
          },
        },
      },
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.ok, true);
    assert.equal(sent.length, 1);
  });

  it('rejects an empty note', async () => {
    const res = await handleContactRequest(
      new Request('https://x.test/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '', email: '', message: '' }),
      }),
      {
        EMAIL: { async send() {} },
      },
    );
    assert.equal(res.status, 400);
  });

  it('reports whether mail is wired on GET', async () => {
    const cold = await handleContactRequest(new Request('https://x.test/api/contact'), {});
    assert.equal(cold.status, 200);
    assert.equal((await cold.json()).mailWired, false);

    const hot = await handleContactRequest(new Request('https://x.test/api/contact'), {
      RESEND_API_KEY: 're_test',
    });
    assert.equal((await hot.json()).mailWired, true);
  });

  it('quietly discards honeypot spam', async () => {
    const sent = [];
    const res = await handleContactRequest(
      new Request('https://x.test/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Bot',
          email: 'bot@example.com',
          message: 'Buy now',
          company: 'Spam Co',
        }),
      }),
      {
        EMAIL: {
          async send(payload) {
            sent.push(payload);
          },
        },
      },
    );
    assert.equal(res.status, 200);
    assert.equal((await res.json()).via, 'discard');
    assert.equal(sent.length, 0);
  });
});

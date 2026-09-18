import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CONTACT_FROM,
  CONTACT_TO,
  cleanResendKey,
  contactHtml,
  contactSubject,
  contactText,
  deliverContact,
  describeResendKey,
  handleContactRequest,
  mailReady,
  mailVia,
  parseContactBody,
  probeResendKey,
  resolveResendFrom,
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

describe('resolveContactTo', () => {
  it('defaults to web.de and refuses domain inboxes that bounce Resend', async () => {
    const { resolveContactTo, CONTACT_TO, contactInboxOverridden } = await import(
      './contact-mail.js'
    );
    assert.equal(resolveContactTo({}), CONTACT_TO);
    assert.equal(
      resolveContactTo({ CONTACT_INBOX: 'henrik.kuerschner@web.de' }),
      'henrik.kuerschner@web.de',
    );
    assert.equal(
      resolveContactTo({ CONTACT_INBOX: 'henrik@thenewsoulsearchers.de' }),
      CONTACT_TO,
    );
    assert.equal(contactInboxOverridden({ CONTACT_INBOX: 'henrik@thenewsoulsearchers.de' }), true);
    assert.equal(contactInboxOverridden({ CONTACT_INBOX: 'henrik.kuerschner@web.de' }), false);
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

describe('cleanResendKey', () => {
  it('strips quotes and a Bearer prefix', () => {
    assert.equal(cleanResendKey('  "re_abc"  '), 're_abc');
    assert.equal(cleanResendKey("Bearer re_abc"), 're_abc');
    assert.equal(cleanResendKey("'re_abc'"), 're_abc');
  });
});

describe('describeResendKey', () => {
  it('reports shape without the value', () => {
    assert.equal(describeResendKey('').present, false);
    assert.match(describeResendKey('re_testkey_abcdefghijklmnopqrstuvwxyz12').shape, /looks like a Resend key/);
    assert.match(describeResendKey('not-a-key').shape, /does NOT look like/);
  });
});

describe('probeResendKey', () => {
  it('rejects tiny / non-re_ values before calling Resend', async () => {
    const probe = await probeResendKey({ RESEND_API_KEY: 'short' });
    assert.equal(probe.ok, false);
    assert.equal(probe.status, 0);
    assert.match(probe.detail, /not a full Resend key/);
  });

  it('reports 401 without sending mail', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => new Response('nope', { status: 401 });
    try {
      const probe = await probeResendKey({ RESEND_API_KEY: 're_dead_key_value_here_xx' });
      assert.equal(probe.ok, false);
      assert.equal(probe.status, 401);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('treats sending_access restriction as ok for the form', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response('{"message":"This API key is restricted to only send emails."}', { status: 401 });
    try {
      const probe = await probeResendKey({ RESEND_API_KEY: 're_send_only_key_value_xxx' });
      assert.equal(probe.ok, true);
      assert.match(probe.detail, /sending_access/);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('reports ok when Resend accepts the key', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (url) => {
      assert.match(String(url), /api\.resend\.com\/domains/);
      return new Response('{"data":[]}', { status: 200 });
    };
    try {
      const probe = await probeResendKey({ RESEND_API_KEY: 're_live_key_value_here_xx' });
      assert.equal(probe.ok, true);
      assert.equal(probe.status, 200);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('contact copy', () => {
  it('builds a clear subject and body', () => {
    assert.match(contactSubject('Bruno'), /Contact form/);
    assert.match(contactSubject('Bruno'), /Bruno/);
    assert.match(
      contactText({ name: 'Bruno', email: 'b@ex.com', message: 'Ventoux was wild.' }),
      /Ventoux was wild/,
    );
    assert.match(
      contactText({ name: 'Bruno', email: 'b@ex.com', message: 'x' }),
      /contact form on thenewsoulsearchers\.de/,
    );
    assert.match(contactText({ name: 'Bruno', email: 'b@ex.com', message: 'x' }), /b@ex.com/);
    assert.match(contactHtml({ name: 'Bruno', email: 'b@ex.com', message: '<hi>' }), /&lt;hi&gt;/);
    assert.match(contactHtml({ name: 'Bruno', email: 'b@ex.com', message: 'x' }), /Contact form/);
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
      assert.equal(body.from, `The Soul Searchers form <${CONTACT_FROM}>`);
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

  it('marks unwired mail with mailto, but not a Resend outage', async () => {
    const cold = await handleContactRequest(
      new Request('https://x.test/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Ana',
          email: 'ana@example.com',
          message: 'Still on the climb.',
        }),
      }),
      {},
    );
    assert.equal(cold.status, 503);
    const coldBody = await cold.json();
    assert.equal(coldBody.mailto, true);

    const original = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response('upstream down', { status: 500, statusText: 'Error' });
    try {
      const hot = await handleContactRequest(
        new Request('https://x.test/api/contact', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'Ana',
            email: 'ana@example.com',
            message: 'Still on the climb.',
          }),
        }),
        { RESEND_API_KEY: 're_test' },
      );
      assert.equal(hot.status, 502);
      const body = await hot.json();
      assert.equal(body.ok, false);
      assert.equal(body.mailto, undefined);
      assert.equal(body.code, 'E_RESEND');
    } finally {
      globalThis.fetch = original;
    }
  });

  it('still sends when the KV copy fails', async () => {
    const sent = [];
    const res = await handleContactRequest(
      new Request('https://x.test/api/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Ana',
          email: 'ana@example.com',
          message: 'Still on the climb.',
        }),
      }),
      {
        EMAIL: {
          async send(payload) {
            sent.push(payload);
          },
        },
        STATS: {
          async put() {
            throw new Error('kv down');
          },
        },
      },
    );
    assert.equal(res.status, 200);
    assert.equal((await res.json()).ok, true);
    assert.equal(sent.length, 1);
  });
});

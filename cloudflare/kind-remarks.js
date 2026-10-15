/**
 * Kind words on every public page.
 * GET  /api/remarks?path=/stories/...
 * POST /api/remarks  { path, name?, message, website? }
 *
 * Stored in STATS KV. Automatic positive check before save — no approve queue.
 */

export const MAX_NAME = 40;
export const MAX_MESSAGE = 280;
export const MIN_MESSAGE = 8;
export const LIST_LIMIT = 12;
export const STORE_LIMIT = 40;
export const RATE_WINDOW_SEC = 60 * 60;
export const RATE_MAX = 5;

const KIND_REFUSAL = 'This site only keeps kind words.';

/** Lowercase EN/DE hostile / rude tokens. Whole-word style via regex boundaries. */
const BLOCKED = [
  'hate',
  'hates',
  'hating',
  'idiot',
  'idiots',
  'stupid',
  'dumb',
  'moron',
  'morons',
  'asshole',
  'assholes',
  'bastard',
  'bastards',
  'bitch',
  'bitches',
  'shit',
  'shitty',
  'fuck',
  'fucking',
  'fucker',
  'fucked',
  'cunt',
  'dick',
  'piss',
  'pissed',
  'suck',
  'sucks',
  'loser',
  'losers',
  'kill',
  'killing',
  'murder',
  'rape',
  'racist',
  'nazi',
  'scam',
  'scammer',
  'spam',
  'trash',
  'garbage',
  'useless',
  'worthless',
  'disgusting',
  'pathetic',
  'ugly',
  'fatass',
  'retard',
  'retarded',
  'whore',
  'slut',
  'dreck',
  'scheisse',
  'scheiße',
  'arschloch',
  'arschloecher',
  'arschlöcher',
  'hurensohn',
  'wichser',
  'fotze',
  'mistkerl',
  'hass',
  'hassen',
  'idiotisch',
  'dumm',
  'blöd',
  'bloed',
  'bescheuert',
  'zerstören',
  'zerstoeren',
  'töten',
  'toeten',
  'vergewaltigen',
  'nazi',
  'schwein',
  'schweine',
];

const BLOCKED_RE = new RegExp(
  `(?:^|[^\\p{L}\\p{N}_])(?:${BLOCKED.map(escapeRegExp).join('|')})(?=$|[^\\p{L}\\p{N}_])`,
  'iu',
);

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * @param {unknown} raw
 */
export function normalizeRemarkPath(raw) {
  let path = String(raw || '').trim();
  if (!path) return '';
  try {
    if (/^https?:\/\//i.test(path)) path = new URL(path).pathname;
  } catch {
    return '';
  }
  path = path.split('?')[0].split('#')[0];
  if (!path.startsWith('/')) path = `/${path}`;
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  if (path.length > 200) return '';
  if (!/^\/[A-Za-z0-9/_.,~%-]*$/.test(path)) return '';
  if (path.startsWith('/api')) return '';
  if (path.startsWith('/admin')) return '';
  if (path === '/auth' || path === '/callback' || path === '/looks') return '';
  return path || '/';
}

/**
 * @param {string} message
 */
export function isKindMessage(message) {
  const text = String(message || '').trim();
  if (!text) return false;
  if (/https?:\/\//i.test(text) || /www\./i.test(text)) return false;
  if (/[<>]/.test(text)) return false;
  const letters = (text.match(/\p{L}/gu) || []).length;
  if (letters < 4) return false;
  if (BLOCKED_RE.test(text)) return false;
  return true;
}

/**
 * @param {unknown} body
 */
export function parseRemarkBody(body) {
  const data = body && typeof body === 'object' ? body : {};
  const name = String(data.name || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
  const message = String(data.message || '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, MAX_MESSAGE);
  const website = String(data.website || data.company || '').trim();
  const path = normalizeRemarkPath(data.path);
  return { name, message, website, path };
}

/**
 * @param {{ name: string, message: string, path: string }} fields
 */
export function validateRemark(fields) {
  if (!fields.path) return 'That page cannot take a remark.';
  if (fields.message.length < MIN_MESSAGE) {
    return `Write at least ${MIN_MESSAGE} characters.`;
  }
  if (fields.message.length > MAX_MESSAGE) {
    return `Keep it under ${MAX_MESSAGE} characters.`;
  }
  if (!isKindMessage(fields.message)) return KIND_REFUSAL;
  if (fields.name && BLOCKED_RE.test(fields.name)) return KIND_REFUSAL;
  return '';
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
    },
  });
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function clientKey(request) {
  const cf = /** @type {{ colo?: string }} */ (request.cf || {});
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    'unknown';
  return `remarks:rate:${ip}:${cf.colo || 'xx'}`;
}

function listKey(path) {
  return `remarks:path:${path}`;
}

/**
 * @param {any} env
 * @param {string} key
 */
async function underRateLimit(env, key) {
  const kv = env?.STATS;
  if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') return true;
  const now = Date.now();
  let hits = [];
  try {
    const raw = await kv.get(key);
    hits = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(hits)) hits = [];
  } catch {
    hits = [];
  }
  hits = hits.filter((t) => typeof t === 'number' && now - t < RATE_WINDOW_SEC * 1000);
  if (hits.length >= RATE_MAX) return false;
  hits.push(now);
  await kv.put(key, JSON.stringify(hits), { expirationTtl: RATE_WINDOW_SEC + 60 });
  return true;
}

/**
 * @param {any} env
 * @param {string} path
 */
export async function readRemarks(env, path) {
  const kv = env?.STATS;
  if (!kv || typeof kv.get !== 'function') return [];
  try {
    const raw = await kv.get(listKey(path));
    const list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) return [];
    return list
      .filter((item) => item && typeof item.message === 'string')
      .slice(0, LIST_LIMIT)
      .map((item) => ({
        id: String(item.id || ''),
        name: String(item.name || '').slice(0, MAX_NAME),
        message: String(item.message || '').slice(0, MAX_MESSAGE),
        at: String(item.at || ''),
      }));
  } catch {
    return [];
  }
}

/**
 * @param {any} env
 * @param {string} path
 * @param {{ name: string, message: string }} fields
 */
export async function saveRemark(env, path, fields) {
  const kv = env?.STATS;
  if (!kv || typeof kv.get !== 'function' || typeof kv.put !== 'function') {
    const err = new Error('Remarks storage is not wired.');
    // @ts-expect-error code
    err.code = 'E_REMARKS_KV';
    throw err;
  }
  const entry = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    name: fields.name,
    message: fields.message,
    at: new Date().toISOString(),
  };
  let list = [];
  try {
    const raw = await kv.get(listKey(path));
    list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
  } catch {
    list = [];
  }
  list = [entry, ...list].slice(0, STORE_LIMIT);
  await kv.put(listKey(path), JSON.stringify(list));
  return entry;
}

/**
 * Markup + styles + client script for Worker-built pages (fresh rides).
 */
export function kindRemarksStripHtml() {
  return `${kindRemarksStyles()}
<section class="kind-remarks" data-kind-remarks aria-label="Kind words">
  <div class="site-shell kind-inner">
    <div class="kind-panel" data-kind-panel>
      <h2 class="kind-title">Kind words</h2>
      <p class="kind-lead">This is a positive site. Leave a short, kind remark for this page.</p>
      <ul class="kind-list" data-kind-list hidden></ul>
      <p class="kind-empty" data-kind-empty>No kind words here yet. Be the first.</p>
      <p class="kind-status" data-kind-status hidden></p>
      <form class="kind-form" data-kind-form>
        <label>
          <span>Name <em>(optional)</em></span>
          <input type="text" name="name" maxlength="${MAX_NAME}" autocomplete="nickname" />
        </label>
        <label>
          <span>Your kind word</span>
          <textarea name="message" rows="2" required maxlength="${MAX_MESSAGE}" minlength="${MIN_MESSAGE}"></textarea>
        </label>
        <label class="kind-hp" aria-hidden="true">
          <span>Website</span>
          <input type="text" name="website" tabindex="-1" autocomplete="off" />
        </label>
        <button type="submit">Leave a kind word</button>
      </form>
    </div>
    <div class="kind-member" id="become-a-member" data-kind-member>
      <h2 class="kind-title">Become a member</h2>
      <p class="kind-lead">Free on thenewsoulsearchers.de. Add your email to our list — we keep one big group so we can write you back. Nothing to pay, ever.</p>
      <p class="kind-status" data-member-status hidden></p>
      <form class="kind-form" data-member-form>
        <label>
          <span>Name <em>(optional)</em></span>
          <input type="text" name="name" maxlength="80" autocomplete="name" />
        </label>
        <label>
          <span>Your email</span>
          <input type="email" name="email" required maxlength="200" autocomplete="email" />
        </label>
        <label class="kind-hp" aria-hidden="true">
          <span>Website</span>
          <input type="text" name="website" tabindex="-1" autocomplete="off" />
        </label>
        <button type="submit">Join free</button>
      </form>
    </div>
  </div>
</section>
${kindRemarksClientScript()}`;
}

export function kindRemarksStyles() {
  return `<style>
.kind-remarks{margin-top:1.25rem;padding:1.15rem 0 1.5rem;border-top:1px solid rgba(215,224,232,.08);background:linear-gradient(180deg,transparent,rgba(30,58,69,.16))}
.kind-inner{display:grid;gap:.85rem;align-items:stretch}
@media (min-width:720px){.kind-inner{grid-template-columns:1fr 1fr;gap:1rem}}
.kind-panel,.kind-member{display:grid;gap:.5rem;align-content:start;min-width:0;padding:.85rem .95rem .95rem;border:1px solid rgba(215,224,232,.14);border-radius:.35rem;background:rgba(8,12,17,.42);box-sizing:border-box}
.kind-title{margin:0;font-family:var(--font-display),Fraunces,Georgia,serif;font-size:.98rem;color:var(--paper,#eef3f7);font-weight:500}
.kind-lead,.kind-empty,.kind-status{margin:0;color:rgba(215,224,232,.58);font-size:.8rem;line-height:1.4}
.kind-list{list-style:none;margin:0;padding:0;display:grid;gap:.4rem;align-content:start}
.kind-list li{margin:0;padding:0;color:rgba(238,243,247,.82);font-size:.82rem;line-height:1.4}
.kind-list .who{display:inline;margin-left:.35rem;color:rgba(215,224,232,.45);font-size:.74rem}
.kind-form{display:grid;gap:.4rem;margin-top:.15rem}
.kind-form label{display:grid;gap:.2rem;color:rgba(215,224,232,.68);font-size:.74rem}
.kind-form em{font-style:normal;opacity:.7}
.kind-form input,.kind-form textarea{width:100%;box-sizing:border-box;border:1px solid rgba(215,224,232,.14);border-radius:.3rem;background:rgba(8,12,17,.5);color:var(--paper,#eef3f7);padding:.4rem .55rem;font:inherit;font-size:.82rem}
.kind-form button{justify-self:start;border:0;border-radius:.35rem;padding:.4rem .75rem;background:#d4a574;color:#0c1218;font-weight:600;font-size:.8rem;cursor:pointer}
.kind-form button:disabled{opacity:.6;cursor:wait}
.kind-hp{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}
.kind-status[data-tone="bad"]{color:#e8b4a2}
.kind-status[data-tone="ok"]{color:#b7d4c4}
</style>`;
}

export function kindRemarksClientScript() {
  return `<script>
(function () {
  var root = document.querySelector('[data-kind-remarks]');
  if (!root) return;
  var path = location.pathname || '/';
  if (path.indexOf('/admin') === 0) { root.hidden = true; return; }
  if (path === '/looks' || path === '/auth' || path === '/callback') { root.hidden = true; return; }
  if (path.length > 1 && path.charAt(path.length - 1) === '/') path = path.slice(0, -1);
  var list = root.querySelector('[data-kind-list]');
  var empty = root.querySelector('[data-kind-empty]');
  var status = root.querySelector('[data-kind-status]');
  var form = root.querySelector('[data-kind-form]');

  function showStatus(text, tone) {
    if (!status) return;
    status.hidden = !text;
    status.textContent = text || '';
    status.setAttribute('data-tone', tone || '');
  }

  function escapeText(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function paint(items) {
    if (!list || !empty) return;
    list.innerHTML = '';
    if (!items || !items.length) {
      list.hidden = true;
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    list.hidden = false;
    items.forEach(function (item) {
      var li = document.createElement('li');
      var who = item.name ? '<span class="who">— ' + escapeText(item.name) + '</span>' : '';
      li.innerHTML = '<span class="said">' + escapeText(item.message) + '</span>' + who;
      list.appendChild(li);
    });
  }

  fetch('/api/remarks?path=' + encodeURIComponent(path), { headers: { accept: 'application/json' } })
    .then(function (res) { return res.json(); })
    .then(function (data) { paint(data && data.remarks ? data.remarks : []); })
    .catch(function () {});

  if (form) {
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      showStatus('', '');
      var fd = new FormData(form);
      var payload = {
        path: path,
        name: String(fd.get('name') || ''),
        message: String(fd.get('message') || ''),
        website: String(fd.get('website') || ''),
      };
      var button = form.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      fetch('/api/remarks', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          if (!result.ok || !result.data || !result.data.ok) {
            showStatus((result.data && result.data.error) || 'Could not save that just now.', 'bad');
            return;
          }
          form.reset();
          showStatus('Thank you. Your kind word is on the page.', 'ok');
          return fetch('/api/remarks?path=' + encodeURIComponent(path), { headers: { accept: 'application/json' } })
            .then(function (res) { return res.json(); })
            .then(function (data) { paint(data && data.remarks ? data.remarks : []); });
        })
        .catch(function () { showStatus('Could not save that just now.', 'bad'); })
        .finally(function () { if (button) button.disabled = false; });
    });
  }

  var memberForm = root.querySelector('[data-member-form]');
  var memberStatus = root.querySelector('[data-member-status]');
  function showMemberStatus(text, tone) {
    if (!memberStatus) return;
    memberStatus.hidden = !text;
    memberStatus.textContent = text || '';
    memberStatus.setAttribute('data-tone', tone || '');
  }
  if (memberForm) {
    memberForm.addEventListener('submit', function (event) {
      event.preventDefault();
      showMemberStatus('', '');
      var fd = new FormData(memberForm);
      var payload = {
        name: String(fd.get('name') || ''),
        email: String(fd.get('email') || ''),
        website: String(fd.get('website') || ''),
      };
      var button = memberForm.querySelector('button[type="submit"]');
      if (button) button.disabled = true;
      fetch('/api/members', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(payload),
      })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          if (!result.ok || !result.data || !result.data.ok) {
            showMemberStatus((result.data && result.data.error) || 'Could not join just now.', 'bad');
            return;
          }
          memberForm.reset();
          showMemberStatus((result.data && result.data.message) || 'Welcome. You are on the free list.', 'ok');
        })
        .catch(function () { showMemberStatus('Could not join just now.', 'bad'); })
        .finally(function () { if (button) button.disabled = false; });
    });
  }
})();
</script>`;
}

/**
 * @param {string} html
 */
export function injectKindRemarks(html) {
  const source = String(html || '');
  if (source.includes('data-kind-remarks')) return source;
  const strip = kindRemarksStripHtml();
  if (source.includes('</main>')) {
    return source.replace('</main>', `</main>\n${strip}`);
  }
  if (source.includes('</body>')) {
    return source.replace('</body>', `${strip}\n</body>`);
  }
  return source + strip;
}

/**
 * @param {Request} request
 * @param {any} env
 */
export async function handleRemarksRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== '/api/remarks' && url.pathname !== '/api/remarks/') return null;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
    });
  }

  if (request.method === 'GET') {
    const path = normalizeRemarkPath(url.searchParams.get('path') || '/');
    if (!path) return json({ ok: false, error: 'That page cannot take a remark.' }, 400);
    const remarks = await readRemarks(env, path);
    return json({ ok: true, path, remarks });
  }

  if (request.method !== 'POST') {
    return json({ ok: false, error: 'POST a kind word to leave it.' }, 405);
  }

  if (!(await underRateLimit(env, clientKey(request)))) {
    return json({ ok: false, error: 'Easy, rider. Wait a little, then try again.' }, 429);
  }

  const fields = parseRemarkBody(await readJson(request));
  if (fields.website) {
    return json({ ok: true, via: 'discard' });
  }

  const problem = validateRemark(fields);
  if (problem) return json({ ok: false, error: problem }, 400);

  try {
    const saved = await saveRemark(env, fields.path, {
      name: fields.name,
      message: fields.message,
    });
    return json({ ok: true, remark: saved });
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : '';
    if (code === 'E_REMARKS_KV') {
      return json(
        { ok: false, error: 'Remarks are not wired on the Worker yet.', code },
        503,
      );
    }
    console.error('remarks save failed', error);
    return json({ ok: false, error: 'Could not save that just now.' }, 502);
  }
}

/**
 * Gold Mail opens our own form. Decap’s files collection often shows
 * nothing to click, so this writes site.json itself.
 */
(function () {
  'use strict';

  var REPO = 'chewbacca23/thenewsoulsearchersblog';
  var BRANCH = 'main';
  var PATH = 'src/content/settings/site.json';
  var AFTER = 'ss-after-login';
  var OPEN = 'ss-open-mail';
  var saving = false;

  function $(id) {
    return document.getElementById(id);
  }

  function isLocalHost() {
    var host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }

  function cmsToken() {
    var keys = ['decap-cms-user', 'netlify-cms-user'];
    for (var i = 0; i < keys.length; i++) {
      try {
        var raw = window.localStorage.getItem(keys[i]);
        if (!raw) continue;
        var parsed = JSON.parse(raw);
        if (parsed && parsed.token) return parsed.token;
      } catch (err) {
        // Ignore a corrupt CMS session and try the next key.
      }
    }
    return '';
  }

  function loggedIn() {
    if (isLocalHost()) return true;
    if (cmsToken()) return true;
    if (window.ssGoldLogin && typeof window.ssGoldLogin.loggedIn === 'function') {
      return window.ssGoldLogin.loggedIn();
    }
    return false;
  }

  function startLogin() {
    if (window.ssGoldLogin && typeof window.ssGoldLogin.startLogin === 'function') {
      window.ssGoldLogin.startLogin();
    }
  }

  function utf8ToBase64(text) {
    return window.btoa(unescape(encodeURIComponent(text)));
  }

  function decodeFile(entry) {
    if (!entry || !entry.content || entry.encoding !== 'base64') return '';
    try {
      return decodeURIComponent(escape(window.atob(entry.content.replace(/\n/g, ''))));
    } catch (err) {
      return '';
    }
  }

  function readError(data, fallback) {
    return (data && (data.error || data.message)) || fallback || 'Request failed';
  }

  function emptyFields() {
    return {
      email: '',
      legalName: 'The Soul Searchers',
      responsible: 'Henrik Kürschner',
      street: '',
      zipCity: '',
      country: 'Germany',
      phone: '',
    };
  }

  function fromUnknown(raw) {
    var src = raw && typeof raw === 'object' ? raw : {};
    var next = emptyFields();
    var keys = Object.keys(next);
    var i;
    for (i = 0; i < keys.length; i++) {
      if (typeof src[keys[i]] === 'string') next[keys[i]] = src[keys[i]].trim();
    }
    return next;
  }

  function parseJson(raw) {
    try {
      return fromUnknown(JSON.parse(String(raw || '{}')));
    } catch (err) {
      return emptyFields();
    }
  }

  function toJson(fields) {
    return JSON.stringify(fromUnknown(fields), null, 2) + '\n';
  }

  function fieldsFromForm() {
    return {
      email: ($('cms-mail-email') || {}).value || '',
      legalName: ($('cms-mail-legal') || {}).value || '',
      responsible: ($('cms-mail-name') || {}).value || '',
      street: ($('cms-mail-street') || {}).value || '',
      zipCity: ($('cms-mail-city') || {}).value || '',
      country: ($('cms-mail-country') || {}).value || '',
      phone: ($('cms-mail-phone') || {}).value || '',
    };
  }

  function fillForm(fields) {
    var map = {
      'cms-mail-email': fields.email,
      'cms-mail-legal': fields.legalName,
      'cms-mail-name': fields.responsible,
      'cms-mail-street': fields.street,
      'cms-mail-city': fields.zipCity,
      'cms-mail-country': fields.country,
      'cms-mail-phone': fields.phone,
    };
    Object.keys(map).forEach(function (id) {
      var el = $(id);
      if (el) el.value = map[id];
    });
  }

  function setStatus(message, ok) {
    var el = $('cms-mail-status');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('ok', !!ok);
    el.classList.toggle('bad', !ok && !!message);
  }

  function panel() {
    return $('cms-mail-panel');
  }

  function openPanel() {
    var el = panel();
    if (!el) return;
    el.hidden = false;
    el.setAttribute('data-open', '1');
    try {
      window.sessionStorage.setItem(OPEN, '1');
    } catch (err) {
      // sessionStorage can be blocked; the form still opens.
    }
    var first = $('cms-mail-email');
    if (first) {
      window.setTimeout(function () {
        first.focus();
      }, 50);
    }
    loadCurrent();
  }

  function closePanel() {
    var el = panel();
    if (!el) return;
    el.hidden = true;
    el.removeAttribute('data-open');
    try {
      window.sessionStorage.removeItem(OPEN);
    } catch (err) {
      // Same as above.
    }
  }

  function github(path, options) {
    var opts = options || {};
    var headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    var token = cmsToken();
    if (token) headers.Authorization = 'Bearer ' + token;
    return fetch('https://api.github.com/repos/' + REPO + '/' + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (res) {
      return res
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          if (res.status === 404) return null;
          if (!res.ok) throw new Error(readError(data, res.statusText));
          return data;
        });
    });
  }

  function proxy(action, params) {
    return fetch('http://localhost:8081/api/v1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: action,
        params: Object.assign({ branch: BRANCH }, params || {}),
      }),
    }).then(function (res) {
      return res
        .json()
        .catch(function () {
          return {};
        })
        .then(function (data) {
          if (!res.ok) throw new Error(readError(data, res.statusText));
          return data;
        });
    });
  }

  function fieldsFromEntry(entry) {
    if (!entry) return emptyFields();
    if (typeof entry.data === 'string') return parseJson(entry.data);
    if (entry.data && typeof entry.data === 'object') return fromUnknown(entry.data);
    if (typeof entry.raw === 'string') return parseJson(entry.raw);
    return emptyFields();
  }

  function loadCurrent() {
    setStatus('Loading the current mail and imprint…', true);
    var loaded;
    if (isLocalHost()) {
      loaded = proxy('getEntry', { path: PATH }).then(fieldsFromEntry);
    } else {
      loaded = github('contents/' + PATH + '?ref=' + BRANCH).then(function (file) {
        return parseJson(decodeFile(file));
      });
    }
    loaded
      .then(function (fields) {
        fillForm(fields);
        setStatus('Type in the boxes, then Save mail and imprint.', true);
      })
      .catch(function () {
        fillForm(emptyFields());
        setStatus('Type in the boxes, then Save mail and imprint.', true);
      });
  }

  function persistLocal(raw) {
    return proxy('persistEntry', {
      entry: { slug: 'imprint', path: PATH, raw: raw, data: fromUnknown(JSON.parse(raw)) },
      assets: [],
      options: {
        collectionName: 'settings',
        commitMessage: 'Update mail and imprint',
        useWorkflow: false,
        status: 'published',
      },
    });
  }

  function persistGithub(raw) {
    return github('contents/' + PATH + '?ref=' + BRANCH).then(function (file) {
      var body = {
        message: 'Update mail and imprint',
        content: utf8ToBase64(raw),
        branch: BRANCH,
      };
      if (file && file.sha) body.sha = file.sha;
      return github('contents/' + PATH, { method: 'PUT', body: body });
    });
  }

  function saveMail() {
    if (saving) return;
    if (!isLocalHost() && !cmsToken()) {
      setStatus('Login with GitHub first. The popup should open now.', false);
      try {
        window.sessionStorage.setItem(AFTER, 'mail');
        window.sessionStorage.setItem(OPEN, '1');
      } catch (err) {
        // Login still works without this.
      }
      startLogin();
      return;
    }
    saving = true;
    var save = $('cms-mail-save');
    if (save) save.disabled = true;
    setStatus('Saving…', true);
    var raw = toJson(fieldsFromForm());
    var started = isLocalHost() ? persistLocal(raw) : persistGithub(raw);
    started
      .then(function () {
        setStatus('Saved. Open Contact and Imprint, then hard-refresh.', true);
      })
      .catch(function (err) {
        var message = err && err.message ? err.message : 'Could not save.';
        setStatus(message, false);
      })
      .then(function () {
        saving = false;
        if (save) save.disabled = false;
      });
  }

  function onMailClick(event) {
    event.preventDefault();
    event.stopPropagation();
    openPanel();
    if (!loggedIn()) {
      try {
        window.sessionStorage.setItem(AFTER, 'mail');
      } catch (err) {
        // Same as above.
      }
      startLogin();
    }
  }

  var mail = $('cms-mail');
  if (mail) {
    mail.setAttribute('href', '#mail');
    mail.addEventListener('click', onMailClick);
  }

  var close = $('cms-mail-close');
  if (close) close.addEventListener('click', closePanel);

  var saveBtn = $('cms-mail-save');
  if (saveBtn) saveBtn.addEventListener('click', saveMail);

  var overlay = panel();
  if (overlay) {
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closePanel();
    });
  }

  window.addEventListener('ss-open-mail', openPanel);

  try {
    if (window.sessionStorage.getItem(OPEN) === '1') openPanel();
  } catch (err) {
    // Form still opens from the Mail chip.
  }
})();

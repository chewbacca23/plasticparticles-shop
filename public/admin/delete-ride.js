/**
 * Puts a "- Ride" button next to Decap's "New Ride" so a ride can be
 * deleted from the list without opening it first.
 */
(function () {
  'use strict';

  var REPO = 'chewbacca23/thenewsoulsearchersblog';
  var BRANCH = 'main';
  var FOLDER = 'src/content/stories';
  var MARK = 'data-ss-delete-ride';

  function log(message) {
    if (window.console && console.info) console.info('[ride] ' + message);
  }

  function isRidePath(path) {
    return /^src\/content\/stories\/[^./][^/]*\.md$/.test(path);
  }

  function slugFromPath(path) {
    return path.replace(/^src\/content\/stories\//, '').replace(/\.md$/, '');
  }

  function labelFromMarkdown(raw, fallback) {
    var match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return fallback;
    var headline = match[1].match(/^headline:\s*(.*)$/m);
    var title = match[1].match(/^title:\s*(.*)$/m);
    var value = ((headline && headline[1]) || (title && title[1]) || '')
      .trim()
      .replace(/^["']|["']$/g, '');
    return value || fallback;
  }

  function onRidesList() {
    var hash = window.location.hash || '';
    if (hash.indexOf('/collections/stories') === -1) return false;
    if (hash.indexOf('/new') !== -1) return false;
    if (hash.indexOf('/entries/') !== -1) return false;
    return true;
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

  function github(path, options) {
    var opts = options || {};
    return fetch('https://api.github.com/repos/' + REPO + '/' + path, {
      method: opts.method || 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + cmsToken(),
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (res) {
      return res.json().catch(function () {
        return {};
      }).then(function (data) {
        if (!res.ok) {
          var message = (data && data.message) || res.statusText || 'GitHub error';
          throw new Error(message);
        }
        return data;
      });
    });
  }

  function decodeFile(entry) {
    if (!entry || !entry.content || entry.encoding !== 'base64') return '';
    try {
      return decodeURIComponent(escape(window.atob(entry.content.replace(/\n/g, ''))));
    } catch (err) {
      return '';
    }
  }

  function findNewRideControl() {
    var nodes = document.querySelectorAll('a, button');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.getAttribute(MARK) !== null) continue;
      var href = el.getAttribute('href') || '';
      if (href.indexOf('/collections/stories/new') !== -1) return el;
      var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
      if (/^(new|[＋+])\s*ride$/i.test(text)) return el;
    }
    return null;
  }

  function ensureButton() {
    var existing = document.querySelector('[' + MARK + '="btn"]');
    if (!onRidesList()) {
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    if (existing) return;
    var create = findNewRideControl();
    if (!create || !create.parentNode) return;

    var button = document.createElement('button');
    button.type = 'button';
    button.setAttribute(MARK, 'btn');
    button.textContent = '− Ride';
    button.setAttribute('aria-label', 'Delete a ride');
    button.style.cssText = [
      'margin-left: 0.55rem',
      'padding: 0.45rem 0.9rem',
      'border: 1px solid rgba(240, 194, 122, 0.55)',
      'border-radius: 999px',
      'background: transparent',
      'color: #f0c27a',
      'font: inherit',
      'font-weight: 600',
      'cursor: pointer',
    ].join(';');
    button.addEventListener('click', openPicker);
    create.parentNode.insertBefore(button, create.nextSibling);
  }

  function closePicker() {
    var overlay = document.querySelector('[' + MARK + '="overlay"]');
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  function openPicker() {
    if (!cmsToken()) {
      window.alert('Log in with GitHub first, then try − Ride again.');
      return;
    }
    closePicker();

    var overlay = document.createElement('div');
    overlay.setAttribute(MARK, 'overlay');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(6,10,14,0.72);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';

    var panel = document.createElement('div');
    panel.style.cssText =
      'width:min(28rem,100%);max-height:80vh;overflow:auto;background:#121820;color:#eef3f7;border:1px solid rgba(215,224,232,0.12);border-radius:1rem;padding:1.15rem 1.2rem 1.25rem;';
    panel.innerHTML =
      '<p style="margin:0 0 0.35rem;color:#d4a35a;font-size:0.78rem;font-weight:700;letter-spacing:0.16em;text-transform:uppercase">Delete a ride</p>' +
      '<h2 style="margin:0 0 0.75rem;font-size:1.35rem">Pick one to erase</h2>' +
      '<p data-ss-status style="margin:0 0 0.85rem;color:rgba(215,224,232,0.72)">Loading rides…</p>' +
      '<div data-ss-list></div>' +
      '<p style="margin:1rem 0 0"><button type="button" data-ss-cancel style="padding:0.45rem 0.9rem;border:1px solid rgba(215,224,232,0.28);border-radius:999px;background:transparent;color:#eef3f7;cursor:pointer">Cancel</button></p>';

    overlay.appendChild(panel);
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) closePicker();
    });
    panel.querySelector('[data-ss-cancel]').addEventListener('click', closePicker);
    document.body.appendChild(overlay);

    var status = panel.querySelector('[data-ss-status]');
    var list = panel.querySelector('[data-ss-list]');

    github('contents/' + FOLDER + '?ref=' + BRANCH)
      .then(function (entries) {
        if (!Array.isArray(entries)) {
          status.textContent = 'No rides to delete.';
          return;
        }
        var files = entries.filter(function (entry) {
          return entry && entry.type === 'file' && isRidePath(entry.path);
        });
        if (!files.length) {
          status.textContent = 'No rides to delete.';
          return;
        }
        status.textContent = 'This removes the ride from the site after Cloudflare rebuilds.';
        return Promise.all(
          files.map(function (entry) {
            return github('contents/' + entry.path + '?ref=' + BRANCH).then(function (file) {
              var slug = slugFromPath(entry.path);
              return {
                path: entry.path,
                sha: file.sha,
                label: labelFromMarkdown(decodeFile(file), slug),
              };
            });
          }),
        ).then(function (rides) {
          rides.forEach(function (ride) {
            var row = document.createElement('button');
            row.type = 'button';
            row.textContent = ride.label;
            row.style.cssText =
              'display:block;width:100%;text-align:left;margin:0 0 0.45rem;padding:0.7rem 0.85rem;border:1px solid rgba(215,224,232,0.14);border-radius:0.7rem;background:rgba(18,26,34,0.9);color:#eef3f7;cursor:pointer;';
            row.addEventListener('click', function () {
              deleteRide(ride, status, row);
            });
            list.appendChild(row);
          });
        });
      })
      .catch(function (err) {
        var message = err && err.message ? err.message : '';
        if (/not found/i.test(message)) {
          status.textContent = 'No rides to delete.';
          return;
        }
        status.textContent = 'Could not load rides. ' + message;
      });
  }

  function deleteRide(ride, status, row) {
    if (!isRidePath(ride.path)) return;
    var ok = window.confirm('Delete the ride “' + ride.label + '”? This cannot be undone from here.');
    if (!ok) return;
    status.textContent = 'Deleting “' + ride.label + '”…';
    row.disabled = true;
    github('contents/' + ride.path, {
      method: 'DELETE',
      body: {
        message: 'Delete Ride “' + slugFromPath(ride.path) + '”',
        sha: ride.sha,
        branch: BRANCH,
      },
    })
      .then(function () {
        log('deleted ' + ride.path);
        closePicker();
        window.alert('Ride deleted. Wait about a minute, then hard-refresh the public site.');
        window.location.hash = '#/collections/stories';
        window.location.reload();
      })
      .catch(function (err) {
        row.disabled = false;
        status.textContent = 'Could not delete that ride. ' + (err && err.message ? err.message : '');
      });
  }

  function tick() {
    ensureButton();
  }

  window.addEventListener('hashchange', tick);
  setInterval(tick, 700);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick);
  } else {
    tick();
  }
})();

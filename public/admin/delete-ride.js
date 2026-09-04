/**
 * + Ride asks for a name, then opens the new file for photos and text.
 * Click a ride in the list so it turns green, then − Ride erases it.
 */
(function () {
  'use strict';

  var REPO = 'chewbacca23/thenewsoulsearchersblog';
  var BRANCH = 'main';
  var MARK = 'data-ss-delete-ride';
  var SELECTED = 'data-ss-ride-selected';
  var GREEN = '#2fbf62';
  var GREEN_TEXT = '#06240f';
  var GREEN_LINE = '#147a3a';
  var selected = {};
  var deleting = false;
  var creating = false;

  function log(message) {
    if (window.console && console.info) console.info('[ride] ' + message);
  }

  function isRidePath(path) {
    return /^src\/content\/stories\/[^./][^/]*\.md$/.test(path);
  }

  function isMediaPath(path) {
    return /^public\/stories\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(path);
  }

  function slugFromPath(path) {
    return path.replace(/^src\/content\/stories\//, '').replace(/\.md$/, '');
  }

  function pathFromSlug(slug) {
    if (!slug || /[./]/.test(slug) || slug.indexOf('/') !== -1) return '';
    return 'src/content/stories/' + slug + '.md';
  }

  function slugFromName(name) {
    var folded = String(name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ß/g, 'ss')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/g, '');
    if (!folded || /[./]/.test(folded)) return '';
    return folded;
  }

  function uniqueSlug(base, paths) {
    var safe = slugFromName(base);
    if (!safe) return '';
    var taken = {};
    (paths || []).forEach(function (path) {
      taken[slugFromPath(path)] = true;
    });
    if (!taken[safe]) return safe;
    for (var n = 2; n < 100; n++) {
      var candidate = safe + '-' + n;
      if (!taken[candidate]) return candidate;
    }
    return '';
  }

  function todayStamp() {
    var now = new Date();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    return now.getFullYear() + '-' + month + '-' + day;
  }

  function newRideMarkdown(title) {
    var name = JSON.stringify(String(title || '').trim() || 'New ride');
    return (
      '---\n' +
      'title: ' +
      name +
      '\nheadline: ' +
      name +
      '\ndescription: "Write a few lines about this ride."\n' +
      'pubDate: ' +
      todayStamp() +
      '\norder: 0\ndraft: false\ngallery: []\n---\n\n'
    );
  }

  function utf8ToBase64(text) {
    return window.btoa(unescape(encodeURIComponent(text)));
  }

  function slugFromHref(href) {
    if (!href) return '';
    var match = href.match(/\/collections\/stories\/entries\/([^/?#]+)/);
    if (!match) return '';
    try {
      return decodeURIComponent(match[1]);
    } catch (err) {
      return match[1];
    }
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

  function mediaFromText(raw) {
    var paths = [];
    var seen = {};
    var re = /\/stories\/[A-Za-z0-9][A-Za-z0-9._-]*/g;
    var match;
    while ((match = re.exec(raw || ''))) {
      var name = match[0].replace('/stories/', '');
      var repo = 'public/stories/' + name;
      if (!isMediaPath(repo) || seen[repo]) continue;
      seen[repo] = true;
      paths.push(repo);
    }
    return paths;
  }

  function onRidesList() {
    var hash = window.location.hash || '';
    if (hash.indexOf('/collections/stories') === -1) return false;
    if (hash.indexOf('/new') !== -1) return false;
    if (hash.indexOf('/entries/') !== -1) return false;
    return true;
  }

  function isLocalHost() {
    var host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }

  function selectedSlugs() {
    return Object.keys(selected).filter(function (slug) {
      return selected[slug];
    });
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

  function readError(data, fallback) {
    return (data && (data.error || data.message)) || fallback || 'Request failed';
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

  function decodeFile(entry) {
    if (!entry || !entry.content || entry.encoding !== 'base64') return '';
    try {
      return decodeURIComponent(escape(window.atob(entry.content.replace(/\n/g, ''))));
    } catch (err) {
      return '';
    }
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

  function listMarkdown(folder) {
    if (isLocalHost()) {
      return proxy('entriesByFolder', {
        folder: folder,
        extension: 'md',
        depth: 1,
      }).then(function (entries) {
        return (entries || [])
          .filter(function (entry) {
            return entry && entry.data && entry.file && entry.file.path;
          })
          .map(function (entry) {
            return { path: entry.file.path.replace(/\\/g, '/'), raw: entry.data, sha: entry.file.id };
          });
      });
    }
    return github('contents/' + folder + '?ref=' + BRANCH).then(function (entries) {
      if (!Array.isArray(entries)) return [];
      var files = entries.filter(function (entry) {
        return entry && entry.type === 'file' && /\.md$/.test(entry.name || '');
      });
      return Promise.all(
        files.map(function (entry) {
          return github('contents/' + entry.path + '?ref=' + BRANCH).then(function (file) {
            return {
              path: entry.path,
              raw: decodeFile(file),
              sha: file && file.sha,
            };
          });
        }),
      );
    });
  }

  function readRide(path) {
    if (!isRidePath(path)) return Promise.reject(new Error('Not a ride file'));
    if (isLocalHost()) {
      return proxy('getEntry', { path: path }).then(function (entry) {
        if (!entry || !entry.data) throw new Error('That ride is not on disk.');
        return { path: path, raw: entry.data, sha: entry.file && entry.file.id };
      });
    }
    return github('contents/' + path + '?ref=' + BRANCH).then(function (file) {
      if (!file) throw new Error('That ride is not on GitHub.');
      return { path: path, raw: decodeFile(file), sha: file.sha };
    });
  }

  function deletePaths(paths, message) {
    var unique = [];
    var seen = {};
    paths.forEach(function (path) {
      if (!path || seen[path]) return;
      if (!isRidePath(path) && !isMediaPath(path)) return;
      seen[path] = true;
      unique.push(path);
    });
    if (!unique.length) return Promise.resolve();
    if (isLocalHost()) {
      return proxy('deleteFiles', {
        paths: unique,
        options: { commitMessage: message },
      });
    }
    return unique.reduce(function (chain, path) {
      return chain.then(function () {
        return github('contents/' + path + '?ref=' + BRANCH).then(function (file) {
          if (!file || !file.sha) return;
          return github('contents/' + path, {
            method: 'DELETE',
            body: { message: message, sha: file.sha, branch: BRANCH },
          });
        });
      });
    }, Promise.resolve());
  }

  function closeCreate() {
    var overlay = document.querySelector('[' + MARK + '="create"]');
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }

  function openCreate() {
    if (creating) return;
    if (!isLocalHost() && !cmsToken()) {
      window.alert('Log in with GitHub first, then try ＋ Ride again.');
      return;
    }
    closeCreate();
    var overlay = document.createElement('div');
    overlay.setAttribute(MARK, 'create');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(6,10,14,0.72);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';
    var panel = document.createElement('div');
    panel.style.cssText =
      'width:min(28rem,100%);background:#121820;color:#eef3f7;border:1px solid rgba(215,224,232,0.12);border-radius:1rem;padding:1.15rem 1.2rem 1.25rem;';
    panel.innerHTML =
      '<p style="margin:0 0 0.35rem;color:#d4a35a;font-size:0.78rem;font-weight:700;letter-spacing:0.16em;text-transform:uppercase">New ride</p>' +
      '<h2 style="margin:0 0 0.75rem;font-size:1.35rem">Name of this ride</h2>' +
      '<p style="margin:0 0 0.85rem;color:rgba(215,224,232,0.72)">Then the file opens so you can add photos and your text.</p>' +
      '<input data-ss-name type="text" maxlength="80" placeholder="Dawn on the ridge" style="display:block;width:100%;box-sizing:border-box;margin:0 0 0.85rem;padding:0.7rem 0.85rem;border:1px solid rgba(215,224,232,0.22);border-radius:0.7rem;background:#0c1218;color:#eef3f7;font:inherit">' +
      '<p data-ss-status style="margin:0 0 0.85rem;min-height:1.2em;color:#f0c27a"></p>' +
      '<p style="margin:0;display:flex;gap:0.55rem;flex-wrap:wrap">' +
      '<button type="button" data-ss-go style="padding:0.45rem 0.9rem;border:0;border-radius:999px;background:#f0c27a;color:#0c1218;font-weight:700;cursor:pointer">Create ride</button>' +
      '<button type="button" data-ss-cancel style="padding:0.45rem 0.9rem;border:1px solid rgba(215,224,232,0.28);border-radius:999px;background:transparent;color:#eef3f7;cursor:pointer">Cancel</button>' +
      '</p>';
    overlay.appendChild(panel);
    overlay.addEventListener('click', function (event) {
      if (event.target === overlay && !creating) closeCreate();
    });
    panel.querySelector('[data-ss-cancel]').addEventListener('click', function () {
      if (!creating) closeCreate();
    });
    var input = panel.querySelector('[data-ss-name]');
    var status = panel.querySelector('[data-ss-status]');
    var go = panel.querySelector('[data-ss-go]');
    function submit() {
      createRide((input.value || '').trim(), status, go);
    }
    go.addEventListener('click', submit);
    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      }
    });
    document.body.appendChild(overlay);
    setTimeout(function () {
      input.focus();
    }, 50);
  }

  function createRide(title, status, go) {
    if (creating) return;
    if (!title) {
      status.textContent = 'Give the ride a name first.';
      return;
    }
    var base = slugFromName(title);
    if (!base) {
      status.textContent = 'Use letters or numbers in the name.';
      return;
    }
    creating = true;
    go.disabled = true;
    status.textContent = 'Making the ride file…';
    listMarkdown('src/content/stories')
      .then(function (entries) {
        var slug = uniqueSlug(
          title,
          (entries || []).map(function (entry) {
            return entry.path;
          }),
        );
        var path = pathFromSlug(slug);
        if (!slug || !isRidePath(path)) throw new Error('Could not make a filename from that name.');
        var raw = newRideMarkdown(title);
        if (isLocalHost()) {
          return proxy('persistEntry', {
            entry: { slug: slug, path: path, raw: raw },
            assets: [],
            options: {
              collectionName: 'stories',
              commitMessage: 'Create Ride “' + slug + '”',
              useWorkflow: false,
              status: 'published',
            },
          }).then(function () {
            return slug;
          });
        }
        return github('contents/' + path, {
          method: 'PUT',
          body: {
            message: 'Create Ride “' + slug + '”',
            content: utf8ToBase64(raw),
            branch: BRANCH,
          },
        }).then(function () {
          return slug;
        });
      })
      .then(function (slug) {
        log('created src/content/stories/' + slug + '.md');
        closeCreate();
        window.location.hash = '#/collections/stories/entries/' + encodeURIComponent(slug);
        window.location.reload();
      })
      .catch(function (err) {
        creating = false;
        go.disabled = false;
        status.textContent = 'Could not create that ride. ' + (err && err.message ? err.message : '');
      });
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

  function entryLinkFromNode(node) {
    var el = node;
    while (el && el !== document.body) {
      if (el.tagName === 'A') {
        var slug = slugFromHref(el.getAttribute('href') || el.getAttribute('to') || '');
        if (slug) return el;
      }
      el = el.parentElement;
    }
    el = node;
    while (el && el !== document.body) {
      var found = el.querySelector && el.querySelector('a[href*="/collections/stories/entries/"]');
      if (found) return found;
      el = el.parentElement;
    }
    return null;
  }

  function paintSelection() {
    var links = document.querySelectorAll('a[href*="/collections/stories/entries/"]');
    for (var i = 0; i < links.length; i++) {
      var link = links[i];
      var slug = slugFromHref(link.getAttribute('href') || '');
      var on = !!(slug && selected[slug]);
      var nodes = [link];
      var li = link.closest && link.closest('li');
      if (li) nodes.push(li);
      var title = link.querySelector('h2, h3');
      if (title) nodes.push(title);
      nodes.forEach(function (el) {
        if (on) {
          el.style.setProperty('background', GREEN, 'important');
          el.style.setProperty('color', GREEN_TEXT, 'important');
          el.style.setProperty('box-shadow', 'inset 0 0 0 3px ' + GREEN_LINE, 'important');
          el.setAttribute(SELECTED, slug);
        } else if (el.getAttribute(SELECTED)) {
          el.style.removeProperty('background');
          el.style.removeProperty('color');
          el.style.removeProperty('box-shadow');
          el.removeAttribute(SELECTED);
        }
      });
    }
  }

  function updateButton() {
    var button = document.querySelector('[' + MARK + '="btn"]');
    if (!button) return;
    var count = selectedSlugs().length;
    button.textContent = count ? '− Ride (' + count + ')' : '− Ride';
    button.style.opacity = deleting ? '0.55' : '1';
  }

  function ensureButton() {
    var existing = document.querySelector('[' + MARK + '="btn"]');
    if (!onRidesList()) {
      selected = {};
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    if (!existing) {
      var create = findNewRideControl();
      if (!create || !create.parentNode) return;
      var button = document.createElement('button');
      button.type = 'button';
      button.setAttribute(MARK, 'btn');
      button.setAttribute('aria-label', 'Delete the green ride');
      button.title = 'Click a ride so it turns green, then − Ride.';
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
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        deleteSelected();
      });
      create.parentNode.insertBefore(button, create.nextSibling);
    }
    paintSelection();
    updateButton();
  }

  function isNewRideControl(el) {
    if (!el || el.getAttribute(MARK) === 'btn') return false;
    var href = el.getAttribute('href') || '';
    if (href.indexOf('/collections/stories/new') !== -1) return true;
    var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return /^(new|[＋+])\s*ride$/i.test(text);
  }

  function onCaptureClick(event) {
    if (!onRidesList()) return;
    if (event.target.closest && event.target.closest('[' + MARK + '="btn"]')) return;
    if (event.target.closest && event.target.closest('[' + MARK + '="create"]')) return;

    var maybe = event.target.closest && event.target.closest('a, button');
    if (maybe && isNewRideControl(maybe)) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
      openCreate();
      return;
    }

    var link = entryLinkFromNode(event.target);
    if (!link) return;
    var slug = slugFromHref(link.getAttribute('href') || '');
    if (!slug || !pathFromSlug(slug)) return;
    if (event.detail > 1) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    if (selected[slug]) delete selected[slug];
    else selected[slug] = true;
    paintSelection();
    updateButton();
  }

  function unusedFromRest(fromDeleted, files, skip) {
    var used = [];
    files.forEach(function (file) {
      if (!file || skip[file.path]) return;
      mediaFromText(file.raw).forEach(function (path) {
        used.push(path);
      });
    });
    var unused = [];
    var seen = {};
    fromDeleted.forEach(function (path) {
      if (!isMediaPath(path) || seen[path]) return;
      seen[path] = true;
      if (used.indexOf(path) === -1) unused.push(path);
    });
    return unused;
  }

  function deleteSelected() {
    if (deleting) return;
    var slugs = selectedSlugs();
    if (!slugs.length) {
      window.alert('Click a ride first so it turns green, then − Ride.');
      return;
    }
    if (!isLocalHost() && !cmsToken()) {
      window.alert('Log in with GitHub first, then try − Ride again.');
      return;
    }

    var rides = slugs
      .map(function (slug) {
        return { slug: slug, path: pathFromSlug(slug) };
      })
      .filter(function (ride) {
        return isRidePath(ride.path);
      });
    if (!rides.length) return;

    var names = rides
      .map(function (ride) {
        var card = document.querySelector('[' + SELECTED + '="' + ride.slug + '"]');
        var text = card ? (card.textContent || '').replace(/\s+/g, ' ').trim() : ride.slug;
        return text || ride.slug;
      })
      .join(', ');
    var ok = window.confirm(
      'Delete ' +
        names +
        '? This erases the ride page and any photos that nothing else on the site still uses.',
    );
    if (!ok) return;

    deleting = true;
    updateButton();

    var skip = {};
    rides.forEach(function (ride) {
      skip[ride.path] = true;
    });

    Promise.all(rides.map(function (ride) {
      return readRide(ride.path).then(function (file) {
        ride.raw = file.raw;
        ride.sha = file.sha;
        ride.label = labelFromMarkdown(file.raw, ride.slug);
        ride.media = mediaFromText(file.raw);
        return ride;
      });
    }))
      .then(function (loaded) {
        return Promise.all([
          listMarkdown('src/content/stories'),
          listMarkdown('src/content/shots'),
          listMarkdown('src/content/journal'),
        ]).then(function (groups) {
          var rest = groups[0].concat(groups[1], groups[2]);
          var fromDeleted = [];
          loaded.forEach(function (ride) {
            fromDeleted = fromDeleted.concat(ride.media);
          });
          var unused = unusedFromRest(fromDeleted, rest, skip);
          var paths = loaded
            .map(function (ride) {
              return ride.path;
            })
            .concat(unused);
          var message =
            loaded.length === 1
              ? 'Delete Ride “' + loaded[0].slug + '”'
              : 'Delete ' + loaded.length + ' rides';
          return deletePaths(paths, message).then(function () {
            return { loaded: loaded, unused: unused };
          });
        });
      })
      .then(function (result) {
        log(
          'deleted ' +
            result.loaded
              .map(function (ride) {
                return ride.path;
              })
              .concat(result.unused)
              .join(', '),
        );
        selected = {};
        deleting = false;
        window.alert(
          'Gone. The ride page is erased' +
            (result.unused.length ? ', plus photos nothing else used' : '') +
            '. Wait about a minute, then hard-refresh the public site.',
        );
        window.location.hash = '#/collections/stories';
        window.location.reload();
      })
      .catch(function (err) {
        deleting = false;
        updateButton();
        window.alert('Could not delete that ride. ' + (err && err.message ? err.message : ''));
      });
  }

  function tick() {
    ensureButton();
  }

  document.addEventListener('click', onCaptureClick, true);
  window.addEventListener('hashchange', tick);
  setInterval(tick, 700);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tick);
  } else {
    tick();
  }
})();

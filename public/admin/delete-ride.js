/**
 * Click a ride in the CMS list so it turns green, then − Ride erases it.
 * That removes the markdown page and any public/stories photos nothing
 * else (other rides, shots, ride notes) still uses.
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

  function onCaptureClick(event) {
    if (!onRidesList()) return;
    if (event.target.closest && event.target.closest('[' + MARK + '="btn"]')) return;
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

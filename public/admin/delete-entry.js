/**
 * Decap’s own Delete sits in a toolbar under our brand bar.
 * This puts a Delete this pill next to Save on every post.
 */
(function () {
  'use strict';

  var REPO = 'chewbacca23/thenewsoulsearchersblog';
  var BRANCH = 'main';
  var MARK = 'data-ss-delete-entry';
  var FOLDERS = {
    stories: 'src/content/stories',
    shots: 'src/content/shots',
    journal: 'src/content/journal',
    friends: 'src/content/friends',
    shop: 'src/content/shop',
    stores: 'src/content/stores',
    week: 'src/content/week',
  };
  var deleting = false;

  function hash() {
    return window.location.hash || '';
  }

  function collectionName() {
    var text = hash();
    var match = text.match(/\/collections\/([^/?#]+)/) || text.match(/\/edit\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function slugName() {
    var text = hash();
    var match = text.match(/\/entries\/([^/?#]+)/) || text.match(/\/edit\/[^/]+\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function canDelete() {
    var name = collectionName();
    if (!FOLDERS[name]) return false;
    if (hash().indexOf('/new') !== -1) return false;
    return !!slugName();
  }

  function noun() {
    switch (collectionName()) {
      case 'week':
        return 'week note';
      case 'stores':
        return 'store';
      case 'journal':
        return 'ride note';
      case 'friends':
        return 'friend';
      case 'shop':
        return 'product';
      case 'shots':
        return 'shot';
      default:
        return 'ride';
    }
  }

  function filePath() {
    var folder = FOLDERS[collectionName()];
    var slug = slugName();
    if (!folder || !slug || /[./]/.test(slug) || slug.indexOf('\\') !== -1) return '';
    return folder + '/' + slug + '.md';
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

  function readError(data, fallback) {
    return (data && (data.error || data.message)) || fallback || 'Request failed';
  }

  function toast(message, ok) {
    var el = document.getElementById('ss-save-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ss-save-toast';
      el.setAttribute(
        'style',
        'position:fixed;left:50%;bottom:5.2rem;transform:translateX(-50%);z-index:100001;max-width:28rem;padding:0.7rem 1rem;border-radius:8px;font:15px/1.35 Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);',
      );
      document.body.appendChild(el);
    }
    el.style.background = ok ? '#1e3a2a' : '#3a1e1e';
    el.style.color = ok ? '#b6e0c4' : '#f0c2c2';
    el.style.border = ok ? '1px solid rgba(47,191,98,.45)' : '1px solid rgba(240,122,122,.45)';
    el.textContent = message;
    el.style.display = 'block';
    window.setTimeout(function () {
      el.style.display = 'none';
    }, 5000);
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

  function deleteFile() {
    var path = filePath();
    var message = 'Delete ' + noun() + ' “' + slugName() + '”';
    if (!path) return Promise.reject(new Error('Could not find that file.'));
    if (isLocalHost()) {
      return proxy('deleteFiles', {
        paths: [path],
        options: { commitMessage: message },
      });
    }
    if (!cmsToken()) {
      return Promise.reject(new Error('Login with GitHub first, then Delete this.'));
    }
    return github('contents/' + path + '?ref=' + BRANCH).then(function (file) {
      if (!file || !file.sha) throw new Error('That post is not on GitHub.');
      return github('contents/' + path, {
        method: 'DELETE',
        body: { message: message, sha: file.sha, branch: BRANCH },
      });
    });
  }

  function goBackToList() {
    var name = collectionName();
    window.location.hash = name ? '#/collections/' + name : '#/';
  }

  function deleteThis() {
    if (deleting || !canDelete()) return;
    var title = noun();
    if (
      !window.confirm(
        'Delete this ' + title + '? It leaves the site. This cannot be undone from here.',
      )
    ) {
      return;
    }
    deleting = true;
    updateButton();

    deleteFile()
      .then(function () {
        toast('Deleted. Wait a minute, then hard-refresh the public site.', true);
        window.setTimeout(goBackToList, 400);
      })
      .catch(function (err) {
        var message = err && err.message ? err.message : 'Could not delete.';
        if (/failed to fetch|unauthorized|bad credentials|requires authentication/i.test(message)) {
          message = 'Login with GitHub first, then Delete this.';
        }
        toast(message, false);
        window.alert(message);
      })
      .then(function () {
        deleting = false;
        updateButton();
      });
  }

  function updateButton() {
    var button = document.querySelector('[' + MARK + ']');
    if (!canDelete()) {
      document.body.removeAttribute('data-ss-has-delete');
      if (button && button.parentNode) button.parentNode.removeChild(button);
      return;
    }
    document.body.setAttribute('data-ss-has-delete', '1');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'cms-pill-delete';
      button.setAttribute(MARK, '1');
      button.setAttribute('aria-label', 'Delete this post');
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        deleteThis();
      });
      var stack = document.getElementById('cms-pill-stack');
      var save = stack && stack.querySelector('[data-ss-save-ride]');
      if (stack && save && save.nextSibling) stack.insertBefore(button, save.nextSibling);
      else if (stack) stack.insertBefore(button, stack.firstChild);
      else document.body.appendChild(button);
    }
    button.disabled = deleting;
    button.textContent = deleting ? 'Deleting…' : 'Delete this';
    button.style.opacity = deleting ? '0.7' : '1';
  }

  window.ssDelete = {
    can: canDelete,
    run: deleteThis,
    busy: function () {
      return deleting;
    },
  };

  window.addEventListener('hashchange', updateButton);
  window.setInterval(updateButton, 700);
  updateButton();
})();

/**
 * One pick for a pile of JPEGs on Stores and This week.
 * Files land in Media, then on the open note. Gold Save still writes the post.
 */
(function () {
  'use strict';

  var REPO = 'chewbacca23/thenewsoulsearchersblog';
  var BRANCH = 'main';
  var LIMITS = { stores: 24, week: 40 };
  var busy = false;
  var progress = '';

  function hash() {
    return window.location.hash || '';
  }

  function collectionName() {
    var text = hash();
    var match = text.match(/\/collections\/([^/?#]+)/) || text.match(/\/edit\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function editorOpen() {
    if (window.ssEditor && typeof window.ssEditor.open === 'function') return window.ssEditor.open();
    var text = hash();
    return text.indexOf('/entries/') !== -1 || text.indexOf('/new') !== -1 || /\/edit\/[^/]+\/[^/?#]+/.test(text);
  }

  function can() {
    return !!LIMITS[collectionName()] && editorOpen();
  }

  function isLocalHost() {
    var host = window.location.hostname;
    return host === 'localhost' || host === '127.0.0.1';
  }

  function cmsToken() {
    var keys = ['decap-cms-user', 'netlify-cms-user'];
    var i;
    for (i = 0; i < keys.length; i++) {
      try {
        var raw = window.localStorage.getItem(keys[i]);
        if (!raw) continue;
        var parsed = JSON.parse(raw);
        if (parsed && parsed.token) return parsed.token;
      } catch (err) {
        // Try the next CMS session key.
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
    }, 6000);
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

  function fiberOf(dom) {
    var key;
    if (!dom) return null;
    for (key in dom) {
      if (key.indexOf('__reactContainer') === 0 || key.indexOf('__reactFiber') === 0) return dom[key];
    }
    return null;
  }

  function photosControl() {
    var root = document.getElementById('nc-root');
    var start = fiberOf(root);
    if (!start) return null;
    var stack = [start];
    var seen = 0;
    while (stack.length && seen < 8000) {
      var fiber = stack.pop();
      seen += 1;
      if (!fiber) continue;
      var inst = fiber.stateNode;
      if (inst && typeof inst.handleAdd === 'function' && inst.props && typeof inst.props.onChange === 'function') {
        var field = inst.props.field;
        var name = field && typeof field.get === 'function' ? field.get('name') : '';
        var widget = field && typeof field.get === 'function' ? field.get('widget') : '';
        if (name === 'photos' && widget === 'list') return inst;
      }
      if (fiber.child) stack.push(fiber.child);
      if (fiber.sibling) stack.push(fiber.sibling);
    }
    return null;
  }

  function isJpeg(file) {
    var name = String((file && file.name) || '');
    var type = String((file && file.type) || '').toLowerCase();
    if (type.indexOf('heic') !== -1 || type.indexOf('heif') !== -1 || /\.(heic|heif)$/i.test(name)) return false;
    return type === 'image/jpeg' || type === 'image/jpg' || /\.jpe?g$/i.test(name);
  }

  function isHeic(file) {
    var name = String((file && file.name) || '');
    var type = String((file && file.type) || '').toLowerCase();
    return type.indexOf('heic') !== -1 || type.indexOf('heif') !== -1 || /\.(heic|heif)$/i.test(name);
  }

  function fileName(file, index) {
    var raw = String((file && file.name) || 'photo');
    var base = raw.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!base) base = 'photo';
    if (base.length > 40) base = base.slice(0, 40);
    return base + '-' + Date.now().toString(36) + '-' + (index + 1) + '.jpg';
  }

  function readBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || '');
        var comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = function () {
        reject(reader.error || new Error('Could not read that photo.'));
      };
      reader.readAsDataURL(file);
    });
  }

  function uploadOne(file, index) {
    var name = fileName(file, index);
    var repoPath = 'public/stories/' + name;
    var message = 'Upload “' + name + '”';
    return readBase64(file).then(function (content) {
      if (isLocalHost()) {
        return proxy('persistMedia', {
          asset: { path: repoPath, content: content, encoding: 'base64' },
          options: { commitMessage: message },
        }).then(function () {
          return '/stories/' + name;
        });
      }
      return github('contents/' + repoPath, {
        method: 'PUT',
        body: { message: message, content: content, branch: BRANCH },
      }).then(function () {
        return '/stories/' + name;
      });
    });
  }

  function readPaths(value) {
    var paths = [];
    if (!value || typeof value.forEach !== 'function') return paths;
    value.forEach(function (item) {
      if (typeof item === 'string' && item) paths.push(item);
      else if (item && typeof item.get === 'function') {
        var image = item.get('image');
        if (typeof image === 'string' && image) paths.push(image);
      }
    });
    return paths;
  }

  function sameShape(sample, path) {
    if (
      sample &&
      typeof sample.get === 'function' &&
      typeof sample.set === 'function' &&
      typeof sample.push !== 'function'
    ) {
      return sample.set('image', path);
    }
    return path;
  }

  function isList(value) {
    return !!(
      value &&
      typeof value.push === 'function' &&
      typeof value.get === 'function' &&
      typeof value.size === 'number'
    );
  }

  function appendPaths(current, paths) {
    if (!isList(current)) return null;
    var sample = typeof current.size === 'number' && current.size > 0 ? current.get(0) : null;
    var list = current;
    paths.forEach(function (path) {
      list = list.push(sameShape(sample, path));
    });
    return list;
  }

  function blankList(control) {
    var value = control.props.value;
    if (value && typeof value.clear === 'function' && typeof value.push === 'function') return value.clear();
    var entry = control.props.entry;
    if (entry && typeof entry.get === 'function') {
      var data = entry.get('data');
      if (data && typeof data.toList === 'function') {
        var list = data.toList();
        if (list && typeof list.clear === 'function' && typeof list.push === 'function') return list.clear();
      }
    }
    return null;
  }

  function attach(paths) {
    var control = photosControl();
    if (!control) throw new Error('Open the store or week note, then Add photos again.');
    var current = control.props.value;
    var next = isList(current) ? appendPaths(current, paths) : null;
    if (!next) {
      var empty = blankList(control);
      next = empty ? appendPaths(empty, paths) : null;
    }
    if (!next) throw new Error('Could not attach those photos to this note.');

    var count = typeof next.size === 'number' ? next.size : paths.length;
    var keys = control.state && Array.isArray(control.state.keys) ? control.state.keys.slice() : [];
    var collapsed = control.state && Array.isArray(control.state.itemsCollapsed) ? control.state.itemsCollapsed.slice() : [];
    while (keys.length < count) {
      keys.push(crypto.randomUUID());
      collapsed.push(false);
    }
    if (typeof control.setState === 'function') {
      control.setState({ keys: keys, itemsCollapsed: collapsed, listCollapsed: false });
    }
    control.props.onChange(next);
  }

  function setProgress(text) {
    progress = text;
    var add = document.getElementById('cms-where-add');
    if (add && busy) add.textContent = text || 'Adding…';
  }

  function addFiles(fileList) {
    if (busy) return Promise.resolve();
    if (!can()) {
      toast('Open a store or a week note, then Add photos.', false);
      return Promise.resolve();
    }
    if (!isLocalHost() && !cmsToken()) {
      toast('Login with GitHub first, then Add photos.', false);
      return Promise.resolve();
    }

    var incoming = Array.prototype.slice.call(fileList || []);
    var heic = incoming.filter(isHeic).length;
    var files = incoming.filter(isJpeg);
    var skipped = incoming.length - files.length;
    if (!files.length) {
      toast(heic ? 'Those are Apple HEIC. Export JPEG from Photos, then Add photos.' : 'Pick JPEG photos from the Mac.', false);
      return Promise.resolve();
    }

    var control = photosControl();
    var already = readPaths(control && control.props && control.props.value);
    var room = LIMITS[collectionName()] - already.length;
    if (room <= 0) {
      toast('This one is full (' + LIMITS[collectionName()] + ' photos).', false);
      return Promise.resolve();
    }
    var batch = files.slice(0, room);
    var leftOut = files.length - batch.length;

    busy = true;
    setProgress('Adding 1/' + batch.length + '…');

    var added = [];
    var chain = Promise.resolve();
    batch.forEach(function (file, index) {
      chain = chain.then(function () {
        setProgress('Adding ' + (index + 1) + '/' + batch.length + '…');
        return uploadOne(file, index).then(function (path) {
          added.push(path);
        });
      });
    });

    return chain
      .then(function () {
        attach(added);
        var noun = collectionName() === 'week' ? 'week note' : 'store';
        var message = 'Added ' + added.length + ' photo' + (added.length === 1 ? '' : 's') + '. Gold Save puts them on this ' + noun + '.';
        if (leftOut) message += ' ' + leftOut + ' did not fit.';
        if (skipped) message += ' Skipped ' + skipped + ' that were not JPEG.';
        toast(message, true);
      })
      .catch(function (err) {
        if (added.length) {
          try {
            attach(added);
          } catch (attachErr) {
            // The files are in Media. Say so below.
          }
        }
        var message = err && err.message ? err.message : 'Could not add those photos.';
        if (/unauthorized|bad credentials|requires authentication/i.test(message)) {
          message = 'Login with GitHub first, then Add photos.';
        }
        if (/failed to fetch/i.test(message) && isLocalHost()) {
          message = 'Local photos need the CMS proxy. In a terminal: npm run cms:proxy';
        }
        if (added.length) message += ' ' + added.length + ' already landed. Gold Save keeps those.';
        toast(message, false);
        window.alert(message);
      })
      .then(function () {
        busy = false;
        progress = '';
        var add = document.getElementById('cms-where-add');
        if (add) {
          add.disabled = false;
          add.textContent = 'Add photos';
        }
      });
  }

  function openPicker() {
    if (!can() || busy) return;
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,.jpg,.jpeg';
    input.multiple = true;
    input.style.display = 'none';
    input.addEventListener('change', function () {
      var files = input.files;
      if (input.parentNode) input.parentNode.removeChild(input);
      if (files && files.length) addFiles(files);
    });
    document.body.appendChild(input);
    input.click();
  }

  window.ssAddPhotos = {
    can: can,
    busy: function () {
      return busy;
    },
    label: function () {
      return progress;
    },
    add: addFiles,
    pick: openPicker,
  };

  function bind() {
    var button = document.getElementById('cms-where-add');
    if (!button || button.getAttribute('data-ss-add-bound')) return;
    button.setAttribute('data-ss-add-bound', '1');
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      openPicker();
    });
  }

  bind();
  window.addEventListener('hashchange', bind);
  window.setInterval(bind, 700);
})();

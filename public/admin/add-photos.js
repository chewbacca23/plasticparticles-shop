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

  var MAX_EDGE = 1800;

  function clampByte(value) {
    if (value < 0) return 0;
    if (value > 255) return 255;
    return value;
  }

  function polishPixels(data, width, height) {
    var count = (data.length / 4) | 0;
    var histR = new Uint32Array(256);
    var histG = new Uint32Array(256);
    var histB = new Uint32Array(256);
    var i;
    for (i = 0; i < data.length; i += 4) {
      histR[data[i]] += 1;
      histG[data[i + 1]] += 1;
      histB[data[i + 2]] += 1;
    }
    var cutoff = Math.max(1, Math.floor(count * 0.01));

    function edge(hist, fromTop) {
      var seen = 0;
      var v;
      if (fromTop) {
        for (v = 255; v >= 0; v -= 1) {
          seen += hist[v];
          if (seen >= cutoff) return v;
        }
        return 255;
      }
      for (v = 0; v < 256; v += 1) {
        seen += hist[v];
        if (seen >= cutoff) return v;
      }
      return 0;
    }

    var loR = edge(histR, false);
    var hiR = edge(histR, true);
    var loG = edge(histG, false);
    var hiG = edge(histG, true);
    var loB = edge(histB, false);
    var hiB = edge(histB, true);
    if (hiR <= loR) {
      loR = 0;
      hiR = 255;
    }
    if (hiG <= loG) {
      loG = 0;
      hiG = 255;
    }
    if (hiB <= loB) {
      loB = 0;
      hiB = 255;
    }
    var spanR = hiR - loR;
    var spanG = hiG - loG;
    var spanB = hiB - loB;

    for (i = 0; i < data.length; i += 4) {
      var r = ((data[i] - loR) * 255) / spanR;
      var g = ((data[i + 1] - loG) * 255) / spanG;
      var b = ((data[i + 2] - loB) * 255) / spanB;
      var avg = (r + g + b) / 3;
      r = avg + (r - avg) * 1.08;
      g = avg + (g - avg) * 1.08;
      b = avg + (b - avg) * 1.08;
      r = (r - 128) * 1.06 + 128;
      g = (g - 128) * 1.06 + 128;
      b = (b - 128) * 1.06 + 128;
      data[i] = clampByte(r);
      data[i + 1] = clampByte(g);
      data[i + 2] = clampByte(b);
    }

    var src = new Uint8ClampedArray(data);
    var amount = 0.45;
    function at(x, y, channel) {
      if (x < 0) x = 0;
      if (y < 0) y = 0;
      if (x >= width) x = width - 1;
      if (y >= height) y = height - 1;
      return src[(y * width + x) * 4 + channel];
    }
    var y;
    var x;
    var c;
    for (y = 0; y < height; y += 1) {
      for (x = 0; x < width; x += 1) {
        var px = (y * width + x) * 4;
        for (c = 0; c < 3; c += 1) {
          var blur =
            (at(x - 1, y, c) + at(x + 1, y, c) + at(x, y - 1, c) + at(x, y + 1, c) + at(x, y, c) * 4) / 8;
          data[px + c] = clampByte(src[px + c] + (src[px + c] - blur) * amount);
        }
      }
    }
  }

  function stampPolish(blob) {
    return blob.arrayBuffer().then(function (buffer) {
      var bytes = new Uint8Array(buffer);
      if (bytes.length < 2 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return blob;
      var comment = new TextEncoder().encode('ss-polish-1');
      var segment = new Uint8Array(4 + comment.length);
      segment[0] = 0xff;
      segment[1] = 0xfe;
      var length = comment.length + 2;
      segment[2] = (length >> 8) & 255;
      segment[3] = length & 255;
      segment.set(comment, 4);
      var out = new Uint8Array(bytes.length + segment.length);
      out.set(bytes.subarray(0, 2), 0);
      out.set(segment, 2);
      out.set(bytes.subarray(2), 2 + segment.length);
      return new Blob([out], { type: 'image/jpeg' });
    });
  }

  function polishFile(file) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        var edge = Math.max(img.naturalWidth, img.naturalHeight) || 1;
        var scale = Math.min(1, MAX_EDGE / edge);
        var width = Math.max(1, Math.round(img.naturalWidth * scale));
        var height = Math.max(1, Math.round(img.naturalHeight * scale));
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        try {
          var frame = ctx.getImageData(0, 0, width, height);
          polishPixels(frame.data, width, height);
          ctx.putImageData(frame, 0, 0);
        } catch (err) {
          resolve(file);
          return;
        }
        canvas.toBlob(
          function (blob) {
            if (!blob) {
              resolve(file);
              return;
            }
            stampPolish(blob).then(resolve, function () {
              resolve(blob);
            });
          },
          'image/jpeg',
          0.82,
        );
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        resolve(file);
      };
      img.src = url;
    });
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
    return polishFile(file).then(function (polished) {
      return readBase64(polished);
    }).then(function (content) {
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
    setProgress('Polishing 1/' + batch.length + '…');

    var added = [];
    var chain = Promise.resolve();
    batch.forEach(function (file, index) {
      chain = chain.then(function () {
        setProgress('Polishing ' + (index + 1) + '/' + batch.length + '…');
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

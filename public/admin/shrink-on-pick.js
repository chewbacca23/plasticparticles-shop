/**
 * Phone photos are 2–5 MB. Two things then break the editor thumb:
 *
 * 1. Decap reads input.files in the same change event. If we shrink
 *    asynchronously and then swap, Decap already has the original.
 *    Stop that event, shrink, swap, fire a new change.
 * 2. Decap uploads with POST /git/blobs, not the contents API. If the
 *    FileList swap fails (iOS), shrink that POST body instead.
 *
 * HEIC from iPhone is converted to JPEG when the browser can decode it.
 */
(function () {
  var MAX_BYTES = 900000;
  var heicWarned = false;

  function isHeic(file) {
    var t = (file.type || '').toLowerCase();
    return t.indexOf('heic') !== -1 || t.indexOf('heif') !== -1 || /\.(heic|heif)$/i.test(file.name || '');
  }

  function isRaster(file) {
    var t = (file.type || '').toLowerCase();
    return /image\/(jpeg|jpg|pjpeg|png|webp)/i.test(t) || /\.(jpe?g|png|webp)$/i.test(file.name || '');
  }

  function shouldShrink(file) {
    if (!file) return false;
    if (isHeic(file)) return true;
    if (!isRaster(file)) return false;
    return file.size > MAX_BYTES;
  }

  function jpegNameFor(name) {
    return String(name || 'photo.jpg').replace(/\.(heic|heif)$/i, '.jpg');
  }

  function toast(msg) {
    var el = document.getElementById('shrink-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'shrink-toast';
      el.setAttribute(
        'style',
        'position:fixed;bottom:1.2rem;left:50%;transform:translateX(-50%);z-index:99999;background:#1e2830;color:#f0c27a;border:1px solid rgba(240,194,122,.4);padding:.7rem 1.05rem;border-radius:8px;font:15px/1.35 Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);',
      );
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = 'block';
  }

  function hideToast() {
    var el = document.getElementById('shrink-toast');
    if (el) el.style.display = 'none';
  }

  function loadBitmap(blob) {
    if (typeof createImageBitmap === 'function') {
      return createImageBitmap(blob).catch(function () {
        return loadHtmlImage(blob);
      });
    }
    return loadHtmlImage(blob);
  }

  function loadHtmlImage(blob) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('decode'));
      };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, quality) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) {
        resolve(blob);
      }, 'image/jpeg', quality);
    });
  }

  function drawToCanvas(source, maxEdge) {
    var w = source.width || source.naturalWidth;
    var h = source.height || source.naturalHeight;
    if (!w || !h) throw new Error('size');
    var scale = Math.min(1, maxEdge / Math.max(w, h));
    var cw = Math.max(1, Math.round(w * scale));
    var ch = Math.max(1, Math.round(h * scale));
    var canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    var ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(source, 0, 0, cw, ch);
    return canvas;
  }

  async function blobToSmallJpeg(blob, name) {
    var source = await loadBitmap(blob);
    var edges = [2400, 1800, 1400, 1100];
    var qualities = [0.72, 0.6, 0.5, 0.42, 0.34];
    var best = null;
    var i;
    var q;
    for (i = 0; i < edges.length; i += 1) {
      var canvas;
      try {
        canvas = drawToCanvas(source, edges[i]);
      } catch (err) {
        continue;
      }
      for (q = 0; q < qualities.length; q += 1) {
        var out = await canvasToBlob(canvas, qualities[q]);
        if (!out) continue;
        if (!best || out.size < best.size) best = out;
        if (out.size <= MAX_BYTES) {
          if (source.close) source.close();
          return new File([out], jpegNameFor(name), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          });
        }
      }
    }
    if (source.close) source.close();
    if (!best) return null;
    return new File([best], jpegNameFor(name), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  }

  async function shrinkFile(file) {
    var small = await blobToSmallJpeg(file, file.name);
    if (!small) return file;
    if (small.size >= file.size && !isHeic(file)) return file;
    return small;
  }

  function assignFiles(input, files) {
    try {
      var dt = new DataTransfer();
      files.forEach(function (f) {
        dt.items.add(f);
      });
      input.files = dt.files;
      return input.files && input.files[0] && input.files[0].size === files[0].size;
    } catch (err) {
      return false;
    }
  }

  function warnHeic() {
    if (heicWarned) return;
    heicWarned = true;
    window.alert(
      'This photo is Apple HEIC. The editor cannot always convert it here.\n\n' +
        'On iPhone: Settings → Camera → Formats → Most Compatible, then pick again.\n\n' +
        'Or export a JPEG from Photos first.',
    );
  }

  function onFileChange(event) {
    var input = event.target;
    if (!input || input.tagName !== 'INPUT' || input.type !== 'file') return;
    if (input.dataset.shrinkDone === '1') {
      input.dataset.shrinkDone = '';
      return;
    }
    var list = Array.prototype.slice.call(input.files || []);
    if (!list.some(shouldShrink)) return;
    event.stopImmediatePropagation();
    event.stopPropagation();
    event.preventDefault();
    toast('Shrinking photo so the thumb works…');
    Promise.resolve()
      .then(async function () {
        var next = [];
        var i;
        for (i = 0; i < list.length; i += 1) {
          var file = list[i];
          if (!shouldShrink(file)) {
            next.push(file);
            continue;
          }
          try {
            next.push(await shrinkFile(file));
          } catch (err) {
            if (isHeic(file)) warnHeic();
            next.push(file);
          }
        }
        assignFiles(input, next);
      })
      .catch(function () {
        if (list.some(isHeic)) warnHeic();
      })
      .then(function () {
        hideToast();
        input.dataset.shrinkDone = '1';
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
  }

  document.addEventListener('change', onFileChange, true);

  function b64ToBytes(b64) {
    var clean = String(b64).replace(/\s/g, '');
    var bin = atob(clean);
    var bytes = new Uint8Array(bin.length);
    var i;
    for (i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function looksLikeImage(bytes) {
    if (!bytes || bytes.length < 12) return false;
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return true;
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return true;
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return true;
    return isHeicBytes(bytes);
  }

  function isHeicBytes(bytes) {
    if (!bytes || bytes.length < 12) return false;
    if (bytes[4] !== 0x66 || bytes[5] !== 0x74 || bytes[6] !== 0x79 || bytes[7] !== 0x70) return false;
    var brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).toLowerCase();
    return /heic|heif|mif1|msf1/.test(brand);
  }

  function blobToGitHubB64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || '');
        var comma = result.indexOf(',');
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function filenameFromContentsUrl(url) {
    try {
      var path = decodeURIComponent(String(url).split('/contents/')[1] || '');
      path = path.split('?')[0];
      return path.split('/').pop() || '';
    } catch (err) {
      return '';
    }
  }

  async function maybeShrinkImagePayload(parsed, nameHint) {
    if (!parsed || typeof parsed.content !== 'string') return parsed;
    if (parsed.encoding && parsed.encoding !== 'base64') return parsed;
    var bytes;
    try {
      bytes = b64ToBytes(parsed.content);
    } catch (err) {
      return parsed;
    }
    var heic = isHeicBytes(bytes) || /\.(heic|heif)$/i.test(nameHint || '');
    if (!looksLikeImage(bytes) && !heic) return parsed;
    if (bytes.length <= MAX_BYTES && !heic) return parsed;
    try {
      var small = await blobToSmallJpeg(
        new Blob([bytes]),
        heic ? jpegNameFor(nameHint || 'photo.heic') : nameHint || 'photo.jpg',
      );
      if (small && small.size) {
        parsed.content = await blobToGitHubB64(small);
        parsed.encoding = 'base64';
      }
    } catch (err) {
      if (heic) warnHeic();
    }
    return parsed;
  }

  function requestUrl(input) {
    if (typeof input === 'string') return input;
    if (input && input.url) return input.url;
    return '';
  }

  function requestMethod(input, init) {
    if (init && init.method) return init.method;
    if (input && input.method) return input.method;
    return 'GET';
  }

  function isBlobPost(url, method) {
    return (
      String(method).toUpperCase() === 'POST' &&
      /api\.github\.com\/repos\/.+\/git\/blobs\/?(\?|$)/i.test(url)
    );
  }

  function isContentsPut(url, method) {
    return (
      String(method).toUpperCase() === 'PUT' &&
      /api\.github\.com\/repos\/.+\/contents\//i.test(url) &&
      /stories\//i.test(url)
    );
  }

  async function rewriteGithubUpload(input, init) {
    var url = requestUrl(input);
    var method = requestMethod(input, init);
    var blobPost = isBlobPost(url, method);
    var contentsPut = isContentsPut(url, method);
    if (!blobPost && !contentsPut) return { input: input, init: init };

    var nameHint = contentsPut ? filenameFromContentsUrl(url) : 'photo.jpg';
    var body = init && init.body;

    if (typeof body === 'string') {
      var parsed = JSON.parse(body);
      var next = await maybeShrinkImagePayload(parsed, nameHint);
      return { input: input, init: Object.assign({}, init, { body: JSON.stringify(next) }) };
    }

    if (typeof Request !== 'undefined' && input instanceof Request && !body) {
      var fromReq = await input.clone().json();
      var rewritten = await maybeShrinkImagePayload(fromReq, nameHint);
      return { input: new Request(input, { body: JSON.stringify(rewritten) }), init: init };
    }

    return { input: input, init: init };
  }

  var origFetch = window.fetch;
  window.fetch = function (input, init) {
    var args = arguments;
    return rewriteGithubUpload(input, init)
      .then(function (pair) {
        return origFetch.call(window, pair.input, pair.init);
      })
      .catch(function () {
        return origFetch.apply(window, args);
      });
  };
})();

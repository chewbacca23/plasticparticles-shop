/**
 * Decap’s First photo thumb often breaks:
 * 1) GitHub contents API returns no body over 1 MB (JSON, not a picture)
 * 2) Live /stories/foo.jpg 404s until Cloudflare rebuilds
 * 3) A blob: HEIC the browser cannot paint
 *
 * Always send those thumbs to public GitHub raw, and keep scanning for
 * imgs that already failed so the broken-image icon does not stick.
 */
(function () {
  var RAW =
    'https://raw.githubusercontent.com/chewbacca23/thenewsoulsearchersblog/main/public/stories/';
  var isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  var PLACEHOLDER =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">' +
        '<rect width="640" height="420" fill="#121820"/>' +
        '<text x="320" y="200" text-anchor="middle" fill="#f0c27a" font-family="system-ui,sans-serif" font-size="22" font-weight="700">Photo is saved</text>' +
        '<text x="320" y="236" text-anchor="middle" fill="#d7e0e8" font-family="system-ui,sans-serif" font-size="15">Preview is loading from GitHub</text>' +
        '</svg>',
    );

  function fileFromSrc(src) {
    var text = String(src || '');
    var publicMatch = text.match(/public\/stories\/([^/?#]+)/i);
    if (publicMatch) return decodeURIComponent(publicMatch[1]);
    var stories = text.match(
      /(?:^|\/)stories\/([^/?#]+\.(?:jpe?g|png|webp|gif|heic|heif))/i,
    );
    return stories ? decodeURIComponent(stories[1]) : null;
  }

  function rawForFile(file) {
    if (!file) return null;
    return RAW + encodeURIComponent(file).replace(/%2F/gi, '/');
  }

  function jpegTwin(file) {
    if (!file) return null;
    if (/\.(heic|heif)$/i.test(file)) return file.replace(/\.(heic|heif)$/i, '.jpg');
    // Phone / Mac often saves .jpeg while the repo has .jpg (or the other way)
    if (/\.jpeg$/i.test(file)) return file.replace(/\.jpeg$/i, '.jpg');
    if (/\.jpg$/i.test(file)) return file.replace(/\.jpg$/i, '.jpeg');
    return null;
  }

  function rawUrl(src) {
    if (!src || src.indexOf('data:') === 0) return null;
    if (src.indexOf('raw.githubusercontent.com') !== -1) return null;
    var file = fileFromSrc(src);
    if (!file) return null;
    // Contents API is never a real image for the <img> tag when the file is fat.
    if (/api\.github\.com\/repos\/.+\/contents\//i.test(src)) return rawForFile(file);
    if (/api\.github\.com\/repos\/.+\/git\/blobs\//i.test(src)) return rawForFile(file);
    if (src.indexOf('blob:') === 0) return null;
    if (isLocal) return null;
    return rawForFile(file);
  }

  function tryTwinOrPlaceholder(img, src) {
    var file = fileFromSrc(src);
    var twin = jpegTwin(file);
    if (twin && img.dataset.jpgTwin !== '1') {
      img.dataset.jpgTwin = '1';
      setSrc(img, rawForFile(twin));
      return;
    }
    showPlaceholder(img);
  }

  function storiesPathNear(img) {
    var root = img;
    var hops = 0;
    while (root && hops < 10) {
      var inputs = root.querySelectorAll ? root.querySelectorAll('input, textarea') : [];
      var i;
      for (i = 0; i < inputs.length; i++) {
        var value = String(inputs[i].value || '');
        var match = value.match(/\/stories\/[^\s"'<>]+/i);
        if (match) return match[0];
      }
      var text = String(root.getAttribute && (root.getAttribute('title') || root.getAttribute('aria-label')) || '');
      var fromAttr = text.match(/\/stories\/[^\s"'<>]+/i);
      if (fromAttr) return fromAttr[0];
      root = root.parentElement;
      hops += 1;
    }
    return null;
  }

  function blobToJpegUrl(blob) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () {
        try {
          var canvas = document.createElement('canvas');
          var max = 1600;
          var scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
          var ctx = canvas.getContext('2d', { alpha: false });
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          canvas.toBlob(
            function (out) {
              if (!out) {
                reject(new Error('empty'));
                return;
              }
              resolve(URL.createObjectURL(out));
            },
            'image/jpeg',
            0.72,
          );
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('decode'));
      };
      img.src = url;
    });
  }

  function setSrc(img, next) {
    if (!img || !next) return;
    if ((img.currentSrc || img.src || '').split('?')[0] === next.split('?')[0]) return;
    img.dataset.ssThumb = '1';
    img.src = next;
  }

  function showPlaceholder(img) {
    if (!img || img.dataset.ssPlace === '1') return;
    img.dataset.ssPlace = '1';
    img.src = PLACEHOLDER;
  }

  function fixImg(img, fromError) {
    if (!img || img.tagName !== 'IMG') return;
    if (img.dataset.ssBusy === '1') return;
    var src = img.currentSrc || img.getAttribute('src') || img.src || '';
    if (!src || src.indexOf(PLACEHOLDER) === 0) return;

    if (src.indexOf('raw.githubusercontent.com') !== -1) {
      if (!fromError && img.complete && img.naturalWidth > 0) return;
      if (img.dataset.rawRetry === '1') {
        tryTwinOrPlaceholder(img, src);
        return;
      }
      img.dataset.rawRetry = '1';
      setTimeout(function () {
        setSrc(img, src.split('?')[0] + '?t=' + Date.now());
      }, 1200);
      return;
    }

    if (src.indexOf('blob:') === 0) {
      if (!fromError && img.complete && img.naturalWidth > 0) return;
      if (img.dataset.blobTried === '1') {
        var near = storiesPathNear(img);
        var fromNear = near && rawUrl(near);
        if (fromNear) {
          setSrc(img, fromNear);
          return;
        }
        showPlaceholder(img);
        return;
      }
      img.dataset.blobTried = '1';
      img.dataset.ssBusy = '1';
      fetch(src)
        .then(function (res) {
          return res.blob();
        })
        .then(blobToJpegUrl)
        .then(function (next) {
          setSrc(img, next);
        })
        .catch(function () {
          var path = storiesPathNear(img);
          var next = path && rawUrl(path);
          if (next) setSrc(img, next);
          else showPlaceholder(img);
        })
        .then(function () {
          img.dataset.ssBusy = '0';
        });
      return;
    }

    var next = rawUrl(src);
    if (!next) {
      var nearby = storiesPathNear(img);
      next = nearby && rawUrl(nearby);
    }
    if (!next) {
      if (fromError || (img.complete && img.naturalWidth === 0)) showPlaceholder(img);
      return;
    }
    setSrc(img, next);
  }

  function scan() {
    var imgs = document.querySelectorAll('#nc-root img, [class*="Editor"] img, [class*="Media"] img');
    var i;
    for (i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      var src = img.currentSrc || img.getAttribute('src') || img.src || '';
      if (!src) continue;
      if (/api\.github\.com\/repos\/.+\/contents\//i.test(src) || fileFromSrc(src)) {
        fixImg(img, false);
        continue;
      }
      if (img.complete && img.naturalWidth === 0 && src.indexOf('data:') !== 0) {
        fixImg(img, true);
      }
    }
  }

  document.addEventListener(
    'error',
    function (event) {
      var img = event.target;
      if (!img || img.tagName !== 'IMG') return;
      fixImg(img, true);
    },
    true,
  );

  if (typeof MutationObserver === 'function') {
    var observer = new MutationObserver(function () {
      scan();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    });
  }

  window.setInterval(scan, 900);
  window.addEventListener('load', scan);
  scan();
})();

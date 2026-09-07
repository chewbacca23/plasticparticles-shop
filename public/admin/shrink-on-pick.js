/**
 * Shrink photos as they are picked, before Decap uploads them.
 *
 * Why: GitHub’s contents API returns no body above ~1 MB, so a phone JPEG
 * (2–5 MB) often looks like a failed upload (broken thumb) even when the
 * file did land. Shrinking first keeps the thumb alive. keep-photos-small
 * stays as the safety net.
 *
 * Do not wrap window.fetch — that froze Publish / Save this note.
 * Stop the first change event, shrink, swap FileList, fire a new change
 * so Decap sees the small JPEG.
 */
(function () {
  'use strict';

  var MAX_BYTES = 900000;
  var EDGE_STEPS = [3000, 2600, 2200, 1800, 1400, 1000];
  var QUALITY_STEPS = [0.86, 0.82, 0.78, 0.74, 0.7];
  var HANDLED = '__soulSearchersShrunk';
  var heicWarned = false;

  function isHeic(file) {
    var t = (file.type || '').toLowerCase();
    return t.indexOf('heic') !== -1 || t.indexOf('heif') !== -1 || /\.(heic|heif)$/i.test(file.name || '');
  }

  function isRaster(file) {
    var t = (file.type || '').toLowerCase();
    return (
      /image\/(jpeg|jpg|pjpeg|png|webp)/i.test(t) ||
      /\.(jpe?g|png|webp)$/i.test(file.name || '')
    );
  }

  function shouldShrink(file) {
    if (!file) return false;
    if (isHeic(file)) return true;
    if (!isRaster(file)) return false;
    return file.size > MAX_BYTES;
  }

  function log(message) {
    if (window.console && console.info) console.info('[photo] ' + message);
  }

  function toast(msg) {
    var el = document.getElementById('shrink-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'shrink-toast';
      el.setAttribute(
        'style',
        'position:fixed;bottom:1.2rem;left:50%;transform:translateX(-50%);z-index:99999;background:#1e2830;color:#f0c27a;border:1px solid rgba(240,194,122,.4);padding:.7rem 1.05rem;border-radius:8px;font:15px/1.35 Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);max-width:28rem;text-align:center;',
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

  function warnHeic() {
    if (heicWarned) return;
    heicWarned = true;
    window.alert(
      'This photo is Apple HEIC. Chrome often cannot upload or show those.\n\n' +
        'On iPhone: Settings → Camera → Formats → Most Compatible, then shoot again.\n\n' +
        'Or in Photos: Share → Save as JPEG / Export, then pick that file.',
    );
  }

  function decode(file) {
    if (typeof createImageBitmap === 'function') {
      return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () {
        return decodeViaImg(file);
      });
    }
    return decodeViaImg(file);
  }

  function decodeViaImg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('decode failed'));
      };
      img.src = url;
    });
  }

  function encode(canvas, quality) {
    return new Promise(function (resolve) {
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });
  }

  function jpegName(name) {
    return String(name || 'photo.jpg').replace(/\.(heic|heif|png|webp|jpe?g)$/i, '') + '.jpg';
  }

  function shrink(file) {
    if (isHeic(file)) {
      warnHeic();
      // Chrome usually cannot decode HEIC — leave file alone so Decap can try,
      // but the alert tells Henrik to use JPEG.
      return Promise.resolve(file);
    }
    if (!shouldShrink(file)) return Promise.resolve(file);

    return decode(file)
      .then(function (source) {
        var name = jpegName(file.name);
        var best = null;
        var bestCanvas = null;

        function toFile(blob, canvas) {
          log(
            file.name +
              ': ' +
              Math.round(file.size / 1024) +
              ' KB -> ' +
              Math.round(blob.size / 1024) +
              ' KB at ' +
              canvas.width +
              'x' +
              canvas.height,
          );
          return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
        }

        function tryEdge(edgeIndex) {
          if (edgeIndex >= EDGE_STEPS.length) {
            if (source.close) source.close();
            if (best) return toFile(best, bestCanvas);
            return file;
          }

          var scale = Math.min(1, EDGE_STEPS[edgeIndex] / Math.max(source.width, source.height));
          var canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(source.width * scale));
          canvas.height = Math.max(1, Math.round(source.height * scale));
          var ctx = canvas.getContext('2d', { alpha: false });
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

          function tryQuality(qualityIndex) {
            if (qualityIndex >= QUALITY_STEPS.length) return tryEdge(edgeIndex + 1);

            return encode(canvas, QUALITY_STEPS[qualityIndex]).then(function (blob) {
              if (!blob) return tryEdge(edgeIndex + 1);
              if (blob.size <= MAX_BYTES) {
                if (source.close) source.close();
                return toFile(blob, canvas);
              }
              if (!best || blob.size < best.size) {
                best = blob;
                bestCanvas = canvas;
              }
              return tryQuality(qualityIndex + 1);
            });
          }

          return tryQuality(0);
        }

        return tryEdge(0);
      })
      .catch(function () {
        log('could not shrink ' + file.name + ' here; uploading original');
        return file;
      });
  }

  function replay(input, files) {
    try {
      var transfer = new DataTransfer();
      files.forEach(function (file) {
        transfer.items.add(file);
      });
      input.files = transfer.files;
    } catch (error) {
      log('could not swap the picked files; uploading the originals');
    }
    input[HANDLED] = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  document.addEventListener(
    'change',
    function (event) {
      var input = event.target;
      if (!input || input.tagName !== 'INPUT' || input.type !== 'file') return;

      if (input[HANDLED]) {
        input[HANDLED] = false;
        return;
      }

      var picked = input.files ? Array.prototype.slice.call(input.files) : [];
      if (!picked.length) return;

      if (picked.some(isHeic)) warnHeic();

      var needsWork = picked.some(shouldShrink);
      if (!needsWork) return;

      event.stopImmediatePropagation();
      event.preventDefault();

      toast('Making the photo small enough for the editor…');
      Promise.all(picked.map(shrink)).then(function (files) {
        hideToast();
        replay(input, files);
      });
    },
    true,
  );

  log('ready — photos over ' + Math.round(MAX_BYTES / 1024) + ' KB are shrunk before upload');
})();

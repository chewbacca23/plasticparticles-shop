/**
 * Shrink photos in the browser as they are picked, before Decap uploads them.
 *
 * Why: the media library draws previews through the GitHub contents API,
 * which returns no body above 1 MB. A phone photo therefore uploads fine and
 * then shows a broken thumbnail until the repo-side workflow resizes it a
 * minute later — and the browser usually keeps serving the cached failure.
 * Shrinking before the upload means the thumbnail is correct immediately.
 *
 * The repo-side workflow stays as the safety net: every path here falls back
 * to the original file rather than blocking an upload.
 */
(function () {
  'use strict';

  // Matches scripts/optimise-photos.py so both paths agree.
  var MAX_BYTES = 900000;
  var EDGE_STEPS = [3000, 2600, 2200, 1800, 1400, 1000];
  var QUALITY_STEPS = [0.86, 0.82, 0.78, 0.74, 0.7];

  var HANDLED = '__soulSearchersShrunk';
  var RESIZABLE = /^image\/(jpeg|png|webp)$/i;

  function log(message) {
    if (window.console && console.info) console.info('[photo] ' + message);
  }

  /** Decode with EXIF rotation applied, so stripping metadata cannot rotate it. */
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

  function shrink(file) {
    if (!RESIZABLE.test(file.type) || file.size <= MAX_BYTES) return Promise.resolve(file);

    return decode(file)
      .then(function (source) {
        var name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
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

        // Largest edge and quality first; drop quality, then size, until it
        // fits. Mirrors the repo-side resizer.
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
          canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);

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
        // Leave it to the repo-side workflow rather than blocking the upload.
        log('could not shrink ' + file.name + ' here; the repo workflow will handle it');
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

  // Capture phase, so this runs before Decap's own React handler.
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

      var oversized = picked.some(function (file) {
        return RESIZABLE.test(file.type) && file.size > MAX_BYTES;
      });
      if (!oversized) return;

      event.stopImmediatePropagation();
      event.preventDefault();

      Promise.all(picked.map(shrink)).then(function (files) {
        replay(input, files);
      });
    },
    true,
  );

  log('ready — photos over ' + Math.round(MAX_BYTES / 1024) + ' KB are shrunk before upload');
})();

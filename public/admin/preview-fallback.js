/**
 * After an upload the editor often points the thumb at /stories/foo.jpg
 * on the live site (404 until Cloudflare rebuilds) or at a blob: HEIC
 * the browser cannot paint. On error, show GitHub raw or a JPEG blob.
 *
 * Do not rewrite working live thumbs eagerly — only swap after a 404.
 */
(function () {
  var RAW =
    'https://raw.githubusercontent.com/chewbacca23/thenewsoulsearchersblog/main/public/stories/';
  var isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  function fileFromSrc(src) {
    var publicMatch = String(src || '').match(/public\/stories\/([^/?#]+)/i);
    if (publicMatch) return publicMatch[1];
    var stories = String(src || '').match(
      /(?:^|\/)stories\/([^/?#]+\.(?:jpe?g|png|webp|gif|heic|heif))/i,
    );
    return stories ? stories[1] : null;
  }

  function rawUrl(src) {
    if (isLocal) return null;
    if (!src || src.indexOf('raw.githubusercontent.com') !== -1) return null;
    if (src.indexOf('blob:') === 0 || src.indexOf('data:') === 0) return null;
    var file = fileFromSrc(src);
    return file ? RAW + file : null;
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

  document.addEventListener(
    'error',
    function (event) {
      var img = event.target;
      if (!img || img.tagName !== 'IMG') return;
      var src = img.currentSrc || img.src || '';

      if (src.indexOf('raw.githubusercontent.com') !== -1) {
        if (img.dataset.rawRetry === '1') return;
        img.dataset.rawRetry = '1';
        setTimeout(function () {
          img.src = src.split('?')[0] + '?t=' + Date.now();
        }, 2000);
        return;
      }

      if (src.indexOf('blob:') === 0 && img.dataset.blobTried !== '1') {
        img.dataset.blobTried = '1';
        fetch(src)
          .then(function (res) {
            return res.blob();
          })
          .then(blobToJpegUrl)
          .then(function (next) {
            img.src = next;
          })
          .catch(function () {});
        return;
      }

      var next = rawUrl(src);
      if (!next) return;
      img.dataset.rawTried = '1';
      img.src = next;
    },
    true,
  );
})();

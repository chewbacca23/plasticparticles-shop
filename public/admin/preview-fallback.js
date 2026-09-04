/**
 * After an upload the editor points the thumb at /stories/foo.jpg on the
 * live site. Cloudflare has not rebuilt yet, so that URL is a 404 and you
 * get the broken-image icon. GitHub already has the file. Swap the thumb
 * to raw.githubusercontent.com (no rebuild wait, no 1 MB cap).
 *
 * Local CMS keeps serving /stories/ from the dev server.
 */
(function () {
  var host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return;

  var RAW =
    'https://raw.githubusercontent.com/chewbacca23/thenewsoulsearchersblog/main/public/stories/';

  function fileFromSrc(src) {
    var publicMatch = String(src || '').match(/public\/stories\/([^/?#]+)/i);
    if (publicMatch) return publicMatch[1];
    var stories = String(src || '').match(
      /(?:^|\/)stories\/([^/?#]+\.(?:jpe?g|png|webp|gif|heic|heif))/i,
    );
    return stories ? stories[1] : null;
  }

  function rawUrl(src) {
    if (!src || src.indexOf('raw.githubusercontent.com') !== -1) return null;
    if (src.indexOf('blob:') === 0 || src.indexOf('data:') === 0) return null;
    var file = fileFromSrc(src);
    return file ? RAW + file : null;
  }

  function rewrite(img) {
    if (!img || img.tagName !== 'IMG') return;
    var src = img.getAttribute('src') || img.currentSrc || '';
    var next = rawUrl(src);
    if (!next || img.dataset.rawOk === next) return;
    img.dataset.rawOk = next;
    img.src = next;
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
        }, 1500);
        return;
      }
      var next = rawUrl(src);
      if (!next) return;
      img.dataset.rawTried = '1';
      img.src = next;
    },
    true,
  );

  function scan() {
    document.querySelectorAll('img').forEach(rewrite);
  }

  scan();
  new MutationObserver(scan).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });
})();

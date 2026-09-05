/**
 * Do not intercept Decap's file picker or window.fetch.
 * Swallowing the change event blocked uploads. Wrapping fetch froze
 * Publish (same GitHub lock as save). GitHub Action keep-photos-small
 * shrinks fat JPEGs after they land.
 *
 * Warn when the picker gets Apple HEIC, which Chrome cannot paint.
 */
(function () {
  var heicWarned = false;

  function isHeic(file) {
    var t = (file.type || '').toLowerCase();
    return t.indexOf('heic') !== -1 || t.indexOf('heif') !== -1 || /\.(heic|heif)$/i.test(file.name || '');
  }

  document.addEventListener(
    'change',
    function (event) {
      var input = event.target;
      if (!input || input.tagName !== 'INPUT' || input.type !== 'file') return;
      var list = Array.prototype.slice.call(input.files || []);
      if (!list.some(isHeic) || heicWarned) return;
      heicWarned = true;
      window.alert(
        'This photo is Apple HEIC. Chrome shows a broken thumb for those.\n\n' +
          'On iPhone: Settings → Camera → Formats → Most Compatible, then pick again.\n\n' +
          'Or export a JPEG from Photos first.',
      );
    },
    true,
  );
})();

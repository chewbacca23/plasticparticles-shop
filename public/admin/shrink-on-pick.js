/**
 * Do not intercept Decap’s file picker or window.fetch.
 *
 * Stopping the change event (to shrink first) made Upload bounce out of the
 * note / ride and feel broken. Wrapping fetch froze Save / Publish.
 *
 * Fat JPEGs still shrink in GitHub Action keep-photos-small after they land.
 * HEIC gets a clear warning — Chrome often cannot show or upload those.
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
        'This photo is Apple HEIC. Chrome often cannot upload or show those.\n\n' +
          'On iPhone: Settings → Camera → Formats → Most Compatible, then shoot again.\n\n' +
          'Or in Photos: Share → Export / Save as JPEG, then Upload that file.\n\n' +
          'On Mac you can also run:\n' +
          '  sh scripts/shrink-photo.sh ~/Desktop/your-photo.HEIC\n' +
          'and upload the -web.jpg it writes.',
      );
    },
    true,
  );
})();

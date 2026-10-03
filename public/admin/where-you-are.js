/**
 * Big “you are here” strip so the editor never gets lost.
 * Reads Decap’s hash and paints THIS WEEK / STORES / RIDES / …
 */
(function () {
  var TITLES = {
    stories: 'RIDES',
    shots: 'SHOTS',
    journal: 'RIDE NOTES',
    friends: 'FRIENDS',
    shop: 'SHOP',
    stores: 'STORES AROUND THE WORLD',
    week: 'THIS WEEK',
    settings: 'SITE',
    media: 'MEDIA',
  };

  var HINTS = {
    stories: 'Stories with photos — the road rides.',
    shots: 'One photo and a line. Shows on Now.',
    journal: 'Longer notes from the road.',
    friends: 'People and shops who helped.',
    shop: 'Products people email Henrik about.',
    stores: 'Bike shops around the planet. Up to 24 photos per shop.',
    week: 'What happened this day or week. Up to 40 photos is fine.',
    settings: 'Mail, imprint, Instagram, home hero.',
    media: 'All uploaded pictures.',
  };

  function collectionFromHash(hash) {
    var text = String(hash || '');
    var match = text.match(/\/collections\/([^/]+)/);
    if (match) return match[1].replace(/[?#].*$/, '');
    if (text.indexOf('/media') !== -1) return 'media';
    return '';
  }

  function paint() {
    var el = document.getElementById('cms-where');
    var titleEl = document.getElementById('cms-where-title');
    var hintEl = document.getElementById('cms-where-hint');
    if (!el || !titleEl) return;

    var here = collectionFromHash(window.location.hash || '');
    if (!here) {
      el.hidden = true;
      titleEl.textContent = '';
      if (hintEl) hintEl.textContent = '';
      return;
    }

    el.hidden = false;
    titleEl.textContent = TITLES[here] || String(here).replace(/-/g, ' ').toUpperCase();
    if (hintEl) hintEl.textContent = HINTS[here] || 'You are editing this section.';
  }

  window.addEventListener('hashchange', paint);
  window.setInterval(paint, 350);
  paint();
})();

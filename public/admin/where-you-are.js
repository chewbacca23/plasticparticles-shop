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
    match = text.match(/\/edit\/([^/?#]+)/);
    if (match) return match[1];
    if (text.indexOf('/media') !== -1) return 'media';
    return '';
  }

  function editorOpen() {
    if (window.ssEditor && typeof window.ssEditor.open === 'function') return window.ssEditor.open();
    var hash = window.location.hash || '';
    return hash.indexOf('/entries/') !== -1 || hash.indexOf('/new') !== -1 || /\/edit\/[^/]+\/[^/?#]+/.test(hash);
  }

  function paintActions() {
    var actions = document.getElementById('cms-where-actions');
    var save = document.getElementById('cms-where-save');
    var del = document.getElementById('cms-where-delete');
    if (!actions || !save) return;

    if (!editorOpen()) {
      actions.hidden = true;
      return;
    }

    actions.hidden = false;
    var saving = window.ssEditor && window.ssEditor.saving && window.ssEditor.saving();
    var label = window.ssEditor && window.ssEditor.label ? window.ssEditor.label() : 'Save';
    save.textContent = saving ? 'Saving…' : label;
    save.disabled = !!saving;

    var can = window.ssDelete && window.ssDelete.can && window.ssDelete.can();
    if (del) {
      del.hidden = !can;
      var deleting = window.ssDelete && window.ssDelete.busy && window.ssDelete.busy();
      del.textContent = deleting ? 'Deleting…' : 'Delete this';
      del.disabled = !!deleting;
    }
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
    paintActions();
  }

  var saveBtn = document.getElementById('cms-where-save');
  if (saveBtn) {
    saveBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (window.ssEditor && typeof window.ssEditor.save === 'function') window.ssEditor.save();
    });
  }

  var deleteBtn = document.getElementById('cms-where-delete');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (window.ssDelete && typeof window.ssDelete.run === 'function') window.ssDelete.run();
    });
  }

  window.addEventListener('hashchange', paint);
  window.setInterval(paint, 350);
  paint();
})();

/**
 * Show the ride from the editor fields, not the live site. After Publish the
 * public page can stay empty until Cloudflare catches up; this pane still
 * shows the text and photos Henrik just saved.
 */
(function () {
  function ready(fn) {
    if (window.CMS) {
      fn();
      return;
    }
    window.addEventListener('load', function () {
      if (window.CMS) fn();
    });
  }

  function asList(value) {
    if (!value) return [];
    if (typeof value.toJS === 'function') return value.toJS();
    if (Array.isArray(value)) return value;
    return [];
  }

  function photoSrc(entry) {
    if (!entry) return '';
    if (typeof entry === 'string') return entry;
    if (typeof entry.get === 'function') return entry.get('image') || '';
    if (entry.image) return entry.image;
    return '';
  }

  ready(function () {
    var h = window.h || (window.CMS && window.CMS.h);
    if (!h || !window.CMS.registerPreviewTemplate) return;

    window.CMS.registerPreviewTemplate('stories', function (props) {
      var entry = props.entry;
      var title =
        entry.getIn(['data', 'headline']) || entry.getIn(['data', 'title']) || 'Ride';
      var description = entry.getIn(['data', 'description']) || '';
      var cover = entry.getIn(['data', 'cover']);
      var gallery = asList(entry.getIn(['data', 'gallery']));
      var photos = [];
      if (cover) photos.push(cover);
      gallery.forEach(function (item) {
        var src = photoSrc(item);
        if (src && photos.indexOf(src) === -1) photos.push(src);
      });

      return h(
        'article',
        { className: 'ss-ride-preview' },
        h('p', { className: 'ss-ride-preview__eyebrow' }, 'Ride'),
        h('h1', null, String(title)),
        description ? h('p', { className: 'ss-ride-preview__dek' }, String(description)) : null,
        photos.length
          ? h(
              'div',
              { className: 'ss-ride-preview__gallery' },
              photos.map(function (src) {
                return h('img', { key: src, src: src, alt: '' });
              }),
            )
          : null,
        props.widgetFor('body'),
      );
    });

    window.CMS.registerPreviewStyle(
      [
        'body{background:#0c1218;color:#d7e0e8;font-family:Figtree,system-ui,sans-serif;}',
        '.ss-ride-preview{max-width:40rem;padding:1.25rem;}',
        '.ss-ride-preview__eyebrow{letter-spacing:.08em;text-transform:uppercase;font-size:.75rem;color:rgba(215,224,232,.55);}',
        '.ss-ride-preview h1{font-size:2rem;color:#eef3f7;}',
        '.ss-ride-preview__dek{color:rgba(215,224,232,.75);}',
        '.ss-ride-preview__gallery img{display:block;width:100%;height:auto;margin:0 0 1rem;border-radius:.8rem;}',
      ].join(''),
    );
  });
})();

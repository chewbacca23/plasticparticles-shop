/**
 * Show the ride from the editor fields, not the live site. After Publish the
 * public page can stay empty until Cloudflare catches up; this pane still
 * shows the text and photos Henrik just saved.
 *
 * First photo at the top. Extra photos sit inside the story.
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

  function safePhoto(src) {
    var value = String(src || '').trim();
    if (!value || value.indexOf('..') !== -1) return '';
    if (value.indexOf('/stories/') !== 0) return '';
    return value;
  }

  function bodyValue(entry) {
    var body = entry.getIn(['data', 'body']);
    if (body == null) body = entry.get('body');
    return body == null ? '' : String(body);
  }

  function bodyPhotos(body) {
    var found = [];
    var re = /!\[[^\]]*\]\(([^)\s]+)/g;
    var match;
    while ((match = re.exec(String(body || '')))) {
      var src = safePhoto(match[1]);
      if (src && found.indexOf(src) === -1) found.push(src);
    }
    return found;
  }

  function weave(body, photos) {
    var extras = (photos || []).map(safePhoto).filter(Boolean);
    var source = String(body || '').replace(/\r\n/g, '\n').trim();
    var imageBlocks = extras.map(function (src) {
      return '![](' + src + ')';
    });
    if (!imageBlocks.length) return source;
    if (!source) return imageBlocks.join('\n\n');
    var blocks = source.split(/\n{2,}/);
    var textIndexes = [];
    blocks.forEach(function (block, index) {
      if (!/^!\[[^\]]*\]\([^)]+\)\s*$/.test(block.trim())) textIndexes.push(index);
    });
    if (!textIndexes.length) return blocks.concat(imageBlocks).join('\n\n');
    var after = {};
    extras.forEach(function (src, i) {
      var slot = Math.floor(((i + 1) * textIndexes.length) / (extras.length + 1));
      var clamped = Math.min(Math.max(slot, 0), textIndexes.length - 1);
      var blockIndex = textIndexes[clamped];
      after[blockIndex] = (after[blockIndex] || []).concat(['![](' + src + ')']);
    });
    var out = [];
    blocks.forEach(function (block, index) {
      out.push(block);
      if (after[index]) out.push.apply(out, after[index]);
    });
    return out.join('\n\n');
  }

  function planPhotos(photos, body, cover) {
    var inBody = bodyPhotos(body);
    var hero = safePhoto(cover) && photos.indexOf(cover) !== -1 && inBody.indexOf(cover) === -1
      ? cover
      : '';
    var inside = photos.filter(function (src) {
      return src && src !== hero && inBody.indexOf(src) === -1;
    });
    return { hero: hero, wovenBody: weave(body, inside) };
  }

  ready(function () {
    var h = window.h || (window.CMS && window.CMS.h);
    if (!h || !window.CMS.registerPreviewTemplate) return;

    window.CMS.registerPreviewTemplate('stories', function (props) {
      var entry = props.entry;
      var title =
        entry.getIn(['data', 'headline']) || entry.getIn(['data', 'title']) || 'Ride';
      var description = entry.getIn(['data', 'description']) || '';
      var cover = safePhoto(entry.getIn(['data', 'cover']));
      var photos = [];
      if (cover) photos.push(cover);
      asList(entry.getIn(['data', 'gallery'])).forEach(function (item) {
        var src = safePhoto(photoSrc(item));
        if (src && photos.indexOf(src) === -1) photos.push(src);
      });
      var plan = planPhotos(photos, bodyValue(entry), cover);
      var blocks = String(plan.wovenBody || '')
        .split(/\n{2,}/)
        .filter(Boolean)
        .map(function (block, index) {
          var image = block.trim().match(/^!\[([^\]]*)\]\(([^)\s]+)\)/);
          if (image) {
            return h('img', { key: 'pic-' + index, src: image[2], alt: image[1] || '' });
          }
          return h('p', { key: 'p-' + index }, block);
        });

      return h(
        'article',
        { className: 'ss-ride-preview' },
        h('p', { className: 'ss-ride-preview__eyebrow' }, 'Ride'),
        h('h1', null, String(title)),
        description ? h('p', { className: 'ss-ride-preview__dek' }, String(description)) : null,
        plan.hero ? h('img', { className: 'ss-ride-preview__hero', src: plan.hero, alt: '' }) : null,
        h('div', { className: 'ss-ride-preview__story' }, blocks),
      );
    });

    window.CMS.registerPreviewStyle(
      [
        'body{background:#0c1218;color:#d7e0e8;font-family:Figtree,system-ui,sans-serif;}',
        '.ss-ride-preview{max-width:40rem;padding:1.25rem;}',
        '.ss-ride-preview__eyebrow{letter-spacing:.08em;text-transform:uppercase;font-size:.75rem;color:rgba(215,224,232,.55);}',
        '.ss-ride-preview h1{font-size:2rem;color:#eef3f7;}',
        '.ss-ride-preview__dek{color:rgba(215,224,232,.75);}',
        '.ss-ride-preview__hero{display:block;width:100%;height:auto;margin:0 0 1.4rem;border-radius:.8rem;}',
        '.ss-ride-preview__story p{margin:0 0 1rem;}',
        '.ss-ride-preview__story img{display:block;width:100%;height:auto;margin:1.4rem 0;border-radius:.8rem;}',
      ].join(''),
    );
  });
})();

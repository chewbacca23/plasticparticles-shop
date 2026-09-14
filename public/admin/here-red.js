/**
 * The collection you are in turns red: Rides, Shots, Ride notes, Site.
 * So you can see where you are, and a friend can too.
 */
(function () {
  var RED = '#ff3b3b';
  var MARK = 'data-ss-here';
  var NAMES = {
    stories: 'rides',
    shots: 'shots',
    journal: 'ride notes',
    friends: 'friends',
    shop: 'shop',
    settings: 'site',
    media: 'media',
  };

  function hereCollection(hash) {
    var text = String(hash || '');
    var match = text.match(/\/collections\/([^/]+)/);
    if (match) return match[1].replace(/[?#].*$/, '');
    if (text.indexOf('/media') !== -1) return 'media';
    return '';
  }

  function hashPath(href) {
    var text = String(href || '');
    var cut = text.indexOf('#');
    if (cut !== -1) text = text.slice(cut);
    return text.replace(/[?].*$/, '');
  }

  function isHomeLink(href, name) {
    var path = hashPath(href);
    return path === '#/collections/' + name || path === '#/collections/' + name + '/';
  }

  function isMediaLink(href) {
    var path = hashPath(href);
    return path === '#/media' || path === '#/media/' || /#\/media(?:\/|$)/.test(path);
  }

  function isCurrentFile(href, hash) {
    var path = hashPath(href);
    var now = hashPath(hash);
    if (path.indexOf('/entries/') === -1) return false;
    return now === path || now.indexOf(path) === 0;
  }

  function paintNode(el, on) {
    if (!el) return;
    if (on) {
      el.setAttribute(MARK, '1');
      el.style.setProperty('color', RED, 'important');
    } else if (el.getAttribute(MARK)) {
      el.removeAttribute(MARK);
      el.style.removeProperty('color');
    }
  }

  function paintTree(el, on) {
    paintNode(el, on);
    if (!el || !el.querySelectorAll) return;
    var kids = el.querySelectorAll('*');
    var i;
    for (i = 0; i < kids.length; i++) paintNode(kids[i], on);
  }

  function wantedLabel(here) {
    return NAMES[here] || String(here || '').replace(/-/g, ' ');
  }

  function paint() {
    var hash = window.location.hash || '';
    var here = hereCollection(hash);
    var links = document.querySelectorAll(
      '#nc-root a[href], [class*="SidebarNav"] a[href], [class*="AppHeader"] a[href]',
    );
    var i;
    for (i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || links[i].getAttribute('to') || '';
      var on = false;
      if (here === 'media') on = isMediaLink(href);
      else if (here) {
        on = isHomeLink(href, here) || isCurrentFile(href, hash);
      }
      paintTree(links[i], on);
    }

    var labels = document.querySelectorAll(
      '[class*="CollectionLabel"], [class*="CollectionTop"], [class*="Breadcrumb"]',
    );
    var want = wantedLabel(here);
    for (i = 0; i < labels.length; i++) {
      var text = String(labels[i].textContent || '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
      var onLabel = !!(want && text && (text === want || text.indexOf(want) !== -1));
      paintTree(labels[i], onLabel);
    }
  }

  window.ssHereCollection = hereCollection;
  window.addEventListener('hashchange', paint);
  window.setInterval(paint, 400);
  paint();
})();

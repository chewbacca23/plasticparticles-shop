/**
 * Keep Decap’s editor below our brand bar so fields are not under .cms-top.
 * Preview is off in config.yml; this only fixes the absolute EditorContainer.
 */
(function () {
  function measure() {
    var row = document.querySelector('.cms-top-row');
    var where = document.getElementById('cms-where');
    var h = 16;
    if (row) h += Math.ceil(row.getBoundingClientRect().height);
    if (where && !where.hidden) h += Math.ceil(where.getBoundingClientRect().height) + 8;
    if (h < 48) h = 72;
    document.documentElement.style.setProperty('--cms-top-h', h + 'px');
  }

  measure();
  window.addEventListener('resize', measure);
  if (typeof ResizeObserver === 'function') {
    var top = document.querySelector('.cms-top');
    if (top) new ResizeObserver(measure).observe(top);
  }
  setTimeout(measure, 400);
  setTimeout(measure, 1200);
})();

/**
 * Keep Decap’s editor below our brand bar so fields are not under .cms-top.
 * Preview is off in config.yml; this only fixes the absolute EditorContainer.
 */
(function () {
  function measure() {
    var top = document.querySelector('.cms-top');
    if (!top) return;
    var h = Math.ceil(top.getBoundingClientRect().height);
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

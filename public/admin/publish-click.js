/**
 * Simple mode: an existing ride shows "Published" (duplicate only) until
 * something changes. Then it shows "Publish", which is a dropdown. The
 * save is the "Publish now" item. One click on Publish should save.
 */
(function () {
  function label(node) {
    return ((node && node.textContent) || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function closestControl(node) {
    if (!node || !node.closest) return null;
    return node.closest('button, a, [role="button"]');
  }

  function clickPublishNow() {
    var nodes = document.querySelectorAll('button, a, [role="menuitem"], [role="option"], li, div, span');
    var i;
    for (i = 0; i < nodes.length; i++) {
      if (label(nodes[i]) === 'publish now') {
        nodes[i].click();
        return true;
      }
    }
    return false;
  }

  document.addEventListener(
    'click',
    function (event) {
      var el = closestControl(event.target);
      if (!el) return;
      var text = label(el);

      if (text === 'published') {
        window.setTimeout(function () {
          window.alert(
            'This ride is already saved on GitHub.\n\n' +
              'Type in the story or add a JPEG. The button then says Publish.\n' +
              'Click Publish. Saving starts from there.',
          );
        }, 0);
        return;
      }

      if (text !== 'publish') return;

      window.setTimeout(function () {
        if (clickPublishNow()) return;
        window.setTimeout(clickPublishNow, 200);
      }, 50);
    },
    false,
  );
})();

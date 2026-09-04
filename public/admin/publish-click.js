/**
 * Existing rides hide Save behind Published. The real write is Publish now,
 * and empty Ride text used to fail persist with a toast that is easy to miss.
 * This script:
 *   - puts a gold Save button on the editor and calls Decap's handleOnPersist
 *   - turns a Published / Publish click into a real save
 */
(function () {
  var BTN = 'data-ss-save-ride';
  var saving = false;
  var ignoreClick = false;

  function editorOpen() {
    var hash = window.location.hash || '';
    return hash.indexOf('/entries/') !== -1 || hash.indexOf('/new') !== -1;
  }

  function saveLabel() {
    var hash = window.location.hash || '';
    if (hash.indexOf('/collections/shots') !== -1) return 'Save this shot';
    if (hash.indexOf('/collections/journal') !== -1) return 'Save this note';
    if (hash.indexOf('/collections/settings') !== -1) return 'Save Instagram';
    return 'Save this ride';
  }

  function label(node) {
    return ((node && node.textContent) || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function fiberOf(dom) {
    var key;
    if (!dom) return null;
    for (key in dom) {
      if (key.indexOf('__reactFiber') === 0 || key.indexOf('__reactInternalInstance') === 0) {
        return dom[key];
      }
    }
    return null;
  }

  function persistFromFiber(fiber) {
    var steps = 0;
    while (fiber && steps < 120) {
      var inst = fiber.stateNode;
      if (inst && typeof inst.handleOnPersist === 'function') {
        return inst.handleOnPersist.bind(inst);
      }
      fiber = fiber.return;
      steps += 1;
    }
    return null;
  }

  function findPersist() {
    var nodes = document.querySelectorAll(
      'button, a, header, nav, [class*="Toolbar"], [class*="toolbar"], [class*="Editor"]',
    );
    var i;
    var fn;
    for (i = 0; i < nodes.length; i++) {
      fn = persistFromFiber(fiberOf(nodes[i]));
      if (fn) return fn;
    }
    var root = document.getElementById('nc-root');
    if (root) {
      var walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
      var node;
      while ((node = walker.nextNode())) {
        fn = persistFromFiber(fiberOf(node));
        if (fn) return fn;
      }
    }
    return null;
  }

  function clickNamed(name) {
    var nodes = document.querySelectorAll('button, a, [role="menuitem"], [role="option"], li, div, span');
    var i;
    ignoreClick = true;
    try {
      for (i = 0; i < nodes.length; i++) {
        if (label(nodes[i]) === name) {
          nodes[i].click();
          return true;
        }
      }
    } finally {
      ignoreClick = false;
    }
    return false;
  }

  function toast(message, ok) {
    var el = document.getElementById('ss-save-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ss-save-toast';
      el.setAttribute(
        'style',
        'position:fixed;left:50%;bottom:5.2rem;transform:translateX(-50%);z-index:100001;max-width:28rem;padding:0.7rem 1rem;border-radius:8px;font:15px/1.35 Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.35);',
      );
      document.body.appendChild(el);
    }
    el.style.background = ok ? '#1e3a2a' : '#3a1e1e';
    el.style.color = ok ? '#b6e0c4' : '#f0c2c2';
    el.style.border = ok ? '1px solid rgba(47,191,98,.45)' : '1px solid rgba(240,122,122,.45)';
    el.textContent = message;
    el.style.display = 'block';
    window.setTimeout(function () {
      el.style.display = 'none';
    }, 5000);
  }

  function fieldErrorMessage() {
    var nodes = document.querySelectorAll('[class*="Error"], [class*="error"], [role="alert"]');
    var i;
    var bits = [];
    for (i = 0; i < nodes.length; i++) {
      var text = label(nodes[i]);
      if (text && text.length < 180 && bits.indexOf(text) === -1) bits.push(text);
    }
    var body = (document.body.innerText || '').replace(/\s+/g, ' ');
    if (/order/i.test(body) && /must be|minimum|at least|range/i.test(body)) {
      bits.push('Order cannot be below 0.');
    }
    return bits[0] || '';
  }

  function saveRide() {
    if (saving) return;
    saving = true;
    updateButton();

    var persist = findPersist();
    var started = Promise.resolve();
    if (persist) {
      try {
        started = Promise.resolve(persist({}));
      } catch (err) {
        started = Promise.reject(err);
      }
    } else if (clickNamed('publish now')) {
      started = new Promise(function (resolve) {
        window.setTimeout(resolve, 400);
      });
    } else if (clickNamed('publish')) {
      started = new Promise(function (resolve, reject) {
        window.setTimeout(function () {
          if (clickNamed('publish now')) resolve();
          else reject(new Error('Could not find Publish now. Use the gold button.'));
        }, 80);
      });
    } else {
      started = Promise.reject(new Error('Could not find the editor save action.'));
    }

    started
      .then(function () {
        return new Promise(function (resolve, reject) {
          var tries = 0;
          function tick() {
            tries += 1;
            var text = document.body.innerText || '';
            var unsaved = /unsaved changes/i.test(text);
            var saved = /changes saved/i.test(text) && !unsaved;
            var busy = /publishing/i.test(text);
            if (saved) {
              resolve();
              return;
            }
            if (unsaved && !busy && tries >= 4) {
              reject(
                new Error(
                  fieldErrorMessage() ||
                    'Could not save. Look for a red field on the form, then try again.',
                ),
              );
              return;
            }
            if (tries >= 40) {
              resolve();
              return;
            }
            window.setTimeout(tick, 250);
          }
          window.setTimeout(tick, 250);
        });
      })
      .then(function () {
        toast('Saved. Wait a minute, then hard-refresh the public site.', true);
      })
      .catch(function (err) {
        var message = err && err.message ? err.message : 'Save failed.';
        if (/required|presence|missing/i.test(String(message))) {
          message = 'Fill the name, then ' + saveLabel() + ' again.';
        }
        toast(message, false);
        window.alert(message);
      })
      .then(function () {
        saving = false;
        updateButton();
      });
  }

  function updateButton() {
    var button = document.querySelector('[' + BTN + ']');
    if (!editorOpen()) {
      if (button && button.parentNode) button.parentNode.removeChild(button);
      return;
    }
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.setAttribute(BTN, '1');
      button.setAttribute(
        'style',
        'position:fixed;right:1.1rem;bottom:1.1rem;z-index:100000;padding:0.85rem 1.25rem;border:0;border-radius:999px;background:#f0c27a;color:#0c1218;font:700 1.05rem/1 Inter,system-ui,sans-serif;cursor:pointer;box-shadow:0 10px 28px rgba(0,0,0,.4);',
      );
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        saveRide();
      });
      document.body.appendChild(button);
    }
    button.disabled = saving;
    button.textContent = saving ? 'Saving…' : saveLabel();
    button.style.opacity = saving ? '0.7' : '1';
  }

  document.addEventListener(
    'click',
    function (event) {
      if (ignoreClick) return;
      var el = event.target && event.target.closest && event.target.closest('button, a, [role="button"]');
      if (!el || el.getAttribute(BTN)) return;
      var text = label(el);
      if (text === 'published' || text === 'publish') {
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) event.stopImmediatePropagation();
        saveRide();
      }
    },
    true,
  );

  document.addEventListener('keydown', function (event) {
    if (!editorOpen()) return;
    if ((event.metaKey || event.ctrlKey) && String(event.key).toLowerCase() === 's') {
      event.preventDefault();
      saveRide();
    }
  });

  window.addEventListener('hashchange', updateButton);
  setInterval(updateButton, 700);
  updateButton();
})();

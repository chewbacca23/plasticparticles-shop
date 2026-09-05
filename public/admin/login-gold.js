/**
 * Gold Login with GitHub in our bar. Decap’s own button can vanish if Mail
 * opens first. This clicks Decap’s login so the GitHub popup still works.
 */
(function () {
  var AFTER = 'ss-after-login';

  function authPage() {
    return document.querySelector('section[class*="AuthenticationPage"]');
  }

  function loggedIn() {
    if (authPage()) return false;
    return !!(
      document.querySelector('[class*="AppHeader"]') ||
      document.querySelector('[class*="CollectionLabel"]') ||
      document.querySelector('[class*="EditorContainer"]') ||
      document.querySelector('[class*="SidebarNav"]')
    );
  }

  function mark() {
    var top = document.querySelector('.cms-top');
    if (!top) return;
    if (loggedIn()) top.classList.add('cms-in');
    else top.classList.remove('cms-in');
  }

  function clickDecapLogin() {
    var button = document.querySelector('button[class*="LoginButton"]');
    if (!button) return false;
    button.click();
    return true;
  }

  function startLogin() {
    if (clickDecapLogin()) return;
    var tries = 0;
    var timer = window.setInterval(function () {
      tries += 1;
      if (clickDecapLogin() || tries > 30) window.clearInterval(timer);
    }, 150);
  }

  var hash = window.location.hash || '';
  if (hash.indexOf('/collections/') !== -1 || hash.indexOf('/workflow') !== -1) {
    try {
      window.sessionStorage.setItem(AFTER, hash);
    } catch (e) {
      // sessionStorage can be blocked; login still works.
    }
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  var login = document.getElementById('cms-login');
  if (login) {
    login.addEventListener('click', function (event) {
      event.preventDefault();
      startLogin();
    });
  }

  var mail = document.getElementById('cms-mail');
  if (mail) {
    mail.addEventListener('click', function (event) {
      if (loggedIn()) return;
      event.preventDefault();
      try {
        window.sessionStorage.setItem(AFTER, '#/collections/settings/entries/imprint');
      } catch (e) {
        // Same as above.
      }
      startLogin();
    });
  }

  window.addEventListener('hashchange', mark);
  window.setInterval(function () {
    mark();
    if (!loggedIn()) return;
    var next = '';
    try {
      next = window.sessionStorage.getItem(AFTER) || '';
      if (next) window.sessionStorage.removeItem(AFTER);
    } catch (e) {
      next = '';
    }
    if (next && window.location.hash !== next) {
      window.location.hash = next;
    }
  }, 700);
  mark();
})();

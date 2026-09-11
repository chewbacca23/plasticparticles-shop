/**
 * Gold Login with GitHub in our bar. Decap’s own button can vanish.
 * This clicks Decap’s login so the GitHub popup still works.
 */
(function () {
  var AFTER = 'ss-after-login';

  function authPage() {
    return document.querySelector('section[class*="AuthenticationPage"]');
  }

  function loggedIn() {
    if (authPage()) return false;
    try {
      var keys = ['decap-cms-user', 'netlify-cms-user'];
      for (var i = 0; i < keys.length; i++) {
        var raw = window.localStorage.getItem(keys[i]);
        if (!raw) continue;
        var parsed = JSON.parse(raw);
        if (parsed && parsed.token) return true;
      }
    } catch (e) {
      // A corrupt session is treated as logged out.
    }
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

  window.ssGoldLogin = {
    loggedIn: loggedIn,
    startLogin: startLogin,
  };

  var login = document.getElementById('cms-login');
  if (login) {
    login.addEventListener('click', function (event) {
      event.preventDefault();
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
    if (next === 'mail' || next === '#mail') {
      window.dispatchEvent(new CustomEvent('ss-open-mail'));
      return;
    }
    if (next && next.charAt(0) === '#' && window.location.hash !== next) {
      window.location.hash = next;
    }
  }, 700);
  mark();
})();

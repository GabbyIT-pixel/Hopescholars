// Small progressive enhancements. The site works without JavaScript; CSP forbids inline scripts.
(function () {
  var toggle = document.querySelector('[data-nav-toggle]');
  var nav = document.getElementById('nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  // Show / hide password buttons.
  document.querySelectorAll('.pw').forEach(function (wrap) {
    var input = wrap.querySelector('input[type=password]');
    if (!input) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'pw-toggle'; b.textContent = 'Show'; b.setAttribute('aria-label', 'Show password');
    b.addEventListener('click', function () {
      var show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      b.textContent = show ? 'Hide' : 'Show';
      b.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
    wrap.appendChild(b);
  });
  // Password strength hint on sign-up.
  var meter = document.querySelector('[data-strength]');
  var pw = document.getElementById('password');
  if (meter && pw) {
    var bar = meter.querySelector('[data-strength-bar]');
    var txt = meter.querySelector('[data-strength-text]');
    pw.addEventListener('input', function () {
      var v = pw.value, n = 0;
      if (v.length >= 10) n++;
      if (/[a-z]/.test(v) && /[A-Z]/.test(v)) n++;
      if (/[0-9]/.test(v)) n++;
      if (v.length >= 14 || /[^A-Za-z0-9]/.test(v)) n++;
      meter.hidden = v.length === 0;
      bar.className = 'bar-fill pct-' + (n * 25);
      bar.setAttribute('data-level', n);
      txt.textContent = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'][n];
    });
  }
  // One-tap demo logins.
  document.querySelectorAll('[data-fill-email]').forEach(function (b) {
    b.addEventListener('click', function () {
      var e = document.getElementById('email'), p = document.getElementById('password');
      if (e && p) { e.value = b.getAttribute('data-fill-email'); p.value = b.getAttribute('data-fill-password'); p.focus(); }
    });
  });
  // Dismissible notices.
  document.querySelectorAll('.flash').forEach(function (f) {
    var x = document.createElement('button');
    x.type = 'button'; x.className = 'flash-close'; x.setAttribute('aria-label', 'Dismiss message'); x.textContent = '✕';
    x.addEventListener('click', function () { f.remove(); });
    f.appendChild(x);
  });
  document.querySelectorAll('form[data-confirm]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      if (!window.confirm(f.getAttribute('data-confirm'))) e.preventDefault();
    });
  });
  // Prevent double submits (slow connections).
  document.querySelectorAll('form').forEach(function (f) {
    f.addEventListener('submit', function () {
      var b = f.querySelector('button[type=submit], button:not([type])');
      if (b && !f.hasAttribute('data-confirm') && !f.hasAttribute('data-keep')) setTimeout(function () { b.disabled = true; if (b.tagName === 'BUTTON' && !b.dataset.label) { b.dataset.label = b.textContent; b.textContent = 'Please wait…'; } }, 0);
    });
  });
})();

// Motion: scroll reveals and count-up numbers (skipped when the visitor prefers reduced motion).
(function () {
  var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (calm || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('js');
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in'); io.unobserve(e.target);
      var n = e.target.querySelector && e.target.querySelector('[data-count]') || (e.target.hasAttribute && e.target.hasAttribute('data-count') ? e.target : null);
      if (n) { var to = parseInt(n.getAttribute('data-count'), 10), t0 = performance.now();
        (function step(t) { var k = Math.min(1, (t - t0) / 1100); n.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); })(t0); }
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal, .ledger > div, .why-grid > *, .stage-tile, .home .card, .how-steps li').forEach(function (el) { el.classList.add('reveal'); io.observe(el); });
})();

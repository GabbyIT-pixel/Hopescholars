// Help desk chat panel. Progressive enhancement: without JavaScript the "Help" button opens /help.
(function () {
  var panel = document.getElementById('help-panel');
  var openers = document.querySelectorAll('[data-help-open]');
  var closer = document.querySelector('[data-help-close]');
  var log = document.getElementById('help-log');
  var form = document.getElementById('help-form');
  var input = document.getElementById('help-q');
  var sugBox = document.getElementById('help-suggest');
  if (!panel || !form || !log || !input) return;
  var csrf = form.querySelector('input[name=_csrf]').value;
  var suggestions = ['What is Hope Scholar?', 'How do I create an account?', 'What does the match percentage mean?', 'Which scholarships close soon?'];
  var lastOpener = null;

  function add(text, who, links) {
    var d = document.createElement('div');
    d.className = 'msg ' + who;
    d.textContent = text;
    if (links && links.length) {
      var row = document.createElement('div'); row.className = 'msg-links';
      links.forEach(function (l) {
        if (typeof l[1] !== 'string' || l[1].charAt(0) !== '/' || l[1].charAt(1) === '/') return; // same-site links only
        var a = document.createElement('a'); a.href = l[1]; a.textContent = l[0]; a.className = 'btn small'; row.appendChild(a);
      });
      d.appendChild(row);
    }
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
    return d;
  }
  function showSuggestions(list) {
    sugBox.textContent = '';
    (list || []).slice(0, 3).forEach(function (q) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'chip-btn'; b.textContent = q;
      b.addEventListener('click', function () { ask(q); });
      sugBox.appendChild(b);
    });
  }
  var hist = [];
  function ask(q) {
    q = (q || '').trim();
    if (!q) return;
    add(q, 'user');
    input.value = '';
    var wait = add('Thinking…', 'bot wait');
    var body = new URLSearchParams({ q: q, h: JSON.stringify(hist.slice(-8)), _csrf: csrf }).toString();
    fetch('/help/ask', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Requested-With': 'fetch', 'X-CSRF-Token': csrf }, body: body })
      .then(function (r) { return r.json(); })
      .then(function (d) { wait.remove(); hist.push({ role: 'user', content: q }, { role: 'assistant', content: String(d.answer || '').slice(0, 1500) }); if (hist.length > 12) hist = hist.slice(-12); add(d.answer || 'Sorry, I could not answer that.', 'bot', d.links); showSuggestions(d.suggestions); })
      .catch(function () { wait.remove(); add('Sorry, something went wrong. Please try again or open the full help page.', 'bot', [['Help page', '/help']]); });
  }
  function open() { panel.hidden = false; document.body.classList.add('help-open'); input.focus(); if (!sugBox.children.length) showSuggestions(suggestions); }
  function close() { panel.hidden = true; document.body.classList.remove('help-open'); if (lastOpener) lastOpener.focus(); }

  openers.forEach(function (o) { o.addEventListener('click', function (e) { e.preventDefault(); lastOpener = o; if (panel.hidden) open(); else close(); }); });
  if (closer) closer.addEventListener('click', close);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) close(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); });
})();

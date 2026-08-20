/* In-tool dialogs. Browser confirm()/alert() block the page, cannot be styled,
 * and say "localhost:5173 says" above whatever you wrote — which reads as an
 * error even when the message is a choice. */
(function (global) {
  'use strict';

  var host = null;

  function el(tag, cls, parent, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.appendChild(n);
    return n;
  }

  function close() {
    if (host) { host.remove(); host = null; }
    document.removeEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  /* opts: {title, body (html), actions:[{label, primary, danger, fn}], wide} */
  function open(opts) {
    close();
    host = el('div', 'modal-back', document.body);
    var card = el('div', 'modal' + (opts.wide ? ' wide' : ''), host);
    card.addEventListener('click', function (e) { e.stopPropagation(); });
    if (opts.title) el('div', 'modal-title', card, opts.title);
    var body = el('div', 'modal-body', card);
    if (opts.body) body.innerHTML = opts.body;

    var foot = el('div', 'modal-foot', card);
    (opts.actions || [{ label: (global.I18N ? global.I18N.t('close') : 'Close') }]).forEach(function (a) {
      var b = el('button', a.primary ? 'primary' : (a.danger ? 'danger' : ''), foot, a.label);
      b.addEventListener('click', function () {
        if (a.keepOpen) { if (a.fn) a.fn(); return; }
        close();
        if (a.fn) a.fn();
      });
      if (a.primary) setTimeout(function () { b.focus(); }, 0);
    });

    if (!opts.sticky) host.addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    return { body: body, card: card, close: close };
  }

  function alert(title, bodyHtml) {
    return open({ title: title, body: bodyHtml, actions: [{ label: 'OK', primary: true }] });
  }

  /* A dialog with no dismiss, for work in progress. Returns {update, close}. */
  function progress(title, bodyHtml) {
    var h = open({ title: title, body: bodyHtml, actions: [], sticky: true });
    var line = el('div', 'modal-progress', h.body);
    var bar = el('i', null, line);
    var note = el('div', 'modal-note', h.body);
    return {
      update: function (frac, text) {
        bar.style.width = Math.max(0, Math.min(1, frac)) * 100 + '%';
        if (text != null) note.textContent = text;
      },
      close: close
    };
  }

  global.Modal = { open: open, alert: alert, progress: progress, close: close };
})(typeof self !== 'undefined' ? self : this);

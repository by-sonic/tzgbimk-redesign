/* Толмачёвский завод ЖБ и МК — общий скрипт: меню, поиск, заявка (корзина), формы, фильтр каталога */
(function () {
  'use strict';
  var BASE = (window.SITE && window.SITE.base) || '/';
  var EMAIL = (window.SITE && window.SITE.email) || 'tzgbimk@tzgbimk.ru';
  var root = document.documentElement;
  root.classList.remove('no-js');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return [].slice.call((c || document).querySelectorAll(s)); }
  function fmt(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- шапка ---------- */
  var hdr = $('#hdr');
  if (hdr && !hdr.hasAttribute('data-home')) {
    hdr.classList.add('is-light');
  }

  /* ---------- мобильное меню ---------- */
  var burger = $('#burger'), mnav = $('#mnav');
  function setMenu(o) {
    root.classList.toggle('menu-open', o);
    if (burger) { burger.setAttribute('aria-expanded', o); burger.setAttribute('aria-label', o ? 'Закрыть меню' : 'Открыть меню'); }
    document.body.style.overflow = o ? 'hidden' : '';
  }
  if (burger && mnav) {
    burger.addEventListener('click', function () { setMenu(!root.classList.contains('menu-open')); });
    mnav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
  }

  /* ---------- модалки ---------- */
  var lastFocus = null;
  function openModal(m) {
    if (!m) return;
    lastFocus = document.activeElement;
    m.classList.add('on'); m.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var f = $('input:not([type=hidden]),textarea,button', m.querySelector('.modal__box, .search__box') || m);
    setTimeout(function () { f && f.focus(); }, 60);
  }
  function closeModal(m) {
    if (!m) return;
    m.classList.remove('on'); m.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = root.classList.contains('menu-open') ? 'hidden' : '';
    lastFocus && lastFocus.focus && lastFocus.focus();
  }
  $$('.modal').forEach(function (m) {
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-close]')) closeModal(m); });
  });
  addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { $$('.modal.on').forEach(closeModal); setMenu(false); }
  });

  /* ---------- заявка (модалка) ---------- */
  var req = $('#request');
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-request]');
    if (!t || !req) return;
    e.preventDefault();
    setMenu(false);
    var prod = t.getAttribute('data-product') || '';
    var f = $('form', req);
    if (f) {
      var msg = f.elements.msg;
      if (msg && prod) msg.value = 'Прошу рассчитать стоимость: ' + prod + ', количество: ';
      var title = $('[data-request-title]', req);
      if (title) title.textContent = prod ? 'Запрос цены' : 'Заявка на расчёт';
    }
    openModal(req);
  });

  /* ---------- формы: письмо на почту завода (бэкенда в превью нет) ---------- */
  function mailto(subject, body) {
    location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }
  $$('form[data-mail]').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var phone = f.elements.phone ? f.elements.phone.value.trim() : '';
      if (f.elements.phone && phone.replace(/\D/g, '').length < 10) {
        f.elements.phone.focus(); f.elements.phone.setCustomValidity('Укажите телефон'); f.elements.phone.reportValidity();
        f.elements.phone.setCustomValidity(''); return;
      }
      var agree = f.querySelector('input[name=agree]');
      if (agree && !agree.checked) { agree.focus(); agree.setCustomValidity('Нужно согласие'); agree.reportValidity(); agree.setCustomValidity(''); return; }
      var lines = [];
      $$('input,textarea,select', f).forEach(function (el) {
        if (!el.name || el.type === 'checkbox' || el.type === 'hidden' && el.name !== 'items') return;
        if (el.type === 'radio' && !el.checked) return;
        var label = el.getAttribute('data-label') || el.getAttribute('aria-label') || el.placeholder || el.name;
        if (el.value.trim()) lines.push(label + ': ' + el.value.trim());
      });
      if (f.hasAttribute('data-cart')) lines.push('', 'Состав заявки:', cartText());
      lines.push('', 'Страница: ' + location.href);
      var msg = $('.fmsg, .form__msg', f);
      var btn = $('button[type=submit]', f);
      function done(text, ok) {
        if (msg) { msg.textContent = text; msg.classList.add('on'); }
        if (btn) btn.disabled = false;
        if (ok) { f.reset(); if (f.hasAttribute('data-cart')) { save([]); renderCart(); } }
      }
      function fallback() {
        done('Сервер заявок недоступен — открываем почтовую программу с готовым письмом на ' + EMAIL + '.', false);
        mailto(f.getAttribute('data-mail') || 'Заявка с сайта', lines.join('\n'));
      }
      var action = f.getAttribute('action');
      if (!action || !window.fetch) return fallback();
      var fd = new FormData(f);
      fd.set('page', location.href);
      if (f.hasAttribute('data-cart')) fd.set('items', cartText());
      var dir = f.querySelector('input[name=t]:checked'); if (dir) fd.set('direction', dir.value);
      if (btn) btn.disabled = true;
      fetch(action, { method: 'POST', body: fd, headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' } })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }, function () { return { ok: false }; }); })
        .then(function (res) {
          if (res.ok && res.j && res.j.success !== false) done('Спасибо! Заявка принята — менеджер свяжется с вами в рабочее время.', true);
          else if (res.j && res.j.errors) done('Проверьте поля: ' + Object.keys(res.j.errors).map(function (k) { return res.j.errors[k][0]; }).join(' '), false);
          else fallback();
        }, fallback);
    });
  });

  /* ---------- корзина-заявка (localStorage) ---------- */
  var KEY = 'tz-cart';
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function save(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) {} badge(); }
  function badge() {
    var n = load().reduce(function (s, i) { return s + i.qty; }, 0);
    $$('[data-cart-count]').forEach(function (b) { b.textContent = n; b.hidden = !n; });
  }
  function cartText() {
    return load().map(function (i) { return '— ' + i.name + ' × ' + i.qty + (i.price ? ' (' + fmt(i.price) + ' ₽/шт.)' : ''); }).join('\n');
  }
  var toast = $('#toast'), toastT;
  function showToast(text) {
    if (!toast) return;
    $('span', toast).textContent = text;
    toast.classList.add('on'); clearTimeout(toastT);
    toastT = setTimeout(function () { toast.classList.remove('on'); }, 3200);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-add]');
    if (!b) return;
    e.preventDefault();
    var item; try { item = JSON.parse(b.getAttribute('data-add')); } catch (err) { return; }
    var q = 1, qi = b.getAttribute('data-qty-from') && $(b.getAttribute('data-qty-from'));
    if (qi) q = Math.max(1, parseInt(qi.value, 10) || 1);
    var c = load(), ex = c.filter(function (i) { return i.u === item.u; })[0];
    if (ex) ex.qty += q; else { item.qty = q; c.push(item); }
    save(c);
    b.classList.add('is-added');
    var lbl = $('.add__t', b); if (lbl) lbl.textContent = 'В заявке';
    showToast(item.n + ' — добавлено в заявку');
  });
  badge();
  addEventListener('storage', badge);

  // страница заявки
  var app = $('[data-cart-app]');
  function renderCart() {
    if (!app) return;
    var c = load(), list = $('[data-cart-list]', app), total = 0, unknown = 0;
    if (!c.length) {
      list.innerHTML = '<div class="empty">В заявке пока пусто. Добавьте изделия из <a class="blue" href="' + BASE + 'zhbi-izdeliya/">каталога</a> или пришлите спецификацию через форму.</div>';
    } else {
      list.innerHTML = c.map(function (i, k) {
        var sum = i.p ? i.p * i.qty : 0; total += sum; if (!i.p) unknown++;
        return '<div class="citem"><div><a href="' + esc(BASE + i.u.replace(/^\//, '')) + '">' + esc(i.n) + '</a><small>' + (i.p ? fmt(i.p) + ' ₽ за шт.' : 'Цена по запросу') + '</small></div>' +
          '<div class="qty"><button type="button" data-q="-1" data-k="' + k + '" aria-label="Меньше">−</button><input type="number" min="1" value="' + i.qty + '" data-k="' + k + '" aria-label="Количество"><button type="button" data-q="1" data-k="' + k + '" aria-label="Больше">+</button></div>' +
          '<div class="citem__sum">' + (i.p ? fmt(sum) + ' ₽' : '—') + '</div>' +
          '<button class="citem__rm" type="button" data-rm="' + k + '" aria-label="Убрать">×</button></div>';
      }).join('');
    }
    var t = $('[data-cart-total]', app);
    if (t) t.innerHTML = '<div>Ориентировочно<small>' + (unknown ? 'без позиций с ценой по запросу' : 'точную сумму назовёт менеджер') + '</small></div><b>' + (total ? fmt(total) + ' ₽' : '—') + '</b>';
    var items = $('input[name=items]', app); if (items) items.value = cartText();
  }
  if (app) {
    app.addEventListener('click', function (e) {
      var c = load(), b;
      if ((b = e.target.closest('[data-q]'))) { var k = +b.getAttribute('data-k'); c[k].qty = Math.max(1, c[k].qty + +b.getAttribute('data-q')); save(c); renderCart(); }
      else if ((b = e.target.closest('[data-rm]'))) { c.splice(+b.getAttribute('data-rm'), 1); save(c); renderCart(); }
      else if (e.target.closest('[data-clear]')) { save([]); renderCart(); }
    });
    app.addEventListener('change', function (e) {
      var inp = e.target.closest('input[data-k]'); if (!inp) return;
      var c = load(); c[+inp.getAttribute('data-k')].qty = Math.max(1, parseInt(inp.value, 10) || 1); save(c); renderCart();
    });
    renderCart();
  }

  /* ---------- количество на странице товара ---------- */
  $$('.qty[data-stepper]').forEach(function (q) {
    var inp = $('input', q);
    q.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      inp.value = Math.max(1, (parseInt(inp.value, 10) || 1) + (b.textContent.trim() === '+' ? 1 : -1));
    });
  });

  /* ---------- галерея товара ---------- */
  $$('[data-gallery]').forEach(function (g) {
    var main = $('.pp__img img', g);
    $$('.pp__thumbs button', g).forEach(function (b) {
      b.addEventListener('click', function () {
        main.src = b.getAttribute('data-src');
        $$('.pp__thumbs button', g).forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      });
    });
  });

  /* ---------- фильтр списка изделий ---------- */
  $$('[data-plist]').forEach(function (box) {
    var rows = $$('.prow', box), input = $('[data-pfind]', box), chips = $$('.chip', box), count = $('[data-pcount]', box), empty = $('.empty', box);
    var series = 'all';
    function norm(s) { return s.toLowerCase().replace(/ё/g, 'е').replace(/[\s.,\-–()]/g, ''); }
    function apply() {
      var q = norm(input ? input.value : ''), n = 0;
      rows.forEach(function (r) {
        var ok = (series === 'all' || r.getAttribute('data-series') === series) && (!q || norm(r.getAttribute('data-name')).indexOf(q) > -1);
        r.hidden = !ok; if (ok) n++;
      });
      if (count) count.textContent = n + ' ' + plural(n, ['позиция', 'позиции', 'позиций']);
      if (empty) empty.hidden = n > 0;
    }
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        series = c.getAttribute('data-series');
        chips.forEach(function (x) { x.setAttribute('aria-pressed', x === c); });
        apply();
      });
    });
    var sel = $('[data-psel]', box);
    if (sel) sel.addEventListener('change', function () { series = sel.value; apply(); });
    if (input) input.addEventListener('input', apply);
    apply();
  });
  function plural(n, f) { var a = n % 10, b = n % 100; return f[a === 1 && b !== 11 ? 0 : a >= 2 && a <= 4 && (b < 10 || b >= 20) ? 1 : 2]; }

  /* ---------- поиск по сайту ---------- */
  var sm = $('#search'), si = sm && $('input', sm), sr = sm && $('.search__res', sm), index = null, sel = -1;
  function loadIndex(cb) {
    if (index) return cb();
    fetch(BASE + 'search.json').then(function (r) { return r.json(); }).then(function (d) { index = d; cb(); }).catch(function () { index = []; cb(); });
  }
  function nrm(s) { return s.toLowerCase().replace(/ё/g, 'е').replace(/[\s.,\-–()«»"]/g, ''); }
  function doSearch() {
    var q = si.value.trim();
    if (q.length < 2) { sr.innerHTML = '<p class="search__hint">Начните вводить марку или название: ФСА, ТСС, опора, бетон B25…</p>'; return; }
    var nq = nrm(q), words = q.toLowerCase().replace(/ё/g, 'е').split(/\s+/).filter(Boolean);
    var res = index.filter(function (it) {
      var t = it.t.toLowerCase().replace(/ё/g, 'е');
      return nrm(it.t).indexOf(nq) > -1 || words.every(function (w) { return t.indexOf(w) > -1; });
    }).slice(0, 40);
    sel = -1;
    sr.innerHTML = res.length ? res.map(function (it) {
      return '<a href="' + BASE + it.u.replace(/^\//, '') + '"><span>' + esc(it.t) + '</span><small>' + esc(it.k) + (it.p ? ' · ' + fmt(it.p) + ' ₽' : '') + '</small></a>';
    }).join('') : '<p class="search__hint">Ничего не нашли. Позвоните: <a class="blue" href="tel:+78137274236">+7 (813) 727-42-36</a> — подберём изделие.</p>';
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-search-open]') && sm) { e.preventDefault(); setMenu(false); openModal(sm); loadIndex(doSearch); }
  });
  if (si) {
    si.addEventListener('input', function () { loadIndex(doSearch); });
    si.addEventListener('keydown', function (e) {
      var links = $$('a', sr); if (!links.length) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length;
        links.forEach(function (a, k) { a.classList.toggle('on', k === sel); }); links[sel].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') { e.preventDefault(); (links[sel] || links[0]).click(); }
    });
  }
  addEventListener('keydown', function (e) {
    if ((e.key === '/' || (e.key === 'k' && (e.ctrlKey || e.metaKey))) && sm && !/input|textarea/i.test(document.activeElement.tagName)) {
      e.preventDefault(); openModal(sm); loadIndex(doSearch);
    }
  });

  /* ---------- появление блоков на внутренних страницах ---------- */
  if (!document.body.hasAttribute('data-home')) {
    var els = $$('.rv');
    if ('IntersectionObserver' in window && !reduce) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
      }, { rootMargin: '0px 0px -6% 0px', threshold: .08 });
      els.forEach(function (el) { io.observe(el); });
    } else els.forEach(function (el) { el.classList.add('in'); });
  }
  var yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();
})();

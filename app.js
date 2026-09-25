(() => {
  'use strict';

  const PRICE = 2;
  const KEY = 'macarons.sales.v1';
  const SETTINGS_KEY = 'macarons.settings.v1';
  const MAX_PER_FLAVOR = 99;
  const METHODS = { cash: 'Cash', venmo: 'Venmo' };
  const VERSION = 4; // keep in step with CACHE in sw.js

  const FLAVORS = [
    { key: 'vanilla',   name: 'Vanilla',   fr: 'Vanille',   color: '#F1DDA8', cream: '#FFFDF5' },
    { key: 'chocolate', name: 'Chocolate', fr: 'Chocolat',  color: '#7B4A3A', cream: '#B98468' },
    { key: 'lemon',     name: 'Lemon',     fr: 'Citron',    color: '#F7DC3E', cream: '#FFF6B8' },
    { key: 'raspberry', name: 'Raspberry', fr: 'Framboise', color: '#E8557A', cream: '#FFC2D2' },
    { key: 'caramel',   name: 'Caramel',   fr: 'Caramel',   color: '#C98A4B', cream: '#F2D0A0' },
  ];
  const BY_KEY = Object.fromEntries(FLAVORS.map(f => [f.key, f]));

  // ---------- state ----------
  let storageOk = true;
  let sales = load();
  let settings = loadSettings();
  let cart = emptyCart();
  let tab = 'sell';
  let toastTimer = null;

  function emptyCart() {
    return Object.fromEntries(FLAVORS.map(f => [f.key, 0]));
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      storageOk = false;
      return [];
    }
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(sales));
      storageOk = true;
    } catch (e) {
      storageOk = false;
    }
    document.getElementById('storage-warning').hidden = storageOk;
  }

  // The Venmo handle lives only in this device's storage, never in the (public) source.
  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      return s && typeof s === 'object' ? s : {};
    } catch (e) {
      return {};
    }
  }

  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
  }

  // ---------- derived values ----------
  const money = n => '$' + (Number.isInteger(n) ? n : n.toFixed(2));
  const countOf = items => FLAVORS.reduce((s, f) => s + (items[f.key] || 0), 0);
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  function totals() {
    const byFlavor = Object.fromEntries(FLAVORS.map(f => [f.key, 0]));
    for (const s of sales) {
      for (const f of FLAVORS) byFlavor[f.key] += s.items[f.key] || 0;
    }
    const qty = FLAVORS.reduce((n, f) => n + byFlavor[f.key], 0);
    // sales saved without a method (or with an unknown one) count as cash
    const byMethod = { cash: 0, venmo: 0 };
    for (const s of sales) byMethod[s.method === 'venmo' ? 'venmo' : 'cash'] += countOf(s.items) * PRICE;
    return { byFlavor, byMethod, qty, dollars: qty * PRICE };
  }

  // ---------- macaron art ----------
  function macaron(f) {
    return `<svg viewBox="0 0 100 72" role="img" aria-label="${f.name} macaron">
      <ellipse cx="50" cy="68" rx="34" ry="3" fill="rgba(0,0,0,.08)"/>
      <path d="M11 47 C11 18 30 12 50 12 C70 12 89 18 89 47 Z" fill="${f.color}" stroke="rgba(0,0,0,.16)" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M17 41 C19 26 30 20 42 19" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="4" stroke-linecap="round"/>
      <rect x="8" y="45" width="84" height="11" rx="5.5" fill="${f.cream}" stroke="rgba(0,0,0,.14)" stroke-width="1.5"/>
      <path d="M11 54 C11 66 30 66 50 66 C70 66 89 66 89 54 Z" fill="${f.color}" stroke="rgba(0,0,0,.16)" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M13 47 h74" stroke="rgba(0,0,0,.10)" stroke-width="1.5" stroke-dasharray="1.5 4" stroke-linecap="round"/>
    </svg>`;
  }

  // ---------- views ----------
  function renderSell() {
    const n = countOf(cart);
    const dollars = n * PRICE;
    const last = sales[sales.length - 1];

    const cards = FLAVORS.map(f => {
      const c = cart[f.key];
      return `<div class="card${c ? ' has' : ''}" style="--c:${f.color}">
        <div class="art">${macaron(f)}</div>
        <div class="info"><div class="name">${f.name}</div><div class="fr">${f.fr}</div></div>
        <div class="stepper">
          <button data-act="dec" data-k="${f.key}" aria-label="Remove one ${f.name}" ${c ? '' : 'disabled'}>&minus;</button>
          <output aria-label="${f.name} count">${c}</output>
          <button data-act="inc" data-k="${f.key}" aria-label="Add one ${f.name}" ${c >= MAX_PER_FLAVOR ? 'disabled' : ''}>+</button>
        </div>
      </div>`;
    }).join('');

    const undoLabel = last
      ? `Undo last sale (${money(countOf(last.items) * PRICE)})`
      : 'Undo last sale';

    document.getElementById('view-sell').innerHTML = `
      <div class="cards">${cards}</div>
      <div class="sell-footer">
        <div class="summary">
          <span class="count">${n ? plural(n, 'macaron') : 'Tap + to add macarons'}</span>
          <span class="total">${money(dollars)}</span>
        </div>
        <div class="pay-row">
          <button class="btn-primary cash" data-act="pay-cash" ${n ? '' : 'disabled'}>Cash${n ? ' ' + money(dollars) : ''}</button>
          <button class="btn-primary venmo" data-act="pay-venmo" ${n ? '' : 'disabled'}>Venmo${n ? ' ' + money(dollars) : ''}</button>
        </div>
        <div class="link-row">
          <button class="link-btn" data-act="undo-last" ${last ? '' : 'disabled'}>${undoLabel}</button>
          <button class="link-btn" data-act="clear-cart" ${n ? '' : 'disabled'}>Clear</button>
        </div>
      </div>`;
  }

  function renderTotals() {
    const t = totals();
    const rows = FLAVORS.map(f => {
      const q = t.byFlavor[f.key];
      return `<div class="trow${q ? '' : ' zero'}" style="--c:${f.color}">
        <div class="art">${macaron(f)}</div>
        <div class="name">${f.name}</div>
        <div class="qty"><b>${q}</b><small>sold</small></div>
        <div class="amt"><b>${money(q * PRICE)}</b><small>sales</small></div>
      </div>`;
    }).join('');

    document.getElementById('view-totals').innerHTML = `
      <div class="grand">
        <div class="label">Total sales</div>
        <div class="money">${money(t.dollars)}</div>
        <div class="sub">${plural(t.qty, 'macaron')} &middot; ${plural(sales.length, 'sale')}</div>
      </div>
      <div class="methods">
        <div class="mtile cash"><small>Cash</small><b>${money(t.byMethod.cash)}</b></div>
        <div class="mtile venmo"><small>Venmo</small><b>${money(t.byMethod.venmo)}</b></div>
      </div>
      <div class="section-title">By flavor</div>
      ${rows}`;
  }

  function renderHistory() {
    const el = document.getElementById('view-history');
    if (!sales.length) {
      el.innerHTML = `<div class="empty">
        <div class="art">${macaron(BY_KEY.raspberry)}</div>
        <div>No sales yet.<br>Your first macaron is waiting!</div>
      </div>`;
      return;
    }
    const rows = sales.slice().reverse().map(s => {
      const n = countOf(s.items);
      const chips = FLAVORS.filter(f => s.items[f.key]).map(f =>
        `<span class="chip" style="--c:${f.color}"><i></i>${s.items[f.key]} &times; ${f.name}</span>`).join('');
      const time = new Date(s.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return `<div class="hrow">
        <div class="time">${time}<span>${plural(n, 'macaron')}</span> <em class="badge ${s.method === 'venmo' ? 'venmo' : 'cash'}">${s.method === 'venmo' ? METHODS.venmo : METHODS.cash}</em></div>
        <div class="amt">${money(n * PRICE)}</div>
        <div class="chips">${chips}</div>
        <button class="del" data-act="ask-del" data-id="${s.id}">Remove</button>
      </div>`;
    }).join('');
    el.innerHTML = `<div class="section-title">Today&rsquo;s sales</div>${rows}`;
  }

  function renderSettings(notice) {
    const t = totals();
    document.getElementById('view-settings').innerHTML = `
      <div class="section-title">Settings</div>
      ${notice ? `<div class="notice">${notice}</div>` : ''}
      <div class="info-card">
        <div><small>Sales recorded</small><b>${plural(sales.length, 'sale')} &middot; ${money(t.dollars)}</b></div>
        <div><small>Venmo username</small><b>${settings.venmo ? '@' + settings.venmo : 'Not set'}</b></div>
      </div>
      <div class="danger-zone">
        <h3>Reset everything</h3>
        <p>Deletes every sale and your saved Venmo username from this phone. This can&rsquo;t be undone.</p>
        <button class="reset-btn" data-act="ask-reset">Reset&hellip;</button>
      </div>
      <p class="version">Les Macarons &middot; version ${VERSION}</p>`;
  }

  function renderAll() {
    renderSell();
    renderTotals();
    renderHistory();
    renderSettings();
  }

  function showTab(name) {
    tab = name;
    for (const t of ['sell', 'totals', 'history', 'settings']) {
      document.getElementById('view-' + t).hidden = t !== name;
    }
    document.querySelectorAll('.tab').forEach(b => {
      const on = b.dataset.tab === name;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (name === 'settings') renderSettings();
    document.querySelector('main').scrollTop = 0;
  }

  // ---------- actions ----------
  function completeSale(method) {
    if (!countOf(cart)) return;
    const sale = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ts: Date.now(),
      method,
      items: { ...cart },
    };
    sales.push(sale);
    save();
    const n = countOf(sale.items);
    cart = emptyCart();
    renderAll();
    confetti(sale);
    toast(`Sale recorded &middot; ${plural(n, 'macaron')} &middot; ${money(n * PRICE)} &middot; ${METHODS[method]}`, sale.id);
  }

  function removeSale(id) {
    const i = sales.findIndex(s => s.id === id);
    if (i === -1) return false;
    sales.splice(i, 1);
    save();
    renderAll();
    return true;
  }

  function toast(html, undoId) {
    const el = document.getElementById('toast');
    clearTimeout(toastTimer);
    el.innerHTML = `<span>${html}</span><button data-act="toast-undo" data-id="${undoId}">Undo</button>`;
    el.hidden = false;
    toastTimer = setTimeout(hideToast, 6000);
  }

  function hideToast() {
    clearTimeout(toastTimer);
    document.getElementById('toast').hidden = true;
  }

  function askDelete(id) {
    const s = sales.find(x => x.id === id);
    if (!s) return;
    const n = countOf(s.items);
    const time = new Date(s.ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const sheet = document.getElementById('sheet');
    sheet.innerHTML = `<div class="panel" role="dialog" aria-modal="true" aria-label="Remove sale">
      <h2>Remove this sale?</h2>
      <p>${time} &middot; ${plural(n, 'macaron')} &middot; ${money(n * PRICE)}. The totals will be updated.</p>
      <div class="actions">
        <button class="danger" data-act="confirm-del" data-id="${id}">Remove sale</button>
        <button class="keep" data-act="close-sheet">Keep it</button>
      </div>
    </div>`;
    sheet.hidden = false;
  }

  function closeSheet() {
    document.getElementById('sheet').hidden = true;
  }

  function askReset() {
    const t = totals();
    const sheet = document.getElementById('sheet');
    sheet.innerHTML = `<div class="panel" role="alertdialog" aria-modal="true" aria-label="Reset everything">
      <h2>Reset everything?</h2>
      <p>This permanently deletes <b>${plural(sales.length, 'sale')}</b> (${money(t.dollars)})${settings.venmo ? ` and your Venmo username <b>@${settings.venmo}</b>` : ''} from this phone. It can&rsquo;t be undone.</p>
      <div class="actions">
        <button class="danger" data-act="confirm-reset">Yes, reset everything</button>
        <button class="keep" data-act="close-sheet">Keep my data</button>
      </div>
    </div>`;
    sheet.hidden = false;
  }

  function resetAll() {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(SETTINGS_KEY);
    } catch (e) { /* storage unavailable: in-memory state is still cleared below */ }
    sales = [];
    settings = {};
    cart = emptyCart();
    hideToast();
    closeSheet();
    renderAll();
    renderSettings('Everything was reset. Sales and Venmo username are cleared.');
  }

  // Letters, digits, - and _ only; also makes the handle safe to drop into HTML and URLs.
  const cleanHandle = s => String(s || '').trim().replace(/^@/, '').replace(/[^A-Za-z0-9_-]/g, '');

  function venmoLink(dollars) {
    const q = `txn=pay&audience=private&amount=${dollars}&note=${encodeURIComponent('Macarons \u{1F36A}')}`;
    return `https://venmo.com/${encodeURIComponent(settings.venmo)}?${q}`;
  }

  function qrSvg(text) {
    try {
      const qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      return qr.createSvgTag({ cellSize: 4, margin: 16, scalable: true });
    } catch (e) {
      return '';
    }
  }

  function askVenmoHandle() {
    const sheet = document.getElementById('sheet');
    sheet.innerHTML = `<form class="panel" data-form="venmo-setup" autocomplete="off">
      <h2>Your Venmo username</h2>
      <p>Enter it once. It&rsquo;s saved only on this phone and used to make your QR code.</p>
      <div class="handle"><span>@</span><input name="handle" value="${settings.venmo || ''}" placeholder="username" autocapitalize="none" autocorrect="off" spellcheck="false" enterkeyhint="done"></div>
      <div class="actions">
        <button class="ok" type="submit">Save</button>
        <button class="keep" type="button" data-act="close-sheet">Cancel</button>
      </div>
    </form>`;
    sheet.hidden = false;
    sheet.querySelector('input').focus();
  }

  function showVenmo() {
    const n = countOf(cart);
    if (!n) return;
    if (!settings.venmo) { askVenmoHandle(); return; }
    const dollars = n * PRICE;
    const svg = qrSvg(venmoLink(dollars));
    const sheet = document.getElementById('sheet');
    sheet.innerHTML = `<div class="panel venmo" role="dialog" aria-modal="true" aria-label="Pay with Venmo">
      <div class="due-label">Pay with Venmo</div>
      <div class="due">${money(dollars)}</div>
      <div class="qr">${svg || '<p>Couldn&rsquo;t draw the QR code.</p>'}</div>
      <p class="who">@${settings.venmo} &middot; scan with the camera</p>
      <div class="actions">
        <button class="ok" data-act="venmo-paid">Payment received</button>
        <button class="keep" data-act="close-sheet">Cancel</button>
      </div>
      <button class="link-btn" data-act="edit-venmo">Change Venmo username</button>
    </div>`;
    sheet.hidden = false;
  }

  function confetti(sale) {
    const layer = document.getElementById('confetti');
    const used = FLAVORS.filter(f => sale.items[f.key]);
    const pool = used.length ? used : FLAVORS;
    const count = Math.min(6 + countOf(sale.items) * 2, 16);
    let html = '';
    for (let i = 0; i < count; i++) {
      const f = pool[i % pool.length];
      const dx = Math.round((Math.random() - 0.5) * 320);
      const dy = -Math.round(140 + Math.random() * 260);
      const rot = Math.round((Math.random() - 0.5) * 540);
      html += macaron(f).replace('<svg ', `<svg style="--dx:${dx}px;--dy:${dy}px;--rot:${rot}deg;animation-delay:${i * 22}ms" `);
    }
    layer.innerHTML = html;
    setTimeout(() => { layer.innerHTML = ''; }, 1600);
  }

  // ---------- events ----------
  document.addEventListener('click', e => {
    const tabBtn = e.target.closest('.tab');
    if (tabBtn) { showTab(tabBtn.dataset.tab); return; }

    const btn = e.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    const { act, k, id } = btn.dataset;

    switch (act) {
      case 'inc':
        if (cart[k] < MAX_PER_FLAVOR) cart[k]++;
        renderSell();
        break;
      case 'dec':
        if (cart[k] > 0) cart[k]--;
        renderSell();
        break;
      case 'clear-cart':
        cart = emptyCart();
        renderSell();
        break;
      case 'pay-cash':
        completeSale('cash');
        break;
      case 'pay-venmo':
        showVenmo();
        break;
      case 'venmo-paid':
        closeSheet();
        completeSale('venmo');
        break;
      case 'edit-venmo':
        askVenmoHandle();
        break;
      case 'undo-last':
        if (sales.length) removeSale(sales[sales.length - 1].id);
        hideToast();
        break;
      case 'toast-undo':
        removeSale(id);
        hideToast();
        break;
      case 'ask-del':
        askDelete(id);
        break;
      case 'ask-reset':
        askReset();
        break;
      case 'confirm-reset':
        resetAll();
        break;
      case 'confirm-del':
        removeSale(id);
        closeSheet();
        break;
      case 'close-sheet':
        closeSheet();
        break;
    }
  });

  document.getElementById('sheet').addEventListener('submit', e => {
    e.preventDefault();
    if (e.target.dataset.form !== 'venmo-setup') return;
    const handle = cleanHandle(e.target.elements.handle.value);
    if (!handle) { e.target.elements.handle.focus(); return; }
    settings.venmo = handle;
    saveSettings();
    showVenmo();
  });

  // tapping the dimmed backdrop dismisses the sheet without recording or deleting anything
  document.getElementById('sheet').addEventListener('click', e => {
    if (e.target.id === 'sheet') closeSheet();
  });

  // ---------- boot ----------
  document.getElementById('price-label').textContent = money(PRICE);
  document.getElementById('storage-warning').hidden = storageOk;
  renderAll();
  showTab(tab);

  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(() => {});
  }
  // Updates: a new service worker installs in the background and takes over. Reload into it as soon as
  // nothing is in progress (empty cart, no sheet open) so a sale is never interrupted.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    const hadController = !!navigator.serviceWorker.controller;
    let updateReady = false;
    let reg = null;

    navigator.serviceWorker.register('sw.js').then(r => { reg = r; }).catch(() => {});

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) updateReady = true; // first-ever install also fires this; no reload needed then
    });

    const reloadIfIdle = () => {
      if (updateReady && !countOf(cart) && document.getElementById('sheet').hidden) location.reload();
    };
    setInterval(reloadIfIdle, 3000);

    // iOS keeps the app alive in the background; check for a new version whenever it comes back
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && reg) reg.update().catch(() => {});
    });
  }
})();

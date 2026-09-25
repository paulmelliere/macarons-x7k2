(() => {
  'use strict';

  const PRICE = 2;
  const KEY = 'macarons.sales.v1';
  const MAX_PER_FLAVOR = 99;

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
    return { byFlavor, qty, dollars: qty * PRICE };
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
        <button class="btn-primary" data-act="complete" ${n ? '' : 'disabled'}>Complete Sale</button>
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
        <div class="time">${time}<span>${plural(n, 'macaron')}</span></div>
        <div class="amt">${money(n * PRICE)}</div>
        <div class="chips">${chips}</div>
        <button class="del" data-act="ask-del" data-id="${s.id}">Remove</button>
      </div>`;
    }).join('');
    el.innerHTML = `<div class="section-title">Today&rsquo;s sales</div>${rows}`;
  }

  function renderAll() {
    renderSell();
    renderTotals();
    renderHistory();
  }

  function showTab(name) {
    tab = name;
    for (const t of ['sell', 'totals', 'history']) {
      document.getElementById('view-' + t).hidden = t !== name;
    }
    document.querySelectorAll('.tab').forEach(b => {
      const on = b.dataset.tab === name;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    document.querySelector('main').scrollTop = 0;
  }

  // ---------- actions ----------
  function completeSale() {
    if (!countOf(cart)) return;
    const sale = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ts: Date.now(),
      items: { ...cart },
    };
    sales.push(sale);
    save();
    const n = countOf(sale.items);
    cart = emptyCart();
    renderAll();
    confetti(sale);
    toast(`Sale recorded &middot; ${plural(n, 'macaron')} &middot; ${money(n * PRICE)}`, sale.id);
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
      case 'complete':
        completeSale();
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
      case 'confirm-del':
        removeSale(id);
        closeSheet();
        break;
      case 'close-sheet':
        closeSheet();
        break;
    }
  });

  // tapping the dimmed backdrop dismisses the confirm sheet without deleting
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
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();

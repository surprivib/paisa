/* Paisa — main app logic */
(function () {
  const DB = window.PaisaDB;
  const Charts = window.PaisaCharts;

  // ---------- Utilities ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const fmtINR = (n) => {
    const neg = n < 0;
    const abs = Math.abs(Math.round(Number(n) || 0));
    const s = new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR',
      maximumFractionDigits: 0
    }).format(abs);
    return (neg ? '-' : '') + s;
  };
  const fmtINRDecimal = (n) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency', currency: 'INR',
      maximumFractionDigits: 2
    }).format(Number(n) || 0);
  };

  const todayISO = () => {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  };
  const monthKey = (iso) => iso ? iso.slice(0, 7) : currentMonthKey();
  const currentMonthKey = () => todayISO().slice(0, 7);

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December'];
  const monthLabel = (mk) => {
    if (!mk) return '';
    const [y, m] = mk.split('-').map(Number);
    return MONTHS[m - 1] + ' ' + y;
  };
  const monthShort = (mk) => {
    const [y, m] = mk.split('-').map(Number);
    return MONTHS[m - 1].slice(0, 3);
  };
  const prevMonth = (mk) => {
    let [y, m] = mk.split('-').map(Number);
    m -= 1; if (m < 1) { m = 12; y -= 1; }
    return y + '-' + String(m).padStart(2, '0');
  };
  const nextMonth = (mk) => {
    let [y, m] = mk.split('-').map(Number);
    m += 1; if (m > 12) { m = 1; y += 1; }
    return y + '-' + String(m).padStart(2, '0');
  };

  const formatDateNice = (iso) => {
    if (!iso) return '';
    const d = new Date(iso + 'T00:00');
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yest = new Date(today); yest.setDate(today.getDate() - 1);
    const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    if (sameDay(d, today)) return 'Today';
    if (sameDay(d, yest)) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const view = $('#view');
  const screenTitle = $('#screen-title');

  // ---------- Toast ----------
  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  // ---------- Theme ----------
  async function initTheme() {
    let theme = await DB.getSetting('theme');
    if (!theme) theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    setTheme(theme);
  }
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    DB.setSetting('theme', t);
  }
  $('#theme-toggle').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    setTheme(cur === 'dark' ? 'light' : 'dark');
    if (state.route === 'charts') renderCharts();
  });

  // ---------- Sheet (bottom modal) ----------
  function openSheet(title, contentNode, opts = {}) {
    closeSheet();
    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';
    const sheet = document.createElement('div');
    sheet.className = 'sheet';
    sheet.innerHTML = `<div class="sheet-handle"></div><div class="sheet-title">${title}</div>`;
    sheet.appendChild(contentNode);
    document.body.append(backdrop, sheet);
    requestAnimationFrame(() => {
      backdrop.classList.add('open');
      sheet.classList.add('open');
    });
    backdrop.addEventListener('click', closeSheet);
    state.activeSheet = { backdrop, sheet };
    return { close: closeSheet };
  }
  function closeSheet() {
    if (!state.activeSheet) return;
    const { backdrop, sheet } = state.activeSheet;
    backdrop.classList.remove('open');
    sheet.classList.remove('open');
    setTimeout(() => { backdrop.remove(); sheet.remove(); }, 250);
    state.activeSheet = null;
  }

  // ---------- App state ----------
  const state = {
    route: 'home',
    monthCursor: currentMonthKey(),
    historyFilter: { type: 'all', category: 'all', month: currentMonthKey() },
    activeSheet: null
  };

  // ---------- Router ----------
  function parseHash() {
    const h = location.hash.replace(/^#/, '') || 'home';
    const [route, qs] = h.split('?');
    const params = {};
    if (qs) qs.split('&').forEach(p => {
      const [k, v] = p.split('='); params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    return { route, params };
  }

  function navigate(route, params = {}) {
    const qs = Object.entries(params).map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v)).join('&');
    location.hash = '#' + route + (qs ? '?' + qs : '');
  }

  async function render() {
    const { route, params } = parseHash();
    state.route = route;
    closeSheet();
    $$('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.route === route));
    window.scrollTo({ top: 0, behavior: 'instant' });

    switch (route) {
      case 'home': screenTitle.textContent = 'Paisa'; return renderHome();
      case 'add': screenTitle.textContent = 'New Entry'; return renderAdd(params);
      case 'history': screenTitle.textContent = 'History'; return renderHistory();
      case 'charts': screenTitle.textContent = 'Charts'; return renderCharts();
      case 'more': screenTitle.textContent = 'More'; return renderMore();
      case 'budget': screenTitle.textContent = 'Budget'; return renderBudgetPage();
      case 'recurring': screenTitle.textContent = 'EMI & Recurring'; return renderRecurringPage();
      case 'categories': screenTitle.textContent = 'Categories'; return renderCategoriesPage();
      default: navigate('home'); return;
    }
  }

  window.addEventListener('hashchange', render);
  $$('.nav-item').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.route)));

  // ---------- HOME ----------
  async function renderHome() {
    const mk = currentMonthKey();
    const [txns, budget, recurring, allCats] = await Promise.all([
      DB.getTransactionsByMonth(mk),
      DB.getBudget(mk),
      DB.getRecurring(),
      DB.getCategories()
    ]);
    const catMap = mapCategories(allCats);
    const income = sum(txns.filter(t => t.type === 'income').map(t => t.amount));
    const expense = sum(txns.filter(t => t.type === 'expense').map(t => t.amount));
    const balance = income - expense;
    const budgetAmt = budget ? budget.amount : 0;
    const budgetPct = budgetAmt > 0 ? Math.min(100, (expense / budgetAmt) * 100) : 0;
    const budgetClass = budgetPct >= 100 ? 'danger' : budgetPct >= 80 ? 'warn' : '';

    const recent = (await DB.getTransactions())
      .sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt))
      .slice(0, 6);

    const upcomingDues = computeUpcomingDues(recurring);

    view.innerHTML = `
      <section class="hero">
        <div class="hero-label">${monthLabel(mk)} balance</div>
        <div class="hero-amount">${fmtINR(balance)}</div>
        <div class="hero-row">
          <div class="hero-stat">
            <div class="l">↓ Income</div>
            <div class="v">${fmtINR(income)}</div>
          </div>
          <div class="hero-stat">
            <div class="l">↑ Expense</div>
            <div class="v">${fmtINR(expense)}</div>
          </div>
        </div>
      </section>

      ${budgetAmt > 0 ? `
        <div class="section-title"><span>Budget</span><a href="#budget">Edit</a></div>
        <div class="card">
          <div class="budget-row">
            <div class="budget-name">This month's spending</div>
            <div class="budget-amt">${fmtINR(expense)} / ${fmtINR(budgetAmt)}</div>
          </div>
          <div class="progress ${budgetClass}"><span style="width:${budgetPct}%"></span></div>
          <div class="budget-meta">
            <span>${Math.round(budgetPct)}% used</span>
            <span>${budgetPct >= 100 ? 'Limit exceeded 🚨' : 'Left: ' + fmtINR(Math.max(0, budgetAmt - expense))}</span>
          </div>
        </div>
      ` : `
        <div class="section-title"><span>Budget</span></div>
        <div class="card">
          <div class="budget-name">No budget set yet</div>
          <div class="budget-meta"><span>Set a monthly spending limit to keep yourself on track.</span></div>
          <div class="budget-cta">
            <button class="btn btn-primary btn-block" id="set-budget-cta">Set Budget</button>
          </div>
        </div>
      `}

      ${upcomingDues.length ? `
        <div class="section-title"><span>Upcoming Dues</span><a href="#recurring">All</a></div>
        <div class="card" style="padding:0">
          ${upcomingDues.slice(0, 4).map(d => recurringRow(d, catMap)).join('')}
        </div>
      ` : ''}

      <div class="section-title">
        <span>Recent</span>
        <a href="#history">See all</a>
      </div>
      ${recent.length ? `
        <div class="txn-list">
          ${recent.map(t => txnRow(t, catMap)).join('')}
        </div>
      ` : emptyState('🪙', 'No entries yet', 'Tap the + button below to add your first entry.')}
    `;

    const setBudgetCta = $('#set-budget-cta');
    if (setBudgetCta) setBudgetCta.addEventListener('click', () => navigate('budget'));
    bindTxnRowClicks();
  }

  function recurringRow(r, catMap) {
    const cat = catMap[r.category] || { icon: '📌', name: r.category };
    const dueClass = r.daysUntil < 0 ? 'overdue' : r.daysUntil <= 3 ? 'due' : 'upcoming';
    const dueText = r.daysUntil < 0 ? `${Math.abs(r.daysUntil)}d late`
      : r.daysUntil === 0 ? 'Due today'
        : `In ${r.daysUntil}d`;
    return `
      <div class="recurring-item" data-rec="${r.id}">
        <div class="txn-icon">${cat.icon}</div>
        <div class="txn-main">
          <div class="txn-cat">${escapeHtml(r.name)}</div>
          <div class="txn-note">${cat.name} • Every ${ordinal(r.dayOfMonth)}</div>
        </div>
        <div class="txn-meta">
          <div class="txn-amt expense">${fmtINR(r.amount)}</div>
          <div class="due ${dueClass}">${dueText}</div>
        </div>
      </div>
    `;
  }

  function ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function computeUpcomingDues(recurring) {
    const today = new Date();
    const tDay = today.getDate();
    const tMonth = currentMonthKey();
    const out = [];
    for (const r of recurring) {
      if (!r.active) continue;
      const paidThisMonth = r.lastPaidMonth === tMonth;
      const dueDay = Math.min(r.dayOfMonth, daysInMonth(today.getFullYear(), today.getMonth() + 1));
      let daysUntil = dueDay - tDay;
      if (paidThisMonth) {
        const next = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const nextDueDay = Math.min(r.dayOfMonth, daysInMonth(next.getFullYear(), next.getMonth() + 1));
        const nextDate = new Date(next.getFullYear(), next.getMonth(), nextDueDay);
        daysUntil = Math.ceil((nextDate - today) / 86400000);
      }
      out.push({ ...r, daysUntil });
    }
    return out.sort((a, b) => a.daysUntil - b.daysUntil);
  }

  function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }

  // ---------- ADD ----------
  async function renderAdd(params) {
    const cats = await DB.getCategories();
    const initialType = params.type === 'income' ? 'income' : 'expense';
    const editId = params.edit;
    let editing = null;
    if (editId) {
      const all = await DB.getTransactions();
      editing = all.find(t => t.id === editId);
    }

    const cur = editing || { type: initialType, amount: '', category: '', date: todayISO(), note: '' };

    view.innerHTML = `
      <div class="segmented" id="type-seg">
        <button data-t="expense" class="${cur.type === 'expense' ? 'active expense' : ''}">↑ Expense</button>
        <button data-t="income" class="${cur.type === 'income' ? 'active income' : ''}">↓ Income</button>
      </div>

      <div class="card mt-16">
        <input type="text" inputmode="decimal" placeholder="₹0" class="amount-input" id="amt" value="${cur.amount || ''}" />
      </div>

      <div class="section-title"><span>Category</span><a href="#categories">Manage</a></div>
      <div id="cat-grid" class="cat-grid"></div>

      <div class="form-stack mt-16">
        <div class="field">
          <label>Date</label>
          <input type="date" class="input" id="date" value="${cur.date}" />
        </div>
        <div class="field">
          <label>Note (optional)</label>
          <input type="text" class="input" id="note" placeholder="What was it for?" value="${escapeAttr(cur.note || '')}" />
        </div>
      </div>

      <div class="mt-16 ${editing ? 'btn-row' : ''}">
        ${editing ? `<button class="btn btn-danger" id="del-btn">Delete</button>` : ''}
        <button class="btn btn-primary btn-block" id="save-btn">${editing ? 'Update' : 'Save'}</button>
      </div>
    `;

    let chosen = { type: cur.type, category: cur.category };

    function renderCats() {
      const filtered = cats.filter(c => c.type === chosen.type);
      const grid = $('#cat-grid');
      grid.innerHTML = filtered.map(c => `
        <button class="cat-chip ${chosen.category === c.id ? 'active' : ''}" data-id="${c.id}">
          <div class="ic">${c.icon}</div>
          <div class="nm">${escapeHtml(c.name)}</div>
        </button>
      `).join('');
      $$('.cat-chip', grid).forEach(btn => {
        btn.addEventListener('click', () => {
          chosen.category = btn.dataset.id;
          renderCats();
        });
      });
    }
    renderCats();

    $$('#type-seg button').forEach(b => b.addEventListener('click', () => {
      chosen.type = b.dataset.t;
      $$('#type-seg button').forEach(x => {
        x.classList.remove('active', 'income', 'expense');
      });
      b.classList.add('active', chosen.type);
      chosen.category = '';
      renderCats();
    }));

    $('#amt').addEventListener('input', (e) => {
      const v = e.target.value.replace(/[^\d.]/g, '');
      if (v !== e.target.value) e.target.value = v;
    });
    $('#amt').focus();

    $('#save-btn').addEventListener('click', async () => {
      const amount = parseFloat($('#amt').value);
      if (!amount || amount <= 0) { toast('Enter an amount'); return; }
      if (!chosen.category) { toast('Pick a category'); return; }
      const date = $('#date').value || todayISO();
      const note = $('#note').value.trim();
      await DB.addTransaction({
        id: editing ? editing.id : undefined,
        createdAt: editing ? editing.createdAt : undefined,
        type: chosen.type, amount, category: chosen.category, date, note
      });
      toast(editing ? 'Updated' : 'Saved ✓');
      navigate('home');
    });

    if (editing) {
      $('#del-btn').addEventListener('click', async () => {
        if (!confirm('Delete this entry?')) return;
        await DB.deleteTransaction(editing.id);
        toast('Deleted');
        navigate('history');
      });
    }
  }

  // ---------- HISTORY ----------
  async function renderHistory() {
    const f = state.historyFilter;
    const [allTxns, cats] = await Promise.all([DB.getTransactions(), DB.getCategories()]);
    const catMap = mapCategories(cats);

    const monthsSet = new Set(allTxns.map(t => t.monthKey).filter(Boolean));
    const months = Array.from(monthsSet).sort().reverse();
    if (!months.includes(f.month)) months.unshift(f.month);

    let filtered = allTxns;
    if (f.month !== 'all') filtered = filtered.filter(t => t.monthKey === f.month);
    if (f.type !== 'all') filtered = filtered.filter(t => t.type === f.type);
    if (f.category !== 'all') filtered = filtered.filter(t => t.category === f.category);
    filtered.sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));

    const income = sum(filtered.filter(t => t.type === 'income').map(t => t.amount));
    const expense = sum(filtered.filter(t => t.type === 'expense').map(t => t.amount));

    view.innerHTML = `
      <div class="month-switcher">
        <button id="prev-m" aria-label="Previous month">‹</button>
        <div class="label">${f.month === 'all' ? 'All months' : monthLabel(f.month)}</div>
        <button id="next-m" aria-label="Next month">›</button>
      </div>

      <div class="filter-bar">
        <button class="chip ${f.type === 'all' ? 'active' : ''}" data-type="all">All</button>
        <button class="chip ${f.type === 'income' ? 'active' : ''}" data-type="income">Income</button>
        <button class="chip ${f.type === 'expense' ? 'active' : ''}" data-type="expense">Expense</button>
        <button class="chip" id="cat-filter-btn">${
          f.category === 'all' ? 'Category ▾' :
          (catMap[f.category] ? catMap[f.category].icon + ' ' + catMap[f.category].name : 'Category ▾')
        }</button>
        ${f.category !== 'all' ? '<button class="chip" id="cat-clear">✕</button>' : ''}
      </div>

      <div class="card" style="display:flex;justify-content:space-around;text-align:center;">
        <div><div class="text-mute" style="font-size:11px">Income</div><div style="color:var(--income);font-weight:800">${fmtINR(income)}</div></div>
        <div><div class="text-mute" style="font-size:11px">Expense</div><div style="color:var(--expense);font-weight:800">${fmtINR(expense)}</div></div>
        <div><div class="text-mute" style="font-size:11px">Net</div><div style="font-weight:800">${fmtINR(income - expense)}</div></div>
      </div>

      <div class="section-title"><span>${filtered.length} ${filtered.length === 1 ? 'entry' : 'entries'}</span></div>
      ${filtered.length ? `
        <div class="txn-list">
          ${filtered.map(t => txnRow(t, catMap)).join('')}
        </div>
      ` : emptyState('🔍', 'No entries found', 'Change the filter or add a new entry.')}
    `;

    $('#prev-m').addEventListener('click', () => {
      f.month = f.month === 'all' ? currentMonthKey() : prevMonth(f.month);
      renderHistory();
    });
    $('#next-m').addEventListener('click', () => {
      f.month = f.month === 'all' ? currentMonthKey() : nextMonth(f.month);
      renderHistory();
    });

    $$('.chip[data-type]').forEach(b => b.addEventListener('click', () => {
      f.type = b.dataset.type;
      renderHistory();
    }));

    $('#cat-filter-btn').addEventListener('click', () => {
      openCategoryPicker(cats, f.category, (chosen) => {
        f.category = chosen;
        renderHistory();
      });
    });
    const cc = $('#cat-clear');
    if (cc) cc.addEventListener('click', () => { f.category = 'all'; renderHistory(); });

    bindTxnRowClicks();
  }

  function openCategoryPicker(cats, current, onPick) {
    const node = document.createElement('div');
    node.innerHTML = `
      <div class="cat-grid">
        <button class="cat-chip ${current === 'all' ? 'active' : ''}" data-id="all">
          <div class="ic">📋</div><div class="nm">All</div>
        </button>
        ${cats.map(c => `
          <button class="cat-chip ${current === c.id ? 'active' : ''}" data-id="${c.id}">
            <div class="ic">${c.icon}</div><div class="nm">${escapeHtml(c.name)}</div>
          </button>
        `).join('')}
      </div>
    `;
    const sheet = openSheet('Choose Category', node);
    $$('.cat-chip', node).forEach(btn => btn.addEventListener('click', () => {
      onPick(btn.dataset.id);
      sheet.close();
    }));
  }

  // ---------- CHARTS ----------
  async function renderCharts() {
    const mk = state.monthCursor;
    const [allTxns, cats] = await Promise.all([DB.getTransactions(), DB.getCategories()]);
    const catMap = mapCategories(cats);

    const thisMonthTxns = allTxns.filter(t => t.monthKey === mk);
    const expensesByCat = {};
    thisMonthTxns.filter(t => t.type === 'expense').forEach(t => {
      expensesByCat[t.category] = (expensesByCat[t.category] || 0) + t.amount;
    });
    const donutItems = Object.entries(expensesByCat)
      .map(([cid, value], i) => {
        const c = catMap[cid] || { name: 'Unknown', icon: '?' };
        return { name: c.name, icon: c.icon, value, color: Charts.PALETTE[i % Charts.PALETTE.length] };
      })
      .sort((a, b) => b.value - a.value);

    const months = [];
    let m = currentMonthKey();
    for (let i = 0; i < 6; i++) { months.unshift(m); m = prevMonth(m); }
    const incomeSeries = months.map(mm => sum(allTxns.filter(t => t.monthKey === mm && t.type === 'income').map(t => t.amount)));
    const expenseSeries = months.map(mm => sum(allTxns.filter(t => t.monthKey === mm && t.type === 'expense').map(t => t.amount)));

    view.innerHTML = `
      <div class="month-switcher">
        <button id="prev-m" aria-label="Previous">‹</button>
        <div class="label">${monthLabel(mk)}</div>
        <button id="next-m" aria-label="Next">›</button>
      </div>

      <div class="section-title"><span>Spending by Category</span></div>
      <div class="card chart-card">
        <div class="chart-wrap"><canvas id="donut"></canvas></div>
        <div class="legend" id="donut-legend"></div>
      </div>

      <div class="section-title"><span>Last 6 Months</span></div>
      <div class="card chart-card">
        <div class="chart-wrap"><canvas id="bars"></canvas></div>
      </div>
    `;

    $('#prev-m').addEventListener('click', () => { state.monthCursor = prevMonth(state.monthCursor); renderCharts(); });
    $('#next-m').addEventListener('click', () => { state.monthCursor = nextMonth(state.monthCursor); renderCharts(); });

    const total = sum(donutItems.map(d => d.value));
    Charts.donut($('#donut'), donutItems, {
      centerLabel: 'Total Spent',
      centerValue: fmtINR(total),
      height: 260
    });

    $('#donut-legend').innerHTML = donutItems.length
      ? donutItems.map(d => `
        <div class="legend-row">
          <span class="legend-dot" style="background:${d.color}"></span>
          <span class="legend-name">${d.icon} ${escapeHtml(d.name)}</span>
          <span class="legend-val">${fmtINR(d.value)}</span>
        </div>
      `).join('')
      : `<div class="text-mute text-c">No spending this month.</div>`;

    Charts.barsGrouped($('#bars'),
      months.map(monthShort),
      incomeSeries, expenseSeries,
      { height: 240 }
    );
  }

  // ---------- MORE menu ----------
  async function renderMore() {
    view.innerHTML = `
      <div class="menu-list">
        <button class="menu-item" data-go="budget"><div class="ic">🎯</div><div class="nm">Budget</div><div class="arrow">›</div></button>
        <button class="menu-item" data-go="categories"><div class="ic">🏷️</div><div class="nm">Categories</div><div class="arrow">›</div></button>
        <button class="menu-item" data-go="recurring"><div class="ic">🔁</div><div class="nm">EMI & Recurring Bills</div><div class="arrow">›</div></button>
      </div>

      <div class="section-title"><span>Backup</span></div>
      <div class="menu-list">
        <button class="menu-item" id="export-json"><div class="ic">⬇️</div><div class="nm">Export (JSON Backup)</div><div class="arrow">›</div></button>
        <button class="menu-item" id="export-csv"><div class="ic">📊</div><div class="nm">Export (CSV for Excel)</div><div class="arrow">›</div></button>
        <button class="menu-item" id="import-btn"><div class="ic">⬆️</div><div class="nm">Import Backup</div><div class="arrow">›</div></button>
      </div>

      <div class="section-title"><span>Settings</span></div>
      <div class="menu-list">
        <button class="menu-item" id="install-btn"><div class="ic">📱</div><div class="nm">Install on Phone</div><div class="arrow">›</div></button>
        <button class="menu-item" id="wipe-btn"><div class="ic">🗑️</div><div class="nm" style="color:var(--expense)">Clear All Data</div><div class="arrow">›</div></button>
      </div>

      <div class="text-mute text-c mt-16" style="font-size:12px">
        Paisa v1 • Offline-first personal finance
      </div>

      <input type="file" id="import-file" accept="application/json,.json" class="hide" />
    `;

    $$('.menu-item[data-go]').forEach(b => b.addEventListener('click', () => navigate(b.dataset.go)));
    $('#export-json').addEventListener('click', exportJSON);
    $('#export-csv').addEventListener('click', exportCSV);
    $('#import-btn').addEventListener('click', () => $('#import-file').click());
    $('#import-file').addEventListener('change', importFromFile);
    $('#wipe-btn').addEventListener('click', async () => {
      if (!confirm('This will delete all your data. Are you sure?')) return;
      await DB.wipeAll();
      toast('All data cleared');
      navigate('home');
    });
    const installBtn = $('#install-btn');
    if (deferredInstall) {
      installBtn.addEventListener('click', async () => {
        deferredInstall.prompt();
        const choice = await deferredInstall.userChoice;
        if (choice.outcome === 'accepted') toast('Installed!');
        deferredInstall = null;
      });
    } else {
      installBtn.addEventListener('click', () => {
        toast('Use Chrome menu → "Add to Home screen"');
      });
    }
  }

  // ---------- BUDGET page ----------
  async function renderBudgetPage() {
    const mk = currentMonthKey();
    const [budget, txns] = await Promise.all([DB.getBudget(mk), DB.getTransactionsByMonth(mk)]);
    const expense = sum(txns.filter(t => t.type === 'expense').map(t => t.amount));
    const amt = budget ? budget.amount : 0;
    const pct = amt > 0 ? Math.min(100, (expense / amt) * 100) : 0;
    const cls = pct >= 100 ? 'danger' : pct >= 80 ? 'warn' : '';

    view.innerHTML = `
      <div class="card">
        <div class="budget-name">${monthLabel(mk)} Budget</div>
        <div class="budget-meta"><span>Spent so far: ${fmtINR(expense)}</span><span>${amt > 0 ? Math.round(pct) + '%' : 'Not set'}</span></div>
        ${amt > 0 ? `<div class="progress ${cls}" style="margin-top:10px"><span style="width:${pct}%"></span></div>` : ''}
      </div>

      <div class="form-stack mt-16">
        <div class="field">
          <label>Monthly Budget (₹)</label>
          <input type="text" inputmode="decimal" class="input" id="budget-amt" value="${amt || ''}" placeholder="e.g. 30000" />
        </div>
        <button class="btn btn-primary btn-block" id="save-budget">Save</button>
        ${amt > 0 ? '<button class="btn btn-ghost btn-block" id="clear-budget">Remove Budget</button>' : ''}
      </div>

      <div class="text-mute mt-16" style="font-size:13px">
        Tip: yellow warning at 80%, red at 100%.
      </div>
    `;

    $('#budget-amt').addEventListener('input', e => {
      e.target.value = e.target.value.replace(/[^\d.]/g, '');
    });
    $('#save-budget').addEventListener('click', async () => {
      const v = parseFloat($('#budget-amt').value);
      if (!v || v <= 0) { toast('Enter an amount'); return; }
      await DB.setBudget(mk, v);
      toast('Budget saved');
      navigate('home');
    });
    const cb = $('#clear-budget');
    if (cb) cb.addEventListener('click', async () => {
      await DB.setBudget(mk, 0);
      toast('Budget removed');
      renderBudgetPage();
    });
  }

  // ---------- CATEGORIES page ----------
  async function renderCategoriesPage() {
    const cats = await DB.getCategories();
    const exp = cats.filter(c => c.type === 'expense');
    const inc = cats.filter(c => c.type === 'income');

    const renderList = (list) => `
      <div class="cat-grid">
        ${list.map(c => `
          <button class="cat-chip" data-id="${c.id}">
            <div class="ic">${c.icon}</div><div class="nm">${escapeHtml(c.name)}</div>
          </button>
        `).join('')}
      </div>
    `;

    view.innerHTML = `
      <div class="section-title"><span>Expense Categories</span></div>
      ${renderList(exp)}
      <div class="section-title"><span>Income Categories</span></div>
      ${renderList(inc)}
      <div class="mt-16">
        <button class="btn btn-primary btn-block" id="add-cat">+ New Category</button>
      </div>
    `;

    $$('.cat-chip[data-id]').forEach(b => b.addEventListener('click', async () => {
      const c = cats.find(x => x.id === b.dataset.id);
      if (!c) return;
      openCategoryEditor(c);
    }));
    $('#add-cat').addEventListener('click', () => openCategoryEditor(null));
  }

  function openCategoryEditor(cat) {
    const isNew = !cat;
    const node = document.createElement('div');
    node.innerHTML = `
      <div class="form-stack">
        <div class="field">
          <label>Type</label>
          <div class="segmented" id="cat-type">
            <button data-t="expense" class="${(cat?.type || 'expense') === 'expense' ? 'active expense' : ''}">Expense</button>
            <button data-t="income" class="${cat?.type === 'income' ? 'active income' : ''}">Income</button>
          </div>
        </div>
        <div class="field">
          <label>Name</label>
          <input class="input" id="cat-name" value="${escapeAttr(cat?.name || '')}" placeholder="e.g. Petrol" />
        </div>
        <div class="field">
          <label>Icon (emoji)</label>
          <input class="input" id="cat-icon" value="${escapeAttr(cat?.icon || '🏷️')}" maxlength="4" />
        </div>
        <div class="btn-row">
          ${!isNew ? `<button class="btn btn-danger" id="cat-del">Delete</button>` : ''}
          <button class="btn btn-primary btn-block" id="cat-save">Save</button>
        </div>
      </div>
    `;
    const sheet = openSheet(isNew ? 'New Category' : 'Edit Category', node);

    let type = cat?.type || 'expense';
    $$('#cat-type button', node).forEach(b => b.addEventListener('click', () => {
      type = b.dataset.t;
      $$('#cat-type button', node).forEach(x => x.classList.remove('active', 'income', 'expense'));
      b.classList.add('active', type);
    }));

    $('#cat-save', node).addEventListener('click', async () => {
      const name = $('#cat-name', node).value.trim();
      const icon = $('#cat-icon', node).value.trim() || '🏷️';
      if (!name) { toast('Enter a name'); return; }
      await DB.addCategory({ id: cat?.id, name, icon, type });
      sheet.close();
      toast('Saved');
      renderCategoriesPage();
    });

    const del = $('#cat-del', node);
    if (del) del.addEventListener('click', async () => {
      if (!confirm('Delete this category? (existing entries will remain)')) return;
      await DB.deleteCategory(cat.id);
      sheet.close();
      toast('Deleted');
      renderCategoriesPage();
    });
  }

  // ---------- RECURRING page ----------
  async function renderRecurringPage() {
    const [list, cats] = await Promise.all([DB.getRecurring(), DB.getCategories()]);
    const catMap = mapCategories(cats);
    const dues = computeUpcomingDues(list);

    view.innerHTML = `
      <div class="section-title"><span>${list.length} recurring ${list.length === 1 ? 'item' : 'items'}</span></div>
      ${list.length ? `
        <div class="card" style="padding:0">
          ${dues.map(d => recurringRow(d, catMap)).join('')}
        </div>
      ` : emptyState('🔁', 'No recurring items', 'Add monthly bills like EMI, rent or subscriptions.')}
      <div class="mt-16">
        <button class="btn btn-primary btn-block" id="add-rec">+ New Recurring</button>
      </div>
    `;

    $$('[data-rec]').forEach(el => el.addEventListener('click', () => {
      const r = list.find(x => x.id === el.dataset.rec);
      openRecurringEditor(r, cats);
    }));
    $('#add-rec').addEventListener('click', () => openRecurringEditor(null, cats));
  }

  function openRecurringEditor(rec, cats) {
    const isNew = !rec;
    const expCats = cats.filter(c => c.type === 'expense');
    const node = document.createElement('div');
    node.innerHTML = `
      <div class="form-stack">
        <div class="field">
          <label>Name</label>
          <input class="input" id="r-name" value="${escapeAttr(rec?.name || '')}" placeholder="e.g. Car EMI" />
        </div>
        <div class="field">
          <label>Amount (₹)</label>
          <input class="input" type="text" inputmode="decimal" id="r-amt" value="${rec?.amount || ''}" placeholder="e.g. 12000" />
        </div>
        <div class="field">
          <label>Category</label>
          <select class="select" id="r-cat">
            ${expCats.map(c => `<option value="${c.id}" ${rec?.category === c.id ? 'selected' : ''}>${c.icon} ${escapeHtml(c.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>Day of the month</label>
          <input class="input" type="number" min="1" max="31" id="r-day" value="${rec?.dayOfMonth || 1}" />
        </div>
        ${!isNew ? `
          <button class="btn btn-primary btn-block" id="r-paid">Mark Paid for This Month</button>
        ` : ''}
        <div class="btn-row">
          ${!isNew ? `<button class="btn btn-danger" id="r-del">Delete</button>` : ''}
          <button class="btn btn-primary btn-block" id="r-save">Save</button>
        </div>
      </div>
    `;
    const sheet = openSheet(isNew ? 'New Recurring' : 'Edit Recurring', node);

    $('#r-amt', node).addEventListener('input', e => { e.target.value = e.target.value.replace(/[^\d.]/g, ''); });

    $('#r-save', node).addEventListener('click', async () => {
      const name = $('#r-name', node).value.trim();
      const amount = parseFloat($('#r-amt', node).value);
      const category = $('#r-cat', node).value;
      const dayOfMonth = parseInt($('#r-day', node).value, 10);
      if (!name) return toast('Enter a name');
      if (!amount || amount <= 0) return toast('Enter an amount');
      if (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31) return toast('Day must be 1–31');
      await DB.addRecurring({ id: rec?.id, name, amount, category, dayOfMonth, type: 'expense', lastPaidMonth: rec?.lastPaidMonth });
      sheet.close();
      toast('Saved');
      renderRecurringPage();
    });

    const del = $('#r-del', node);
    if (del) del.addEventListener('click', async () => {
      if (!confirm('Delete this recurring item?')) return;
      await DB.deleteRecurring(rec.id);
      sheet.close();
      toast('Deleted');
      renderRecurringPage();
    });

    const paid = $('#r-paid', node);
    if (paid) paid.addEventListener('click', async () => {
      const mk = currentMonthKey();
      const day = Math.min(rec.dayOfMonth, daysInMonth(parseInt(mk.split('-')[0]), parseInt(mk.split('-')[1])));
      const date = mk + '-' + String(day).padStart(2, '0');
      await DB.addTransaction({
        type: 'expense', amount: rec.amount, category: rec.category, date, note: rec.name + ' (recurring)'
      });
      await DB.addRecurring({ ...rec, lastPaidMonth: mk });
      sheet.close();
      toast('Marked as paid ✓');
      navigate('home');
    });
  }

  // ---------- Export / Import ----------
  async function exportJSON() {
    const payload = await DB.exportAll();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `paisa-backup-${todayISO()}.json`);
    toast('Backup downloaded');
  }

  async function exportCSV() {
    const [txns, cats] = await Promise.all([DB.getTransactions(), DB.getCategories()]);
    const catMap = mapCategories(cats);
    const rows = [['Date', 'Type', 'Category', 'Amount (INR)', 'Note']];
    txns.sort((a, b) => a.date.localeCompare(b.date)).forEach(t => {
      const c = catMap[t.category] || { name: t.category };
      rows.push([t.date, t.type, c.name, t.amount, t.note || '']);
    });
    const csv = rows.map(r => r.map(csvField).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `paisa-export-${todayISO()}.csv`);
    toast('CSV downloaded');
  }

  function csvField(v) {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importFromFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const txt = await file.text();
      const data = JSON.parse(txt);
      const merge = confirm('OK: merge with existing data\nCancel: replace everything');
      await DB.importAll(data, { merge });
      toast('Imported ✓');
      navigate('home');
    } catch (err) {
      console.error(err);
      toast('Import failed — check the file');
    } finally {
      e.target.value = '';
    }
  }

  // ---------- Helpers ----------
  function sum(arr) { return arr.reduce((s, v) => s + v, 0); }

  function mapCategories(cats) {
    const m = {};
    for (const c of cats) m[c.id] = c;
    return m;
  }

  function txnRow(t, catMap) {
    const c = catMap[t.category] || { name: 'Other', icon: '📦' };
    const sign = t.type === 'income' ? '+' : '−';
    return `
      <div class="txn" data-edit="${t.id}">
        <div class="txn-icon">${c.icon}</div>
        <div class="txn-main">
          <div class="txn-cat">${escapeHtml(c.name)}</div>
          <div class="txn-note">${escapeHtml(t.note || formatDateNice(t.date))}</div>
        </div>
        <div class="txn-meta">
          <div class="txn-amt ${t.type}">${sign}${fmtINR(t.amount)}</div>
          <div class="txn-date">${formatDateNice(t.date)}</div>
        </div>
      </div>
    `;
  }

  function bindTxnRowClicks() {
    $$('[data-edit]').forEach(el => el.addEventListener('click', () => {
      navigate('add', { edit: el.dataset.edit });
    }));
  }

  function emptyState(icon, title, sub) {
    return `<div class="empty"><div class="em-icon">${icon}</div><div class="em-title">${title}</div><div class="em-sub">${sub}</div></div>`;
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, m => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  // ---------- PWA Install ----------
  let deferredInstall = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
  });

  // ---------- Service Worker ----------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW reg failed', err));
    });
  }

  // ---------- Boot ----------
  (async function boot() {
    await DB.openDB();
    await DB.seedIfEmpty();
    await initTheme();
    if (!location.hash) location.hash = '#home';
    render();
  })();
})();

/* Paisa DB — IndexedDB wrapper. No deps. */
(function () {
  const DB_NAME = 'paisa-db';
  const DB_VERSION = 1;
  const STORES = {
    transactions: 'transactions',
    categories: 'categories',
    budgets: 'budgets',
    recurring: 'recurring',
    settings: 'settings'
  };

  let _dbPromise = null;

  function openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORES.transactions)) {
          const s = db.createObjectStore(STORES.transactions, { keyPath: 'id' });
          s.createIndex('by_date', 'date');
          s.createIndex('by_month', 'monthKey');
          s.createIndex('by_type', 'type');
          s.createIndex('by_category', 'category');
        }
        if (!db.objectStoreNames.contains(STORES.categories)) {
          db.createObjectStore(STORES.categories, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.budgets)) {
          db.createObjectStore(STORES.budgets, { keyPath: 'monthKey' });
        }
        if (!db.objectStoreNames.contains(STORES.recurring)) {
          db.createObjectStore(STORES.recurring, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.settings)) {
          db.createObjectStore(STORES.settings, { keyPath: 'key' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return _dbPromise;
  }

  function tx(storeName, mode = 'readonly') {
    return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
  }

  function reqAsPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- Generic helpers ----------
  async function put(storeName, value) {
    const store = await tx(storeName, 'readwrite');
    await reqAsPromise(store.put(value));
    return value;
  }
  async function get(storeName, key) {
    const store = await tx(storeName);
    return reqAsPromise(store.get(key));
  }
  async function del(storeName, key) {
    const store = await tx(storeName, 'readwrite');
    return reqAsPromise(store.delete(key));
  }
  async function getAll(storeName) {
    const store = await tx(storeName);
    return reqAsPromise(store.getAll());
  }
  async function clear(storeName) {
    const store = await tx(storeName, 'readwrite');
    return reqAsPromise(store.clear());
  }

  // ---------- Domain methods ----------
  async function addTransaction(t) {
    const rec = {
      id: t.id || uid(),
      type: t.type, // 'income' | 'expense'
      amount: Number(t.amount) || 0,
      category: t.category,
      date: t.date, // ISO yyyy-mm-dd
      monthKey: t.date ? t.date.slice(0, 7) : '',
      note: t.note || '',
      createdAt: t.createdAt || Date.now()
    };
    return put(STORES.transactions, rec);
  }

  async function deleteTransaction(id) { return del(STORES.transactions, id); }
  async function getTransactions() { return getAll(STORES.transactions); }
  async function getTransactionsByMonth(monthKey) {
    const store = await tx(STORES.transactions);
    return reqAsPromise(store.index('by_month').getAll(monthKey));
  }

  async function setBudget(monthKey, amount) {
    return put(STORES.budgets, { monthKey, amount: Number(amount) || 0 });
  }
  async function getBudget(monthKey) { return get(STORES.budgets, monthKey); }
  async function getBudgets() { return getAll(STORES.budgets); }

  async function addCategory(c) {
    const rec = {
      id: c.id || uid(),
      name: c.name,
      icon: c.icon || '🏷️',
      type: c.type, // 'income' | 'expense'
      builtin: !!c.builtin
    };
    return put(STORES.categories, rec);
  }
  async function deleteCategory(id) { return del(STORES.categories, id); }
  async function getCategories() { return getAll(STORES.categories); }

  async function addRecurring(r) {
    const rec = {
      id: r.id || uid(),
      name: r.name,
      amount: Number(r.amount) || 0,
      category: r.category,
      type: r.type || 'expense',
      dayOfMonth: Number(r.dayOfMonth) || 1,
      active: r.active !== false,
      lastPaidMonth: r.lastPaidMonth || ''
    };
    return put(STORES.recurring, rec);
  }
  async function deleteRecurring(id) { return del(STORES.recurring, id); }
  async function getRecurring() { return getAll(STORES.recurring); }

  async function setSetting(key, value) { return put(STORES.settings, { key, value }); }
  async function getSetting(key) {
    const r = await get(STORES.settings, key);
    return r ? r.value : undefined;
  }

  // ---------- Seed defaults on first run ----------
  async function seedIfEmpty() {
    const cats = await getCategories();
    if (cats.length > 0) return;
    const seed = [
      { name: 'Food', icon: '🍽️', type: 'expense', builtin: true },
      { name: 'Travel', icon: '🚗', type: 'expense', builtin: true },
      { name: 'Rent', icon: '🏠', type: 'expense', builtin: true },
      { name: 'Bills', icon: '💡', type: 'expense', builtin: true },
      { name: 'Shopping', icon: '🛍️', type: 'expense', builtin: true },
      { name: 'Health', icon: '💊', type: 'expense', builtin: true },
      { name: 'EMI', icon: '🏦', type: 'expense', builtin: true },
      { name: 'Other', icon: '📦', type: 'expense', builtin: true },
      { name: 'Salary', icon: '💰', type: 'income', builtin: true },
      { name: 'Business', icon: '💼', type: 'income', builtin: true },
      { name: 'Other', icon: '🎁', type: 'income', builtin: true }
    ];
    for (const c of seed) await addCategory(c);
  }

  // ---------- Export / Import ----------
  async function exportAll() {
    const [transactions, categories, budgets, recurring, settings] = await Promise.all([
      getAll(STORES.transactions),
      getAll(STORES.categories),
      getAll(STORES.budgets),
      getAll(STORES.recurring),
      getAll(STORES.settings)
    ]);
    return {
      app: 'paisa',
      version: 1,
      exportedAt: new Date().toISOString(),
      data: { transactions, categories, budgets, recurring, settings }
    };
  }

  async function importAll(payload, { merge = false } = {}) {
    if (!payload || !payload.data) throw new Error('Invalid backup file');
    const d = payload.data;
    if (!merge) {
      await Promise.all([
        clear(STORES.transactions), clear(STORES.categories),
        clear(STORES.budgets), clear(STORES.recurring), clear(STORES.settings)
      ]);
    }
    for (const t of d.transactions || []) await put(STORES.transactions, t);
    for (const c of d.categories || []) await put(STORES.categories, c);
    for (const b of d.budgets || []) await put(STORES.budgets, b);
    for (const r of d.recurring || []) await put(STORES.recurring, r);
    for (const s of d.settings || []) await put(STORES.settings, s);
  }

  async function wipeAll() {
    await Promise.all([
      clear(STORES.transactions), clear(STORES.categories),
      clear(STORES.budgets), clear(STORES.recurring)
    ]);
    await seedIfEmpty();
  }

  window.PaisaDB = {
    openDB, uid, seedIfEmpty,
    addTransaction, deleteTransaction, getTransactions, getTransactionsByMonth,
    setBudget, getBudget, getBudgets,
    addCategory, deleteCategory, getCategories,
    addRecurring, deleteRecurring, getRecurring,
    setSetting, getSetting,
    exportAll, importAll, wipeAll
  };
})();

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Paisa** — an offline-first personal finance PWA. Plain HTML/CSS/JS, no build step, no framework, no package manager, no tests. All data lives in the browser's IndexedDB; there is no backend.

## Running it

A service worker is registered, so it must be served over `http://localhost` (not `file://`). From `D:\Project\Claude_Website\App`:

```powershell
python -m http.server 8000          # or: npx --yes http-server -p 8000 -c-1
```

Then open http://localhost:8000.

There is no build, no lint, no test command — edits are live on reload. There is no package.json.

## Shipping changes (cache-busting)

The service worker (`sw.js`) caches every asset listed in its `ASSETS` array under a versioned cache name (`VERSION = 'paisa-vN'`). After editing any file in `ASSETS`:

1. Bump `VERSION` in `sw.js` (e.g. `paisa-v2` → `paisa-v3`).
2. Reload the page **twice** — the new SW activates on the second load (`skipWaiting` + `clients.claim` are set, but the controlling SW only swaps after the next navigation).

If you add a new top-level asset (new JS file, new icon), also add it to `ASSETS` in `sw.js`, or it won't be cached for offline use.

## Architecture

Three IIFEs, each attaching one global to `window`. Load order is fixed in `index.html`:

```
db.js     →  window.PaisaDB      (IndexedDB wrapper + domain methods)
charts.js →  window.PaisaCharts  (canvas donut + grouped bars, no libs)
app.js    →  (routing, views, business logic — consumes the two above)
```

`app.js` is the whole application. It uses hash-based routing (`#home`, `#history`, `#add?type=expense`, `#add?edit=<id>`, `#charts`, `#more`, `#budget`, `#recurring`, `#categories`) dispatched by `render()` in a single `switch`. Each route has a `renderX()` function that rewrites `#view`'s innerHTML and re-binds events. There is no virtual DOM and no component model — re-rendering means re-rendering the whole screen.

### IndexedDB schema

DB name `paisa-db`, `DB_VERSION = 1`. Five object stores, all defined in `openDB()` in `db.js`:

| Store          | keyPath     | Notes                                                          |
|----------------|-------------|----------------------------------------------------------------|
| `transactions` | `id`        | Indexes: `by_date`, `by_month` (monthKey = `yyyy-mm`), `by_type`, `by_category` |
| `categories`   | `id`        | Seeded on first run via `seedIfEmpty()`                        |
| `budgets`      | `monthKey`  | One per month (`yyyy-mm`)                                      |
| `recurring`    | `id`        | EMIs / subscriptions, with `dayOfMonth` + `lastPaidMonth`      |
| `settings`     | `key`       | Misc key/value (e.g. `theme`)                                  |

**To change the schema:** bump `DB_VERSION` and extend the `onupgradeneeded` handler. Existing user data only migrates if you write the migration — there is no auto-migration.

### Money & locale

- Currency formatting goes through `fmtINR` / `fmtINRDecimal` in `app.js` (uses `Intl.NumberFormat('en-IN', { currency: 'INR' })`). Don't hardcode `₹` + `toFixed` elsewhere; route through these helpers so Indian digit grouping (`1,00,000`) stays consistent.
- The compact form (`₹1.2L`, `₹3Cr`) lives in `formatINRShort` inside `charts.js` for chart centers.
- Month keys are `yyyy-mm` strings everywhere (`monthKey()`, `currentMonthKey()`, `prevMonth()`, `nextMonth()`). Dates are ISO `yyyy-mm-dd` strings, never `Date` objects in storage.

### Service worker caching strategy

In `sw.js`:
- **HTML / navigations** → network-first, fallback to cache (so deploys land fast).
- **Other same-origin assets** → cache-first, populate on miss.
- Cross-origin requests are passed through untouched.

### PWA install hook

`beforeinstallprompt` is captured into `deferredInstall` in `app.js`. The "Install on Phone" button in the More menu calls `.prompt()` on it if available; otherwise it shows a toast pointing the user at Chrome's menu.

## Conventions worth knowing

- All user-supplied strings going into `innerHTML` must pass through `escapeHtml` / `escapeAttr` (defined at the bottom of `app.js`). Several view functions interpolate `r.name`, `t.note`, `c.name` etc. — keep this discipline when adding new templates.
- New routes need three things: a `case` in `render()`, a `renderX()` function, and (if it's a top-level nav) a matching `data-route` button in `index.html`'s `.bottom-nav`.
- Bottom sheets use `openSheet(title, contentNode)` / `closeSheet()` from `app.js` rather than a custom modal each time.
- Toasts: `toast('message')` — auto-dismisses after ~2.2s.
- The icon `make-icons.ps1` in `icons/` regenerates the PWA icons via PowerShell; don't hand-edit the PNGs.

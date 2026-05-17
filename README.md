# Paisa — Personal Finance PWA

A clean, offline-first personal finance app in friendly Hinglish. Tracks income, expenses, budgets, EMIs & recurring bills. All data stays on **your** device in IndexedDB — no backend, no login, nothing leaves your phone.

Stack: plain HTML + CSS + JavaScript. No build step. Installs as a PWA on Android.

---

## (a) Open it on your computer

The app uses a service worker, which only works over `http://localhost` or `https://`, not via `file://`. So we need a tiny local server. Pick whichever you have:

### Option 1 — Python (already installed on most machines)

```powershell
cd D:\Project\Claude_Website\App
python -m http.server 8000
```

Then open: **http://localhost:8000**

### Option 2 — Node.js

```powershell
cd D:\Project\Claude_Website\App
npx --yes http-server -p 8000 -c-1
```

Then open: **http://localhost:8000**

### Option 3 — VS Code

Install the "Live Server" extension, right-click `index.html` → "Open with Live Server".

> First load fetches all assets and the service worker caches them. After that the app works **fully offline** — turn off Wi-Fi and it still loads.

---

## (b) Install on your Android phone

You have two easy paths. Path A is what most people do.

### Path A — Same Wi-Fi (recommended)

1. Make sure your phone and computer are on the **same Wi-Fi network**.
2. On your computer, find its local IP:
   ```powershell
   ipconfig | findstr IPv4
   ```
   You'll see something like `192.168.1.42`.
3. On your computer, start the server (from the `App` folder):
   ```powershell
   python -m http.server 8000
   ```
4. On your phone's Chrome, open: `http://192.168.1.42:8000` (use **your** IP).
5. Chrome will show **"Add Paisa to Home screen"** banner. Tap it.
   - If you don't see the banner, tap the **⋮ menu → Install app** (or **Add to Home screen**).
6. The app icon appears on your home screen. Open it — full-screen, no browser bars, works offline.

> ⚠️ Note: served over plain HTTP on LAN, Chrome's strictest PWA features (background sync etc.) are limited. Install + offline still work fine because Chrome treats `localhost` and your LAN address as a secure context for service workers in most builds. If install is greyed out, use Path B.

### Path B — Free HTTPS tunnel (most reliable for install)

1. Install [Cloudflare's tunnel](https://github.com/cloudflare/cloudflared) or use ngrok.
2. Run the local server: `python -m http.server 8000`.
3. In another terminal:
   ```powershell
   cloudflared tunnel --url http://localhost:8000
   ```
4. It'll print an HTTPS URL like `https://xyz-abc.trycloudflare.com`. Open that on your phone.
5. Tap **⋮ → Install app**.

### Path C — Host the folder anywhere

Upload the `App` folder to any static host (Netlify drop, Vercel, GitHub Pages, Cloudflare Pages). Open the URL on your phone → **Install app**. This is the "set it and forget it" option.

---

## How to use

- **+** (bottom centre) — add an income or expense. Toggle at top.
- **Home** — this month's totals, budget progress, upcoming dues, recent entries.
- **History** — full transaction list with month/type/category filters. Tap any entry to edit or delete.
- **Charts** — donut of expense by category + 6-month income vs expense bars.
- **More** —
  - **Budget**: set a monthly spend limit. Warns at 80% (yellow) and 100% (red).
  - **Categories**: add your own, change icons.
  - **Recurring**: EMIs / rent / subscriptions. Shows on home with days-until badge.
  - **Export JSON** / **CSV** / **Import** — your data, your control.
  - **Wipe data** — danger button.

---

## Files

```
App/
├── index.html          single-page shell
├── styles.css          design system + mobile-first layout
├── app.js              routing, views, business logic
├── db.js               IndexedDB wrapper
├── charts.js           canvas donut + bar charts (no libs)
├── sw.js               service worker (offline cache)
├── manifest.json       PWA manifest
├── icons/
│   ├── icon-192.png
│   ├── icon-512.png
│   ├── icon-maskable-512.png
│   └── make-icons.ps1  (regenerate icons via PowerShell)
└── README.md
```

---

## Backup philosophy

Your data lives in IndexedDB. If you clear browser data, uninstall the PWA, or wipe your phone, it's gone. **Export a JSON backup once a week** from More → Export. Save it to Google Drive. Easy recovery via Import.

---

## Troubleshooting

- **App doesn't install on phone** → use Path B (HTTPS tunnel) or Path C (static host).
- **Charts look fuzzy** → they auto-scale to device pixel ratio; pull-to-refresh once after install.
- **Numbers not in Indian format** → uses `Intl.NumberFormat('en-IN')`, available in all modern browsers.
- **Need to update after editing files** → bump `VERSION` in `sw.js` (e.g. `paisa-v1` → `paisa-v2`) and reload twice. New SW activates on the second load.

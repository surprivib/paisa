/* Paisa Charts — lightweight canvas charts. */
(function () {
  const PALETTE = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#06b6d4',
    '#a855f7', '#f97316', '#22c55e', '#eab308', '#ec4899',
    '#3b82f6', '#14b8a6'
  ];

  function setupCanvas(canvas, cssW, cssH) {
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function donut(canvas, items, opts = {}) {
    const cssW = canvas.parentElement.clientWidth;
    const cssH = opts.height || 240;
    const ctx = setupCanvas(canvas, cssW, cssH);
    ctx.clearRect(0, 0, cssW, cssH);

    const total = items.reduce((s, i) => s + i.value, 0);
    const cx = cssW / 2, cy = cssH / 2;
    const r = Math.min(cssW, cssH) / 2 - 8;
    const inner = r * 0.62;

    if (total <= 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.arc(cx, cy, inner, 0, Math.PI * 2, true);
      ctx.fillStyle = getCSSVar('--surface-2');
      ctx.fill();
      ctx.fillStyle = getCSSVar('--text-3');
      ctx.font = '600 14px -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('No data', cx, cy);
      return;
    }

    let start = -Math.PI / 2;
    items.forEach((it, idx) => {
      const angle = (it.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, start + angle);
      ctx.closePath();
      ctx.fillStyle = it.color || PALETTE[idx % PALETTE.length];
      ctx.fill();
      start += angle;
    });

    // Inner hole
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fillStyle = getCSSVar('--surface');
    ctx.fill();

    // Center label
    ctx.fillStyle = getCSSVar('--text-3');
    ctx.font = '600 11px -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(opts.centerLabel || 'TOTAL', cx, cy - 10);

    ctx.fillStyle = getCSSVar('--text');
    ctx.font = '800 18px -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(opts.centerValue || formatINRShort(total), cx, cy + 10);
  }

  function barsGrouped(canvas, labels, seriesA, seriesB, opts = {}) {
    const cssW = canvas.parentElement.clientWidth;
    const cssH = opts.height || 240;
    const ctx = setupCanvas(canvas, cssW, cssH);
    ctx.clearRect(0, 0, cssW, cssH);

    const padL = 8, padR = 8, padT = 10, padB = 38;
    const innerW = cssW - padL - padR;
    const innerH = cssH - padT - padB;

    const max = Math.max(
      1,
      ...seriesA.map(v => v || 0),
      ...seriesB.map(v => v || 0)
    );
    const niceMax = niceCeil(max);

    // grid lines
    ctx.strokeStyle = getCSSVar('--border');
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + (innerH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padL, y); ctx.lineTo(padL + innerW, y);
      ctx.stroke();
    }

    const groupW = innerW / labels.length;
    const barW = Math.min(18, groupW * 0.36);
    const gap = 4;

    const colorA = opts.colorA || getCSSVar('--income') || '#10b981';
    const colorB = opts.colorB || getCSSVar('--expense') || '#ef4444';

    labels.forEach((lab, i) => {
      const gx = padL + i * groupW + groupW / 2;
      const aVal = seriesA[i] || 0;
      const bVal = seriesB[i] || 0;
      const aH = (aVal / niceMax) * innerH;
      const bH = (bVal / niceMax) * innerH;

      // A bar (income)
      roundedRect(ctx, gx - barW - gap / 2, padT + innerH - aH, barW, aH, 4);
      ctx.fillStyle = colorA; ctx.fill();
      // B bar (expense)
      roundedRect(ctx, gx + gap / 2, padT + innerH - bH, barW, bH, 4);
      ctx.fillStyle = colorB; ctx.fill();

      // Label
      ctx.fillStyle = getCSSVar('--text-3');
      ctx.font = '600 11px -apple-system, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillText(lab, gx, padT + innerH + 8);
    });

    // Legend
    const legY = cssH - 14;
    ctx.font = '600 11px -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.textBaseline = 'middle';
    // Income legend
    ctx.fillStyle = colorA;
    roundedRect(ctx, padL, legY - 5, 10, 10, 2); ctx.fill();
    ctx.fillStyle = getCSSVar('--text-2');
    ctx.textAlign = 'left';
    ctx.fillText('Income', padL + 16, legY);
    // Expense legend
    const xExp = padL + 78;
    ctx.fillStyle = colorB;
    roundedRect(ctx, xExp, legY - 5, 10, 10, 2); ctx.fill();
    ctx.fillStyle = getCSSVar('--text-2');
    ctx.fillText('Expense', xExp + 16, legY);
  }

  function roundedRect(ctx, x, y, w, h, r) {
    if (h <= 0) { ctx.beginPath(); ctx.rect(x, y, w, 0); return; }
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  function niceCeil(v) {
    if (v <= 0) return 1;
    const exp = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / exp;
    let nice;
    if (f <= 1) nice = 1;
    else if (f <= 2) nice = 2;
    else if (f <= 5) nice = 5;
    else nice = 10;
    return nice * exp;
  }

  function getCSSVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function formatINRShort(n) {
    n = Math.round(n);
    if (n >= 10000000) return '₹' + (n / 10000000).toFixed(1).replace(/\.0$/, '') + 'Cr';
    if (n >= 100000) return '₹' + (n / 100000).toFixed(1).replace(/\.0$/, '') + 'L';
    if (n >= 1000) return '₹' + (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return '₹' + n;
  }

  window.PaisaCharts = { donut, barsGrouped, PALETTE };
})();

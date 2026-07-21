// Utilitaires d'export CSV / PNG côté client (#47) — aucun appel réseau.

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const escapeCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// rows = tableau d'objets ; columns = [{ key, label }].
export function exportCSV(filename, columns, rows) {
  const header = columns.map((c) => escapeCell(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => escapeCell(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(',')).join('\n');
  const csv = '﻿' + header + '\n' + body; // BOM pour Excel/accents
  download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), filename);
}

// Rend un tableau de « tuiles » (titre + valeur) en PNG via canvas — pas de dépendance.
export function exportSummaryPNG(filename, title, tiles) {
  const W = 900, pad = 40, cardW = 260, cardH = 120, gap = 20, perRow = 3;
  const rows = Math.ceil(tiles.length / perRow);
  const H = pad * 2 + 60 + rows * (cardH + gap);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b0a0c'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f2eeee'; ctx.font = '700 28px Inter, system-ui, sans-serif';
  ctx.fillText(title, pad, pad + 28);
  tiles.forEach((t, i) => {
    const col = i % perRow, row = Math.floor(i / perRow);
    const x = pad + col * (cardW + gap), y = pad + 60 + row * (cardH + gap);
    ctx.fillStyle = '#201c21'; roundRect(ctx, x, y, cardW, cardH, 16); ctx.fill();
    ctx.fillStyle = '#f5342a'; ctx.font = '800 40px Inter, system-ui, sans-serif';
    ctx.fillText(String(t.value), x + 20, y + 62);
    ctx.fillStyle = '#a49aa0'; ctx.font = '500 15px Inter, system-ui, sans-serif';
    ctx.fillText(t.label, x + 20, y + 92);
  });
  c.toBlob((blob) => blob && download(blob, filename), 'image/png');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

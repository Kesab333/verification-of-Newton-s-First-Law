/* ==========================================================================
   vectors.js — Results panel extras:
     1. a table of every force with its components (F, θ, Fx, Fy)
     2. a vector diagram on <canvas>:
          left  — the four forces drawn from one point, plus the resultant R
          right — the same forces placed head to tail (the "polygon").
                  At equilibrium the polygon closes: ΣF = 0.
   Reads state.values.forces / sx / sy / R / equilibrium. Generic drawing code,
   experiment-specific data.
   ========================================================================== */

import { $ } from './utils.js';
import { FORCE_COLORS } from './config.js';

const RESULTANT_COLOR = '#6d28d9';
let lastTableKey = '';

/* ------------------------------------------------------------------ Components table */

export function renderComponentsTable(state) {
  const { forces, sx, sy, R } = state.values;
  const f2 = (n) => (Math.abs(n) < 0.005 ? 0 : n).toFixed(2);
  const key = forces.map((f) => `${f2(f.F)}|${f.angle}`).join(';');
  if (key === lastTableKey) return;
  lastTableKey = key;

  const rows = forces
    .map((f, i) => `
      <tr>
        <td><b class="swatch" style="background:${FORCE_COLORS[i]}"></b>F<sub>${i + 1}</sub></td>
        <td>${f2(f.F)} N</td>
        <td>${f.angle}°</td>
        <td>${f2(f.fx)} N</td>
        <td>${f2(f.fy)} N</td>
      </tr>`)
    .join('');
  $('#componentsBody').innerHTML = `${rows}
      <tr class="sum-row">
        <td>Σ / R</td>
        <td>R = ${f2(R)} N</td>
        <td>—</td>
        <td>${f2(sx)} N</td>
        <td>${f2(sy)} N</td>
      </tr>`;
}

/* ------------------------------------------------------------------ Canvas helpers */

function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const width = Math.round(rect.width * ratio);
  const height = Math.round(rect.height * ratio);
  if (width > 0 && height > 0 && (canvas.width !== width || canvas.height !== height)) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width: rect.width, height: rect.height, ratio };
}

/** Line with an arrow head at (x1, y1). */
function arrow(g, x0, y0, x1, y1, color, { width = 2.5, dash = null, head = 9 } = {}) {
  const length = Math.hypot(x1 - x0, y1 - y0);
  if (length < 1) return;
  const angle = Math.atan2(y1 - y0, x1 - x0);
  const h = Math.min(head, length * 0.6);
  g.save();
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.setLineDash(dash ?? []);
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1 - Math.cos(angle) * h * 0.6, y1 - Math.sin(angle) * h * 0.6);
  g.stroke();
  g.setLineDash([]);
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x1 - h * Math.cos(angle - 0.4), y1 - h * Math.sin(angle - 0.4));
  g.lineTo(x1 - h * Math.cos(angle + 0.4), y1 - h * Math.sin(angle + 0.4));
  g.closePath();
  g.fill();
  g.restore();
}

function label(g, text, x, y, color, align = 'center') {
  g.save();
  g.font = '700 12px Nunito, sans-serif';
  g.fillStyle = color;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
  g.restore();
}

/* ------------------------------------------------------------------ Vector diagram */

export function renderVectorDiagram(canvas, state) {
  const g = canvas.getContext('2d');
  const { width, height, ratio } = fitCanvas(canvas);
  if (!g || width <= 0 || height <= 0) return;

  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, canvas.width, canvas.height);
  g.setTransform(ratio, 0, 0, ratio, 0, 0);

  const { forces, sx, sy, R, equilibrium } = state.values;
  const half = width / 2;
  const top = 34; // room for the panel titles

  // divider + titles
  g.strokeStyle = '#dce7e6';
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(half, 10); g.lineTo(half, height - 10); g.stroke();
  g.font = '700 13px Nunito, sans-serif';
  g.fillStyle = '#087d76';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('Forces acting on the ring', half / 2, 16);
  g.fillText('Head-to-tail polygon', half + half / 2, 16);

  /* ---- Left: concurrent forces from the origin ---- */
  const cx = half / 2;
  const cy = top + (height - top) / 2;
  const maxForce = Math.max(...forces.map((f) => f.F), R, 1e-6);
  const reach = Math.min(half - 50, height - top - 30) / 2;
  const scale = reach / maxForce;

  g.strokeStyle = '#cfdad9';
  g.lineWidth = 1;
  g.setLineDash([4, 4]);
  g.beginPath();
  g.moveTo(cx - reach - 12, cy); g.lineTo(cx + reach + 12, cy);
  g.moveTo(cx, cy - reach - 12); g.lineTo(cx, cy + reach + 12);
  g.stroke();
  g.setLineDash([]);
  label(g, 'x', cx + reach + 18, cy, '#7a8a89');
  label(g, 'y', cx, cy - reach - 18, '#7a8a89');

  forces.forEach((f, i) => {
    const x1 = cx + f.fx * scale;
    const y1 = cy - f.fy * scale;
    arrow(g, cx, cy, x1, y1, FORCE_COLORS[i]);
    if (f.F * scale > 14) {
      const lx = cx + f.fx * scale * 1.12 + Math.sign(f.fx || 0.0001) * 8;
      const ly = cy - f.fy * scale * 1.12 - Math.sign(f.fy || 0.0001) * 6;
      label(g, `F${i + 1}`, lx, ly, FORCE_COLORS[i]);
    }
  });
  if (!equilibrium) {
    arrow(g, cx, cy, cx + sx * scale, cy - sy * scale, RESULTANT_COLOR, { dash: [6, 4], width: 2.5 });
    label(g, 'R', cx + sx * scale * 1.12 + 8, cy - sy * scale * 1.12 - 6, RESULTANT_COLOR);
  }
  g.fillStyle = '#334155';
  g.beginPath(); g.arc(cx, cy, 3, 0, Math.PI * 2); g.fill();

  /* ---- Right: head-to-tail polygon ---- */
  const points = [{ x: 0, y: 0 }];
  forces.forEach((f) => {
    const last = points[points.length - 1];
    points.push({ x: last.x + f.fx, y: last.y + f.fy });
  });
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 1e-6);
  const spanY = Math.max(maxY - minY, 1e-6);
  const boxW = half - 70;
  const boxH = height - top - 46;
  const k = Math.min(boxW / spanX, boxH / spanY, 80); // 80 px/N cap keeps tiny polygons readable
  const ox = half + half / 2 - ((minX + maxX) / 2) * k;
  const oy = top + (height - top - 18) / 2 + ((minY + maxY) / 2) * k;
  const px = (p) => ox + p.x * k;
  const py = (p) => oy - p.y * k;

  forces.forEach((f, i) => {
    arrow(g, px(points[i]), py(points[i]), px(points[i + 1]), py(points[i + 1]), FORCE_COLORS[i]);
    const mx = (px(points[i]) + px(points[i + 1])) / 2;
    const my = (py(points[i]) + py(points[i + 1])) / 2;
    if (f.F * k > 16) label(g, `F${i + 1}`, mx + 9, my - 9, FORCE_COLORS[i]);
  });
  const end = points[points.length - 1];
  if (!equilibrium) {
    arrow(g, px(points[0]), py(points[0]), px(end), py(end), RESULTANT_COLOR, { dash: [6, 4], width: 2.5 });
    label(g, 'R', (px(points[0]) + px(end)) / 2 - 10, (py(points[0]) + py(end)) / 2 + 10, RESULTANT_COLOR);
  }
  g.fillStyle = '#334155';
  g.beginPath(); g.arc(px(points[0]), py(points[0]), 3.5, 0, Math.PI * 2); g.fill();

  // caption
  g.font = '700 12px Nunito, sans-serif';
  g.textAlign = 'center';
  g.fillStyle = equilibrium ? '#0d9488' : '#b45309';
  g.fillText(
    equilibrium ? 'Closed polygon: the vector sum is zero (ΣF = 0)' : 'Open polygon: the gap is the resultant R',
    half + half / 2,
    height - 10
  );
}

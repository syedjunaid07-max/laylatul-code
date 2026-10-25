(() => {
'use strict';

/* ---------- settings the owner may change ---------- */
const WHATSAPP_NUMBER = '910000000000';   // placeholder: digits only, with country code (91...)
const EMAIL = 'abus76416@gmail.com';
const HAS_VIDEO = false;                  // set to true once assets/hero-scrub.mp4 is approved and in place
const VIDEO_URL = 'assets/hero-scrub.mp4';
const POSTER_URL = 'assets/hero-poster.jpg';
const VIDEO_BYTES = 6000000;              // replace with the real byte size of the encoded video

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smoothstep = (p, e0, e1) => { const t = clamp((p - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

const hero = $('.hero'), stage = $('.stage'), video = $('#hero-video'), ring = $('.ring');
const posterLayer = $('.poster'), canvas = $('.night');

/* ---------- split headline text (seeded, once) ---------- */
$$('.split').forEach((el, n) => {
  const text = el.textContent.trim();
  const band = el.closest('.band');
  const fx = band && band.classList.contains('fx-scatter') ? 'scatter' : band && band.classList.contains('fx-rise') ? 'rise' : 'drift';
  const spread = Number(band && band.dataset.spread) || 0.55;
  const r = rng(1000 + n * 77);
  el.textContent = '';
  const sr = document.createElement('span'); sr.className = 'vh'; sr.textContent = text; el.appendChild(sr);
  const vis = document.createElement('span'); vis.setAttribute('aria-hidden', 'true');
  const words = text.split(' ');
  words.forEach((w, wi) => {
    const ws = document.createElement('span'); ws.className = 'w';
    if (fx !== 'scatter') ws.style.setProperty('--th', (wi / words.length * (fx === 'rise' ? 0.45 : 0.5)).toFixed(3));
    [...w].forEach(ch => {
      const c = document.createElement('span'); c.className = 'c'; c.textContent = ch;
      if (fx === 'scatter') {
        c.style.setProperty('--th', (r() * spread).toFixed(3));
        c.style.setProperty('--jx', ((r() - 0.5) * 170).toFixed(1) + 'px');
        c.style.setProperty('--jy', ((r() - 0.5) * 130).toFixed(1) + 'px');
        c.style.setProperty('--jr', ((r() - 0.5) * 90).toFixed(1) + 'deg');
      }
      ws.appendChild(c);
    });
    vis.appendChild(ws);
    if (wi < words.length - 1) vis.appendChild(document.createTextNode(' '));
  });
  el.appendChild(vis);
});

/* ---------- caption bands ---------- */
const bands = $$('.band').map((el, i, all) => {
  const [a, b] = el.dataset.range.split(',').map(Number);
  return { el, a, b, i, last: i === all.length - 1, ramp: Number(el.dataset.ramp) || 0, op: -1, k: -1 };
});
let loadK = 0;   // band one's one-time load ramp

function updateCaptions(p) {
  for (const b of bands) {
    const f = Math.min(0.03, (b.b - b.a) / 3);
    let op;
    if (b.i === 0) op = 1 - smoothstep(p, b.b - f, b.b);
    else if (b.last) op = smoothstep(p, b.a, b.a + f);
    else op = smoothstep(p, b.a, b.a + f) * (1 - smoothstep(p, b.b - f, b.b));
    op = Math.round(op * 1000) / 1000;
    let k = clamp((p - b.a) / (b.ramp || Math.min(0.05, (b.b - b.a) * 0.35)), 0, 1);
    if (b.i === 0) k = Math.max(k, loadK);
    if (op !== b.op) { b.op = op; b.el.style.opacity = op; b.el.classList.toggle('live', op > 0.5); }
    if (Math.abs(k - b.k) > 0.008 || (k === 1 && b.k !== 1) || (k === 0 && b.k !== 0)) {
      b.k = k; b.el.style.setProperty('--k', k.toFixed(3));
    }
  }
}

// the hero's size and position, measured once and on resize, so nothing re-measures layout every frame
const HM = { top: 0, h: 0, sh: 0, sw: 0 };
function measureHero() { HM.top = hero.offsetTop; HM.h = hero.offsetHeight; HM.sh = stage.offsetHeight; HM.sw = stage.offsetWidth; }
measureHero();
function heroBox() { const top = HM.top - scrollY; return { top, bottom: top + HM.h }; }
function stageBox() {
  const top = scrubOn ? Math.min(0, HM.top + HM.h - HM.sh - scrollY) : HM.top - scrollY;
  return { left: 0, top, width: HM.sw, height: HM.sh };
}
function heroProgress() {
  const range = HM.h - innerHeight;
  if (range <= 0) return 1;
  return clamp((scrollY - HM.top) / range, 0, 1);
}

/* ---------- the Multiverse journey canvas (code-drawn hero, and the fallback when no video) ---------- */
// Scroll down = fly forward: launch through a light bridge, pass portals into four universes
// (one per kind of website), then exit and watch the website gather from light.
const TAU = Math.PI * 2;
// phones and touch tablets: same look, drawn lighter (lower canvas resolution, fewer extras, 30 fps canvases)
const LITE = matchMedia('(pointer: coarse)').matches || innerWidth <= 820;
const PORTALS = [0.18, 0.34, 0.50, 0.66, 0.82];
const WORLDS = [
  { a: 0.18, b: 0.34, kind: 'ember',  c0: [62, 16, 6],  c1: [10, 4, 3],  h1: [255, 128, 48],  h2: [255, 70, 30] },
  { a: 0.34, b: 0.50, kind: 'aurora', c0: [50, 32, 4],  c1: [10, 6, 2],  h1: [255, 196, 74],  h2: [255, 140, 40] },
  { a: 0.50, b: 0.66, kind: 'neon',   c0: [52, 12, 4],  c1: [9, 3, 2],   h1: [255, 96, 30],   h2: [255, 190, 90] },
  { a: 0.66, b: 0.82, kind: 'cosmic', c0: [42, 20, 8],  c1: [8, 4, 3],   h1: [255, 150, 60],  h2: [255, 222, 150] }
];
const HUD = [['00', 'Ready for launch'], ['01', 'Online stores'], ['02', 'Restaurants and cafes'], ['03', 'Booking sites'], ['04', 'Web apps'], ['05', 'Your website']];
const DEPTH = 10, CDEPTH = 9;
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

const STAR_PAL = [0, 1, 2, 3, 4].map(ti => { const tr = ti / 4; return [0, 1, 2, 3, 4, 5, 6, 7].map(hi => `hsl(${Math.round(12 + hi * 36 / 7)},${Math.round(40 + 55 * tr)}%,${Math.round(80 - 18 * tr)}%)`); });
function transitAt(p) { return smoothstep(p, 0.10, 0.18) * (1 - smoothstep(p, 0.80, 0.87)); }
const TRAVEL = (() => {
  const n = 1000, arr = new Float32Array(n + 1); let acc = 0;
  for (let i = 0; i <= n; i++) { arr[i] = acc; acc += (1.2 + 62 * transitAt(i / n)) / n; }
  return arr;
})();
function travelAt(p) { const f = clamp(p, 0, 1) * 1000, i = Math.floor(f), j = Math.min(1000, i + 1); return TRAVEL[i] + (TRAVEL[j] - TRAVEL[i]) * (f - i); }
function worldWeight(w, p) { return smoothstep(p, w.a - 0.004, w.a + 0.012) * (1 - smoothstep(p, w.b - 0.004, w.b + 0.012)); }
function hudIndex(p) { if (p < PORTALS[0]) return 0; if (p >= PORTALS[4]) return 5; for (let i = 0; i < 4; i++) if (p < WORLDS[i].b) return i + 1; return 5; }

const night = { ctx: null, W: 0, H: 0, parts: [], stars: [], clouds: [], sky: null, cyan: null, cloudSpr: [], vel: 0 };

function sprite(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return c;
}
function cloudSprite(w, seed) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), r = rng(seed);
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const x = 100 + r() * 56, y = 100 + r() * 56, rad = 36 + r() * 52, col = r() < 0.55 ? w.h1 : w.h2;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, rgba(col, 0.22)); gr.addColorStop(1, rgba(col, 0));
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  }
  return c;
}

function makeScene() {
  const { W, H } = night, r = rng(7);
  const NT = clamp(Math.round(W * H / 2400), 260, 560);
  const GA = Math.PI * (3 - Math.sqrt(5));
  night.parts = [];
  for (let i = 0; i < NT; i++) {
    const ring = i % 5 === 0;
    const yy = 1 - 2 * (i + 0.5) / NT, rr = Math.sqrt(1 - yy * yy), th = i * GA;
    night.parts.push({ ring, ux: Math.cos(th) * rr, uy: yy, uz: Math.sin(th) * rr, th: r() * TAU, rr: 1.08 + r() * 0.16,
      ang: r() * TAU, rad: 0.35 + r() * 0.9, ph: r() * TAU, sz: 0.9 + r() * 1.5, delay: r() * 0.04 });
  }
  const NS = clamp(Math.round(W * H / 1600), 170, 850);   // same density on small screens
  night.stars = Array.from({ length: NS }, () => ({ th: r() * TAU, rho: 0.22 + Math.pow(r(), 0.7) * 2.8, z0: r() * DEPTH, s: 0.6 + r() * 1.4, ph: r() * TAU }));
  night.clouds = [];
  WORLDS.forEach((w, wi) => {
    for (let i = 0; i < (LITE ? 3 : 6); i++) {
      let x = (r() - 0.5) * 7, y = (r() - 0.5) * 4.4;
      if (Math.abs(x) < 0.9 && Math.abs(y) < 0.7) x += x < 0 ? -1.2 : 1.2;
      night.clouds.push({ wi, x, y, z0: r() * CDEPTH, s: 1.4 + r() * 2.4, spr: i % 2 });
    }
  });
}

function sizeCanvas() {
  const rc = canvas.getBoundingClientRect();
  if (!rc.width || !rc.height) return;
  const dpr = LITE ? 0.7 : Math.min(1.25, devicePixelRatio || 1);
  night.W = rc.width; night.H = rc.height;
  canvas.width = Math.round(rc.width * dpr); canvas.height = Math.round(rc.height * dpr);
  night.ctx = canvas.getContext('2d');
  night.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!night.sky) {
    night.sky = sprite('rgba(255,214,170,.9)', 'rgba(255,110,30,0)');
    night.cyan = sprite('rgba(255,138,31,.95)', 'rgba(255,138,31,0)');
    night.gold = sprite('rgba(255,205,110,.95)', 'rgba(255,120,30,0)');
    night.cloudSpr = WORLDS.map((w, i) => [cloudSprite(w, 11 + i * 31), cloudSprite(w, 97 + i * 13)]);
  }
  makeScene();
}

function boltPoints(x1, y1, x2, y2, rnd, disp) {
  let pts = [[x1, y1], [x2, y2]];
  for (let k = 0; k < 5; k++) {
    const np = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      np.push([(ax + bx) / 2 + (rnd() - 0.5) * disp, (ay + by) / 2 + (rnd() - 0.5) * disp], [bx, by]);
    }
    pts = np; disp *= 0.55;
  }
  return pts;
}
function drawBolt(ctx, pts, glow, a) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.globalAlpha = a * 0.3; ctx.lineWidth = 7; ctx.strokeStyle = glow; ctx.stroke();
  ctx.globalAlpha = a; ctx.lineWidth = 1.5; ctx.strokeStyle = '#fff4e0'; ctx.stroke();
}

function drawWorldExtras(ctx, w, wt, lp, t, vx, vy, F, trav) {
  const { W, H } = night;
  if (w.kind === 'ember') {
    const R = H * (0.32 + 0.12 * lp), sx = vx + W * 0.16, sy = H * 0.98;
    const g = ctx.createRadialGradient(sx, sy, R * 0.2, sx, sy, R * 1.6);
    g.addColorStop(0, rgba([255, 190, 120], 0.55 * wt)); g.addColorStop(0.35, rgba(w.h1, 0.3 * wt)); g.addColorStop(1, rgba(w.h2, 0));
    ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  } else if (w.kind === 'aurora') {
    for (let k = 0; k < 3; k++) {
      const base = H * (0.14 + 0.09 * k), amp = H * 0.06, hh = H * (0.32 - 0.05 * k);
      ctx.beginPath();
      for (let x = -20; x <= W + 20; x += 24) {
        const y = base + Math.sin(x * 0.0042 + t * 0.55 + k * 1.7) * amp + Math.sin(x * 0.011 - t * 0.35 + k) * amp * 0.35;
        x < 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      for (let x = W + 20; x >= -20; x -= 24) {
        const y = base + hh + Math.sin(x * 0.0042 + t * 0.55 + k * 1.7) * amp * 0.6;
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      const g = ctx.createLinearGradient(0, base - amp, 0, base + hh);
      const col = k === 1 ? w.h2 : w.h1;
      g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.25, rgba(col, 0.32 * wt)); g.addColorStop(1, rgba(col, 0));
      ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.fill();
    }
  } else if (w.kind === 'neon') {
    // perspective grid floor rushing toward the viewer, with towers on both sides
    ctx.lineWidth = 1;
    const camH = 0.9, spacing = 0.7, off = (trav * 0.9) % spacing;
    for (let i = 0; i < 18; i++) {
      const z = 0.3 + i * spacing - off; if (z <= 0.25) continue;
      const y = vy + camH / z * F; if (y > H + 4) continue;
      ctx.globalAlpha = wt * clamp(1 - z / 12, 0, 1) * 0.7; ctx.strokeStyle = rgba(w.h1, 1);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.strokeStyle = rgba(w.h2, 1);
    for (let X = -6; X <= 6; X += 0.75) {
      ctx.globalAlpha = wt * 0.5;
      ctx.beginPath(); ctx.moveTo(vx + X / 0.3 * F, vy + camH / 0.3 * F); ctx.lineTo(vx, vy); ctx.stroke();
    }
    for (let i = 0; i < 14; i++) {
      const side = i % 2 ? 1 : -1, X = side * (1.4 + (i * 0.37) % 1.6), hgt = 0.8 + ((i * 0.53) % 1.4);
      const z = ((i * 1.3 - trav * 0.9) % 9 + 9) % 9 + 0.35;
      const f = F / z, x = vx + X * f, yb = vy + camH * f, yt = yb - hgt * f, wd = 0.35 * f;
      if (x + wd < 0 || x - wd > W) continue;
      const a = wt * clamp((9 - z) / 3, 0, 1) * clamp((z - 0.35) * 2, 0, 1) * (W / H > 1.15 && x < W * 0.48 ? 0.3 : 1);   // keep the caption side calm
      ctx.globalAlpha = a * 0.18; ctx.fillStyle = rgba(w.h1, 1); ctx.fillRect(x - wd / 2, yt, wd, yb - yt);
      ctx.globalAlpha = a * 0.85; ctx.strokeStyle = rgba(i % 3 ? w.h1 : w.h2, 1); ctx.strokeRect(x - wd / 2, yt, wd, yb - yt);
    }
  } else if (w.kind === 'cosmic') {
    // a giant atom around the path: three electron orbits with electrons riding them
    const R = Math.min(W, H) * (0.34 + 0.1 * lp);
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      const rot = i * Math.PI / 3 + t * 0.12, ea = t * (1.1 + i * 0.3) + i * 2;
      ctx.save(); ctx.translate(vx, vy); ctx.rotate(rot);
      ctx.globalAlpha = 0.35 * wt; ctx.strokeStyle = rgba(w.h2, 1);
      ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.32, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = wt; ctx.drawImage(night.gold, Math.cos(ea) * R - 9, Math.sin(ea) * R * 0.32 - 9, 18, 18);
      ctx.restore();
    }
  }
}

function drawPortal(ctx, P, p, t, vx, vy, md) {
  const d = P - p;
  if (d < -0.004 || d > 0.1) return;
  const a = smoothstep(p, P - 0.1, P - 0.07) * (1 - smoothstep(p, P - 0.002, P + 0.004));
  if (a <= 0) return;
  const R = md * 0.006 / (Math.max(d, -0.002) + 0.0065);
  const next = WORLDS.find(w => Math.abs(w.a - P) < 0.001);
  // a glimpse of the next universe inside the ring
  const inner = ctx.createRadialGradient(vx, vy, 0, vx, vy, R);
  if (next) { inner.addColorStop(0, rgba(next.h1, 0.55 * a)); inner.addColorStop(0.6, rgba(next.c0, 0.5 * a)); inner.addColorStop(1, rgba(next.h2, 0.25 * a)); }
  else { inner.addColorStop(0, `rgba(255,240,210,${0.5 * a})`); inner.addColorStop(1, `rgba(255,138,31,${0.2 * a})`); }
  ctx.globalAlpha = 1; ctx.fillStyle = inner; ctx.beginPath(); ctx.arc(vx, vy, R, 0, TAU); ctx.fill();
  // the rainbow rim
  let rim;
  if (ctx.createConicGradient) {
    rim = ctx.createConicGradient(t * 0.8, vx, vy);
    ['#ff4d1f', '#ff8a1f', '#ffc24a', '#fff1c8', '#ffc24a', '#ff8a1f', '#ff4d1f', '#ff4d1f'].forEach((c, i, arr) => rim.addColorStop(i / (arr.length - 1), c));
  } else rim = '#ff8a1f';
  ctx.strokeStyle = rim;
  ctx.globalAlpha = a * 0.25; ctx.lineWidth = Math.max(4, R * 0.16); ctx.beginPath(); ctx.arc(vx, vy, R, 0, TAU); ctx.stroke();
  ctx.globalAlpha = a; ctx.lineWidth = Math.max(1.5, R * 0.035); ctx.beginPath(); ctx.arc(vx, vy, R, 0, TAU); ctx.stroke();
  // swirling arcs inside
  for (let i = 0; i < 5; i++) {
    const rr = R * (0.45 + i * 0.1), st = t * (0.6 + i * 0.35) * (i % 2 ? -1 : 1) + i;
    ctx.globalAlpha = a * 0.45; ctx.lineWidth = Math.max(1, R * 0.012);
    ctx.beginPath(); ctx.arc(vx, vy, rr, st, st + 1.4); ctx.stroke();
  }
  // lightning crawling over the rim
  const rnd = rng(Math.floor(t * 12) * 131 + Math.round(P * 1000));
  for (let i = 0; i < 3; i++) {
    const a1 = rnd() * TAU, a2 = a1 + 0.4 + rnd() * 0.6;
    const pts = boltPoints(vx + Math.cos(a1) * R, vy + Math.sin(a1) * R, vx + Math.cos(a2) * R * 1.04, vy + Math.sin(a2) * R * 1.04, rnd, R * 0.18);
    drawBolt(ctx, pts, '#ffc070', a * 0.85);
  }
}

function drawNight(p, t) {
  const { ctx, W, H } = night;
  if (!ctx) return;
  const wide = W / H > 1.15;
  const vx = wide ? W * 0.72 : W * 0.5;
  const vy = wide ? H * 0.47 : H * 0.33;
  const md = Math.min(W, H), F = md * 0.55;
  const tr = transitAt(p);
  const trav = travelAt(p) + t * (0.05 + 0.35 * tr);
  const wts = WORLDS.map(w => worldWeight(w, p));

  // 1. backgrounds: home night, then each universe's own sky
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#050304'); bg.addColorStop(0.62, '#0b0706'); bg.addColorStop(1, '#120a07');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  WORLDS.forEach((w, i) => {
    if (wts[i] <= 0) return;
    const g = ctx.createRadialGradient(vx, vy, 0, vx, vy, Math.hypot(W, H) * 0.75);
    g.addColorStop(0, rgba(w.c0, 1)); g.addColorStop(1, rgba(w.c1, 1));
    ctx.globalAlpha = wts[i]; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  });
  // 2. the light-bridge rainbow around the edges while travelling
  if (!LITE && tr > 0.01 && ctx.createConicGradient) {
    const cg = ctx.createConicGradient(t * 0.15, vx, vy);
    ['#ff4d1f', '#ff8a1f', '#ffc24a', '#fff1c8', '#ffc24a', '#ff8a1f', '#ff4d1f', '#ff4d1f'].forEach((c, i, arr) => cg.addColorStop(i / (arr.length - 1), c));
    ctx.globalAlpha = 0.11 * tr; ctx.fillStyle = cg; ctx.fillRect(0, 0, W, H);
    const dark = ctx.createRadialGradient(vx, vy, 0, vx, vy, md * 0.75);
    dark.addColorStop(0, 'rgba(6,4,4,0.9)'); dark.addColorStop(1, 'rgba(6,4,4,0)');
    ctx.globalAlpha = tr; ctx.fillStyle = dark; ctx.fillRect(0, 0, W, H);
  }

  ctx.globalCompositeOperation = 'lighter';
  // 3. universe scenery and nebula clouds flying past
  WORLDS.forEach((w, i) => {
    if (wts[i] <= 0) return;
    drawWorldExtras(ctx, w, wts[i], clamp((p - w.a) / (w.b - w.a), 0, 1), t, vx, vy, F, trav);
  });
  for (const c of night.clouds) {
    const wt = wts[c.wi]; if (wt <= 0) continue;
    const zr = ((c.z0 - trav * 0.6) % CDEPTH + CDEPTH) % CDEPTH + 0.4;
    const size = c.s * F / zr, x = vx + c.x / zr * F, y = vy + c.y / zr * F;
    if (x + size < 0 || x - size > W || y + size < 0 || y - size > H) continue;
    if (zr < 0.7) continue;
    const sz = Math.min(size, md * 0.85);
    ctx.globalAlpha = wt * 0.45 * clamp((CDEPTH - zr) / 3, 0, 1) * clamp((zr - 0.7) / 0.9, 0, 1);
    ctx.drawImage(night.cloudSpr[c.wi][c.spr], x - sz, y - sz, sz * 2, sz * 2);
  }

  // 4. stars: calm dots at home, rainbow light streaks while travelling
  const len = 0.015 + tr * (0.22 + Math.min(night.vel * 18, 3.2));
  const settle = smoothstep(p, 0.84, 0.97);
  ctx.lineCap = 'round';
  for (const s of night.stars) {
    const zr = ((s.z0 - trav) % DEPTH + DEPTH) % DEPTH + 0.12;
    const x = Math.cos(s.th) * s.rho, y = Math.sin(s.th) * s.rho;
    const hx = vx + x / zr * F, hy = vy + y / zr * F;
    if (hx < -40 || hx > W + 40 || hy < -40 || hy > H + 40) continue;
    const z2 = zr + len, tx = vx + x / z2 * F, ty = vy + y / z2 * F;
    const a = clamp((DEPTH - zr) / 3, 0, 1) * (0.55 + 0.45 * Math.sin(t * 1.7 + s.ph)) * (1 - 0.5 * settle);
    const hi = Math.round((Math.sin(s.th * 3 + t * 0.5) + 1) * 3.5);
    ctx.globalAlpha = a;
    ctx.strokeStyle = tr > 0.02 ? STAR_PAL[Math.round(tr * 4)][hi] : '#ffd8b0';
    ctx.lineWidth = clamp(s.s * 1.3 / zr, 0.5, 3.4);
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx + 0.01, hy); ctx.stroke();
  }

  // 5. lightning: rare at home, constant in transit, wild in the cosmic universe
  const slot = Math.floor(t * 7), br = rng(slot * 9301 + 7);
  const chance = 0.05 + 0.22 * tr + 0.4 * wts[3];
  if (br() < chance) {
    const edge = br() * 4 | 0, u = br();
    const sx = edge === 0 ? u * W : edge === 1 ? W : edge === 2 ? u * W : 0;
    const sy = edge === 0 ? 0 : edge === 1 ? u * H : edge === 2 ? H : u * H;
    const ex = vx + (br() - 0.5) * md * 0.3, ey = vy + (br() - 0.5) * md * 0.3;
    const cur = WORLDS.findIndex((w, i) => wts[i] > 0.5);
    drawBolt(ctx, boltPoints(sx, sy, ex, ey, br, Math.hypot(ex - sx, ey - sy) * 0.22), cur >= 0 ? rgba(WORLDS[cur].h2, 1) : '#ffb050', 0.75 * (1 - settle * 0.6));
  }

  // 6. portals between universes
  for (const P of PORTALS) drawPortal(ctx, P, p, t, vx, vy, md);

  // 7. home again: the multiverse light spirals back into the living orb (drawn on its own layer)
  const R = wide ? Math.min(W * 0.12, H * 0.23) : Math.min(W * 0.24, H * 0.13);
  const floorY = vy + R * 2.05, dot = wide ? 1 : 0.75;
  if (settle > 0) {
    ctx.save(); ctx.translate(vx, floorY); ctx.scale(1, 0.14);
    const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.8);
    pool.addColorStop(0, `rgba(255,180,80,${0.32 * settle})`); pool.addColorStop(1, 'rgba(255,140,40,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = pool; ctx.beginPath(); ctx.arc(0, 0, R * 1.8, 0, TAU); ctx.fill(); ctx.restore();
    const fl = ctx.createLinearGradient(vx - R * 2.6, 0, vx + R * 2.6, 0);
    fl.addColorStop(0, 'rgba(255,190,90,0)'); fl.addColorStop(0.5, 'rgba(255,200,120,.7)'); fl.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.globalAlpha = 0.45 * settle; ctx.fillStyle = fl; ctx.fillRect(vx - R * 2.6, floorY, R * 5.2, 1.2);
  }
  for (const q of night.parts) {
    const a = smoothstep(p, 0.8 + q.delay, 0.95 + q.delay);
    if (a <= 0 || a >= 1) continue;
    const e = a * a * (3 - 2 * a), ang = q.ang + e * 2.4, rr = q.rad * md * 0.55 * (1 - e) + R * 0.3;
    const x = vx + Math.cos(ang) * rr, y = vy + Math.sin(ang) * rr * 0.7;
    const s = q.sz * dot * (1.2 - 0.5 * e);
    ctx.globalAlpha = Math.sin(Math.PI * a);
    ctx.drawImage(night.gold, x - s * 2, y - s * 2, s * 4, s * 4);
  }

  // 8. the flash of crossing each portal
  let flash = 0;
  for (const P of PORTALS) flash += Math.exp(-Math.pow((p - P) / 0.007, 2));
  if (flash > 0.01) { ctx.globalAlpha = Math.min(0.5, 0.5 * flash); ctx.fillStyle = '#fff0dc'; ctx.fillRect(0, 0, W, H); }

  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
}

/* ---------- optional scrub video (Blob loader, gated seeks) ---------- */
let videoReady = false, seekBusy = false, pendingTime = null;
function requestSeek(t) {
  if (!videoReady || !video.duration) return;
  if (seekBusy) { pendingTime = t; return; }
  seekBusy = true; video.currentTime = t;
}
video.addEventListener('seeked', () => {
  seekBusy = false;
  if (pendingTime !== null) { const t = pendingTime; pendingTime = null; requestSeek(t); }
});
video.addEventListener('error', () => { seekBusy = false; pendingTime = null; if (HAS_VIDEO) failVideo(); });

function failVideo() {
  videoReady = false;
  stage.classList.remove('loading', 'video-ready');
  stage.classList.add('video-failed');
  kick();
}
async function loadHeroBlob() {
  stage.classList.add('loading');
  const ctrl = new AbortController();
  let watchdog = setTimeout(() => ctrl.abort(), 20000);
  const res = await fetch(VIDEO_URL, { priority: 'low', signal: ctrl.signal });
  if (!res.ok || !res.body) throw new Error('video ' + res.status);
  const total = Number(res.headers.get('Content-Length')) || VIDEO_BYTES;
  const reader = res.body.getReader(), chunks = [];
  let got = 0, lastRing = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    clearTimeout(watchdog); watchdog = setTimeout(() => ctrl.abort(), 20000);
    chunks.push(value); got += value.length;
    const frac = Math.min(1, got / total), now = performance.now();
    if (now - lastRing > 100 || frac === 1) { lastRing = now; ring.style.setProperty('--ld', Math.round(126 * (1 - frac))); }
  }
  clearTimeout(watchdog);
  ring.style.setProperty('--ld', 0);
  video.src = URL.createObjectURL(new Blob(chunks, { type: 'video/mp4' }));
  video.load();
  video.addEventListener('canplay', () => {
    videoReady = true;
    stage.classList.remove('loading');
    stage.classList.add('video-ready');
    requestSeek(heroProgress() * video.duration);
  }, { once: true });
}
let heroInited = false;
function initHeroOnce() {
  if (heroInited) return; heroInited = true;
  if (!HAS_VIDEO) return;   // the Night Build canvas carries the hero until the video exists
  posterLayer.style.backgroundImage = `url('${POSTER_URL}')`;
  let started = false;
  const start = () => { if (started) return; started = true; loadHeroBlob().catch(failVideo); };
  const img = new Image(); img.onload = start; img.onerror = start; img.src = POSTER_URL;
  setTimeout(start, 4000);
}

/* ---------- the drive loop (lerped, rests when idle or off-screen) ---------- */
const hudN = $('.hud-n'), hudT = $('.hud-t'); let hudIdx = -1, hudAt = 0;
function updateHud(p, now) {
  if (now - hudAt < 100) return;
  const i = hudIndex(p); if (i === hudIdx) return;
  hudIdx = i; hudAt = now; hudN.textContent = HUD[i][0]; hudT.textContent = HUD[i][1];
}
let prevShown = 0;
const perf = { n: 0, sum: 0 };
let target = 0, shown = 0, rafId = null, lastTick = 0, lastDraw = 0, heroOnScreen = true, scrubOn = false, scrolledFlag = null;

function tick(now) {
  rafId = null;
  const dt = Math.min(100, now - (lastTick || now)); lastTick = now;
  shown += (target - shown) * (1 - Math.pow(1 - 0.14, dt / 16.667));
  const moving = Math.abs(target - shown) >= 0.0005;
  if (!moving) shown = target;
  if (loadK < 1) loadK = Math.min(1, loadK + dt / 1400);
  if (!slowPhone && perf.n < 120 && innerWidth <= 1024 && dt > 0) {
    perf.n++; perf.sum += dt;
    if (perf.n === 120 && perf.sum / perf.n > 40) { slowPhone = true; applyHeroMode(); return; }
  }
  if (videoReady) requestSeek(shown * video.duration);
  updateCaptions(shown);
  const v = Math.abs(shown - prevShown) / Math.max(dt, 1) * 1000; prevShown = shown;
  night.vel += (v - night.vel) * 0.2;
  updateHud(shown, now);
  const ambient = !videoReady && heroOnScreen && !document.hidden;
  const idleGap = LITE ? 32 : transitAt(shown) > 0.05 ? 0 : 33;
  if (!videoReady && ((moving && !LITE) || now - lastDraw >= idleGap)) { drawNight(shown, now / 1000); lastDraw = now; }
  if (scrubOn && heroOnScreen && (moving || loadK < 1 || ambient)) rafId = requestAnimationFrame(tick);
  else lastTick = 0;
}
function kick() { if (rafId === null && scrubOn && heroOnScreen && !document.hidden) rafId = requestAnimationFrame(tick); }
function onScroll() {
  target = heroProgress();
  const sc = target > 0.02;
  if (sc !== scrolledFlag) { scrolledFlag = sc; stage.classList.toggle('scrolled', sc); }
  kick();
}
new IntersectionObserver(es => { heroOnScreen = es[0].isIntersecting; if (heroOnScreen) kick(); }).observe(hero);

/* ---------- static-hero gates (identical strings to the CSS) ---------- */
const GATES = [
  '(orientation: landscape) and (pointer: coarse) and (max-height: 560px)',
  '(prefers-reduced-motion: reduce)'
];
const MQLS = GATES.map(q => matchMedia(q));
function drawStatic() { sizeCanvas(); drawNight(1, 2); }
function enableScrub() {
  if (scrubOn) return; scrubOn = true;
  initHeroOnce();
  sizeCanvas();
  addEventListener('scroll', onScroll, { passive: true });
  bands.forEach(b => { b.op = -1; b.k = -1; });
  unpinFinalStates();
  shown = target = heroProgress();
  updateCaptions(shown);
  onScroll();
}
function disableScrub() {
  if (scrubOn) { scrubOn = false; removeEventListener('scroll', onScroll); if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null; } }
  drawStatic();
}
let slowPhone = false;   // set once if a phone cannot keep up with the journey
function applyHeroMode() {
  document.documentElement.classList.toggle('hero-static', slowPhone);
  const still = slowPhone || MQLS.some(m => m.matches);
  measureHero();   // the hero changes height between modes
  if (still) disableScrub(); else enableScrub();
  measureHero();
}
MQLS.forEach(m => m.addEventListener('change', applyHeroMode));

/* ---------- reduced motion, live in both directions ---------- */
const RM = matchMedia('(prefers-reduced-motion: reduce)');
function pinToFinalStates() { document.body.classList.add('pinned'); $$('.reveal').forEach(r => r.classList.add('in', 'settled')); }
function unpinFinalStates() { document.body.classList.remove('pinned'); sectionDrive(); }
RM.addEventListener('change', e => { if (e.matches) pinToFinalStates(); else applyHeroMode(); });

/* ---------- section drives (scroll-drawn lines), delta-gated ---------- */
const quotes = $$('.quotes li'), notHere = $('.not-here'), problem = $('#problem');
const stepsLine = $('.steps-line'), how = $('#how');
const cache = new Map();
function setVar(el, name, v) {
  const key = el; const prev = cache.get(key);
  const s = v.toFixed(3);
  if (prev === s) return; cache.set(key, s); el.style.setProperty(name, s);
}
function sectionDrive() {
  if (document.body.classList.contains('pinned')) return;
  const vh = innerHeight;
  const pr = problem.getBoundingClientRect();
  const q = clamp((vh * 0.8 - pr.top) / (pr.height * 0.85), 0, 1);
  quotes.forEach((li, i) => setVar(li, '--d', clamp((q - 0.12 - i * 0.12) / 0.14, 0, 1)));
  setVar(notHere, '--n', clamp((q - 0.78) / 0.14, 0, 1));
  const hr = how.getBoundingClientRect();
  setVar(stepsLine, '--d', clamp((vh * 0.75 - hr.top) / (hr.height * 0.55), 0, 1));
}
let secTick = false;
addEventListener('scroll', () => { if (secTick) return; secTick = true; requestAnimationFrame(() => { secTick = false; sectionDrive(); }); }, { passive: true });

/* ---------- nav, reveals, living elements, hidden-tab pause ---------- */
const nav = $('.nav'); let navSolid = null;
function navState() { const s = scrollY > innerHeight * 0.6; if (s !== navSolid) { navSolid = s; nav.classList.toggle('solid', s); } }
addEventListener('scroll', navState, { passive: true });

const revIO = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return;
  e.target.classList.add('in');
  setTimeout(() => e.target.classList.add('settled'), 1700);
  revIO.unobserve(e.target);
}), { threshold: 0.15 });
$$('.reveal').forEach(r => revIO.observe(r));

const liveIO = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('live', e.isIntersecting)));
$$('main section').forEach(s => liveIO.observe(s));

document.addEventListener('visibilitychange', () => { document.body.classList.toggle('paused', document.hidden); if (!document.hidden) kick(); });

let rz;
let lastW = innerWidth, lastH = innerHeight;
addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => {
  const big = innerWidth !== lastW || Math.abs(innerHeight - lastH) > 140;   // phone URL bars only nudge the height
  lastW = innerWidth; lastH = innerHeight;
  measureHero();
  if (scrubOn) { if (big) sizeCanvas(); onScroll(); } else drawStatic();
  sectionDrive();
}, 150); });

/* ---------- request builder ---------- */
const form = $('#bform'), err = $('#err'), done = $('#done'), doneMsg = $('#done-msg');
const pagesIn = $('#pages'), pagesOut = $('#pages-out'), planSel = $('#plan');
const typeMap = { 'Business website': 't-business', 'Online store': 't-store', 'Restaurant or cafe': 't-restaurant', 'Clinic or booking site': 't-booking', 'Portfolio': 't-portfolio', 'Real estate': 't-realestate', 'School or coaching': 't-school', 'Landing page': 't-landing', 'Blog or news': 't-blog', 'Custom web app': 't-app' };
const featMap = { 'WhatsApp chat button': 'f-whatsapp', 'Online payments': 'f-pay', 'Booking calendar': 'f-cal', 'Photo gallery': 'f-gallery', 'Customer reviews': 'f-reviews', 'Blog': 'f-blog', 'Customer logins': 'f-login', 'Google Maps': 'f-map', 'More than one language': 'f-lang', 'Search engine setup (SEO)': 'f-seo' };
const pageRects = ['.p2', '.p3', '.p4', '.p5'].map(s => $('#bp ' + s));

function pagesLabel(n) { return n >= 20 ? '20+ pages' : n + (n === 1 ? ' page' : ' pages'); }
function renderBlueprint() {
  const fd = new FormData(form);
  const type = fd.get('type'), feats = fd.getAll('feat'), pages = Number(fd.get('pages'));
  const on = new Set();
  if (type) { on.add('g-nav'); if (type !== 'Custom web app') on.add('g-hero'); on.add(typeMap[type]); }
  feats.forEach(f => on.add(featMap[f]));
  $$('#bp .grp').forEach(g => g.classList.toggle('on', [...g.classList].some(c => on.has(c))));
  [2, 5, 10, 15].forEach((lim, i) => pageRects[i].classList.toggle('on', pages >= lim));
  pagesOut.textContent = pagesLabel(pages);
  $('#bp-title').textContent = type ? type.toLowerCase().replace(/[^a-z]+/g, '-').replace(/-$/, '') : 'your-website';
  $('#bp-count').textContent = on.size + (on.size === 1 ? ' part' : ' parts');
}
form.addEventListener('input', () => { renderBlueprint(); if (err.textContent) err.textContent = ''; });
renderBlueprint();
addEventListener('pageshow', renderBlueprint);   // browsers restore form choices after a reload

function buildMessage(fd) {
  const feats = fd.getAll('feat');
  const lines = [
    'Hello laylatul-code, I would like a website.',
    'Kind of website: ' + fd.get('type'),
    'Features: ' + (feats.length ? feats.join(', ') : 'Not sure yet'),
    'Pages: about ' + pagesLabel(Number(fd.get('pages'))),
    'Package: ' + fd.get('plan'),
    'When: ' + fd.get('when'),
    'Name: ' + fd.get('name').trim()
  ];
  [['biz', 'Business'], ['phone', 'Phone'], ['city', 'City'], ['notes', 'Notes']].forEach(([k, l]) => {
    const v = (fd.get(k) || '').trim(); if (v) lines.push(l + ': ' + v);
  });
  return lines.join('\n');
}
let lastMsg = '';
form.addEventListener('submit', e => {
  e.preventDefault();
  const via = (e.submitter && e.submitter.dataset.via) || 'wa';
  const fd = new FormData(form);
  if (!fd.get('type')) { err.textContent = 'Pick a kind of website first.'; $('#type-chips input').focus(); return; }
  if (!(fd.get('name') || '').trim()) { err.textContent = 'Add your name so we know who to reply to.'; form.elements.name.focus(); return; }
  err.textContent = '';
  lastMsg = buildMessage(fd);
  if (via === 'wa') {
    window.open('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(lastMsg), '_blank', 'noopener');
    doneMsg.textContent = 'WhatsApp has opened with your request written out. Press send there, and we reply within one working day.';
  } else {
    location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Website request from ' + fd.get('name').trim()) + '&body=' + encodeURIComponent(lastMsg);
    doneMsg.textContent = 'Your email app has opened with your request written out. Press send there, and we reply within one working day.';
  }
  done.hidden = false; done.focus({ preventScroll: true });
  $('#copy').textContent = "Didn't open? Copy my request";
});
$('#copy').addEventListener('click', async () => {
  const btn = $('#copy');
  try { await navigator.clipboard.writeText(lastMsg); btn.textContent = 'Copied. Paste it into WhatsApp or email ' + EMAIL; }
  catch { btn.textContent = 'Copy failed. Email us at ' + EMAIL; }
});

$$('.type').forEach(t => t.addEventListener('click', () => {
  const r = $(`#type-chips input[value="${t.dataset.type}"]`);
  if (r) { r.checked = true; renderBlueprint(); }
  $('#build').scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth' });
}));
$$('.pick').forEach(b => b.addEventListener('click', () => {
  planSel.value = b.dataset.plan; renderBlueprint();
  $('#build').scrollIntoView({ behavior: RM.matches ? 'auto' : 'smooth' });
}));

const wa = $('.wa-link');
wa.href = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent('Hello laylatul-code, I have a question about a website.');
wa.target = '_blank'; wa.rel = 'noopener';
$('#yr').textContent = new Date().getFullYear();

/* ---------- the living orb: one companion that travels the whole site ---------- */
const orbCv = document.createElement('canvas');
orbCv.className = 'orb-layer'; orbCv.setAttribute('aria-hidden', 'true');
document.body.appendChild(orbCv);
const oc = orbCv.getContext('2d');
const orb = { x: innerWidth * 0.72, y: innerHeight * 0.47, vx: 0, vy: 0, R: 40, big: 0, excite: 0, exciteT: 0,
  waves: [], mx: -1, my: -1, trail: [], W: 0, H: 0, pts: [], swarm: [], beams: [], arcs: [], sparks: [], scrollRot: 0, lastSY: scrollY, last: 0, raf: null, anchor: null };
(() => {
  const r = rng(42);
  // a dense shell of embers, thicker near the surface
  for (let i = 0; i < 2000; i++) {
    const u = r() * 2 - 1, th = r() * TAU, rr = Math.sqrt(1 - u * u);
    const rj = 0.62 + Math.pow(r(), 0.45) * 0.55;
    orb.pts.push({ x: Math.cos(th) * rr, y: u, z: Math.sin(th) * rr, rj, ph: r() * TAU });
  }
  // a swirling galaxy disk around it
  for (let i = 0; i < 900; i++) {
    const rr = 1.0 + Math.pow(r(), 0.8) * 0.75;
    orb.swarm.push({ a: r() * TAU, rr, h: (r() - 0.5) * 0.14 * rr, w: 0.32 / rr, ph: r() * TAU });
  }
  // long solar flare beams; some cut straight through the core
  for (let i = 0; i < 24; i++) {
    orb.beams.push({ a: r() * TAU, l: 1.1 + Math.pow(r(), 1.6) * 0.85, through: r() < 0.35, l2: 0.5 + r() * 0.9, w: 1 + r() * 1.8, ph: r() * TAU });
  }
  // bold arc segments
  orb.arcs = [[0.92, 1.3, 0.35, 1], [1.06, 0.7, -0.5, 0.6], [1.22, 1.7, 0.22, 0.8], [0.8, 0.55, -0.7, 1.2]].map(([rr, span, w, k], i) => ({ rr, span, w, k, s: i * 1.7 }));
})();
function sizeOrb() {
  const dpr = LITE ? 0.85 : Math.min(1.25, devicePixelRatio || 1);
  orb.W = innerWidth; orb.H = innerHeight;
  orbCv.width = Math.round(orb.W * dpr); orbCv.height = Math.round(orb.H * dpr);
  oc.setTransform(dpr, 0, 0, dpr, 0, 0);
}
sizeOrb();

// the orb belongs to the hero: it lives inside the journey and shrinks away once you scroll past it
function heroLive() { return heroBox().bottom > orb.H * 0.55; }
function orbTarget() {
  if (heroLive()) {
    const sr = stageBox(), sw = sr.width, sh = sr.height, wide = sw / sh > 1.15;
    const Rbig = wide ? Math.min(sw * 0.12, sh * 0.23) : Math.min(sw * 0.24, sh * 0.13);
    const p = scrubOn ? shown : 1;
    const f = 0.62 - 0.24 * smoothstep(p, 0.08, 0.18) + 0.42 * smoothstep(p, 0.82, 0.95);
    return { x: sr.left + (wide ? sw * 0.72 : sw * 0.5), y: sr.top + (wide ? sh * 0.47 : sh * 0.33), R: Rbig * f, big: scrubOn ? smoothstep(p, 0.84, 0.97) : 1, hero: true };
  }
  return { x: orb.x, y: orb.y, R: 0, big: 0, hero: false };
}

function drawOrb(c, x, y, R, t, ex, big) {
  const r = R * (1 + 0.03 * Math.sin(t * 2.2) + 0.05 * ex);
  const step = Math.max(LITE ? 3 : 1, R > 80 ? 1 : R > 40 ? 2 : R > 22 ? 3 : 5);      // fewer embers when small or on phones
  const unit = Math.max(0.6, r / 120), rot = orb.scrollRot;
  c.globalCompositeOperation = 'lighter';

  // soft solar glow
  const gR = Math.min(r * 2.8, r * 1.6 + 160);
  let g = c.createRadialGradient(x, y, 0, x, y, gR);
  g.addColorStop(0, `rgba(255,140,30,${0.26 + 0.12 * ex})`); g.addColorStop(0.45, 'rgba(255,90,10,0.08)'); g.addColorStop(1, 'rgba(255,80,10,0)');
  c.globalAlpha = 1; c.fillStyle = g; c.fillRect(x - gR, y - gR, gR * 2, gR * 2);

  // the ember shell, drawn in three depth layers
  const spin = t * 0.22 + rot * 0.6, cS = Math.cos(spin), sS = Math.sin(spin), ct = Math.cos(0.32), st = Math.sin(0.32);
  const layers = [[], [], []], ds = Math.max(1.1, r / 85);
  for (let i = 0; i < orb.pts.length; i += step) {
    const q = orb.pts[i];
    const X = q.x * cS - q.z * sS, Z = q.x * sS + q.z * cS, Y2 = q.y * ct - Z * st, Z2 = q.y * st + Z * ct;
    const d = q.rj * (1 + 0.035 * Math.sin(t * 1.7 + q.ph));
    layers[Z2 < -0.33 ? 0 : Z2 < 0.33 ? 1 : 2].push(x + X * r * d, y + Y2 * r * d);
  }
  c.fillStyle = '#ff9a2e';
  [0.4, 0.7, 1].forEach((a, li) => {
    const L = layers[li], s = ds * (0.8 + li * 0.35);
    c.globalAlpha = a;
    for (let i = 0; i < L.length; i += 2) c.fillRect(L[i] - s / 2, L[i + 1] - s / 2, s, s);
  });

  // swirling galaxy disk, tilted around the sphere
  const dt0 = 1.05, cD = Math.cos(dt0), sD = Math.sin(dt0), sc0 = Math.cos(-0.35), ss0 = Math.sin(-0.35);
  c.fillStyle = '#ffb347'; c.globalAlpha = 0.8;
  for (let i = 0; i < orb.swarm.length; i += step) {
    const q = orb.swarm[i], ang = q.a + t * q.w + rot;
    const X = Math.cos(ang) * q.rr, Z = Math.sin(ang) * q.rr, Y = q.h;
    const Y2 = Y * cD - Z * sD;
    const px = X * sc0 - Y2 * ss0, py = X * ss0 + Y2 * sc0, s = ds * 0.9;
    c.fillRect(x + px * r - s / 2, y + py * r - s / 2, s, s);
  }

  // wireframe globe inside
  c.strokeStyle = '#ff8a1f'; c.lineWidth = Math.max(0.7, r / 150); c.globalAlpha = 0.65;
  const gr = r * 0.74;
  for (let k = 0; k < 8; k++) {
    const phi = k * Math.PI / 8 + spin;
    c.beginPath(); c.ellipse(x, y, gr * Math.abs(Math.sin(phi)), gr, 0.12, 0, TAU); c.stroke();
  }
  for (let k = -3; k <= 3; k++) {
    const lat = k * 0.4, yy = y + Math.sin(lat) * gr * ct, rx = Math.cos(lat) * gr;
    c.beginPath(); c.ellipse(x, yy, rx, rx * st, 0.12, 0, TAU); c.stroke();
  }

  // bold arc segments
  c.strokeStyle = '#ff9d2e'; c.lineCap = 'round';
  for (const a of orb.arcs) {
    const a0 = a.s + t * a.w + rot * a.k;
    c.globalAlpha = 0.25; c.lineWidth = Math.max(4, r * 0.09);
    c.beginPath(); c.arc(x, y, r * a.rr, a0, a0 + a.span); c.stroke();
    c.globalAlpha = 0.9; c.lineWidth = Math.max(1.5, r * 0.035);
    c.beginPath(); c.arc(x, y, r * a.rr, a0, a0 + a.span); c.stroke();
  }

  // solar flare beams: they turn with the scroll, so scrolling down sweeps them down
  const reach = 1 + 0.25 * ex + 0.15 * big;
  for (const b of orb.beams) {
    const ang = b.a + rot + Math.sin(t * 0.3 + b.ph) * 0.03;
    const len = r * b.l * reach * (0.9 + 0.12 * Math.sin(t * 3.1 + b.ph));
    const back = b.through ? -r * b.l2 : r * 0.12;
    const ca = Math.cos(ang), sa = Math.sin(ang);
    const x0 = x + ca * back, y0 = y + sa * back, x1 = x + ca * len, y1 = y + sa * len;
    const lg = c.createLinearGradient(x0, y0, x1, y1);
    lg.addColorStop(0, 'rgba(255,170,60,0.35)'); lg.addColorStop(b.through ? 0.45 : 0.08, 'rgba(255,190,90,1)'); lg.addColorStop(1, 'rgba(255,110,20,0)');
    c.strokeStyle = lg;
    c.globalAlpha = 0.22; c.lineWidth = b.w * unit * 4; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.globalAlpha = 0.95; c.lineWidth = b.w * unit; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  }

  // white-gold core
  g = c.createRadialGradient(x, y, 0, x, y, r * 0.55);
  g.addColorStop(0, 'rgba(255,253,235,1)'); g.addColorStop(0.16, 'rgba(255,238,150,1)'); g.addColorStop(0.38, 'rgba(255,170,40,0.55)'); g.addColorStop(1, 'rgba(255,110,20,0)');
  c.globalAlpha = 0.92 + 0.08 * Math.sin(t * 5); c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 0.55, 0, TAU); c.fill();
}

function renderOrb(t) {
  oc.clearRect(0, 0, orb.W, orb.H);
  const { x, y, R } = orb, sp = Math.hypot(orb.vx, orb.vy);
  oc.globalCompositeOperation = 'lighter';
  if (sp > 1.5) {
    oc.fillStyle = '#ff9a2e';
    orb.trail.forEach(([px, py], i) => {
      const a = i / orb.trail.length, s = Math.max(1, R * 0.06 * a);
      oc.globalAlpha = a * 0.5 * Math.min(1, sp / 12); oc.fillRect(px - s / 2, py - s / 2, s, s);
    });
  }
  drawOrb(oc, x, y, R, t, orb.excite, orb.big);
  // sparks shed by the flares, falling as you scroll down
  oc.strokeStyle = '#ffb04a'; oc.lineCap = 'round';
  for (const s of orb.sparks) {
    oc.globalAlpha = Math.max(0, s.life); oc.lineWidth = s.w;
    oc.beginPath(); oc.moveTo(s.x, s.y); oc.lineTo(s.x - s.vx * 3, s.y - s.vy * 3); oc.stroke();
  }
  orb.waves = orb.waves.filter(w => t - w < 1.2);
  for (const w of orb.waves) {
    const k = (t - w) / 1.2;
    oc.globalAlpha = (1 - k) * 0.6; oc.strokeStyle = '#ffb04a'; oc.lineWidth = 2;
    oc.beginPath(); oc.arc(x, y, R * (1.2 + k * 3), 0, TAU); oc.stroke();
  }
  oc.globalAlpha = 1; oc.globalCompositeOperation = 'source-over';
}

function stepOrb(now) {
  orb.raf = null;
  const dt = Math.min(50, now - (orb.last || now)); orb.last = now;
  const t = now / 1000, k = dt / 16.667, T = orbTarget();
  if (!T.hero && orb.R < 0.8 && !orb.sparks.length) { oc.clearRect(0, 0, orb.W, orb.H); orb.asleep = true; return; }
  // alive: a gentle drift around its spot in the hero
  const tx = T.x + Math.sin(t * 0.7) * T.R * 0.1 + Math.sin(t * 1.9) * T.R * 0.03;
  const ty = T.y + Math.cos(t * 0.9) * T.R * 0.1;
  orb.vx += (tx - orb.x) * 0.14 * k; orb.vy += (ty - orb.y) * 0.14 * k;
  const damp = Math.pow(0.66, k);
  orb.vx *= damp; orb.vy *= damp;
  orb.x += orb.vx * k; orb.y += orb.vy * k;
  orb.R += (T.R - orb.R) * (1 - Math.pow(0.88, k));
  orb.big += (T.big - orb.big) * (1 - Math.pow(0.88, k));
  orb.excite += (orb.exciteT - orb.excite) * (1 - Math.pow(0.9, k));
  orb.trail.push([orb.x, orb.y]); if (orb.trail.length > 18) orb.trail.shift();
  const sy = scrollY, sv = (sy - orb.lastSY) / Math.max(dt, 1); orb.lastSY = sy;
  orb.scrollRot += (sy * 0.0016 - orb.scrollRot) * (1 - Math.pow(0.85, k));
  if (T.hero && sv > 0.05 && orb.sparks.length < 180) {
    const n = Math.min(7, Math.ceil(sv * 3) * (orb.R > 40 ? 2 : 1));
    for (let i = 0; i < n; i++) {
      const ang = Math.PI * (0.12 + Math.random() * 0.76), sp = 1 + Math.random() * 2.2;
      orb.sparks.push({ x: orb.x + Math.cos(ang) * orb.R * 0.95, y: orb.y + Math.sin(ang) * orb.R * 0.95,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp + Math.min(sv, 3) * 2.5, life: 1, w: Math.max(1, orb.R / 90) * (0.8 + Math.random()) });
    }
  }
  for (const s of orb.sparks) { s.x += s.vx * k; s.y += s.vy * k; s.vy += 0.09 * k; s.vx *= Math.pow(0.99, k); s.life -= 0.022 * k; }
  orb.sparks = orb.sparks.filter(s => s.life > 0 && s.y < orb.H + 20);
  if (!LITE || now - (orb.lastDraw || 0) >= 32) { renderOrb(t); orb.lastDraw = now; }
  if (!document.hidden && !RM.matches) orb.raf = requestAnimationFrame(stepOrb);
}
function orbStill() {   // reduced motion: the orb sits still at its spot, redrawn only when the page moves
  const T = orbTarget();
  if (!T.hero) { oc.clearRect(0, 0, orb.W, orb.H); return; }
  Object.assign(orb, { x: T.x, y: T.y, R: T.R, big: T.big, vx: 0, vy: 0, excite: 0, scrollRot: scrollY * 0.0016, sparks: [] });
  renderOrb(1.2);
}
function wakeOrb() {
  if (RM.matches) { orbStill(); return; }
  if (orb.asleep && !heroLive()) return;
  orb.asleep = false;
  if (orb.raf === null && !document.hidden) { orb.last = 0; orb.raf = requestAnimationFrame(stepOrb); }
}
addEventListener('scroll', () => { if (RM.matches) requestAnimationFrame(orbStill); else if (orb.asleep) wakeOrb(); }, { passive: true });
addEventListener('resize', () => { sizeOrb(); wakeOrb(); });
document.addEventListener('visibilitychange', wakeOrb);
RM.addEventListener('change', wakeOrb);
wakeOrb();

/* ---------- the tech layer: data rain, a drifting network, atoms, all falling softly down the page ---------- */
const techCv = document.createElement('canvas');
techCv.className = 'tech-layer'; techCv.setAttribute('aria-hidden', 'true');
document.body.insertBefore(techCv, document.body.firstChild);
const tc = techCv.getContext('2d');
const tech = { W: 0, H: 0, rain: [], glyphs: [], nodes: [], atoms: [], hexes: [], packets: [], last: 0, raf: null, lastSY: scrollY, boost: 0, mix: 0.5 };
const GLYPHS = '01001101{}<>/=;ABCDEF#$01';
const trnd = rng(2026);
function techSeed() {
  const { W, H } = tech, area = W * H / 1e6, r = trnd;
  const n = (base, min) => Math.max(min, Math.round(base * area));
  tech.rain = Array.from({ length: n(70, 26) }, () => ({ x: r() * W, y: r() * H, v: 0.6 + r() * 2.2, l: 8 + r() * 36, a: 0.12 + r() * 0.3 }));
  tech.glyphs = Array.from({ length: n(30, 12) }, () => ({ x: r() * W, y: r() * H, v: 0.25 + r() * 0.7, c: GLYPHS[(r() * GLYPHS.length) | 0], s: 10 + r() * 5, a: 0.1 + r() * 0.2, swap: r() * 3 }));
  tech.nodes = Array.from({ length: n(34, 16) }, () => ({ x: r() * W, y: r() * H, v: 0.15 + r() * 0.45, ph: r() * TAU, sw: 6 + r() * 18 }));
  tech.atoms = Array.from({ length: n(3.2, 2) }, () => ({ x: r() * W, y: r() * H, v: 0.12 + r() * 0.25, R: 22 + r() * 30, rot: r() * TAU, sp: (0.3 + r() * 0.5) * (r() < 0.5 ? -1 : 1),
    nuc: Array.from({ length: 7 + ((r() * 5) | 0) }, (_, i) => ({ dx: (r() - 0.5) * 0.36, dy: (r() - 0.5) * 0.36, p: i % 2 === 0 })) }));
  tech.hexes = Array.from({ length: n(5, 3) }, () => ({ x: r() * W, y: r() * H, v: 0.1 + r() * 0.2, s: 14 + r() * 26, rot: r() * TAU, sp: (r() - 0.5) * 0.01 }));
  tech.packets = [];
}
function sizeTech() {
  tech.W = innerWidth; tech.H = innerHeight;
  techCv.width = tech.W; techCv.height = tech.H;   // 1x is plenty for soft background particles
  techSeed();
}
sizeTech();

function wrapY(o, pad) { if (o.y > tech.H + pad) { o.y = -pad; o.x = trnd() * tech.W; return true; } return false; }

function drawTech(t, k) {
  const { W, H } = tech, c = tc;
  c.clearRect(0, 0, W, H);
  const fall = 1 + tech.boost;                     // scrolling down makes everything rain faster
  const m = tech.mix;                              // softer while the hero journey is on screen
  c.globalCompositeOperation = 'lighter';

  // network: drifting nodes linked when close, with packets running along the links
  const LINK = Math.min(170, W * 0.14);
  for (const nd of tech.nodes) { nd.y += nd.v * fall * k; wrapY(nd, 20); }
  c.lineWidth = 1;
  for (let i = 0; i < tech.nodes.length; i++) {
    const a = tech.nodes[i], ax = a.x + Math.sin(t * 0.4 + a.ph) * a.sw;
    for (let j = i + 1; j < tech.nodes.length; j++) {
      const b = tech.nodes[j], bx = b.x + Math.sin(t * 0.4 + b.ph) * b.sw;
      const d = Math.hypot(ax - bx, a.y - b.y);
      if (d < LINK) {
        c.globalAlpha = (1 - d / LINK) * 0.18 * m; c.strokeStyle = '#ffe2bf';
        c.beginPath(); c.moveTo(ax, a.y); c.lineTo(bx, b.y); c.stroke();
        if (tech.packets.length < 14 && trnd() < 0.0025 * k) tech.packets.push({ a: i, b: j, p: 0 });
      }
    }
    c.globalAlpha = (0.35 + 0.25 * Math.sin(t * 2 + a.ph)) * m; c.fillStyle = '#fff1dc';
    c.beginPath(); c.arc(ax, a.y, 1.6, 0, TAU); c.fill();
  }
  tech.packets = tech.packets.filter(pk => {
    pk.p += 0.02 * k; if (pk.p >= 1) return false;
    const a = tech.nodes[pk.a], b = tech.nodes[pk.b];
    const ax = a.x + Math.sin(t * 0.4 + a.ph) * a.sw, bx = b.x + Math.sin(t * 0.4 + b.ph) * b.sw;
    const x = ax + (bx - ax) * pk.p, y = a.y + (b.y - a.y) * pk.p;
    c.globalAlpha = 0.8 * m * Math.sin(Math.PI * pk.p); c.fillStyle = '#ffc070';
    c.beginPath(); c.arc(x, y, 2.2, 0, TAU); c.fill();
    return true;
  });

  // data rain: light streaks with a bright head
  for (const d of tech.rain) {
    d.y += d.v * fall * k; wrapY(d, d.l);
    c.globalAlpha = d.a * 0.35 * m; c.strokeStyle = '#ffecd2'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(d.x, d.y - d.l * fall); c.lineTo(d.x, d.y - d.l * fall * 0.4); c.stroke();
    c.globalAlpha = d.a * 0.8 * m;
    c.beginPath(); c.moveTo(d.x, d.y - d.l * fall * 0.4); c.lineTo(d.x, d.y); c.stroke();
    c.globalAlpha = d.a * 1.6 * m; c.fillStyle = '#fff6ea'; c.fillRect(d.x - 0.8, d.y - 0.8, 1.6, 1.6);
  }

  // falling code characters
  c.textAlign = 'center'; c.fillStyle = '#ffe9cf'; c.font = '500 12px "JetBrains Mono", monospace';
  for (const g of tech.glyphs) {
    g.y += g.v * fall * k; wrapY(g, 20);
    g.swap -= 0.016 * k; if (g.swap < 0) { g.swap = 1 + trnd() * 3; g.c = GLYPHS[(trnd() * GLYPHS.length) | 0]; }
    c.globalAlpha = g.a * m;
    c.fillText(g.c, g.x, g.y);
  }

  // slow hexagon outlines
  c.strokeStyle = '#ffd9a8';
  for (const h of tech.hexes) {
    h.y += h.v * fall * k; h.rot += h.sp * k; wrapY(h, h.s * 2);
    c.globalAlpha = 0.1 * m; c.beginPath();
    for (let i = 0; i <= 6; i++) { const a = h.rot + i * TAU / 6, x = h.x + Math.cos(a) * h.s, y = h.y + Math.sin(a) * h.s; i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke();
  }

  // atoms: a nucleus of protons and neutrons, electrons on three orbits
  for (const at of tech.atoms) {
    at.y += at.v * fall * k; at.rot += 0.002 * k; wrapY(at, at.R * 2);
    const R = at.R;
    c.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      c.save(); c.translate(at.x, at.y); c.rotate(at.rot + i * Math.PI / 3);
      c.globalAlpha = 0.22 * m; c.strokeStyle = '#ffe2bf';
      c.beginPath(); c.ellipse(0, 0, R, R * 0.34, 0, 0, TAU); c.stroke();
      const ea = t * at.sp * (1.6 + i * 0.4) + i * 2.1;
      c.globalAlpha = 0.85 * m; c.fillStyle = '#ffd08a';
      c.beginPath(); c.arc(Math.cos(ea) * R, Math.sin(ea) * R * 0.34, 2.2, 0, TAU); c.fill();
      c.restore();
    }
    for (const nu of at.nuc) {
      c.globalAlpha = 0.55 * m; c.fillStyle = nu.p ? '#ff9a3c' : '#fff0dc';
      c.beginPath(); c.arc(at.x + nu.dx * R * 0.5 + Math.sin(t * 3 + nu.dx * 9) * 0.6, at.y + nu.dy * R * 0.5, Math.max(1.6, R * 0.07), 0, TAU); c.fill();
    }
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}

function stepTech(now) {
  tech.raf = null;
  const dt = Math.min(50, now - (tech.last || now)); tech.last = now;
  const k = dt / 16.667, sy = scrollY, sv = (sy - tech.lastSY) / Math.max(dt, 1); tech.lastSY = sy;
  tech.boost += (clamp(sv * 1.6, 0, 5) - tech.boost) * (1 - Math.pow(0.9, k));
  const inHero = heroBox().bottom > innerHeight * 0.4;
  tech.mix += ((inHero ? 0.45 : 1) - tech.mix) * (1 - Math.pow(0.92, k));
  tech.frame = (tech.frame || 0) + 1;
  if (LITE && inHero) { if (!tech.cleared) { tc.clearRect(0, 0, tech.W, tech.H); tech.cleared = true; } }
  else if ((!LITE && !inHero) || tech.frame % 2 === 0) { tech.cleared = false; drawTech(now / 1000, k * (LITE || inHero ? 2 : 1)); }   // half rate on phones and behind the hero
  if (!document.hidden && !RM.matches) tech.raf = requestAnimationFrame(stepTech);
}
function wakeTech() {
  if (RM.matches) { tech.mix = 1; drawTech(1, 0); return; }   // reduced motion: one still frame
  if (tech.raf === null && !document.hidden) { tech.last = 0; tech.raf = requestAnimationFrame(stepTech); }
}
addEventListener('resize', () => { sizeTech(); wakeTech(); });
document.addEventListener('visibilitychange', wakeTech);
RM.addEventListener('change', wakeTech);
wakeTech();

/* ---------- the cursor: a glowing core and tech ring, shedding sparks and current as it moves ---------- */
const FINE = matchMedia('(pointer: fine) and (hover: hover)');
const cur = { on: false, x: -100, y: -100, rx: -100, ry: -100, vx: 0, vy: 0, seen: false, hot: 0, hotT: 0, down: 0,
  sparks: [], trail: [], raf: null, last: 0, W: 0, H: 0, idle: 0 };
const curCv = document.createElement('canvas');
curCv.className = 'cursor-layer'; curCv.setAttribute('aria-hidden', 'true');
const cc = curCv.getContext('2d');
const HOT = 'a, button, label, summary, select, .type, .plan, input[type="range"]';

function sizeCursor() {
  const dpr = Math.min(1.5, devicePixelRatio || 1);
  cur.W = innerWidth; cur.H = innerHeight;
  curCv.width = Math.round(cur.W * dpr); curCv.height = Math.round(cur.H * dpr);
  cc.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function emit(n, speed, spread) {
  for (let i = 0; i < n && cur.sparks.length < 160; i++) {
    const back = Math.atan2(-cur.vy, -cur.vx), a = (cur.vx || cur.vy) ? back + (Math.random() - 0.5) * spread : Math.random() * TAU;
    const sp = speed * (0.4 + Math.random());
    cur.sparks.push({ x: cur.x, y: cur.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, decay: 0.016 + Math.random() * 0.024,
      w: 0.8 + Math.random() * 1.4, hue: Math.random() });
  }
}
function drawCursor(t) {
  const c = cc, { x, y, rx, ry } = cur;
  c.clearRect(0, 0, cur.W, cur.H);
  if (!cur.seen) return;
  c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';

  // electric current: a jittering zig-zag through the recent path
  if (cur.trail.length > 3) {
    c.beginPath();
    cur.trail.forEach(([px, py], i) => {
      const j = i === cur.trail.length - 1 ? 0 : (Math.random() - 0.5) * 6;
      i ? c.lineTo(px + j, py + j) : c.moveTo(px, py);
    });
    c.strokeStyle = '#ff8a1f'; c.globalAlpha = 0.22; c.lineWidth = 4; c.stroke();
    c.strokeStyle = '#ffe2b0'; c.globalAlpha = 0.75; c.lineWidth = 1.1; c.stroke();
  }

  // sparks
  for (const s of cur.sparks) {
    c.globalAlpha = Math.max(0, s.life);
    c.strokeStyle = s.hue < 0.5 ? '#ffb04a' : s.hue < 0.85 ? '#ff7a1a' : '#fff1d6';
    c.lineWidth = s.w;
    c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x - s.vx * 3, s.y - s.vy * 3); c.stroke();
  }

  // ring: trails a little behind, swells over anything clickable
  const R = 15 + 10 * cur.hot - 5 * cur.down;
  c.globalAlpha = 0.08 + 0.12 * cur.hot; c.fillStyle = '#ff8a1f';
  c.beginPath(); c.arc(rx, ry, R, 0, TAU); c.fill();
  c.strokeStyle = '#ff8a1f'; c.lineWidth = 1.3; c.globalAlpha = 0.55;
  c.beginPath(); c.arc(rx, ry, R, 0, TAU); c.stroke();
  c.lineWidth = 2.4; c.globalAlpha = 0.95; c.strokeStyle = '#ffb04a';
  for (let i = 0; i < 2; i++) { const a0 = t * 2.4 + i * Math.PI; c.beginPath(); c.arc(rx, ry, R + 4, a0, a0 + 0.9); c.stroke(); }
  c.lineWidth = 1; c.globalAlpha = 0.6; c.beginPath();
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 - t * 0.8; c.moveTo(rx + Math.cos(a) * (R + 7), ry + Math.sin(a) * (R + 7)); c.lineTo(rx + Math.cos(a) * (R + 11), ry + Math.sin(a) * (R + 11)); }
  c.stroke();

  // the glowing core sits exactly on the pointer
  const g = c.createRadialGradient(x, y, 0, x, y, 14);
  g.addColorStop(0, 'rgba(255,252,235,1)'); g.addColorStop(0.25, 'rgba(255,214,130,0.95)'); g.addColorStop(0.6, 'rgba(255,138,31,0.35)'); g.addColorStop(1, 'rgba(255,110,20,0)');
  c.globalAlpha = 1 - 0.4 * cur.hot; c.fillStyle = g; c.beginPath(); c.arc(x, y, 14, 0, TAU); c.fill();
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}
function stepCursor(now) {
  cur.raf = null;
  if (!cur.seen) { drawCursor(0); return; }   // pointer left the window: rest until it comes back
  const dt = Math.min(50, now - (cur.last || now)); cur.last = now;
  const k = dt / 16.667, t = now / 1000;
  cur.rx += (cur.x - cur.rx) * (1 - Math.pow(0.78, k)); cur.ry += (cur.y - cur.ry) * (1 - Math.pow(0.78, k));
  cur.hot += (cur.hotT - cur.hot) * (1 - Math.pow(0.8, k));
  cur.down *= Math.pow(0.85, k);
  const speed = Math.hypot(cur.vx, cur.vy);
  if (!RM.matches) {
    if (speed > 0.5) emit(Math.min(6, Math.ceil(speed / 4)), 1.2 + Math.min(speed, 30) * 0.14, 1.5);
    else if ((cur.idle += dt) > 260) { cur.idle = 0; emit(1, 0.6, TAU); }
  }
  for (const s of cur.sparks) { s.x += s.vx * k; s.y += s.vy * k; s.vy += 0.05 * k; s.vx *= Math.pow(0.96, k); s.vy *= Math.pow(0.97, k); s.life -= s.decay * k; }
  cur.sparks = cur.sparks.filter(s => s.life > 0);
  cur.trail.push([cur.x, cur.y]); if (cur.trail.length > 9) cur.trail.shift();
  if (speed < 0.5 && cur.trail.length) cur.trail.shift();
  cur.vx *= Math.pow(0.6, k); cur.vy *= Math.pow(0.6, k);
  drawCursor(t);
  const busy = cur.sparks.length || Math.abs(cur.x - cur.rx) > 0.3 || Math.abs(cur.y - cur.ry) > 0.3 || cur.trail.length;
  if (!document.hidden && (busy || !RM.matches)) cur.raf = requestAnimationFrame(stepCursor);
}
function wakeCursor() { if (cur.on && cur.raf === null && !document.hidden) { cur.last = 0; cur.raf = requestAnimationFrame(stepCursor); } }
function onMove(e) {
  if (e.pointerType !== 'mouse') return;
  cur.vx = e.clientX - cur.x; cur.vy = e.clientY - cur.y;
  if (!cur.seen) { cur.rx = e.clientX; cur.ry = e.clientY; cur.vx = cur.vy = 0; }
  cur.x = e.clientX; cur.y = e.clientY; cur.seen = true;
  wakeCursor();
}
function onOver(e) { cur.hotT = e.target.closest && e.target.closest(HOT) ? 1 : 0; }
function onDown(e) { if (e.pointerType !== 'mouse') return; cur.down = 1; if (!RM.matches) { const v = [cur.vx, cur.vy]; cur.vx = cur.vy = 0; emit(28, 4, TAU); [cur.vx, cur.vy] = v; } wakeCursor(); }
function onLeave() { cur.seen = false; cur.trail = []; drawCursor(0); }
function applyCursor() {
  const want = FINE.matches;
  if (want === cur.on) return;
  cur.on = want;
  document.documentElement.classList.toggle('cursor-on', want);
  if (want) {
    document.body.appendChild(curCv); sizeCursor();
    addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerover', onOver);
    addEventListener('pointerdown', onDown, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeave);
  } else {
    curCv.remove();
    removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerover', onOver);
    removeEventListener('pointerdown', onDown);
    document.documentElement.removeEventListener('mouseleave', onLeave);
  }
}
FINE.addEventListener('change', applyCursor);
addEventListener('resize', () => { if (cur.on) sizeCursor(); });
document.addEventListener('visibilitychange', wakeCursor);
applyCursor();

/* ---------- go ---------- */
if (RM.matches) pinToFinalStates();
applyHeroMode();
sectionDrive();
navState();
})();

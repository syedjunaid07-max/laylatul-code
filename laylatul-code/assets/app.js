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
  if (phoneOn) return;   // on phones the captions live in their own pages and scroll natively
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
const HM = { top: 0, h: 0, sh: 0, sw: 0, pt: [] };
const panels = [];   // phone pages (filled by setPhoneLayout)
function measureHero() { HM.top = hero.offsetTop; HM.h = hero.offsetHeight; HM.sh = stage.offsetHeight; HM.sw = stage.offsetWidth; HM.pt = panels.map(p => p.offsetTop); }
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

/* ---------- the data-centre journey canvas (code-drawn hero, and the fallback when no video) ---------- */
// Scroll down = fly forward down a glowing server hall: dark cabinets with LED strips on both walls, light rails,
// a glossy floor, and a lit gate at each bay (one per kind of website). At the end the light gathers into the orb.
const TAU = Math.PI * 2;
// phones and touch tablets: same look, drawn lighter (lower canvas resolution, fewer extras, 30 fps canvases)
const LITE = matchMedia('(pointer: coarse)').matches || innerWidth <= 820;
const PORTALS = [0.18, 0.34, 0.50, 0.66, 0.82];
const WORLDS = [
  { a: 0.18, b: 0.34, c0: [40, 12, 4], c1: [10, 4, 3], h1: [255, 128, 48] },
  { a: 0.34, b: 0.50, c0: [38, 24, 4], c1: [10, 6, 2], h1: [255, 196, 74] },
  { a: 0.50, b: 0.66, c0: [40, 10, 4], c1: [9, 3, 2],  h1: [255, 96, 30] },
  { a: 0.66, b: 0.82, c0: [34, 16, 6], c1: [8, 4, 3],  h1: [255, 160, 70] }
];
const HUD = [['00', 'Ready for launch'], ['01', 'Online stores'], ['02', 'Restaurants and cafes'], ['03', 'Booking sites'], ['04', 'Web apps'], ['05', 'Your website']];
const DEPTH = 10;
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
// the hall, in camera units: floor below, ceiling above, cabinets every S along both walls
const HALL = { S: 0.9, ZN: 0.2, ZF: 11, KZ: 0.6, YF: 1.0, YT: -0.92, YC: -1.25 };
const hallHW = wide => wide ? 1.55 : 1.12;
// 48 cabinet fronts, reused down the hall: rows of LED strips and dots, some blinking, a few running hot
const RACKS = (() => {
  const r = rng(311);
  return Array.from({ length: 48 }, () => {
    const rows = [], n = LITE ? 9 : 16;
    for (let k = 0; k < n; k++) {
      if (r() < 0.12) continue;
      rows.push({ y: (k + 0.5) / n, x0: 0.04 + r() * 0.2, len: 0.25 + r() * 0.65, dots: r() < 0.35, blink: r() < 0.25 ? 1.5 + r() * 4 : 0, ph: r() * TAU, hot: r() < 0.15 });
    }
    return rows;
  });
})();

function transitAt(p) { return smoothstep(p, 0.10, 0.18) * (1 - smoothstep(p, 0.80, 0.87)); }
const TRAVEL = (() => {
  const n = 1000, arr = new Float32Array(n + 1); let acc = 0;
  for (let i = 0; i <= n; i++) { arr[i] = acc; acc += (1.2 + 62 * transitAt(i / n)) / n; }
  return arr;
})();
function travelAt(p) { const f = clamp(p, 0, 1) * 1000, i = Math.floor(f), j = Math.min(1000, i + 1); return TRAVEL[i] + (TRAVEL[j] - TRAVEL[i]) * (f - i); }
function worldWeight(w, p) { return smoothstep(p, w.a - 0.004, w.a + 0.012) * (1 - smoothstep(p, w.b - 0.004, w.b + 0.012)); }
function hudIndex(p) { if (p < PORTALS[0]) return 0; if (p >= PORTALS[4]) return 5; for (let i = 0; i < 4; i++) if (p < WORLDS[i].b) return i + 1; return 5; }

const night = { ctx: null, W: 0, H: 0, parts: [], stars: [], sky: null, cyan: null, vel: 0 };

// the opening scene: a photo of the hall with its halo rig and platform (text, cards and the old orb removed).
// The live orb sits exactly where the photo's orb was; as you fly off, the photo gives way to the drawn hall, and it returns as you land.
const PLATE = { img: null, fade: null, fadeKey: '' };
const PLATE_A = 1808 / 870, PLATE_ORB = [1166 / 870, 400 / 870], PLATE_R = 300 / 870;   // in units of the photo's height
(() => {
  const im = new Image(); im.decoding = 'async';
  im.src = LITE ? 'assets/hall-plate-sm.jpg' : 'assets/hall-plate.jpg';
  im.decode().then(() => { PLATE.img = im; if (!scrubOn) drawStatic(); }).catch(() => {});
})();
function plateFit(W, H) {
  const wide = W / H > 1.15;
  let Hd, ox, oy;
  if (wide) { Hd = Math.max(H, W / PLATE_A); ox = (W - Hd * PLATE_A) / 2; oy = (H - Hd) / 2; }   // covers the screen; the orb lands right of centre, clear of the captions
  else { Hd = Math.min(W * 1.074, H * 0.6); ox = W / 2 - PLATE_ORB[0] * Hd; oy = H * (W < 720 ? 0.38 : 0.42) - PLATE_ORB[1] * Hd; }   // a band around the orb
  return { wide, Hd, Wd: Hd * PLATE_A, ox, oy, x: ox + PLATE_ORB[0] * Hd, y: oy + PLATE_ORB[1] * Hd, R: PLATE_R * Hd * 0.92 };
}
function plateImage(f) {   // on tall screens the photo is a band, so its top and bottom fade into the hall
  if (f.wide) return PLATE.img;
  const key = Math.round(f.Wd) + 'x' + Math.round(f.Hd);
  if (PLATE.fadeKey !== key) {
    const c = document.createElement('canvas'); c.width = Math.round(f.Wd); c.height = Math.round(f.Hd);
    const g = c.getContext('2d'); g.drawImage(PLATE.img, 0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in';
    const lg = g.createLinearGradient(0, 0, 0, c.height);
    lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(0.16, '#000'); lg.addColorStop(0.84, '#000'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = lg; g.fillRect(0, 0, c.width, c.height);
    PLATE.fade = c; PLATE.fadeKey = key;
  }
  return PLATE.fade;
}
// how much of the photo shows: all of it at rest, fading out (and pushing in) as you fly off, back again as you land
function plateAt(p) {
  if (p < 0.5) return { a: 1 - smoothstep(p, 0.07, 0.2), z: 1 + 0.45 * smoothstep(p, 0.02, 0.2) };
  return { a: smoothstep(p, 0.82, 0.96), z: 0.72 + 0.28 * smoothstep(p, 0.82, 0.97) };
}

function sprite(inner, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return c;
}

function makeScene() {
  const { W, H } = night, r = rng(7);
  const NT = clamp(Math.round(W * H / 2400), 260, 560);
  night.parts = [];
  for (let i = 0; i < NT; i++) night.parts.push({ ang: r() * TAU, rad: 0.35 + r() * 0.9, sz: 0.9 + r() * 1.5, delay: r() * 0.04 });
  // dust hanging in the hall: still motes at rest, streaks of light while you fly
  const NS = clamp(Math.round(W * H / 5200), 70, 260);
  night.stars = Array.from({ length: NS }, () => ({ th: r() * TAU, rho: 0.1 + Math.sqrt(r()) * 0.9, z0: r() * DEPTH, s: 0.6 + r() * 1.4, ph: r() * TAU }));
}

function sizeCanvas() {
  const rc = canvas.getBoundingClientRect();
  if (!rc.width || !rc.height) return;
  const dpr = LITE ? Math.min(1.2, devicePixelRatio || 1) : Math.min(1.25, devicePixelRatio || 1);
  night.W = rc.width; night.H = rc.height;
  canvas.width = Math.round(rc.width * dpr); canvas.height = Math.round(rc.height * dpr);
  night.ctx = canvas.getContext('2d');
  night.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!night.sky) {
    night.sky = sprite('rgba(255,214,170,.9)', 'rgba(255,110,30,0)');
    night.cyan = sprite('rgba(255,138,31,.95)', 'rgba(255,138,31,0)');
    night.gold = sprite('rgba(255,205,110,.95)', 'rgba(255,120,30,0)');
  }
  makeScene();
}

function drawHall(ctx, t, vx, vy, F, cz, wide, md) {
  const C = HALL, HW = hallHW(wide), { W, H } = night;
  const X2 = (X, z) => vx + X / z * F, Y2 = (Y, z) => vy + Y / z * F;
  const fog = z => clamp((C.ZF - z) / (C.ZF * 0.6), 0, 1) * clamp((z - C.ZN) / 0.3, 0, 1);
  const calmL = wide ? 0.62 : 1;   // the caption side stays quieter

  // the far end of the hall glows where the orb hangs
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1;
  let g = ctx.createRadialGradient(vx, vy, 0, vx, vy, md * 0.55);
  g.addColorStop(0, 'rgba(255,150,50,0.2)'); g.addColorStop(1, 'rgba(255,120,30,0)');
  ctx.fillStyle = g; ctx.fillRect(vx - md * 0.55, vy - md * 0.55, md * 1.1, md * 1.1);

  // rails running to the far end: ceiling lamps, cabinet-top trims, floor edges, floor seams
  const rail = (X, Y, a, w) => {
    const z0 = 0.75, x0 = X2(X, z0), y0 = Y2(Y, z0), x1 = X2(X, C.ZF), y1 = Y2(Y, C.ZF);
    const lg = ctx.createLinearGradient(x0, y0, x1, y1);
    lg.addColorStop(0, `rgba(255,170,70,${a})`); lg.addColorStop(0.6, `rgba(255,150,50,${a * 0.6})`); lg.addColorStop(0.93, `rgba(255,130,40,${a * 0.15})`); lg.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.strokeStyle = lg; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  };
  for (const s of [-1, 1]) {
    const k = s < 0 ? calmL : 1;
    rail(s * HW * 0.42, C.YC, 0.55 * k, 2.2); if (!LITE) rail(s * HW * 0.42, C.YC, 0.08 * k, 10);   // ceiling lamps, with a glow
    rail(s * HW, C.YT - 0.05, 0.5 * k, 1.6);                                               // trim along the cabinet tops
    rail(s * HW, C.YF, 0.45 * k, 1.6); if (!LITE) rail(s * HW, C.YF, 0.06 * k, 9);                    // floor edge strips
    for (const f of [0.33, 0.66]) rail(s * HW * f, C.YF, 0.07, 1);                          // floor seams
  }
  rail(0, C.YF, 0.12, 1);
  // cross lines: ceiling beams and floor tiles sliding past
  const beams = new Path2D(), tiles = new Path2D(), half = C.S / 2;
  for (let n = Math.floor((cz + C.ZN) / half); n * half - cz < C.ZF; n++) {
    const z = n * half - cz; if (z <= 0.55) continue;
    const xl = X2(-HW, z), xr = X2(HW, z);
    tiles.moveTo(xl, Y2(C.YF, z)); tiles.lineTo(xr, Y2(C.YF, z));
    if (n % 2 === 0) { beams.moveTo(xl, Y2(C.YC, z)); beams.lineTo(xr, Y2(C.YC, z)); }
  }
  ctx.strokeStyle = '#ff9a3c'; ctx.lineWidth = 1;
  ctx.globalAlpha = 0.07; ctx.stroke(tiles);
  ctx.globalAlpha = 0.12; ctx.stroke(beams);
  ctx.globalAlpha = 1;

  // cabinets: dark fronts first (far to near), lights batched by distance and wall
  ctx.globalCompositeOperation = 'source-over';
  const D = C.S * 0.86, n0 = Math.floor((cz + C.ZN) / C.S) - 1, n1 = Math.ceil((cz + C.ZF) / C.S);
  const ZB = z => z < 1.2 ? 0 : z < 2.6 ? 1 : z < 5 ? 2 : 3, LW = [3, 1.9, 1.25, 0.8], BA = [1, 0.95, 0.75, 0.42];
  const mk = () => Array.from({ length: 8 }, () => new Path2D());
  const strip = mk(), refl = mk(), post = mk(), frame = mk(), leds = [];
  for (let n = n1; n >= n0; n--) for (let sd = 0; sd < 2; sd++) {
    const side = sd ? 1 : -1, X = side * HW, z0 = n * C.S - cz, z1 = z0 + D;
    if (z1 <= C.ZN || z0 >= C.ZF) continue;
    const za = Math.max(z0, C.ZN), xa = X2(X, za), xb = X2(X, z1);
    if (side < 0 ? Math.max(xa, xb) < 0 : Math.min(xa, xb) > W) continue;
    ctx.globalAlpha = fog((za + z1) / 2) * 0.35 + 0.65; ctx.fillStyle = '#0b0706';
    ctx.beginPath(); ctx.moveTo(xa, Y2(C.YT, za)); ctx.lineTo(xb, Y2(C.YT, z1)); ctx.lineTo(xb, Y2(C.YF, z1)); ctx.lineTo(xa, Y2(C.YF, za)); ctx.closePath(); ctx.fill();
    const b = ZB((za + z1) / 2) + sd * 4, rows = RACKS[((n * 7 + sd * 13) % 48 + 48) % 48];
    if (z0 >= C.ZN) { post[b].moveTo(xa, Y2(C.YT, z0)); post[b].lineTo(xa, Y2(C.YF, z0)); }   // the lit edge between cabinets
    frame[b].moveTo(xa, Y2(C.YT, za)); frame[b].lineTo(xb, Y2(C.YT, z1)); frame[b].lineTo(xb, Y2(C.YF, z1)); frame[b].lineTo(xa, Y2(C.YF, za));   // cabinet outline
    const zd = z0 + D * 0.5; if (zd > C.ZN) { frame[b].moveTo(X2(X, zd), Y2(C.YT, zd)); frame[b].lineTo(X2(X, zd), Y2(C.YF, zd)); }   // the split between its two doors
    for (const row of rows) {
      if (row.blink && Math.sin(t * row.blink + row.ph) < -0.2) continue;
      const Y = C.YT + (C.YF - C.YT) * row.y;
      let s0 = z0 + D * row.x0; const s1 = Math.min(z1 - D * 0.04, s0 + D * row.len);
      if (s1 <= C.ZN) continue; s0 = Math.max(s0, C.ZN);
      if (row.dots) {
        for (let d = 0; d < 3; d++) { const zz = s0 + (s1 - s0) * d / 2; leds.push(X2(X, zz), Y2(Y, zz), Math.min(9, F * 0.014 / zz), fog(zz) * (side < 0 ? calmL : 1) * (row.hot ? 1 : 0.7)); }
      } else {
        strip[b].moveTo(X2(X, s0), Y2(Y, s0)); strip[b].lineTo(X2(X, s1), Y2(Y, s1));
        const Yr = 2 * C.YF - Y;   // its reflection in the glossy floor
        refl[b].moveTo(X2(X, s0), Y2(Yr, s0)); refl[b].lineTo(X2(X, s1), Y2(Yr, s1));
      }
    }
  }
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'butt';
  for (let k = 0; k < 8; k++) {
    const q = k & 3, a = BA[q] * (k < 4 ? calmL : 1);
    ctx.strokeStyle = '#ff8a1f'; ctx.globalAlpha = a * 0.22; ctx.lineWidth = Math.max(0.6, LW[q] * 0.5); ctx.stroke(frame[k]);
    ctx.strokeStyle = '#ffa640';
    ctx.globalAlpha = a * 0.95; ctx.lineWidth = LW[q]; ctx.stroke(strip[k]);
    if (!LITE) { ctx.globalAlpha = a * 0.14; ctx.lineWidth = LW[q] * 4; ctx.stroke(strip[k]); }   // phones skip the soft glow passes
    ctx.globalAlpha = a * 0.13; ctx.lineWidth = LW[q] * 3; ctx.stroke(refl[k]);
    ctx.strokeStyle = '#ffb04a';
    ctx.globalAlpha = a * 0.6; ctx.lineWidth = LW[q] * 1.2; ctx.stroke(post[k]);
    if (!LITE) { ctx.globalAlpha = a * 0.1; ctx.lineWidth = LW[q] * 6; ctx.stroke(post[k]); }
  }
  for (let i = 0; i < leds.length; i += 4) {
    const s = leds[i + 2]; ctx.globalAlpha = leds[i + 3];
    ctx.drawImage(night.gold, leds[i] - s, leds[i + 1] - s, s * 2, s * 2);
  }
  ctx.globalAlpha = 1;
}

// a lit gate across the hall at each bay; you fly through it as the caption changes
function drawGate(ctx, z, t, vx, vy, F, wide, i, ga) {
  const C = HALL; if (z <= C.ZN || z >= C.ZF) return;
  const HW = hallHW(wide) * 0.94, a = ga * clamp((C.ZF - z) / 4, 0, 1) * clamp((z - C.ZN) / 0.35, 0, 1);
  const col = i < 4 ? WORLDS[i].h1 : [255, 214, 150];
  const x0 = vx - HW / z * F, x1 = vx + HW / z * F, yt = vy + C.YC * 0.94 / z * F, yb = vy + C.YF / z * F, w = Math.max(1, 0.028 / z * F);
  ctx.strokeStyle = rgba(col, 1); ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(x0, yb); ctx.lineTo(x0, yt); ctx.lineTo(x1, yt); ctx.lineTo(x1, yb);
  ctx.globalAlpha = a * 0.16; ctx.lineWidth = w * 5; ctx.stroke();
  ctx.globalAlpha = a * 0.85; ctx.lineWidth = w; ctx.stroke();
  // an inner frame with light running round it
  const ix0 = vx - HW * 0.86 / z * F, ix1 = vx + HW * 0.86 / z * F, iyt = vy + C.YC * 0.84 / z * F;
  ctx.setLineDash([w * 10, w * 6]); ctx.lineDashOffset = -t * 60;
  ctx.globalAlpha = a * 0.45; ctx.lineWidth = Math.max(0.6, w * 0.45);
  ctx.beginPath(); ctx.moveTo(ix0, yb); ctx.lineTo(ix0, iyt); ctx.lineTo(ix1, iyt); ctx.lineTo(ix1, yb); ctx.stroke();
  ctx.setLineDash([]);
  // the threshold line on the floor
  ctx.globalAlpha = a * 0.6; ctx.lineWidth = w * 0.8; ctx.beginPath(); ctx.moveTo(x0, yb); ctx.lineTo(x1, yb); ctx.stroke();
}

function drawNight(p, t) {
  const { ctx, W, H } = night;
  if (!ctx) return;
  const wide = W / H > 1.15;
  const fit = plateFit(W, H), vx = fit.x, vy = fit.y;   // the vanishing point sits on the orb's home
  const md = Math.min(W, H), F = md * 0.55;
  const tr = transitAt(p), base = travelAt(p);
  const cz = (base + t * (0.05 + 0.35 * tr)) * HALL.KZ;
  const wts = WORLDS.map(w => worldWeight(w, p));
  const settle = smoothstep(p, 0.84, 0.97);
  const pl = plateAt(p), covered = PLATE.img && fit.wide && pl.a > 0.999 && pl.z >= 1;   // the photo fills the screen: skip the hall behind it

  // 1. the hall's darkness, warmed a little differently in each bay
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#060404'); bg.addColorStop(0.55, '#0a0605'); bg.addColorStop(1, '#0e0806');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  if (!covered) WORLDS.forEach((w, i) => {
    if (wts[i] <= 0) return;
    const g = ctx.createRadialGradient(vx, vy, 0, vx, vy, Math.hypot(W, H) * 0.7);
    g.addColorStop(0, rgba(w.c0, 1)); g.addColorStop(1, rgba(w.c1, 0));
    ctx.globalAlpha = wts[i] * 0.5; ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  });

  // 2. the hall itself
  if (!covered) drawHall(ctx, t, vx, vy, F, cz, wide, md);

  // 2b. the photo of the hall, at rest and on landing
  if (PLATE.img && pl.a > 0.004) {
    ctx.save(); ctx.translate(vx, vy); ctx.scale(pl.z, pl.z); ctx.translate(-vx, -vy);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = pl.a;
    ctx.drawImage(plateImage(fit), fit.ox, fit.oy, fit.Wd, fit.Hd);
    ctx.restore(); ctx.globalAlpha = 1;
  }

  // 3. gates at each bay (never over the photo)
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < PORTALS.length; i++) { const P = PORTALS[i], ga = smoothstep(p, P - 0.1, P - 0.06) * (PLATE.img ? 1 - pl.a : 1); if (ga > 0) drawGate(ctx, (travelAt(P) - base) * HALL.KZ + 0.12, t, vx, vy, F, wide, i, ga); }

  // 4. dust: drifting motes at rest, light streaks while flying
  const HW = hallHW(wide), len = 0.015 + tr * (0.18 + Math.min(night.vel * 14, 2.5));
  ctx.lineCap = 'round'; ctx.strokeStyle = '#ffc98a';
  for (const s of night.stars) {
    const zr = ((s.z0 - cz * 1.4) % DEPTH + DEPTH) % DEPTH + 0.15;
    const X = Math.cos(s.th) * s.rho * HW, Y = Math.sin(s.th) * s.rho * 0.95;
    const hx = vx + X / zr * F, hy = vy + Y / zr * F;
    if (hx < -40 || hx > W + 40 || hy < -40 || hy > H + 40) continue;
    const z2 = zr + len, tx = vx + X / z2 * F, ty = vy + Y / z2 * F;
    ctx.globalAlpha = clamp((DEPTH - zr) / 3, 0, 1) * (0.35 + 0.35 * Math.sin(t * 1.7 + s.ph)) * (1 - 0.5 * settle);
    ctx.lineWidth = clamp(s.s * 0.9 / zr, 0.4, 2.4);
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(hx + 0.01, hy); ctx.stroke();
  }

  // 5. the end of the hall: its light spirals into the orb (drawn on its own layer)
  const dot = wide ? 1 : 0.75, R = wide ? Math.min(W * 0.12, H * 0.23) : Math.min(W * 0.24, H * 0.13);
  for (const q of night.parts) {
    const a = smoothstep(p, 0.8 + q.delay, 0.95 + q.delay);
    if (a <= 0 || a >= 1) continue;
    const e = a * a * (3 - 2 * a), ang = q.ang + e * 2.4, rr = q.rad * md * 0.55 * (1 - e) + R * 0.3;
    const x = vx + Math.cos(ang) * rr, y = vy + Math.sin(ang) * rr * 0.7;
    const s = q.sz * dot * (1.2 - 0.5 * e);
    ctx.globalAlpha = Math.sin(Math.PI * a);
    ctx.drawImage(night.gold, x - s * 2, y - s * 2, s * 4, s * 4);
  }

  // 6. a soft wash of light as you pass each gate
  let flash = 0;
  for (const P of PORTALS) flash += Math.exp(-Math.pow((p - P) / 0.006, 2));
  if (flash > 0.01) { ctx.globalAlpha = Math.min(0.22, 0.22 * flash); ctx.fillStyle = '#ffd9a8'; ctx.fillRect(0, 0, W, H); }

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
  updateHud(jp(shown), now);
  const ambient = !videoReady && heroOnScreen && !document.hidden;
  const idleGap = LITE ? 32 : transitAt(shown) > 0.05 ? 0 : 33;
  if (!videoReady && ((moving && !LITE) || now - lastDraw >= idleGap)) { drawNight(jp(shown), now / 1000); lastDraw = now; }
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
  setPhoneLayout(PHONE.matches && !still);
  measureHero();   // the hero changes height between modes
  if (still) disableScrub(); else enableScrub();
  measureHero();
}
MQLS.forEach(m => m.addEventListener('change', applyHeroMode));

/* ---------- phones: the hero becomes four full-screen pages that scroll freely; captions move with the finger ---------- */
const PHONE = matchMedia('(max-width: 720px)');
let phoneOn = false, panelIO = null;
const PHONE_RESTS = [0, 0.42, 0.74, 1];   // where each page lands in the journey: calm moments between portals
function jp(p) {   // page progress -> journey progress
  if (!phoneOn) return p;
  const seg = Math.min(2, Math.floor(p * 3)), f = p * 3 - seg;
  return PHONE_RESTS[seg] + (PHONE_RESTS[seg + 1] - PHONE_RESTS[seg]) * f;
}
function setPhoneLayout(on) {
  if (on === phoneOn) return;
  phoneOn = on;
  hero.classList.toggle('phone', on);
  if (on) {
    panelIO = panelIO || new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('in', e.isIntersecting)), { threshold: 0.35 });
    bands.forEach(b => {
      const pn = document.createElement('div'); pn.className = 'panel';
      pn.appendChild(b.el); hero.appendChild(pn); panels.push(pn); panelIO.observe(pn);
      b.el.style.opacity = ''; b.el.style.setProperty('--k', '1'); b.el.classList.add('live');
    });
  } else {
    const anchor = stage.querySelector('.static-copy');
    bands.forEach(b => { anchor.before(b.el); b.op = -1; b.k = -1; });
    panels.forEach(p => { panelIO.unobserve(p); p.remove(); }); panels.length = 0;
  }
}
PHONE.addEventListener('change', applyHeroMode);

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
  const q = clamp((vh * 0.85 - pr.top) / (Math.min(pr.height, vh) * 0.75), 0, 1);   // finishes while the whole section is on screen
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
const planSel = $('#plan');
const typeMap = { 'Business website': 't-business', 'Online store': 't-store', 'Restaurant or cafe': 't-restaurant', 'Clinic or booking site': 't-booking', 'Portfolio': 't-portfolio', 'Real estate': 't-realestate', 'School or coaching': 't-school', 'Landing page': 't-landing', 'Blog or news': 't-blog', 'Custom web app': 't-app' };
const featMap = { 'WhatsApp chat button': 'f-whatsapp', 'Online payments': 'f-pay', 'Booking calendar': 'f-cal', 'Photo gallery': 'f-gallery', 'Customer reviews': 'f-reviews', 'Blog': 'f-blog', 'Customer logins': 'f-login', 'Google Maps': 'f-map', 'More than one language': 'f-lang', 'Search engine setup (SEO)': 'f-seo' };

function renderBlueprint() {
  const fd = new FormData(form);
  const type = fd.get('type'), feats = fd.getAll('feat');
  const on = new Set();
  if (type) { on.add('g-nav'); if (type !== 'Custom web app') on.add('g-hero'); on.add(typeMap[type]); }
  feats.forEach(f => on.add(featMap[f]));
  $$('#bp .grp').forEach(g => g.classList.toggle('on', [...g.classList].some(c => on.has(c))));
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
stage.insertBefore(orbCv, stage.querySelector('.scrim'));   // inside the hero: above the journey, below the captions
const oc = orbCv.getContext('2d');
const orb = { x: innerWidth * 0.72, y: innerHeight * 0.47, vx: 0, vy: 0, R: 40, big: 0, excite: 0, exciteT: 0,
  waves: [], mx: -1, my: -1, trail: [], W: 0, H: 0, pts: [], swarm: [], beams: [], arcs: [], sparks: [], scrollRot: 0, lastSY: scrollY, last: 0, raf: null, anchor: null };
(() => {
  const r = rng(42);
  // data fragments: short glowing lines and chips scattered over the sphere's surface, in a few shells
  const NF = LITE ? 480 : 850;
  for (let i = 0; i < NF; i++) {
    const lat = Math.asin(r() * 2 - 1) * 0.92, lon = r() * TAU;
    orb.pts.push({ lat, lon, dl: 0.02 + Math.pow(r(), 2.2) * 0.32, rad: 0.82 + r() * 0.2, chip: r() < 0.28, b: 0.45 + r() * 0.55, ph: r() * TAU });
  }
  // floating sparks around it
  for (let i = 0; i < (LITE ? 160 : 320); i++) {
    orb.swarm.push({ lat: Math.asin(r() * 2 - 1), lon: r() * TAU, rad: 0.9 + Math.pow(r(), 1.5) * 0.6, s: 0.6 + r() * 1.4, ph: r() * TAU });
  }
  // fine straight lines crossing the sphere, each carrying a pulse of light
  for (let i = 0; i < 9; i++) orb.beams.push({ a: r() * TAU, off: (r() - 0.5) * 0.5, len: 0.8 + r() * 0.35, sp: 0.2 + r() * 0.5, ph: r() });
  // segmented rings: latitudes and meridians, each with its own dash rhythm
  orb.rings = [];
  for (let k = -5; k <= 5; k++) orb.rings.push({ kind: 'lat', v: k * 0.25, dash: [6 + r() * 30, 3 + r() * 9, 1 + r() * 6, 3 + r() * 8], rad: 0.93 + r() * 0.08 });
  for (let k = 0; k < 8; k++) orb.rings.push({ kind: 'lon', v: k * Math.PI / 8, dash: [8 + r() * 26, 3 + r() * 10, 2 + r() * 4, 4 + r() * 6], rad: 0.95 + r() * 0.06 });
  // partial outer rings, like a hologram's frame
  orb.arcs = [[1.08, 1.6, 0.18, 1], [1.16, 0.9, -0.3, 0.6], [1.24, 2.1, 0.1, 0.8], [1.0, 0.7, -0.45, 1.2]].map(([rr, span, w, k], i) => ({ rr, span, w, k, s: i * 1.7 }));
})();
function sizeOrb() {
  const dpr = LITE ? Math.min(1.6, devicePixelRatio || 1) : Math.min(1.25, devicePixelRatio || 1);   // the orb is the star on phones: keep it crisp
  orb.W = stage.clientWidth || innerWidth; orb.H = stage.clientHeight || innerHeight;
  orbCv.width = Math.round(orb.W * dpr); orbCv.height = Math.round(orb.H * dpr);
  oc.setTransform(dpr, 0, 0, dpr, 0, 0);
}
sizeOrb();

// the orb sits at the centre of the screen behind the whole site; it is the star in the hero and a backdrop elsewhere
function heroLive() { return heroBox().bottom > orb.H * 0.55; }
function orbHome() {   // its resting spot: exactly where the photo's orb was, between the halo rig and the platform
  const hl = heroLive(), f = plateFit(orb.W, orb.H);
  return { x: f.x, y: f.y, R: hl ? f.R : 0, big: 1, hero: hl, soft: true, wide: f.wide };
}
function heroP() { return scrubOn ? jp(shown) : 1; }   // how far down the hall we are (the still hero shows it landed)
// the trip: it lifts off the platform, flies ahead of you down the hall weaving through each bay, then lands on the next platform
function orbTarget() {
  const T = orbHome(); if (!T.R) return T;
  const p = heroP(), fl = smoothstep(p, 0.05, 0.16) * (1 - smoothstep(p, 0.84, 0.95));
  const lift = smoothstep(p, 0.02, 0.1) * (1 - smoothstep(p, 0.88, 0.96));
  if (fl + lift <= 0) return T;
  const W = orb.W, H = orb.H, ph = p * TAU, R0 = T.R;
  if (!T.wide) { T.x += fl * W * 0.14 * Math.sin(ph * 2.3); T.y += fl * H * 0.035 * Math.sin(ph * 1.7 + 0.8); }
  else { T.x += fl * (W * 0.6 - T.x) + fl * W * 0.08 * Math.sin(ph * 2.3); T.y += fl * H * 0.08 * Math.sin(ph * 1.7 + 0.8); }   // weaves right of the captions
  T.y -= lift * R0 * 0.22;
  T.R = R0 * (1 - 0.2 * fl + 0.06 * fl * Math.sin(ph * 3.1));   // a little smaller in flight: it is ahead of you
  return T;
}
// the platform's distance: 1 at rest; it slides under you as you leave, and the next one rises out of the far end as you arrive
function stationAt(p) {
  if (p < 0.5) return { z: 1 - 0.68 * smoothstep(p, 0.06, 0.22), a: 1 - smoothstep(p, 0.13, 0.21) };
  return { z: 1 + 7 * (1 - smoothstep(p, 0.8, 0.95)), a: smoothstep(p, 0.78, 0.86) };
}

/* the projector the orb floats above: a dark platform with turning light rings, a beam rising into the orb, and a halo ring overhead.
   It stays put while the orb drifts. */
function drawPedestal(c, Rnow, t) {
  if (PLATE.img) return;   // the photo has the real platform and halo rig
  const T = orbHome(), st = stationAt(heroP()), A = clamp((Rnow - 8) / 80, 0, 1) * st.a;
  if (!T.R || A <= 0.005) return;
  const R = T.R, narrow = orb.W < 720, x = T.x, lw = Math.max(1, R / 170);
  c.save(); c.translate(T.x, T.y); c.scale(1 / st.z, 1 / st.z); c.translate(-T.x, -T.y);   // the hall's perspective: far = small, near the vanishing point
  const rx = R * (narrow ? 1.0 : 1.3), ry = rx * 0.17, yb = T.y + R * (narrow ? 1.12 : 1.32), th = ry * 0.45;

  // the beam rising from the platform into the orb
  c.globalCompositeOperation = 'lighter';
  let g = c.createLinearGradient(0, yb, 0, T.y);
  g.addColorStop(0, `rgba(255,170,70,${0.14 * A})`); g.addColorStop(1, 'rgba(255,140,40,0)');
  c.globalAlpha = 1; c.fillStyle = g;
  c.beginPath(); c.moveTo(x - rx * 0.6, yb); c.lineTo(x - R * 0.4, T.y); c.lineTo(x + R * 0.4, T.y); c.lineTo(x + rx * 0.6, yb); c.closePath(); c.fill();
  // the pool of light it throws on the floor
  c.save(); c.translate(x, yb + th); c.scale(1, 0.18);
  g = c.createRadialGradient(0, 0, 0, 0, 0, rx * 2.3);
  g.addColorStop(0, `rgba(255,160,60,${0.32 * A})`); g.addColorStop(1, 'rgba(255,120,30,0)');
  c.fillStyle = g; c.fillRect(-rx * 2.3, -rx * 2.3, rx * 4.6, rx * 4.6); c.restore();

  // the platform: a dark disc standing a little proud of the floor
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = 0.94 * A; c.fillStyle = '#0a0605';
  c.beginPath(); c.ellipse(x, yb + th, rx, ry, 0, 0, Math.PI); c.lineTo(x - rx, yb); c.ellipse(x, yb, rx, ry, 0, Math.PI, TAU); c.closePath(); c.fill();
  c.globalCompositeOperation = 'lighter';
  c.strokeStyle = '#ff9a2e'; c.lineWidth = lw;
  c.globalAlpha = 0.45 * A; c.beginPath(); c.ellipse(x, yb + th, rx, ry, 0, 0, Math.PI); c.stroke();   // lower edge
  c.strokeStyle = '#ffc061';
  c.globalAlpha = 0.14 * A; c.lineWidth = lw * 7; c.beginPath(); c.ellipse(x, yb, rx, ry, 0, 0, TAU); c.stroke();
  c.globalAlpha = 0.9 * A; c.lineWidth = lw * 1.3; c.stroke();                                              // bright top rim
  // light rings turning on its surface
  [[0.8, 1, [26, 8, 4, 8]], [0.6, -1.4, [14, 6]], [0.42, 0.8, [40, 10]]].forEach(([k, sp, dash]) => {
    c.setLineDash(dash.map(d => d * lw)); c.lineDashOffset = t * 24 * sp;
    c.globalAlpha = 0.6 * A; c.lineWidth = lw;
    c.beginPath(); c.ellipse(x, yb, rx * k, ry * k, 0, 0, TAU); c.stroke();
  });
  c.setLineDash([]);
  // the bright emitter at its centre
  c.save(); c.translate(x, yb); c.scale(1, 0.2);
  g = c.createRadialGradient(0, 0, 0, 0, 0, rx * 0.4);
  g.addColorStop(0, `rgba(255,236,190,${0.75 * A})`); g.addColorStop(0.4, `rgba(255,170,60,${0.35 * A})`); g.addColorStop(1, 'rgba(255,140,30,0)');
  c.globalAlpha = 1; c.fillStyle = g; c.fillRect(-rx * 0.4, -rx * 0.4, rx * 0.8, rx * 0.8); c.restore();

  // the halo ring overhead
  const yh = T.y - R * (narrow ? 1.18 : 1.3), hx = R * 0.85, hy = hx * 0.17;
  c.strokeStyle = '#ffc061';
  c.globalAlpha = 0.12 * A; c.lineWidth = lw * 7; c.beginPath(); c.ellipse(x, yh, hx, hy, 0, 0, TAU); c.stroke();
  c.globalAlpha = 0.85 * A; c.lineWidth = lw * 1.3; c.stroke();
  c.setLineDash([30 * lw, 10 * lw, 4 * lw, 10 * lw]); c.lineDashOffset = -t * 30;
  c.strokeStyle = '#ff9a2e'; c.globalAlpha = 0.55 * A; c.lineWidth = lw;
  c.beginPath(); c.ellipse(x, yh, hx * 1.18, hy * 1.18, 0, 0, TAU); c.stroke();
  c.setLineDash([]);
  c.restore();
}

/* the orb artwork: one image cut into three soft-edged rings (core, middle, shell) that turn at their own speeds */
const orbImg = new Image();
orbImg.decoding = 'async';
orbImg.src = LITE ? 'assets/orb-sm.jpg' : 'assets/orb.jpg';
orbImg.decode().then(() => {
  const N = orbImg.naturalWidth;
  // turn the photo's black background see-through: brightness becomes opacity, so only the glowing gold remains
  const src = document.createElement('canvas'); src.width = src.height = N;
  const sg = src.getContext('2d', { willReadFrequently: true });
  sg.drawImage(orbImg, 0, 0, N, N);
  const im = sg.getImageData(0, 0, N, N), px = im.data, BLACK = 14, K = 255 / (255 - BLACK);
  for (let i = 0; i < px.length; i += 4) {
    const r = Math.max(0, px[i] - BLACK) * K, g = Math.max(0, px[i + 1] - BLACK) * K, b = Math.max(0, px[i + 2] - BLACK) * K;
    const m = Math.max(r, g, b);
    if (m < 1) { px[i + 3] = 0; continue; }
    px[i] = r * 255 / m; px[i + 1] = g * 255 / m; px[i + 2] = b * 255 / m; px[i + 3] = m;
  }
  sg.putImageData(im, 0, 0);
  // each band keeps the image where its mask is 1; neighbouring bands cross-fade so, unrotated, they add back up to the original
  const bands = [[[0, 1], [0.3, 1], [0.38, 0]], [[0.3, 0], [0.38, 1], [0.6, 1], [0.68, 0]], [[0.6, 0], [0.68, 1], [0.88, 1], [0.97, 0]]];
  orb.layers = bands.map(stops => {
    const cv = document.createElement('canvas'); cv.width = cv.height = N;
    const g = cv.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    const m = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    stops.forEach(([at, a]) => m.addColorStop(at, `rgba(0,0,0,${a})`));
    g.fillStyle = m; g.fillRect(0, 0, N, N);
    return cv;
  });
}).catch(() => {});   // if the image fails, the drawn hologram below stays

/* energy streams: fine filaments curve in from the darkness, wrap around the orb and merge into its shell or its core;
   a few motes of light ride them in, and soft glints mark where they are absorbed */
const feed = { lanes: [], n: LITE ? 70 : 130, glow: 0, glints: [], motes: [], boost: 1 };
const glint = document.createElement('canvas');   // one soft dot of light, reused for every particle
glint.width = glint.height = 32;
(() => {
  const g = glint.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,246,220,1)'); gr.addColorStop(0.22, 'rgba(255,205,120,0.65)'); gr.addColorStop(1, 'rgba(255,140,30,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  const r = rng(77);
  const dirs = [-2.5, -1.45, -0.55, 0.35, 1.2, 2.0, 2.85, 3.6];   // roughly even around the orb, a little irregular
  feed.lanes = dirs.map((a, i) => ({ a: a + (r() - 0.5) * 0.25, wrap: 1.1 + r() * 0.8, spread: 0.12 + r() * 0.08, len: 0.85 + r() * 0.3, ph: r() * TAU,
    end: i % 4 === 1 ? 0.14 : 0.8 + r() * 0.12,   // two bundles dive into the core, the rest merge into the outer shell
    strands: Array.from({ length: LITE ? 3 : 5 }, () => ({ off: (r() - 0.5) * 2, ph: r() * TAU })) }));
  const n = feed.n;
  feed.lane = new Uint8Array(n); feed.u = new Float32Array(n); feed.off = new Float32Array(n); feed.sp = new Float32Array(n); feed.s = new Float32Array(n);
  for (let i = 0; i < n; i++) { feed.lane[i] = (r() * dirs.length) | 0; feed.u[i] = r(); feed.off[i] = (r() - 0.5) * 2; feed.sp[i] = 0.75 + r() * 0.5; feed.s[i] = 0.6 + r() * 0.8; }
  // loose motes drifting in on a slow spiral (distances in orb radii)
  feed.motes = Array.from({ length: LITE ? 14 : 26 }, () => ({ rho: 1 + r() * 2.4, a: r() * TAU, s: 0.6 + r() * 0.9, ph: r() * TAU, sp: 0.7 + r() * 0.6 }));
})();
const smooth = v => { v = clamp(v, 0, 1); return v * v * (3 - 2 * v); };
// a point on a filament: u runs 0 (out in the dark) to 1 (merged); it sweeps round the orb as it closes in, so the curl happens near the sphere
const LP = [0, 0];
function lanePt(L, u, off, x, y, R, D, t) {
  const v = 1 - u, rEnd = R * L.end;
  const rho = rEnd + (D * L.len - rEnd) * Math.pow(v, 1.5);
  const ang = L.a + L.wrap * Math.pow(u, 2.2) + off * L.spread * Math.pow(v, 1.2) + Math.sin(t * 0.4 + L.ph + v * 3) * 0.03 * v;
  LP[0] = x + Math.cos(ang) * rho; LP[1] = y + Math.sin(ang) * rho;
  return LP;
}
function stepFeed(dt, k) {
  const target = 1 + Math.min(1.5, Math.abs(orb.svs || 0) * 2);
  feed.boost += (target - feed.boost) * (1 - Math.pow(0.95, k));   // scrolling feeds it faster, easing in and out
  const d = feed.boost * dt / 1000;
  for (let i = 0; i < feed.n; i++) {
    feed.u[i] += feed.sp[i] * (0.11 + 0.3 * feed.u[i]) * d;   // a calm, steady pull
    if (feed.u[i] >= 1) {
      if (orb.R > 20 && feed.glints.length < 12 && Math.random() < 0.5) feed.glints.push({ l: feed.lane[i], off: feed.off[i], life: 1 });
      feed.glow = Math.min(1, feed.glow + 0.006);
      feed.u[i] = Math.random() * 0.05; feed.off[i] = (Math.random() - 0.5) * 2;
    }
  }
  feed.glow *= Math.pow(0.975, k);
  for (const g of feed.glints) g.life -= 0.035 * k;
  feed.glints = feed.glints.filter(g => g.life > 0);
  for (const m of feed.motes) {
    m.rho -= 0.07 * m.sp * d;
    m.a += 0.16 * m.sp * d / m.rho;   // turns faster the closer it gets
    if (m.rho < 0.9) { m.rho = 2.8 + Math.random() * 0.6; m.a = Math.random() * TAU; }
  }
}
function drawFeed(c, x, y, R, t) {
  const A = clamp((R - 8) / 80, 0, 1); if (A <= 0) return;
  const D = Math.hypot(orb.W, orb.H) * 0.6, lw = Math.max(0.6, R / 320);
  c.globalCompositeOperation = 'lighter'; c.lineCap = 'round'; c.lineJoin = 'round';
  // the filaments: barely there in the dark, brightest where they wrap the orb, fading as they merge
  const cuts = [0, 0.4, 0.72, 0.9, 1], al = [0.035, 0.08, 0.13, 0.05], seg = [new Path2D(), new Path2D(), new Path2D(), new Path2D()], STEP = LITE ? 16 : 26;
  for (const L of feed.lanes) for (const s of L.strands) {
    const off = s.off + Math.sin(t * 0.35 + s.ph) * 0.08;
    for (let q = 0; q < 4; q++) {
      const n = Math.max(2, Math.round(STEP * (cuts[q + 1] - cuts[q])));
      for (let j = 0; j <= n; j++) {
        const p = lanePt(L, cuts[q] + (cuts[q + 1] - cuts[q]) * j / n, off, x, y, R, D, t);
        j ? seg[q].lineTo(p[0], p[1]) : seg[q].moveTo(p[0], p[1]);
      }
    }
  }
  c.strokeStyle = '#ffa93f'; c.lineWidth = lw;
  for (let q = 0; q < 4; q++) { c.globalAlpha = al[q] * A; c.stroke(seg[q]); }
  c.globalAlpha = 0.03 * A; c.lineWidth = lw * 4; c.stroke(seg[2]);   // a faint halo where they wrap the sphere
  // thin light trails riding the filaments, fading in from the dark and dissolving as they merge
  const bk = [new Path2D(), new Path2D(), new Path2D()], heads = [];
  for (let i = 0; i < feed.n; i++) {
    const u = feed.u[i], f = smooth(u / 0.3) * (1 - smooth((u - 0.88) / 0.12));
    if (f < 0.05) continue;
    const L = feed.lanes[feed.lane[i]], tl = 0.03 + 0.03 * u;
    const a = lanePt(L, Math.max(0, u - tl), feed.off[i], x, y, R, D, t), ax = a[0], ay = a[1];
    const b = lanePt(L, u, feed.off[i], x, y, R, D, t);
    const q = f < 0.4 ? 0 : f < 0.75 ? 1 : 2;
    bk[q].moveTo(ax, ay); bk[q].lineTo(b[0], b[1]);
    if (f > 0.3) heads.push(b[0], b[1], feed.s[i], f);
  }
  c.strokeStyle = '#ffc266'; c.lineWidth = lw * 1.1;
  c.globalAlpha = 0.18 * A; c.stroke(bk[0]);
  c.globalAlpha = 0.38 * A; c.stroke(bk[1]);
  c.globalAlpha = 0.6 * A; c.stroke(bk[2]);
  for (let i = 0; i < heads.length; i += 4) {
    const z = lw * 3.5 * heads[i + 2];
    c.globalAlpha = heads[i + 3] * 0.8 * A; c.drawImage(glint, heads[i] - z, heads[i + 1] - z, z * 2, z * 2);
  }
  // loose motes drifting in on a slow spiral
  for (const m of feed.motes) {
    const f = smooth((3.3 - m.rho) / 0.8) * smooth((m.rho - 0.92) / 0.3) * (0.6 + 0.4 * Math.sin(t * 1.7 + m.ph));
    if (f < 0.03) continue;
    const z = lw * 4.5 * m.s;
    c.globalAlpha = f * 0.7 * A; c.drawImage(glint, x + Math.cos(m.a) * m.rho * R - z, y + Math.sin(m.a) * m.rho * R - z, z * 2, z * 2);
  }
}
function drawFeedFlashes(c, x, y, R, t) {   // a soft glint where each stream is absorbed
  if (!feed.glints.length) return;
  const D = Math.hypot(orb.W, orb.H) * 0.6;
  c.globalCompositeOperation = 'lighter';
  for (const g of feed.glints) {
    const p = lanePt(feed.lanes[g.l], 1, g.off, x, y, R, D, t), s = R * 0.045 * (1.5 - g.life * 0.5);
    c.globalAlpha = g.life * 0.6; c.drawImage(glint, p[0] - s, p[1] - s, s * 2, s * 2);
  }
}

function drawOrbArt(c, x, y, R, t, ex) {
  const r = R * 1.08 * (1 + 0.018 * Math.sin(t * 1.9) + 0.04 * ex);   // gentle breathing
  const rot = orb.scrollRot, spin = orb.spin;
  c.globalCompositeOperation = 'lighter';
  // soft golden haze behind it
  const gR = r * 1.9;
  let g = c.createRadialGradient(x, y, r * 0.2, x, y, gR);
  g.addColorStop(0, `rgba(255,150,40,${0.16 + 0.08 * ex})`); g.addColorStop(1, 'rgba(255,110,20,0)');
  c.globalAlpha = 1; c.fillStyle = g; c.fillRect(x - gR, y - gR, gR * 2, gR * 2);
  // the three rings: core and shell turn one way, the middle turns the other; all speed up while you scroll
  const angles = [spin * 1.7 + rot * 0.9 + t * 0.18, -spin * 0.9 - rot * 0.5 - t * 0.09, spin * 0.45 + rot * 0.3 + t * 0.04];
  const flicker = 0.93 + 0.07 * Math.sin(t * 3.3);
  orb.layers.forEach((cv, i) => {
    c.save(); c.translate(x, y); c.rotate(angles[i]);
    c.globalAlpha = flicker;
    c.drawImage(cv, -r, -r, r * 2, r * 2);
    c.restore();
  });
  // the core pulses
  const pulse = 0.5 + 0.5 * Math.sin(t * 2.6);
  g = c.createRadialGradient(x, y, 0, x, y, r * (0.22 + 0.08 * feed.glow));
  const fed = feed.glow;
  g.addColorStop(0, `rgba(255,240,190,${Math.min(1, 0.3 + 0.3 * pulse + 0.5 * fed)})`); g.addColorStop(0.5, `rgba(255,170,60,${0.12 + 0.12 * pulse + 0.25 * fed})`); g.addColorStop(1, 'rgba(255,140,30,0)');
  c.globalAlpha = 1; c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 0.3, 0, TAU); c.fill();
}

function drawOrb(c, x, y, R, t, ex, big) {
  if (orb.layers) { drawOrbArt(c, x, y, R, t, ex); return; }   // the artwork, once loaded
  const r = R * (1 + 0.025 * Math.sin(t * 2.2) + 0.05 * ex);
  const rot = orb.scrollRot, spin = orb.spin + rot * 0.6;
  const cS = Math.cos(spin), sS = Math.sin(spin), tilt = 0.34, ct = Math.cos(tilt), st = Math.sin(tilt);
  // rotate a point on the unit sphere and project it; returns [screenX, screenY, depth(-1 back .. 1 front)]
  const P = (lat, lon, rad) => {
    const cl = Math.cos(lat), X0 = cl * Math.cos(lon), Z0 = cl * Math.sin(lon), Y0 = Math.sin(lat);
    const X = X0 * cS - Z0 * sS, Z = X0 * sS + Z0 * cS, Y2 = Y0 * ct - Z * st, Z2 = Y0 * st + Z * ct;
    return [x + X * r * rad, y - Y2 * r * rad, Z2];
  };
  const thin = Math.max(0.6, r / 220);
  c.globalCompositeOperation = 'lighter'; c.lineCap = 'round';

  // a soft golden haze behind it
  const gR = LITE ? r * 1.8 : r * 2.3;
  let g = c.createRadialGradient(x, y, r * 0.1, x, y, gR);
  g.addColorStop(0, `rgba(255,170,60,${0.22 + 0.1 * ex})`); g.addColorStop(0.5, 'rgba(255,120,20,0.07)'); g.addColorStop(1, 'rgba(255,100,10,0)');
  c.globalAlpha = 1; c.fillStyle = g; c.fillRect(x - gR, y - gR, gR * 2, gR * 2);

  // segmented rings, dim at the back and bright at the front (dashes drawn as short chunks: much cheaper than line dashes)
  const SEG = LITE ? 40 : 48, ringBack = new Path2D(), ringFront = new Path2D(), drift = Math.floor(t * 3);
  orb.rings.forEach((ring, ri) => {
    let prev = null;
    for (let i = 0; i <= SEG; i++) {
      const a = i / SEG * TAU;
      const p = ring.kind === 'lat' ? P(ring.v, a, ring.rad) : P(a, ring.v, ring.rad);
      const on = ((i + ri * 3 + drift * (ring.kind === 'lat' ? 1 : -1)) % 7 + 7) % 7 < 4;   // 4 on, 3 off, sliding slowly
      if (prev && on) { const path = (prev[2] + p[2]) > 0 ? ringFront : ringBack; path.moveTo(prev[0], prev[1]); path.lineTo(p[0], p[1]); }
      prev = p;
    }
  });
  c.strokeStyle = '#ff8a1f'; c.globalAlpha = 0.16; c.lineWidth = thin * 0.9; c.stroke(ringBack);
  c.strokeStyle = '#ffc061'; c.globalAlpha = 0.55; c.lineWidth = thin * 1.2; c.stroke(ringFront);

  // data fragments over the surface: short lines along the latitudes, and little glowing chips
  const step = LITE ? 1 : (R > 60 ? 1 : 2);
  const back = new Path2D(), mid = new Path2D(), fr = new Path2D(), chips = [];
  for (let i = 0; i < orb.pts.length; i += step) {
    const q = orb.pts[i];
    const a = P(q.lat, q.lon, q.rad), b = P(q.lat, q.lon + q.dl, q.rad), d = (a[2] + b[2]) / 2;
    const path = d < -0.3 ? back : d < 0.35 ? mid : fr;
    path.moveTo(a[0], a[1]); path.lineTo(b[0], b[1]);
    if (q.chip && d > -0.2) chips.push(a[0], a[1], d, q.b * (0.6 + 0.4 * Math.sin(t * 3 + q.ph)));
  }
  c.strokeStyle = '#ff9a2e'; c.lineWidth = thin * 1.1; c.globalAlpha = 0.22; c.stroke(back);
  c.strokeStyle = '#ffb347'; c.lineWidth = thin * 1.4; c.globalAlpha = 0.5; c.stroke(mid);
  c.strokeStyle = '#ffd27a'; c.lineWidth = thin * 1.8; c.globalAlpha = 0.9; c.stroke(fr);
  c.fillStyle = '#ffe6a8';
  const cs = Math.max(1.4, r / 70);
  for (let i = 0; i < chips.length; i += 4) {
    c.globalAlpha = Math.min(1, chips[i + 3] * (0.5 + chips[i + 2]));
    c.fillRect(chips[i] - cs, chips[i + 1] - cs * 0.45, cs * 2, cs * 0.9);
  }

  // the swirling loop inside, turning on its own axis
  for (let k = 0; k < 2; k++) {
    const ax = t * (0.5 + k * 0.25) + k * 1.9, ca = Math.cos(ax), sa = Math.sin(ax), rr = 0.5 - k * 0.12;
    c.beginPath();
    for (let i = 0; i <= 48; i++) {
      const a = i / 48 * TAU, px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.45;
      const X = px * ca - py * sa * 0.6, Y = px * sa * 0.5 + py * ca;
      i ? c.lineTo(x + X * r, y + Y * r) : c.moveTo(x + X * r, y + Y * r);
    }
    c.strokeStyle = '#ffcf70'; c.globalAlpha = 0.25; c.lineWidth = thin * 6; c.stroke();
    c.globalAlpha = 0.85; c.lineWidth = thin * 1.8; c.stroke();
  }

  // fine straight lines crossing the sphere, each with a pulse of light running along it
  for (const b of orb.beams) {
    const ang = b.a + rot * 0.5 + Math.sin(t * 0.2 + b.ph * 6) * 0.04, ca = Math.cos(ang), sa = Math.sin(ang);
    const ox = -sa * b.off * r, oy = ca * b.off * r, L = b.len * r * (1 + Math.min(0.4, Math.abs(orb.svs) * 0.6));
    const x0 = x + ox - ca * L, y0 = y + oy - sa * L, x1 = x + ox + ca * L, y1 = y + oy + sa * L;
    const lg = c.createLinearGradient(x0, y0, x1, y1);
    lg.addColorStop(0, 'rgba(255,170,60,0)'); lg.addColorStop(0.5, 'rgba(255,200,110,0.55)'); lg.addColorStop(1, 'rgba(255,170,60,0)');
    c.strokeStyle = lg; c.globalAlpha = 1; c.lineWidth = thin;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    const f = (t * b.sp + b.ph) % 1, px = x0 + (x1 - x0) * f, py = y0 + (y1 - y0) * f;
    c.globalAlpha = Math.sin(Math.PI * f) * 0.9; c.fillStyle = '#fff1c8';
    c.beginPath(); c.arc(px, py, Math.max(1.2, r / 90), 0, TAU); c.fill();
  }

  // partial outer rings
  c.strokeStyle = '#ffb347';
  for (const a of orb.arcs) {
    const a0 = a.s + t * a.w + rot * a.k;
    c.globalAlpha = 0.6; c.lineWidth = thin * 1.6;
    c.beginPath(); c.arc(x, y, r * a.rr, a0, a0 + a.span); c.stroke();
  }

  // floating sparks
  c.fillStyle = '#ffd27a';
  for (let i = 0; i < orb.swarm.length; i += step) {
    const s = orb.swarm[i], p = P(s.lat, s.lon + t * 0.05, s.rad);
    c.globalAlpha = (0.35 + 0.65 * Math.max(0, Math.sin(t * 2.5 + s.ph))) * (p[2] > 0 ? 1 : 0.4);
    const z = s.s * Math.max(0.8, r / 140);
    c.fillRect(p[0] - z / 2, p[1] - z / 2, z, z);
  }

  // the lens at the centre: a dark pupil inside a bright ring, with a glow
  c.globalCompositeOperation = 'source-over';
  g = c.createRadialGradient(x, y, 0, x, y, r * 0.13);
  g.addColorStop(0, 'rgba(25,10,2,0.85)'); g.addColorStop(1, 'rgba(25,10,2,0)');
  c.globalAlpha = 1; c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 0.13, 0, TAU); c.fill();
  c.globalCompositeOperation = 'lighter';
  g = c.createRadialGradient(x, y, r * 0.06, x, y, r * 0.3);
  g.addColorStop(0, 'rgba(255,220,140,0.45)'); g.addColorStop(1, 'rgba(255,150,40,0)');
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 0.3, 0, TAU); c.fill();
  c.strokeStyle = '#fff0c4'; c.globalAlpha = 0.95; c.lineWidth = Math.max(1.5, r * 0.022);
  c.beginPath(); c.arc(x, y, r * 0.1, 0, TAU); c.stroke();
  c.strokeStyle = '#ffb347'; c.globalAlpha = 0.6; c.lineWidth = thin;
  c.beginPath(); c.arc(x, y, r * 0.17, t * 0.8, t * 0.8 + 4.6); c.stroke();
}

function renderOrb(t) {
  oc.clearRect(0, 0, orb.W, orb.H);
  const { x, y, R } = orb, sp = Math.hypot(orb.vx, orb.vy);
  oc.globalCompositeOperation = 'lighter';
  if (sp > 0.4 && R > 6) {   // a comet tail of light behind it while it flies
    const n = orb.trail.length, k = Math.min(1, sp / 6);
    for (let i = 0; i < n - 1; i++) {
      const [px, py] = orb.trail[i], a = i / n, s = R * (0.3 + 0.6 * a);
      oc.globalAlpha = a * a * 0.4 * k; oc.drawImage(glint, px - s, py - s, s * 2, s * 2);
    }
  }
  if (R > 1.5) { drawPedestal(oc, R, t); drawFeed(oc, x, y, R, t); drawOrb(oc, x, y, R, t, orb.excite, orb.big); drawFeedFlashes(oc, x, y, R, t); }
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
  const sy0 = scrollY, svRaw = (sy0 - orb.lastSY) / Math.max(dt, 1);
  orb.svs = (orb.svs || 0) + (svRaw - (orb.svs || 0)) * (1 - Math.pow(0.85, k));            // smoothed scroll speed
  orb.spin = (orb.spin || 0) + (0.22 + Math.min(4, Math.abs(orb.svs) * 3)) * dt / 1000;      // spins faster while you scroll
  // alive: a gentle drift, and it lags against the scroll so you can feel the page moving past it
  const tx = T.x + Math.sin(t * 0.7) * T.R * 0.06 + Math.sin(t * 1.9) * T.R * 0.02;
  const ty = T.y + Math.cos(t * 0.9) * T.R * 0.06 - clamp(orb.svs * 70, -T.R * 0.5, T.R * 0.5);
  const op = 1;   // full strength: the orb itself shrinks away after the hero, the storm stays bright
  orb.op = (orb.op ?? op) + (op - (orb.op ?? op)) * (1 - Math.pow(0.9, k));
  const opS = orb.op.toFixed(2); if (opS !== orb.opS) { orb.opS = opS; orbCv.style.opacity = opS; }
  const stiff = T.soft ? 0.05 : 0.14;   // phones: a softer, slower spring so it glides instead of darting
  orb.vx += (tx - orb.x) * stiff * k; orb.vy += (ty - orb.y) * stiff * k;
  const damp = Math.pow(T.soft ? 0.8 : 0.66, k);
  orb.vx *= damp; orb.vy *= damp;
  orb.x += orb.vx * k; orb.y += orb.vy * k;
  orb.R += (T.R * (1 + Math.min(0.12, Math.abs(orb.svs) * 0.15)) - orb.R) * (1 - Math.pow(0.88, k));
  orb.big += (T.big - orb.big) * (1 - Math.pow(0.88, k));
  orb.excite += (orb.exciteT - orb.excite) * (1 - Math.pow(0.9, k));
  orb.trail.push([orb.x, orb.y]); if (orb.trail.length > 18) orb.trail.shift();
  const sy = scrollY, sv = (sy - orb.lastSY) / Math.max(dt, 1); orb.lastSY = sy;
  orb.scrollRot += (sy * 0.0016 - orb.scrollRot) * (1 - Math.pow(0.85, k));
  if (orb.R > 6 && sv > 0.05 && orb.sparks.length < 180) {
    const n = Math.min(7, Math.ceil(sv * 3) * (orb.R > 40 ? 2 : 1));
    for (let i = 0; i < n; i++) {
      const ang = Math.PI * (0.12 + Math.random() * 0.76), sp = 1 + Math.random() * 2.2;
      orb.sparks.push({ x: orb.x + Math.cos(ang) * orb.R * 0.95, y: orb.y + Math.sin(ang) * orb.R * 0.95,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp + Math.min(sv, 3) * 2.5, life: 1, w: Math.max(1, orb.R / 90) * (0.8 + Math.random()) });
    }
  }
  for (const s of orb.sparks) { s.x += s.vx * k; s.y += s.vy * k; s.vy += 0.09 * k; s.vx *= Math.pow(0.99, k); s.life -= 0.022 * k; }
  orb.sparks = orb.sparks.filter(s => s.life > 0 && s.y < orb.H + 20);
  if (orb.R > 6) stepFeed(dt, k);
  if (now - (orb.lastDraw || 0) >= 32) { renderOrb(t); orb.lastDraw = now; }   // 30 redraws a second is plenty for a hologram
  if (!document.hidden && !RM.matches) orb.raf = requestAnimationFrame(stepOrb);
}
function orbStill() {   // reduced motion: the orb sits still at its spot, redrawn only when the page moves
  const T = orbTarget();
  Object.assign(orb, { x: T.x, y: T.y, R: T.R, big: T.big, vx: 0, vy: 0, excite: 0, svs: 0, spin: 0, scrollRot: scrollY * 0.0016, sparks: [] });
  orbCv.style.opacity = 1;
  renderOrb(1.2);
}
function wakeOrb() {
  if (RM.matches) { orbStill(); return; }
  if (orb.raf === null && !document.hidden) { orb.last = 0; orb.raf = requestAnimationFrame(stepOrb); }
}
addEventListener('scroll', () => { if (RM.matches) requestAnimationFrame(orbStill); }, { passive: true });
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

/* ---------- Explore: plays the page like a video, gliding scene to scene with a pause at each ---------- */
const GLIDE_STOPS_EV = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
let glide = null;
function stopGlide() {
  if (!glide) return;
  cancelAnimationFrame(glide.raf); clearTimeout(glide.wait); glide = null;
  document.documentElement.classList.remove('gliding');
  GLIDE_STOPS_EV.forEach(ev => removeEventListener(ev, stopGlide));
}
function sceneStops() {
  const docTop = el => el.getBoundingClientRect().top + scrollY;
  const range = HM.h - innerHeight, stops = [];
  if (phoneOn && scrubOn) HM.pt.slice(1).forEach(t => stops.push(HM.top + t));            // each hero page
  else if (scrubOn) [0.40, 0.70, 0.97].forEach(p => stops.push(HM.top + p * range));       // each caption, clear of portal flashes
  const pr = $('#problem');                                                                 // strike-throughs finished
  stops.push(phoneOn ? docTop(pr) : docTop(pr) - 70);
  const prEnd = docTop(pr) + pr.offsetHeight - innerHeight + 30;                          // then "Not here." if it sits below the fold
  if (prEnd > stops[stops.length - 1] + 120) stops.push(prEnd);
  stops.push(docTop($('#promises')));
  stops.push(docTop($('#types')));                                                          // the last stop: What we build
  return stops.filter(y => y > scrollY + 8);
}
function startGlide() {
  stopGlide();
  const stops = sceneStops();
  if (!stops.length) return;
  if (RM.matches) { scrollTo({ top: stops[stops.length - 1], behavior: 'auto' }); return; }
  document.documentElement.classList.add('gliding');   // snapping off while it plays
  glide = { raf: 0, wait: 0 };
  const ease = x => 0.5 - 0.5 * Math.cos(Math.PI * x);   // gentle start, gentle stop
  const leg = i => {
    if (!glide) return;
    if (i >= stops.length) { stopGlide(); return; }
    const from = scrollY, to = stops[i], dist = to - from;
    const ms = 2500;   // every move takes 2.5 seconds
    const t0 = performance.now();
    const step = now => {
      if (!glide) return;
      const x = Math.min(1, (now - t0) / ms);
      scrollTo({ top: from + dist * ease(x), behavior: 'instant' });
      if (x < 1) glide.raf = requestAnimationFrame(step);
      else glide.wait = setTimeout(() => leg(i + 1), i === stops.length - 1 ? 0 : 2500);   // hold the scene, then move on
    };
    glide.raf = requestAnimationFrame(step);
  };
  leg(0);
  setTimeout(() => GLIDE_STOPS_EV.forEach(ev => addEventListener(ev, stopGlide, { passive: true })), 50);
}
$$('[data-explore]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); startGlide(); }));

/* ---------- go ---------- */
/* ---------- the scroll line and the orb button ---------- */
// a glowing line on the right edge (with a small orb riding it) replaces the browser's scrollbar; the orb button glides to the next section
const rail = $('.rail'), railFill = $('.rail-fill'), railOrb = $('.rail-orb'), railTip = $('.rail-tip'), orbBtn = $('.orb-btn'), finalSec = $('.final');
let railTouch = false, railTick = false, railH = 0, finalTop = 0, btnUp = null, btnGlide = null, railIdle = 0, railName = '';
// the section names the line shows while you drag it
const RAIL_NAMES = [['#problem', 'Heard this before?'], ['#promises', 'Our promises'], ['#types', 'What we build'], ['#how', 'How it works'], ['#prices', 'Prices'], ['#build', 'Your request'], ['#faq', 'FAQ'], ['.final', "Let's start"]];
let railSecs = [];
function railLabel() { let n = 'Intro'; for (const [t, name] of railSecs) if (scrollY >= t) n = name; return n; }
const maxScroll = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);
const docTopOf = el => el.getBoundingClientRect().top + scrollY;
function updateRail() {
  railTick = false;
  const sp = clamp(scrollY / maxScroll(), 0, 1);
  railFill.style.transform = `scaleY(${sp.toFixed(4)})`;
  const ty = `translateY(${(sp * railH).toFixed(1)}px)`;
  railOrb.style.translate = `0 ${(sp * railH).toFixed(1)}px`;   // 'translate', not 'transform', so the dot's grow animation doesn't scale its position
  if (rail.classList.contains('drag')) {   // the label rides beside the dot, naming the section you're dragging through
    railTip.style.transform = ty;
    const n = railLabel();
    if (n !== railName) { railName = n; railTip.firstChild.textContent = n; if (railTouch && navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(6); }
    railTip.lastChild.textContent = Math.round(sp * 100) + '%';
  }
  const up = scrollY + 12 >= Math.min(finalTop, maxScroll() - 8);
  if (up !== btnUp) { btnUp = up; orbBtn.classList.toggle('up', up); orbBtn.setAttribute('aria-label', up ? 'Back to top' : 'Next section'); }
}
function sizeRail() { railH = rail.clientHeight; finalTop = docTopOf(finalSec); railSecs = RAIL_NAMES.map(([s, n]) => [docTopOf($(s)) - innerHeight * 0.4, n]); updateRail(); }
addEventListener('scroll', () => {
  if (!railTick) { railTick = true; requestAnimationFrame(updateRail); }
  rail.classList.add('moving'); clearTimeout(railIdle); railIdle = setTimeout(() => rail.classList.remove('moving'), 900);   // the line lights up while the page moves
}, { passive: true });
addEventListener('resize', () => requestAnimationFrame(sizeRail));
addEventListener('load', sizeRail);
function btnStops() {
  const stops = [], range = HM.h - innerHeight;
  if (phoneOn && scrubOn) HM.pt.slice(1).forEach(t => stops.push(HM.top + t));              // each hero page
  else if (scrubOn) [0.40, 0.70, 0.97].forEach(p => stops.push(HM.top + p * range));         // each caption in the hall
  $$('main > section').forEach(s => stops.push(docTopOf(s)));
  return stops.map(y => Math.min(y, maxScroll())).filter(y => y > scrollY + 12);
}
function cancelBtnGlide() { if (btnGlide !== null) { cancelAnimationFrame(btnGlide); btnGlide = null; document.documentElement.classList.remove('gliding'); } }
function glideTo(y) {
  stopGlide(); cancelBtnGlide();
  if (RM.matches) { scrollTo({ top: y, behavior: 'auto' }); return; }
  const from = scrollY, dist = y - from, ms = clamp(Math.abs(dist) / innerHeight * 380, 650, 1800), t0 = performance.now();
  const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  document.documentElement.classList.add('gliding');
  const step = now => {
    const x = Math.min(1, (now - t0) / ms);
    scrollTo({ top: from + dist * ease(x), behavior: 'instant' });
    if (x < 1) btnGlide = requestAnimationFrame(step); else { btnGlide = null; document.documentElement.classList.remove('gliding'); }
  };
  btnGlide = requestAnimationFrame(step);
  setTimeout(() => ['wheel', 'touchstart'].forEach(ev => addEventListener(ev, cancelBtnGlide, { passive: true, once: true })), 50);
}
orbBtn.addEventListener('click', () => {
  if (btnUp) { glideTo(0); return; }
  const s = btnStops(); glideTo(s.length ? s[0] : 0);
});
// drag the dot to scroll (finger or mouse); with a mouse the whole line also works like a scrollbar
rail.addEventListener('pointerdown', e => {
  const onDot = !!e.target.closest('.rail-orb'), touch = e.pointerType !== 'mouse';
  if (touch && !onDot) return;   // on touch only the dot is grabbable, so normal swipes near the edge still scroll
  e.preventDefault(); stopGlide(); cancelBtnGlide();
  const cap = onDot ? railOrb : rail; cap.setPointerCapture(e.pointerId);
  const r = rail.getBoundingClientRect(), dotY = r.top + clamp(scrollY / maxScroll(), 0, 1) * r.height;
  const off = onDot ? e.clientY - dotY : 0;   // keep the dot under the finger instead of jumping
  const go = ev => scrollTo({ top: clamp((ev.clientY - off - r.top) / r.height, 0, 1) * maxScroll(), behavior: 'instant' });
  railName = ''; railTouch = touch; rail.classList.add('drag'); updateRail();
  if (!onDot) go(e);
  const end = () => {
    rail.classList.remove('drag');
    cap.removeEventListener('pointermove', go); cap.removeEventListener('pointerup', end); cap.removeEventListener('pointercancel', end);
  };
  cap.addEventListener('pointermove', go); cap.addEventListener('pointerup', end); cap.addEventListener('pointercancel', end);
});

if (RM.matches) pinToFinalStates();
applyHeroMode();
sizeRail();
sectionDrive();
navState();
})();

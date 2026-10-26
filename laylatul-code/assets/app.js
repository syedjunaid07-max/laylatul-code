(() => {
'use strict';

/* ---------- settings the owner may change ---------- */
const WHATSAPP_NUMBER = '910000000000';   // placeholder: digits only, with country code (91...)
const EMAIL = 'abus76416@gmail.com';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const smoothstep = (p, e0, e1) => { const t = clamp((p - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
const TAU = Math.PI * 2;
const LITE = matchMedia('(pointer: coarse)').matches || innerWidth <= 820;   // phones and touch tablets draw lighter
const hero = $('.hero');

/* ---------- lightning helpers ---------- */
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
function drawBolt(ctx, pts, glow, a, w = 1) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.globalAlpha = a * 0.3; ctx.lineWidth = 7 * w; ctx.strokeStyle = glow; ctx.stroke();
  ctx.globalAlpha = a; ctx.lineWidth = 1.5 * w; ctx.strokeStyle = '#fff4e0'; ctx.stroke();
}

/* ---------- reduced motion, live in both directions ---------- */
const RM = matchMedia('(prefers-reduced-motion: reduce)');
function pinToFinalStates() { document.body.classList.add('pinned'); $$('.reveal').forEach(r => r.classList.add('in', 'settled')); }
function unpinFinalStates() { document.body.classList.remove('pinned'); sectionDrive(); }
RM.addEventListener('change', e => { if (e.matches) pinToFinalStates(); else unpinFinalStates(); });

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

document.addEventListener('visibilitychange', () => document.body.classList.toggle('paused', document.hidden));

let rz;
addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(sectionDrive, 150); });

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

/* ---------- hero: the burning ring video, the entrance, and the phone menu ---------- */
// The glow is never drawn in code: a still plate, with the 4s loop fading in over it once its first frame is ready.
const glowVideos = $$('.glow-motion');
function startGlowVideo(v) {
  if (RM.matches || v.dataset.started) return;
  v.dataset.started = '1';
  v.addEventListener('loadeddata', () => { v.classList.add('ready'); if (v.dataset.onscreen === '1') v.play().catch(() => {}); }, { once: true });
  v.addEventListener('error', () => v.remove(), { once: true });
  v.preload = 'auto';
  v.src = 'assets/ring-loop.mp4';
}
const glowIO = new IntersectionObserver(es => es.forEach(en => {
  const v = en.target.querySelector('.glow-motion'); if (!v) return;
  v.dataset.onscreen = en.isIntersecting ? '1' : '0';
  if (en.isIntersecting) { startGlowVideo(v); if (v.classList.contains('ready') && !RM.matches) v.play().catch(() => {}); }
  else v.pause();
}), { rootMargin: '200px 0px' });
glowVideos.forEach(v => glowIO.observe(v.closest('.hero, .final') || v));
RM.addEventListener('change', e => glowVideos.forEach(v => { if (e.matches) { v.pause(); v.classList.remove('ready'); } else if (v.dataset.onscreen === '1') { startGlowVideo(v); v.play().catch(() => {}); } }));

// section headlines wipe up out of a clip as they arrive, like the hero's
$$('main h2').forEach(h => { const inner = h.innerHTML; h.innerHTML = `<span class="wipe"><span>${inner}</span></span>`; });
const wipeIO = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); wipeIO.unobserve(en.target); } }), { threshold: 0.4 });
$$('main h2').forEach(h => wipeIO.observe(h));

// one Web Animations sequence, about 1.9s: nav fades in, badge opens from its centre,
// the headline wipes up out of its clip, then the subline and each button rise
function heroEntrance() {
  if (RM.matches || !document.body.animate) return;
  const E = 'cubic-bezier(.16,1,.3,1)';
  const run = (el, kf, delay, dur = 700) => el && el.animate(kf, { duration: dur, delay, easing: E, fill: 'backwards' });
  const fade = [{ opacity: 0 }, { opacity: 1 }];
  run($('.brand'), [{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }], 0, 600);
  $$('.nav-links a').forEach((a, i) => run(a, fade, 80 + i * 60, 600));
  run($('.nav-cta'), fade, 380, 600);
  run($('.burger'), fade, 200, 600);
  run($('.badge'), [{ opacity: 0, transform: 'scaleX(.2)' }, { opacity: 1, transform: 'scaleX(1)' }], 420, 650);
  $$('.hero h1 .line > span').forEach((s, i) => run(s, [{ transform: 'translateY(110%)' }, { transform: 'translateY(0)' }], 700 + i * 140, 800));
  run($('.hero-sub'), [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], 1150, 650);
  $$('.hero-cta .btn').forEach((b, i) => run(b, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], 1350 + i * 110, 550));
}
heroEntrance();

// phones: the round glass burger opens a dark ember dropdown
const burger = $('.burger'), menu = $('#menu');
function setMenu(open) {
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  menu.hidden = !open;
}
burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
menu.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); burger.focus(); } });
document.addEventListener('click', e => { if (!menu.hidden && !e.target.closest('.nav')) setMenu(false); });

/* ---------- the storm: lightning roots that haul each section up as you scroll ---------- */
const stormCv = document.createElement('canvas');
stormCv.className = 'storm-layer'; stormCv.setAttribute('aria-hidden', 'true');
document.body.appendChild(stormCv);
const sc = stormCv.getContext('2d');
const storm = { W: 0, H: 0, svs: 0, lastY: scrollY, last: 0, raf: null, idle: 0 };
const STORM_SECS = $$('main > section, .foot');
function sizeStorm() {
  const dpr = Math.min(LITE ? 1.25 : 1.5, devicePixelRatio || 1);
  storm.W = innerWidth; storm.H = innerHeight;
  stormCv.width = Math.round(storm.W * dpr); stormCv.height = Math.round(storm.H * dpr);
  sc.setTransform(dpr, 0, 0, dpr, 0, 0);
}
sizeStorm();
function drawStorm(c, t) {
  const W = storm.W, H = storm.H, pull = clamp(storm.svs * 1.4, 0, 1);
  for (const el of STORM_SECS) {
    const top = el.getBoundingClientRect().top, f = top / H;
    const zone = smoothstep(f, 0.1, 0.28) * (1 - smoothstep(f, 0.92, 1.02));
    if (zone < 0.03) continue;
    const I = zone * (0.22 + 0.78 * pull);
    // the edge being hauled up: a bright seam with a blue glow band
    const seam = c.createLinearGradient(0, 0, W, 0);
    seam.addColorStop(0, 'rgba(255,138,31,0)'); seam.addColorStop(0.5, `rgba(255,236,210,${Math.min(1, 1.1 * I)})`); seam.addColorStop(1, 'rgba(255,138,31,0)');
    c.globalAlpha = 1; c.fillStyle = seam; c.fillRect(0, top - 1.5, W, 3);
    const glow = c.createLinearGradient(0, top - 70, 0, top + 30);
    glow.addColorStop(0, 'rgba(255,120,30,0)'); glow.addColorStop(0.7, `rgba(255,120,30,${0.28 * I})`); glow.addColorStop(1, 'rgba(255,120,30,0)');
    c.fillStyle = glow; c.fillRect(0, top - 70, W, 100);
    // lightning roots: from the sky down to the edge, forking as they go, with claws where they grip
    const r = rng(Math.floor(t * 11) * 7919 + Math.round(top / 9));
    const n = 2 + Math.round(I * 6);
    for (let i = 0; i < n; i++) {
      const ex = W * (0.05 + r() * 0.9), sx = ex + (r() - 0.5) * W * 0.35, sy = -20;
      const pts = boltPoints(sx, sy, ex, top, r, Math.hypot(ex - sx, top - sy) * 0.22);
      const a = Math.min(1, I * (0.6 + 0.6 * r()));
      drawBolt(c, pts, '#ff8a1f', a, 1.3);
      for (let b = 0; b < 3; b++) {   // forks
        const p = pts[(4 + r() * (pts.length - 8)) | 0], len = 40 + r() * 110, ang = Math.PI * (0.25 + r() * 0.5);
        drawBolt(c, boltPoints(p[0], p[1], p[0] + Math.cos(ang) * len * (r() < 0.5 ? -1 : 1), p[1] + Math.sin(ang) * len, r, len * 0.3), '#ffb04a', a * 0.7, 0.7);
      }
      for (let k = 0; k < 3; k++) {   // claws gripping the edge
        const kx = ex + (r() - 0.5) * 90;
        drawBolt(c, boltPoints(ex, top, kx, top - 4 - r() * 16, r, 12), '#ffc070', a * 0.8, 0.8);
      }
      c.globalAlpha = a; c.fillStyle = '#fff1dc'; c.beginPath(); c.arc(ex, top, 2.5, 0, TAU); c.fill();   // spark at the grip
    }
    if (pull > 0.3 && r() < 0.22) { c.globalAlpha = 0.07 * I; c.fillStyle = '#ff8a1f'; c.fillRect(0, 0, W, H); }
  }
}
function stepStorm(now) {
  storm.raf = null;
  const dt = Math.min(50, now - (storm.last || now)); storm.last = now;
  const k = dt / 16.667, v = (scrollY - storm.lastY) / Math.max(dt, 1); storm.lastY = scrollY;
  storm.svs += (v - storm.svs) * (1 - Math.pow(0.85, k));
  sc.clearRect(0, 0, storm.W, storm.H);
  sc.globalCompositeOperation = 'lighter';
  drawStorm(sc, now / 1000);
  sc.globalAlpha = 1; sc.globalCompositeOperation = 'source-over';
  // keep running while the page moves; rest once it has been still for a moment
  storm.idle = Math.abs(storm.svs) < 0.01 ? storm.idle + dt : 0;
  if (!document.hidden && !RM.matches && storm.idle < 1500) storm.raf = requestAnimationFrame(stepStorm);
}
function wakeStorm() { if (storm.raf === null && !document.hidden && !RM.matches) { storm.last = 0; storm.idle = 0; storm.raf = requestAnimationFrame(stepStorm); } }
addEventListener('scroll', wakeStorm, { passive: true });
addEventListener('resize', () => { sizeStorm(); wakeStorm(); });
document.addEventListener('visibilitychange', wakeStorm);

/* ---------- the ember layer: rising embers and orange light streaks behind the sections ---------- */
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
  tech.embers = Array.from({ length: n(LITE ? 40 : 65, 22) }, () => ({ x: r() * W, y: r() * H, v: 0.25 + r() * 0.9, s: 0.7 + r() * 1.9, ph: r() * TAU, sw: 0.2 + r() * 0.5, a: 0.25 + r() * 0.6 }));
  tech.streaks = Array.from({ length: n(6, 4) }, () => ({ x: r() * W, y: H * (0.2 + r() * 0.7), h: 60 + r() * 200, life: r(), sp: 0.0016 + r() * 0.003 }));
}
function sizeTech() {
  tech.W = innerWidth; tech.H = innerHeight;
  techCv.width = tech.W; techCv.height = tech.H;   // 1x is plenty for soft background particles
  techSeed();
}
sizeTech();

function wrapY(o, pad) { if (o.y > tech.H + pad) { o.y = -pad; o.x = trnd() * tech.W; return true; } return false; }

function drawTech(t, k) {
  const { W, H } = tech, c = tc, m = tech.mix, rise = 1 + tech.boost;
  c.clearRect(0, 0, W, H);
  c.globalCompositeOperation = 'lighter';
  // thin vertical light streaks that glow up and fade, like the ones around the ring
  for (const s of tech.streaks) {
    s.life += s.sp * k;
    if (s.life >= 1) { s.life = 0; s.x = trnd() * W; s.y = H * (0.2 + trnd() * 0.7); s.h = 60 + trnd() * 200; }
    const a = Math.sin(Math.PI * s.life) * 0.32 * m;
    const g = c.createLinearGradient(0, s.y - s.h / 2, 0, s.y + s.h / 2);
    g.addColorStop(0, 'rgba(255,120,30,0)'); g.addColorStop(0.5, `rgba(255,175,90,${a})`); g.addColorStop(1, 'rgba(255,120,30,0)');
    c.globalAlpha = 1; c.fillStyle = g; c.fillRect(s.x - 1, s.y - s.h / 2, 2, s.h);
    c.globalAlpha = 0.35; c.fillRect(s.x - 5, s.y - s.h / 2, 10, s.h);
  }
  // embers rising and swaying; scrolling stirs them faster
  for (const e of tech.embers) {
    e.y -= e.v * rise * k; e.x += Math.sin(t * 0.8 + e.ph) * e.sw * k;
    if (e.y < -10) { e.y = H + 10; e.x = trnd() * W; }
    const a = e.a * (0.55 + 0.45 * Math.sin(t * 3 + e.ph)) * m;
    c.globalAlpha = a * 0.22; c.fillStyle = '#ff7a1a'; c.beginPath(); c.arc(e.x, e.y, e.s * 3, 0, TAU); c.fill();
    c.globalAlpha = a; c.fillStyle = '#ffc070'; c.beginPath(); c.arc(e.x, e.y, e.s * 0.7, 0, TAU); c.fill();
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}

function stepTech(now) {
  tech.raf = null;
  const dt = Math.min(50, now - (tech.last || now)); tech.last = now;
  const k = dt / 16.667, sy = scrollY, sv = (sy - tech.lastSY) / Math.max(dt, 1); tech.lastSY = sy;
  tech.boost += (clamp(sv * 1.6, 0, 5) - tech.boost) * (1 - Math.pow(0.9, k));
  const inHero = hero.getBoundingClientRect().bottom > innerHeight * 0.4;
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

/* ---------- the tour: plays the page like a video, gliding scene to scene with a pause at each ---------- */
const GLIDE_STOPS_EV = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
let glide = null;
function stopGlide() {
  if (!glide) return;
  cancelAnimationFrame(glide.raf); clearTimeout(glide.wait); glide = null;
  document.documentElement.classList.remove('gliding');
  GLIDE_STOPS_EV.forEach(ev => removeEventListener(ev, stopGlide));
}
function sceneStops() {
  const docTop = el => el.getBoundingClientRect().top + scrollY, narrow = innerWidth <= 820, stops = [];
  const pr = $('#problem');                                                                 // strike-throughs finished
  stops.push(narrow ? docTop(pr) : docTop(pr) - 70);
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
if (RM.matches) pinToFinalStates();
sectionDrive();
navState();
})();

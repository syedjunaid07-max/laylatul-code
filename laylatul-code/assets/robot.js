// laylatul-code: a 3D robot that flies through the page with the scroll.
// Built in code (original design): metal armour, a glowing visor, crystalline energy wings,
// blue jet flames from palms, feet and back thrusters, and a parallax space layer.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const RM = matchMedia('(prefers-reduced-motion: reduce)');
const LITE = matchMedia('(pointer: coarse)').matches || innerWidth <= 820;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => t * t * (3 - 2 * t);
function rng(seed) { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }

function webglOK() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); }
  catch { return false; }
}
if (webglOK()) start();   // no WebGL: the site simply runs without the robot

function start() {
/* ---------- renderer, camera, light ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: !LITE, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, LITE ? 1.25 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const cv = renderer.domElement;
cv.className = 'robot-layer'; cv.setAttribute('aria-hidden', 'true');
document.body.appendChild(cv);
document.documentElement.classList.add('robot-on');

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.1, 120);
camera.position.set(0, 0, 12);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

scene.add(new THREE.HemisphereLight(0x9fc3ff, 0x1a0d05, 0.5));
const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(4, 6, 8); scene.add(key);
const rim = new THREE.DirectionalLight(0xff8a3a, 3.2); rim.position.set(-6, -4, -5); scene.add(rim);   // warm rim, like the glow of a planet below
const fill = new THREE.DirectionalLight(0x3fa0ff, 1.3); fill.position.set(6, -2, 4); scene.add(fill);

/* ---------- surface detail: panel seams and rivets drawn into a bump map ---------- */
function panelTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'), r = rng(9);
  g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 4000; i++) { const v = 120 + r() * 30 | 0; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * 512, r() * 512, 2, 2); }
  g.strokeStyle = '#3a3a3a'; g.lineWidth = 3;
  for (let i = 0; i < 22; i++) g.strokeRect(r() * 512, r() * 512, 50 + r() * 200, 30 + r() * 150);
  g.fillStyle = '#505050';
  for (let i = 0; i < 90; i++) { g.beginPath(); g.arc(r() * 512, r() * 512, 2.4, 0, 6.3); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1.4, 1.4); return t;
}
const bump = panelTexture();

/* ---------- materials ---------- */
const silver = new THREE.MeshPhysicalMaterial({ color: 0xa3abb6, metalness: 1, roughness: 0.3, clearcoat: 0.45, clearcoatRoughness: 0.22, bumpMap: bump, bumpScale: 0.7 });
const gun = new THREE.MeshStandardMaterial({ color: 0x2a2f37, metalness: 0.92, roughness: 0.4, bumpMap: bump, bumpScale: 0.5 });
const dark = new THREE.MeshStandardMaterial({ color: 0x15181d, metalness: 0.85, roughness: 0.5 });
const glowMat = new THREE.MeshStandardMaterial({ color: 0x08182a, emissive: 0x49b8ff, emissiveIntensity: 3.2 });
const wingMat = new THREE.MeshBasicMaterial({ color: 0x3fa9ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const wingEdge = new THREE.LineBasicMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });

/* ---------- building blocks ---------- */
const geoCache = new Map();
function rbox(w, h, d, r = 0.05) {
  const k = `b${w}|${h}|${d}|${r}`;
  if (!geoCache.has(k)) geoCache.set(k, new RoundedBoxGeometry(w, h, d, LITE ? 2 : 3, Math.min(r, w / 2.2, h / 2.2, d / 2.2)));
  return geoCache.get(k);
}
function put(parent, geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m;
}
const B = (p, w, h, d, mat, x, y, z, rx, ry, rz, r) => put(p, rbox(w, h, d, r), mat, x, y, z, rx, ry, rz);
const C = (p, rt, rb, h, mat, x, y, z, rx = 0, ry = 0, rz = 0, seg = LITE ? 14 : 22) => put(p, new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z, rx, ry, rz);
const S = (p, r, mat, x, y, z) => put(p, new THREE.SphereGeometry(r, LITE ? 14 : 22, LITE ? 10 : 16), mat, x, y, z);
const G = (p, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; };

/* ---------- glow sprites ---------- */
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(160,220,255,0.8)'); gr.addColorStop(0.5, 'rgba(60,150,255,0.25)'); gr.addColorStop(1, 'rgba(30,90,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const glowTex = glowTexture();
const glows = [];
function glow(parent, size, x, y, z, color = 0x6cc6ff, base = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.position.set(x, y, z); s.scale.setScalar(size); s.userData = { size, base }; parent.add(s); glows.push(s); return s;
}

/* ---------- the robot ---------- */
const robot = new THREE.Group(); scene.add(robot);
const body = G(robot);                    // everything that banks and pitches
const pelvis = G(body, 0, 0, 0);
B(pelvis, 0.62, 0.3, 0.38, gun, 0, 0, 0, 0, 0, 0, 0.07);
B(pelvis, 0.22, 0.26, 0.2, silver, 0, -0.12, 0.14, 0.15, 0, 0, 0.05);
B(pelvis, 0.18, 0.22, 0.32, silver, 0.31, -0.06, 0, 0, 0, 0.18, 0.05);
B(pelvis, 0.18, 0.22, 0.32, silver, -0.31, -0.06, 0, 0, 0, -0.18, 0.05);

const torso = G(pelvis, 0, 0.2, 0);
C(torso, 0.2, 0.24, 0.3, dark, 0, 0.12, 0);
[0, 1, 2].forEach(i => B(torso, 0.44 - i * 0.03, 0.08, 0.3, silver, 0, 0.06 + i * 0.1, 0.03, 0, 0, 0, 0.03));
const chest = G(torso, 0, 0.62, 0);
B(chest, 1.0, 0.58, 0.52, gun, 0, 0.02, -0.02, 0, 0, 0, 0.12);
B(chest, 0.7, 0.3, 0.44, gun, 0, -0.32, -0.02, 0, 0, 0, 0.1);              // tapered lower ribcage
B(chest, 0.48, 0.36, 0.14, silver, 0.24, 0.07, 0.22, 0.12, 0.2, -0.1, 0.05);
B(chest, 0.48, 0.36, 0.14, silver, -0.24, 0.07, 0.22, 0.12, -0.2, 0.1, 0.05);
B(chest, 0.3, 0.2, 0.1, silver, 0.3, -0.2, 0.2, -0.1, 0.25, -0.35, 0.04);
B(chest, 0.3, 0.2, 0.1, silver, -0.3, -0.2, 0.2, -0.1, -0.25, 0.35, 0.04);
B(chest, 0.3, 0.16, 0.1, silver, 0, -0.2, 0.24, -0.2, 0, 0, 0.04);
const coreRing = put(chest, new THREE.TorusGeometry(0.11, 0.025, 12, 32), gun, 0, -0.02, 0.29);
const core = C(chest, 0.085, 0.085, 0.04, glowMat, 0, -0.02, 0.29, Math.PI / 2);
glow(chest, 0.9, 0, -0.02, 0.36, 0x7fd0ff, 1);
B(chest, 0.012, 0.3, 0.01, glowMat, 0.36, 0.02, 0.24, 0, 0, 0.2);
B(chest, 0.012, 0.3, 0.01, glowMat, -0.36, 0.02, 0.24, 0, 0, -0.2);
B(chest, 0.62, 0.12, 0.4, gun, 0, 0.32, -0.02, 0, 0, 0, 0.05);           // collar
// back pack with two thrusters
const pack = G(chest, 0, 0.02, -0.34);
B(pack, 0.72, 0.5, 0.28, gun, 0, 0, 0, 0, 0, 0, 0.07);
B(pack, 0.5, 0.2, 0.1, silver, 0, 0.14, -0.16, 0, 0, 0, 0.04);
B(pack, 0.05, 0.3, 0.12, silver, 0.22, 0.32, 0.02, -0.5, 0, -0.2, 0.02);
B(pack, 0.05, 0.3, 0.12, silver, -0.22, 0.32, 0.02, -0.5, 0, 0.2, 0.02);
const nozzles = [];
[-0.2, 0.2].forEach(x => {
  const n = G(pack, x, -0.2, -0.12);
  n.rotation.x = 0.75;                                                     // exhaust points down and back
  C(n, 0.1, 0.14, 0.22, dark, 0, -0.08, 0);
  C(n, 0.08, 0.08, 0.02, glowMat, 0, -0.19, 0);
  nozzles.push(n);
});

// neck and head
const neck = G(chest, 0, 0.36, 0);
C(neck, 0.09, 0.11, 0.18, dark, 0, 0.06, 0);
const head = G(neck, 0, 0.26, 0.02);
B(head, 0.34, 0.34, 0.38, silver, 0, 0.02, 0, 0, 0, 0, 0.12);
B(head, 0.3, 0.2, 0.1, gun, 0, -0.04, 0.17, 0, 0, 0, 0.04);                 // faceplate
B(head, 0.2, 0.08, 0.12, silver, 0, -0.16, 0.12, -0.15, 0, 0, 0.03);       // jaw
const eyeL = B(head, 0.12, 0.028, 0.02, glowMat, 0.075, 0.015, 0.225, 0, 0, -0.28, 0.01);
const eyeR = B(head, 0.12, 0.028, 0.02, glowMat, -0.075, 0.015, 0.225, 0, 0, 0.28, 0.01);
glow(head, 0.42, 0.075, 0.015, 0.25, 0x8fdcff, 1.2); glow(head, 0.42, -0.075, 0.015, 0.25, 0x8fdcff, 1.2);
B(head, 0.04, 0.24, 0.2, silver, 0, 0.2, -0.02, -0.25, 0, 0, 0.02);       // crest
B(head, 0.17, 0.05, 0.12, silver, 0.08, 0.075, 0.19, 0.35, 0, -0.32, 0.02); // brow ridge, angled down into a scowl
B(head, 0.17, 0.05, 0.12, silver, -0.08, 0.075, 0.19, 0.35, 0, 0.32, 0.02);
B(head, 0.05, 0.16, 0.12, silver, 0.15, -0.08, 0.15, 0, 0.3, 0.2, 0.02);   // cheek blades
B(head, 0.05, 0.16, 0.12, silver, -0.15, -0.08, 0.15, 0, -0.3, -0.2, 0.02);
B(head, 0.03, 0.28, 0.06, silver, 0.17, 0.14, -0.06, 0, 0, -0.55, 0.015);  // horn fins
B(head, 0.03, 0.28, 0.06, silver, -0.17, 0.14, -0.06, 0, 0, 0.55, 0.015);
[0.18, -0.18].forEach(x => { C(head, 0.07, 0.07, 0.04, gun, x, 0, 0, 0, 0, Math.PI / 2); put(head, new THREE.TorusGeometry(0.05, 0.008, 8, 24), glowMat, x * 1.1, 0, 0, 0, Math.PI / 2, 0); });

// arms
function arm(side) {
  const sh = G(chest, side * 0.56, 0.18, 0);
  S(sh, 0.14, dark, 0, 0, 0);
  const pad = G(sh, side * 0.05, 0.08, 0);
  B(pad, 0.44, 0.26, 0.5, silver, 0, 0, 0, 0, 0, side * -0.25, 0.08);
  B(pad, 0.36, 0.16, 0.42, gun, side * 0.06, -0.14, 0, 0, 0, side * -0.4, 0.05);
  B(pad, 0.05, 0.3, 0.14, silver, side * 0.06, 0.2, 0, 0, 0, side * -0.4, 0.02);
  B(pad, 0.012, 0.012, 0.36, glowMat, side * 0.17, -0.06, 0, 0, 0, side * -0.25, 0.005);
  const upper = G(sh, 0, -0.04, 0);
  C(upper, 0.105, 0.095, 0.46, gun, 0, -0.27, 0);
  B(upper, 0.22, 0.32, 0.22, silver, side * 0.02, -0.24, 0.01, 0, 0, 0, 0.06);
  const elbow = G(upper, 0, -0.54, 0);
  S(elbow, 0.1, dark, 0, 0, 0);
  C(elbow, 0.125, 0.1, 0.48, silver, 0, -0.27, 0);
  B(elbow, 0.2, 0.3, 0.2, gun, side * 0.04, -0.24, 0.04, 0, 0, 0, 0.05);
  put(elbow, new THREE.TorusGeometry(0.105, 0.012, 8, 28), glowMat, 0, -0.5, 0, Math.PI / 2, 0, 0);
  const hand = G(elbow, 0, -0.56, 0);
  B(hand, 0.18, 0.2, 0.09, gun, 0, -0.08, 0, 0, 0, 0, 0.03);
  const palm = C(hand, 0.045, 0.045, 0.012, glowMat, 0, -0.08, 0.05, Math.PI / 2);
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const f = G(hand, (i - 1.5) * 0.045, -0.18, 0.01);
    B(f, 0.034, 0.075, 0.04, silver, 0, -0.035, 0, 0, 0, 0, 0.012);
    const f2 = G(f, 0, -0.075, 0);
    B(f2, 0.03, 0.065, 0.036, dark, 0, -0.03, 0, 0, 0, 0, 0.01);
    fingers.push([f, f2]);
  }
  const thumb = G(hand, side * -0.1, -0.08, 0.03);
  B(thumb, 0.035, 0.09, 0.04, silver, 0, -0.04, 0, 0, 0, side * 0.5, 0.012);
  // exhaust leaves the palm, pointing down/back
  const emit = G(hand, 0, -0.08, 0.06); emit.rotation.x = Math.PI / 2;
  return { sh, upper, elbow, hand, fingers, emit, palm };
}
const armL = arm(1), armR = arm(-1);

// energy ring around the right forearm (like the reference)
const ringMat = new THREE.MeshBasicMaterial({ color: 0x5cc0ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
const ring = put(armR.elbow, new THREE.TorusGeometry(0.34, 0.018, 10, 64), ringMat, 0, -0.32, 0, Math.PI / 2, 0, 0);
const ring2 = put(armR.elbow, new THREE.TorusGeometry(0.29, 0.006, 6, 64), ringMat, 0, -0.32, 0, Math.PI / 2, 0, 0);

// legs
function leg(side) {
  const hip = G(pelvis, side * 0.2, -0.14, 0);
  S(hip, 0.13, dark, 0, 0, 0);
  C(hip, 0.15, 0.12, 0.6, gun, 0, -0.33, 0);
  B(hip, 0.3, 0.5, 0.33, silver, side * 0.02, -0.3, 0.02, 0, 0, 0, 0.08);
  B(hip, 0.12, 0.3, 0.2, gun, side * 0.15, -0.26, 0, 0, 0, side * 0.12, 0.04);
  B(hip, 0.012, 0.36, 0.012, glowMat, side * 0.14, -0.3, 0.12, 0, 0, 0, 0.005);
  const knee = G(hip, 0, -0.66, 0);
  S(knee, 0.11, dark, 0, 0, 0);
  B(knee, 0.2, 0.2, 0.14, silver, 0, 0.02, 0.1, -0.2, 0, 0, 0.05);
  B(knee, 0.06, 0.2, 0.08, silver, 0, 0.1, 0.16, -0.6, 0, 0, 0.02);
  B(knee, 0.25, 0.6, 0.27, silver, 0, -0.34, 0, 0, 0, 0, 0.08);
  B(knee, 0.18, 0.3, 0.16, gun, 0, -0.26, -0.17, 0, 0, 0, 0.05);
  const foot = G(knee, 0, -0.68, 0);
  B(foot, 0.22, 0.12, 0.4, gun, 0, -0.04, 0.08, 0, 0, 0, 0.04);
  B(foot, 0.2, 0.08, 0.14, silver, 0, 0.01, 0.24, 0.2, 0, 0, 0.03);
  C(foot, 0.07, 0.1, 0.08, dark, 0, -0.12, -0.02);
  C(foot, 0.06, 0.06, 0.01, glowMat, 0, -0.165, -0.02);
  const emit = G(foot, 0, -0.17, -0.02); emit.rotation.x = Math.PI;      // exhaust points straight down
  return { hip, knee, foot, emit };
}
const legL = leg(1), legR = leg(-1);

// crystalline energy wings
const wings = [];
function blade(len, wid) {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(len * 0.85, wid * 0.55); s.lineTo(len, wid * 0.15); s.lineTo(len * 0.9, -wid * 0.2); s.lineTo(0, -wid * 0.12); s.closePath();
  return new THREE.ShapeGeometry(s);
}
[1, -1].forEach(side => {
  const root = G(pack, side * 0.3, 0.12, -0.08);
  [[1.5, 0.34, 0.55], [1.25, 0.28, 0.2], [1.0, 0.22, -0.12]].forEach(([len, wid, ang], i) => {
    const g = blade(len, wid);
    const w = new THREE.Mesh(g, wingMat); const e = new THREE.LineSegments(new THREE.EdgesGeometry(g), wingEdge);
    const holder = G(root); holder.rotation.set(0, side > 0 ? -0.5 : Math.PI + 0.5, ang * (side > 0 ? 1 : -1));
    if (side < 0) holder.scale.y = -1;
    holder.add(w); holder.add(e);
    wings.push({ holder, side, i, ang });
  });
});
glow(body, 4.2, 0, 0.8, -0.6, 0x2f7dff, 0.22);   // a soft energy aura behind the robot

/* ---------- jet flames: layered cones with a flickering shader ---------- */
const flameVert = `
  uniform float uTime, uPower, uSeed; varying float vY; varying float vFres;
  void main() {
    vec3 p = position; float y = uv.y;
    float w = sin(y * 14.0 - uTime * 32.0 + uSeed) * 0.05 * y + sin(y * 7.0 + uTime * 21.0 + uSeed * 2.0) * 0.04 * y;
    p.x += w; p.z += w * 0.7;
    p.y *= 0.35 + uPower;
    vY = y;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    vFres = abs(dot(n, normalize(-mv.xyz)));
    gl_Position = projectionMatrix * mv;
  }`;
const flameFrag = `
  uniform float uTime, uPower, uCore; varying float vY; varying float vFres;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
  void main() {
    float n = noise(vec2(vFres * 6.0, vY * 7.0 - uTime * 12.0));
    vec3 white = vec3(1.0), cyan = vec3(0.35, 0.85, 1.0), blue = vec3(0.1, 0.35, 1.0);
    vec3 col = mix(white, cyan, smoothstep(0.0, 0.35 - uCore * 0.2, vY));
    col = mix(col, blue, smoothstep(0.35, 0.9, vY));
    float a = pow(1.0 - vY, 1.3) * pow(vFres, 1.2 + uCore) * (0.55 + 0.7 * n) * clamp(0.35 + uPower, 0.0, 1.6);
    gl_FragColor = vec4(col * (1.2 + uCore), a);
  }`;
const flames = [];
function flame(parent, radius, length, core) {
  const geo = new THREE.ConeGeometry(radius, length, LITE ? 12 : 20, 6, true);
  geo.translate(0, length / 2, 0);
  // base sits at the nozzle, the tip runs along +Y of its holder (the exhaust direction)
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPower: { value: 0.4 }, uSeed: { value: Math.random() * 10 }, uCore: { value: core } },
    vertexShader: flameVert, fragmentShader: flameFrag,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
  });
  const m = new THREE.Mesh(geo, mat); parent.add(m); flames.push(m); return m;
}
// every emitter: an outer flame and a hot inner core, plus a light that colours the armour
const emitters = [
  ...nozzles.map(n => { const e = G(n, 0, -0.19, 0); e.rotation.x = Math.PI; return { node: e, r: 0.11, len: 1.6, kind: 'back' }; }),
  { node: legL.emit, r: 0.07, len: 1.1, kind: 'foot' }, { node: legR.emit, r: 0.07, len: 1.1, kind: 'foot' },
  { node: armL.emit, r: 0.05, len: 0.8, kind: 'palm' }, { node: armR.emit, r: 0.05, len: 0.8, kind: 'palm' }
];
emitters.forEach(e => {
  e.outer = flame(e.node, e.r * 1.25, e.len, 0);
  e.inner = flame(e.node, e.r * 0.55, e.len * 0.55, 1);
  e.glow = glow(e.node, e.r * 7, 0, 0.05, 0, 0x7fd0ff, 1);
});
const thrustLights = [];
[[pack, 0, -0.3, -0.3], [armL.hand, 0, -0.1, 0.1], [armR.hand, 0, -0.1, 0.1]].slice(0, LITE ? 1 : 2).forEach(([p, x, y, z]) => {
  const l = new THREE.PointLight(0x49b6ff, 6, 3.5, 2); l.position.set(x, y, z); p.add(l); thrustLights.push(l);
});

/* ---------- sparks and embers trailing the thrusters (world space) ---------- */
const NSP = LITE ? 160 : 520;
const spPos = new Float32Array(NSP * 3), spLife = new Float32Array(NSP), spVel = new Float32Array(NSP * 3);
const spGeo = new THREE.BufferGeometry();
spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
spGeo.setAttribute('life', new THREE.BufferAttribute(spLife, 1));
const spMat = new THREE.ShaderMaterial({
  uniforms: { uScale: { value: renderer.getPixelRatio() * 60 } },
  vertexShader: `attribute float life; varying float vL; uniform float uScale;
    void main() { vL = life; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = uScale * (0.4 + life) / -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vL;
    void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.0, d) * vL; gl_FragColor = vec4(mix(vec3(0.2, 0.55, 1.0), vec3(0.85, 0.97, 1.0), vL), a); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
});
const sparks = new THREE.Points(spGeo, spMat); sparks.frustumCulled = false; scene.add(sparks);
let spNext = 0;
const tmpV = new THREE.Vector3(), tmpD = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0);
function emitSpark(e, speed) {
  const i = spNext; spNext = (spNext + 1) % NSP;
  e.node.getWorldPosition(tmpV); e.node.getWorldQuaternion(tmpQ);
  tmpD.copy(UP).applyQuaternion(tmpQ);
  spPos[i * 3] = tmpV.x; spPos[i * 3 + 1] = tmpV.y; spPos[i * 3 + 2] = tmpV.z;
  const s = speed * (0.6 + Math.random() * 0.8);
  spVel[i * 3] = tmpD.x * s + (Math.random() - 0.5) * 0.02;
  spVel[i * 3 + 1] = tmpD.y * s + (Math.random() - 0.5) * 0.02;
  spVel[i * 3 + 2] = tmpD.z * s + (Math.random() - 0.5) * 0.02;
  spLife[i] = 1;
}

/* ---------- deep space: parallax stars and drifting nebula ---------- */
const NST = LITE ? 450 : 1300;
const stPos = new Float32Array(NST * 3), stDepth = new Float32Array(NST);
const r0 = rng(77);
for (let i = 0; i < NST; i++) {
  const z = -6 - r0() * 40; stDepth[i] = z;
  stPos[i * 3] = (r0() - 0.5) * 60; stPos[i * 3 + 1] = (r0() - 0.5) * 40; stPos[i * 3 + 2] = z;
}
const stBase = stPos.slice();
const stGeo = new THREE.BufferGeometry(); stGeo.setAttribute('position', new THREE.BufferAttribute(stPos, 3));
const stars = new THREE.Points(stGeo, new THREE.PointsMaterial({ color: 0xbfe2ff, size: LITE ? 0.07 : 0.06, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
stars.frustumCulled = false; scene.add(stars);
function nebulaTexture(seed, tint) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'), r = rng(seed); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const x = 70 + r() * 116, y = 70 + r() * 116, rad = 30 + r() * 60;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${tint},0.10)`); gr.addColorStop(1, `rgba(${tint},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const nebulas = [[-14, 6, -30, 30, '60,120,255', 3], [16, -8, -34, 34, '120,80,255', 5], [4, 14, -38, 26, '40,170,255', 8]].map(([x, y, z, s, tint, seed]) => {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: nebulaTexture(seed, tint), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  sp.position.set(x, y, z); sp.scale.setScalar(s); sp.userData.base = new THREE.Vector3(x, y, z); scene.add(sp); return sp;
});

/* ---------- flight path: where the robot flies for each part of the page ---------- */
// x/y are screen positions (-1..1, +y is up), s is size, yaw turns it toward the content, z is depth
const DESK = {
  hero: [{ x: 0.5, y: 0.02, s: 1.0, yaw: -0.75, z: 0 }, { x: 0.52, y: -0.04, s: 0.92, yaw: -0.4, z: -1.5 }, { x: 0.47, y: 0.0, s: 1.04, yaw: -0.8, z: 0 }],
  '#problem': { x: 0.8, y: 0.12, s: 0.6, yaw: -0.95 }, '#promises': { x: -0.78, y: -0.62, s: 0.5, yaw: 0.85 },
  '#types': { x: 0.76, y: 0.5, s: 0.5, yaw: -0.85 }, '#how': { x: -0.8, y: 0.46, s: 0.5, yaw: 0.9 },
  '#prices': { x: 0.8, y: 0.52, s: 0.5, yaw: -0.85 }, '#build': { x: 0.82, y: -0.55, s: 0.45, yaw: -0.9 },
  '#faq': { x: -0.78, y: -0.42, s: 0.5, yaw: 0.85 }, '.final': { x: 0.78, y: 0.3, s: 0.5, yaw: -0.8 }
};
const PHONE = {
  hero: [{ x: 0, y: 0.42, s: 0.62, yaw: -0.3, z: 0 }, { x: 0.12, y: 0.44, s: 0.56, yaw: -0.15, z: -1 }, { x: 0, y: 0.42, s: 0.66, yaw: -0.35, z: 0 }],
  side: s => ({ x: s * 0.6, y: 0.58, s: 0.36, yaw: s * -0.8 }), '.final': { x: 0, y: 0.5, s: 0.42, yaw: 0 }
};
const SECS = ['#problem', '#promises', '#types', '#how', '#prices', '#build', '#faq', '.final'];
let anchors = [];
function docTop(el) { return el.getBoundingClientRect().top + scrollY; }
function buildAnchors() {
  const H = innerHeight, phone = innerWidth < 720, P = phone ? PHONE : DESK;
  const hero = document.querySelector('.hero');
  const range = Math.max(1, hero.offsetHeight - H);
  const list = [{ ...P.hero[0], at: 0 }, { ...P.hero[1], at: range * 0.5 }, { ...P.hero[2], at: range }];   // `at` = scroll position
  SECS.forEach((sel, i) => {
    const el = document.querySelector(sel); if (!el) return;
    const st = phone ? (sel === '.final' ? P['.final'] : P.side(i % 2 ? -1 : 1)) : P[sel];
    const top = docTop(el), a = top - H * 0.3, b = top + el.offsetHeight - H * 0.75;
    list.push({ ...st, z: st.z || 0, at: a });
    if (b > a + 40) list.push({ ...st, z: st.z || 0, at: b });
  });
  list.sort((p, q) => p.at - q.at);
  for (let i = 1; i < list.length; i++) if (list[i].at <= list[i - 1].at) list[i].at = list[i - 1].at + 1;
  anchors = list;
}
function pathAt(y) {
  if (y <= anchors[0].at) return { ...anchors[0], travel: 0 };
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1], b = anchors[i];
    if (y <= b.at) {
      const t = ease((y - a.at) / (b.at - a.at));
      const moving = Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 0.05;
      return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), s: lerp(a.s, b.s, t), yaw: lerp(a.yaw, b.yaw, t),
        z: lerp(a.z || 0, b.z || 0, t) - (moving ? 2.6 * Math.sin(Math.PI * t) : 0), travel: moving ? Math.sin(Math.PI * t) : 0 };
    }
  }
  return { ...anchors[anchors.length - 1], travel: 0 };
}

/* ---------- the drive loop ---------- */
const st = { x: 0, y: 0, z: 0, s: 1, yaw: -0.5, roll: 0, pitch: 0, lastY: scrollY, sv: 0, thrust: 0.3, mx: 0, my: 0, init: false };
let raf = null, last = 0, lastDraw = 0, visible = true;
const halfH = z => Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (camera.position.z - z);
addEventListener('pointermove', e => { st.mx = e.clientX / innerWidth * 2 - 1; st.my = -(e.clientY / innerHeight * 2 - 1); }, { passive: true });

function pose(t, speed) {
  const fly = clamp(speed, 0, 1), idle = 1 - fly;
  const breathe = Math.sin(t * 1.6);
  chest.scale.setScalar(1 + breathe * 0.008);
  torso.rotation.x = 0.16 + fly * 0.22;
  torso.rotation.y = Math.sin(t * 0.7) * 0.05;
  // left arm reaches forward and out, right arm sweeps back with the palm thruster firing
  armL.sh.rotation.x = lerp(-0.55, -0.85, fly) + Math.sin(t * 1.3) * 0.05;
  armL.sh.rotation.z = lerp(0.42, 0.3, fly) + Math.sin(t * 0.9) * 0.03;
  armL.elbow.rotation.x = lerp(-0.85, -0.45, fly);
  armL.hand.rotation.x = lerp(-0.1, 0.2, fly);
  armR.sh.rotation.x = lerp(0.45, 0.8, fly) + Math.sin(t * 1.3 + 1) * 0.05;
  armR.sh.rotation.z = lerp(-0.38, -0.22, fly) + Math.sin(t * 0.9 + 1) * 0.03;
  armR.elbow.rotation.x = lerp(-0.45, -0.25, fly);
  armR.hand.rotation.x = lerp(0.6, 0.9, fly);
  [armL, armR].forEach((a, s) => a.fingers.forEach(([f, f2], i) => {
    const c = (s ? 0.9 : 0.35) + 0.2 * Math.sin(t * 1.1 + i * 0.6 + s) * idle;   // right hand clenched, left hand open
    f.rotation.x = c; f2.rotation.x = c * 1.1;
  }));
  // legs trail behind: the left stays long, the right knee bends
  legL.hip.rotation.x = lerp(0.12, 0.38, fly) + Math.sin(t * 1.2) * 0.05;
  legL.knee.rotation.x = lerp(0.25, 0.4, fly) + Math.sin(t * 1.2 + 0.6) * 0.05;
  legL.foot.rotation.x = lerp(0.35, 0.7, fly);
  legR.hip.rotation.x = lerp(0.5, 0.75, fly) + Math.sin(t * 1.2 + 1.5) * 0.05;
  legR.knee.rotation.x = lerp(0.95, 1.15, fly) + Math.sin(t * 1.2 + 2.1) * 0.05;
  legR.foot.rotation.x = lerp(0.5, 0.8, fly);
  legL.hip.rotation.z = 0.08; legR.hip.rotation.z = -0.1;
  // head follows the pointer (or looks toward the viewer)
  head.rotation.y = lerp(head.rotation.y, clamp(st.mx * 0.6 - st.yaw * 0.6, -0.7, 0.7), 0.08);
  head.rotation.x = lerp(head.rotation.x, clamp(-st.my * 0.3 - 0.12 - fly * 0.15, -0.45, 0.3), 0.08);
  wings.forEach(w => { w.holder.rotation.z = w.ang * (w.side > 0 ? 1 : -1) + Math.sin(t * 2.2 + w.i) * 0.05 * (w.side > 0 ? 1 : -1) + fly * 0.15 * (w.side > 0 ? -1 : 1); });
  ring.rotation.z = t * 2.4; ring2.rotation.z = -t * 3.1;
  ringMat.opacity = 0.65 + 0.25 * Math.sin(t * 5);
  coreRing.rotation.z = t * 0.8;
  glowMat.emissiveIntensity = 2.8 + 0.6 * Math.sin(t * 3) + st.thrust * 1.2;
}

function frame(now) {
  raf = null;
  const dt = Math.min(50, now - (last || now)); last = now;
  const k = dt / 16.667, t = now / 1000, still = RM.matches;
  // scroll speed, smoothed: drives flame power, body pitch and the dip as the page moves
  const sy = scrollY, rawV = (sy - st.lastY) / Math.max(dt, 1); st.lastY = sy;
  st.sv += (rawV - st.sv) * (1 - Math.pow(0.85, k));
  const P = pathAt(sy + (still ? 0 : st.sv * 160));
  const tz = P.z || 0, hH = halfH(tz), hW = hH * camera.aspect;
  const tx = P.x * hW * 0.9, ty = P.y * hH + Math.sin(t * 1.4) * 0.06 * hH * 0.1 - clamp(st.sv * 0.9, -1.2, 1.2);
  const f = still ? 1 : 1 - Math.pow(0.9, k);
  if (!st.init) { st.x = tx; st.y = ty; st.z = tz; st.s = P.s; st.yaw = P.yaw; st.init = true; }
  const ox = st.x;
  st.x = lerp(st.x, tx, f); st.y = lerp(st.y, ty, f); st.z = lerp(st.z, tz, f); st.s = lerp(st.s, P.s, f);
  const vx = (st.x - ox) / Math.max(k, 0.001);
  st.yaw = lerp(st.yaw, P.yaw + clamp(vx * 2.2, -0.6, 0.6), f * 0.8);
  st.roll = lerp(st.roll, clamp(-vx * 1.6, -0.55, 0.55) + Math.sin(t * 0.9) * 0.03, f);
  st.pitch = lerp(st.pitch, clamp(st.sv * 0.35, -0.35, 0.6), f);
  const speed = clamp(Math.abs(st.sv) * 0.9 + Math.abs(vx) * 3 + P.travel * 0.6, 0, 1.4);
  st.thrust = lerp(st.thrust, 0.28 + speed, f);

  robot.position.set(st.x, st.y + (still ? 0 : Math.sin(t * 1.5) * 0.05), st.z);
  const heroOn = sy < (anchors[2] ? anchors[2].at + innerHeight * 0.4 : 0);
  const op = innerWidth < 720 && !heroOn ? 0.5 : 1;
  st.op = lerp(st.op ?? op, op, 0.08); const opS = st.op.toFixed(2); if (opS !== st.opS) { st.opS = opS; cv.style.opacity = opS; }
  robot.scale.setScalar(st.s * (innerWidth < 720 ? 0.95 : 1));
  robot.rotation.set(0, st.yaw, 0);
  body.rotation.set(st.pitch, 0, st.roll);
  pose(still ? 0 : t, clamp(speed, 0, 1));

  const power = still ? 0.35 : st.thrust;
  emitters.forEach((e, i) => {
    const pw = power * (e.kind === 'back' ? 1.1 : e.kind === 'foot' ? 0.9 : 0.7) * (0.9 + 0.1 * Math.sin(t * 40 + i));
    e.outer.material.uniforms.uTime.value = t; e.outer.material.uniforms.uPower.value = pw;
    e.inner.material.uniforms.uTime.value = t; e.inner.material.uniforms.uPower.value = pw * 0.9;
    e.glow.scale.setScalar(e.r * (5 + 4 * pw));
    if (!still && !LITE || (!still && i % 2 === 0)) { const n = pw > 0.6 ? 2 : (Math.random() < pw * 1.2 ? 1 : 0); for (let j = 0; j < n; j++) emitSpark(e, 0.03 + pw * 0.05); }
  });
  thrustLights.forEach(l => { l.intensity = 3 + power * 9; });

  // sparks drift, slow and fade
  for (let i = 0; i < NSP; i++) {
    if (spLife[i] <= 0) continue;
    spPos[i * 3] += spVel[i * 3] * k; spPos[i * 3 + 1] += spVel[i * 3 + 1] * k - 0.002 * k; spPos[i * 3 + 2] += spVel[i * 3 + 2] * k;
    spVel[i * 3] *= 0.97; spVel[i * 3 + 1] *= 0.97; spVel[i * 3 + 2] *= 0.97;
    spLife[i] = Math.max(0, spLife[i] - 0.025 * k);
  }
  spGeo.attributes.position.needsUpdate = true; spGeo.attributes.life.needsUpdate = true;

  // parallax: near stars slide more than far ones as the page scrolls
  for (let i = 0; i < NST; i++) {
    const depth = -stDepth[i], par = 6 / depth;
    let y = stBase[i * 3 + 1] + sy * 0.004 * par;
    y = ((y + 20) % 40 + 40) % 40 - 20;
    stPos[i * 3 + 1] = y;
  }
  stGeo.attributes.position.needsUpdate = true;
  nebulas.forEach((n, i) => { n.position.y = n.userData.base.y + sy * 0.0012 * (1 + i * 0.3); n.material.rotation = t * 0.01 * (i % 2 ? 1 : -1); });

  camera.position.x = lerp(camera.position.x, st.x * 0.04, 0.05);   // a gentle camera drift that follows the robot
  camera.lookAt(0, 0, 0);

  if (!LITE || now - lastDraw >= 32) { renderer.render(scene, camera); lastDraw = now; }
  if (!still && visible && !document.hidden) raf = requestAnimationFrame(frame);
}
function wake() { if (raf === null && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }

function resize() {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  spMat.uniforms.uScale.value = renderer.getPixelRatio() * 60;
  buildAnchors(); wake();
}
let rz;
addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(resize, 120); });
new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(() => { buildAnchors(); wake(); }, 120); }).observe(document.body);
addEventListener('scroll', () => { if (RM.matches) requestAnimationFrame(t => frame(t)); }, { passive: true });
document.addEventListener('visibilitychange', wake);
RM.addEventListener('change', wake);
buildAnchors();
wake();
}

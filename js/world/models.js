// Alle 3D-Modelle von BloomWorld – aus Grundformen zusammengesetzt (keine externen Dateien).
import { Geo, roundedBox, box, sphere, icosphere, cylinder, lathe, petal, extrude, disk, terrain, col, T } from '../engine/geo.js';
import { rng, v3 } from '../engine/math.js';
import { SEEDS } from '../config.js';

const P = Math.PI;

export const PAL = {
  grass: '#8fd34f', grassDark: '#62b53a', lawnA: '#76c44b', lawnB: '#6bb845', meadow: '#5ea640',
  gravel: '#dcc391', gravelDark: '#c4a874', stone: '#b9b0a3', stoneDark: '#918a80',
  soil: '#7a4b2b', soilDark: '#5a341c',
  wood: '#c08a52', woodDark: '#8f5d34', woodLight: '#dcaa6e',
  wall: '#fff3df', beam: '#8b5a35', roof: '#e2654a', roofDark: '#b9473a', door: '#4aa58f', glass: '#9fd8f2', white: '#fdfbf5',
  leaf1: '#6ac646', leaf2: '#4fae3b', leaf3: '#8fdb5c', trunk: '#8a5a36', pine: '#3f9a52',
  water: '#4cb8e6', stem: '#4f9e35',
};

// ---------------- Gelände ----------------
export function ground() {
  const g = new Geo();
  const R = rng(7);
  const noise = (x, z) => Math.sin(x * 0.21) * Math.cos(z * 0.17) + Math.sin(x * 0.07 + z * 0.11) * 1.6;
  const height = (x, z) => {
    const d = Math.max(Math.abs(x), Math.abs(z));
    const k = Math.max(0, Math.min(1, (d - 21) / 30)); // innen flach: Platz für Gartenerweiterungen
    return k * k * (3 + noise(x, z) * 2.2 + d * 0.12);
  };
  const c1 = col(PAL.meadow), c2 = col('#4f9b37', ), c3 = col('#7dbb55');
  const outer = terrain(-110, -110, 110, 110, 64, 64, height, (p) => {
    const n = Math.sin(p[0] * 0.3) * Math.cos(p[2] * 0.25) * 0.5 + 0.5;
    const hh = Math.min(1, p[1] / 10);
    return v3.lerp(v3.lerp(c1, c2, n), c3, hh * 0.6);
  });
  g.add(outer, T(0, -0.02, 0));
  void R;
  return { geo: g, height };
}

// Gemähter Rasen im Garten mit Streifen
export function lawn(size) {
  const A = col(PAL.lawnA), B = col(PAL.lawnB), D = col('#5aa53c'), L = col('#86cf57');
  const n = 44, h = size / 2;
  return terrain(-h, -h, h, h, n, n, () => 0, (p) => {
    const stripe = Math.floor((p[0] + h) / (size / 11)) % 2 ? A : B;
    const k = Math.sin(p[0] * 0.9 + p[2] * 0.4) * Math.cos(p[2] * 0.7 - p[0] * 0.3) * 0.5 + 0.5;
    const k2 = Math.sin(p[0] * 2.3) * Math.sin(p[2] * 2.1);
    return v3.lerp(v3.lerp(stripe, D, k * 0.35), L, Math.max(0, k2) * 0.25);
  });
}

// Kiesplatz unter den Beeten
export function plaza(w, d) {
  const g = new Geo();
  g.add(roundedBox(w, 0.12, d, 0.06, PAL.gravel, 2), T(0, 0.0, 0));
  const R = rng(11);
  for (let i = 0; i < 70; i++) {
    const x = (R() - 0.5) * (w - 0.4), z = (R() - 0.5) * (d - 0.4);
    g.add(icosphere(0.04 + R() * 0.05, R() > 0.5 ? PAL.gravelDark : PAL.stone, 0, true), T(x, 0.06, z, R() * 6, 0, 0, 1, 0.45, 1));
  }
  return g;
}

// Trittsteine
export function steppingStones(points, seed = 3) {
  const g = new Geo(), R = rng(seed);
  for (const [x, z] of points) {
    const s = 0.38 + R() * 0.12;
    g.add(cylinder(s, s * 1.05, 0.08, R() > 0.5 ? PAL.stone : '#c8bfb2', 9), T(x, 0, z, R() * 3, 0, 0, 1, 1, 0.8 + R() * 0.3));
  }
  return g;
}

// ---------------- Hochbeet ----------------
// Beet-Stufen: 1 Holz, 2 Stein, 3 Pracht (weiß mit Gold)
const BED_STYLE = [
  { lo: PAL.woodDark, hi: PAL.wood, post: PAL.woodDark, cap: PAL.woodLight },
  { lo: '#9c968d', hi: '#bdb6ab', post: '#857f77', cap: '#d9d3c9' },
  { lo: '#efe4cc', hi: '#fdf7ea', post: '#e6d7b4', cap: '#ffc93a' },
];
export function raisedBed(locked = false, lvl = 1) {
  const g = new Geo();
  const W = 2.3, H = 0.56, th = 0.14, st = BED_STYLE[(lvl || 1) - 1];
  const plank = (len, hgt, c) => roundedBox(len, hgt, th, lvl === 2 ? 0.06 : 0.04, c, 1);
  for (let side = 0; side < 4; side++) {
    const ry = side * P / 2;
    for (let k = 0; k < 2; k++) {
      const c = k === 0 ? st.lo : st.hi;
      if (lvl === 2) {
        // Steinblöcke statt durchgehender Bretter
        for (let j = 0; j < 3; j++) g.add(plank((W - 0.3) / 3, 0.25, (j + k) % 2 ? st.lo : st.hi), mul(T(0, 0, 0, ry), T(-0.67 + j * 0.67 + (k ? 0.12 : 0), 0.14 + k * 0.27, (W - th) / 2)));
      } else g.add(plank(W - 0.2, 0.25, c), mul(T(0, 0, 0, ry), T(0, 0.14 + k * 0.27, (W - th) / 2)));
    }
  }
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    g.add(roundedBox(0.22, H + 0.12, 0.22, 0.06, st.post, 1), T(sx * (W / 2 - 0.08), (H + 0.12) / 2, sz * (W / 2 - 0.08)));
    g.add(roundedBox(0.26, 0.06, 0.26, 0.03, st.cap, 1), T(sx * (W / 2 - 0.08), H + 0.13, sz * (W / 2 - 0.08)));
    if (lvl === 3) g.add(sphere(0.09, '#ffcf3a', 8, 6), T(sx * (W / 2 - 0.08), H + 0.24, sz * (W / 2 - 0.08)));
  }
  if (lvl === 3) for (let side = 0; side < 4; side++) g.add(roundedBox(W - 0.3, 0.05, 0.05, 0.02, '#ffc93a', 1), mul(T(0, 0, 0, side * P / 2), T(0, H + 0.06, (W - th) / 2 + 0.07)));
  // Erde mit leichten Hügeln
  const soil = roundedBox(W - 0.3, 0.12, W - 0.3, 0.05, PAL.soil, 2).displace((p, n) => (n[1] > 0.5 ? [p[0], p[1] + Math.sin(p[0] * 7) * Math.sin(p[2] * 6) * 0.02, p[2]] : p));
  g.add(soil, T(0, H - 0.1, 0));
  const R = rng(locked ? 21 : 5);
  for (let i = 0; i < 14; i++) g.add(icosphere(0.05 + R() * 0.04, PAL.soilDark, 0, true), T((R() - 0.5) * 1.7, H - 0.04, (R() - 0.5) * 1.7, 0, 0, 0, 1, 0.5, 1));
  if (locked) {
    // Verwildert: hohes Gras, Steine, Brett mit Schild
    const tuft = grassTuft(R, 0.55, ['#7cbf3f', '#6aac36', '#94d156']);
    for (let i = 0; i < 9; i++) g.add(tuft, T((R() - 0.5) * 1.5, H - 0.05, (R() - 0.5) * 1.5, R() * 6, 0, 0, 0.8 + R() * 0.5));
    for (let i = 0; i < 3; i++) g.add(icosphere(0.14 + R() * 0.08, PAL.stoneDark, 1, true, 0.15, i), T((R() - 0.5) * 1.4, H, (R() - 0.5) * 1.4, 0, 0, 0, 1, 0.6, 1));
    g.add(roundedBox(0.08, 0.7, 0.08, 0.03, PAL.woodDark, 1), T(0.75, H + 0.25, 0.75));
    g.add(roundedBox(0.6, 0.32, 0.06, 0.04, PAL.woodLight, 2), T(0.75, H + 0.62, 0.79, P / 4));
  }
  return g;
}

function mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
export { mul as mmul };

// ---------------- Gras ----------------
export function grassTuft(R, h = 0.35, colors = ['#7fcf48', '#6bbd3d', '#98dd5e']) {
  const g = new Geo();
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * P * 2 + R() * 0.6, lean = 0.25 + R() * 0.35, hh = h * (0.6 + R() * 0.6), w = 0.035;
    const c = col(colors[i % colors.length]);
    const base = [Math.cos(a) * 0.03, 0, Math.sin(a) * 0.03];
    const tip = [Math.cos(a) * hh * lean, hh, Math.sin(a) * hh * lean];
    const side = [Math.cos(a + P / 2) * w, 0, Math.sin(a + P / 2) * w];
    const A = v3.add(base, side), B = v3.sub(base, side);
    const nrm = v3.norm([Math.cos(a) * 0.3, 1, Math.sin(a) * 0.3]);
    const dark = v3.scale(c, 0.7);
    g.vert(A, nrm, dark, 0, 0); g.vert(B, nrm, dark, 0, 0); g.vert(tip, nrm, c, 0, 1);
    g.vert(A, nrm, dark, 0, 0); g.vert(tip, nrm, c, 0, 1); g.vert(B, nrm, dark, 0, 0);
  }
  return g;
}

// ---------------- Blumen ----------------
export const FLOWER_LOOK = {
  daisy: { petal: '#ffffff', tip: '#fff6fb', center: '#ffcf2e' },
  tulip: { petal: '#ff4d7a', tip: '#ff8fae', center: '#ffe27a' },
  sunflower: { petal: '#ffc21a', tip: '#ffdb5c', center: '#6b3a14' },
  lavender: { petal: '#9a7be8', tip: '#c3aef7', center: '#7c5cd6' },
  rose: { petal: '#cf1734', tip: '#f23a52', center: '#8e0b22' },
  orchid: { petal: '#f27ad0', tip: '#ffd3f1', center: '#fff2a8' },
};
Object.assign(FLOWER_LOOK, {
  rainbowTulip: { petals: ['#ff4d6d', '#ff9f1c', '#ffd23f', '#5fd35a', '#4aa3ff', '#9a7be8'], petal: '#ff4d6d', tip: '#ffffff', center: '#ffe27a' },
  sunTulip: { petal: '#ff6a1a', tip: '#ffd23f', center: '#ffe27a' },
  goldRose: { petal: '#d28c08', tip: '#ffdf6a', center: '#8f5200', glow: 0.25 },
  moonOrchid: { petal: '#dfe6ff', tip: '#bfaaff', center: '#fff0b8', glow: 0.45 },
  northRose: { petal: '#1fcfa8', tip: '#8f7bff', center: '#7a4dff', glow: 0.6 },
  blackRose: { petal: '#2a0d18', tip: '#7a1634', center: '#14060b' },
  starRose: { petal: '#1f2fa8', tip: '#5b74f0', center: '#ffcf3a', glow: 0.7 },
  // Neue Gartenblumen
  cornflower: { petal: '#3d6fe0', tip: '#86b4ff', center: '#26308f' },
  poppy: { petal: '#e3241c', tip: '#ff5a3c', center: '#1d1a22' },
  lily: { petal: '#ffffff', tip: '#ff9cc8', center: '#ffcf3a' },
  hydrangea: { petal: '#8fa8ff', tip: '#c9a6ff', center: '#e8e0ff' },
  // Neue Züchtungen
  skyCornflower: { petal: '#22b6ff', tip: '#c4f1ff', center: '#1660b8', glow: 0.25 },
  firePoppy: { petal: '#ff5a0a', tip: '#ffd23f', center: '#3a1a10', glow: 0.45 },
  iceLily: { petal: '#d6f1ff', tip: '#6fcaff', center: '#b9ecff', glow: 0.45 },
  rainbowHydrangea: { petals: ['#ff6f9a', '#ffd23f', '#7be86a', '#5ab4ff', '#b48cff'], petal: '#ff6f9a', tip: '#ffffff', center: '#ffffff' },
  dragonLily: { petal: '#6a0a24', tip: '#ffb81c', center: '#ffd23f', glow: 0.35 },
  crystalRose: { petal: '#b9e4ff', tip: '#f4fbff', center: '#7cc8ff', glow: 0.5 },
  moonRose: { petal: '#c9d3ff', tip: '#eef1ff', center: '#8fa4ff', glow: 0.5 },
  dahlia: { petal: '#ff5c8a', tip: '#ffd1dc', center: '#ff9ab8' },
  peony: { petal: '#ffb3c6', tip: '#fff0f3', center: '#ffd6e0' },
  magnolia: { petal: '#f7e6f2', tip: '#ffffff', center: '#e8a0c8' },
  moonflower: { petal: '#9fb0ff', tip: '#d6ddff', center: '#6f88ff', glow: 0.6 },
  // Event-Blumen
  heartRose: { petal: '#e0163f', tip: '#ffd5de', center: '#8c0a26' },
  daffodil: { petal: '#ffe14a', tip: '#fff6b0', center: '#ff9e1a' },
  lilac: { petal: '#b07ee8', tip: '#d9bdf7', center: '#f3e8ff', petals: ['#b07ee8', '#c89cf2', '#9d66dd'] },
  hibiscus: { petal: '#ff2d55', tip: '#ff7a95', center: '#ffd23f' },
  chrysanthemum: { petal: '#d8782a', tip: '#ffc45c', center: '#a44d12' },
  marigold: { petal: '#ff8a1a', tip: '#ffc23a', center: '#c9540a' },
  poinsettia: { petal: '#e0202e', tip: '#ff4a55', center: '#ffd23f' },
  sparkler: { petals: ['#ff3d6e', '#ffd23f', '#4aa3ff', '#5fd35a', '#ff9f1c', '#b48cff'], petal: '#ff3d6e', tip: '#ffffff', center: '#fff2a8', glow: 0.5 },
  crocus: { petal: '#8f5fd9', tip: '#b99af0', center: '#ffb81c' },
  candyCrocus: { petals: ['#ff8fb8', '#ffd97a', '#8fe0ff', '#b9f5a8', '#d9b3ff'], petal: '#ff8fb8', tip: '#ffffff', center: '#ffb81c' },
  lavaHibiscus: { petal: '#ff3b1f', tip: '#ffc93a', center: '#ffe27a', glow: 0.45 },
  frostStar: { petal: '#cfeaff', tip: '#f6fbff', center: '#7fcfff', glow: 0.45 },
  queenRose: { petal: '#c2102e', tip: '#ffd25a', center: '#6e0618', glow: 0.3 },
  opheliaBloom: { petals: ['#ffd1dc', '#fff0b3', '#d4f5d0', '#cfe6ff', '#e6d6ff'], petal: '#ffd1dc', tip: '#ffffff', center: '#ffe27a', glow: 0.5 },
});
const brighten = (look) => {
  const b = (c) => { const v = col(c); return v.map((x) => Math.min(1, x * 1.12 + 0.04)); };
  return { ...look, petal: b(look.petal), tip: b(look.tip), petals: look.petals && look.petals.map(b) };
};
const setEmissive = (g, e) => { for (let i = 9; i < g.d.length; i += 11) g.d[i] = e; return g; };

function stem(h, bend = 0.08, r = 0.022) {
  const g = new Geo();
  const segs = 4;
  for (let i = 0; i < segs; i++) {
    const y0 = (h * i) / segs, y1 = (h * (i + 1)) / segs;
    const x0 = Math.sin((i / segs) * P * 0.5) * bend, x1 = Math.sin(((i + 1) / segs) * P * 0.5) * bend;
    const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(x1 - x0, y1 - y0);
    g.add(cylinder(r * 0.9, r, len, PAL.stem, 6, false), T(x0, y0, 0, 0, 0, -ang));
  }
  return g;
}
const leaf = (len, wid, c = PAL.leaf1) => petal(len, wid, c, { cup: 0.1, curl: 0.35, tip: 0.9, fold: 0.25, colorTip: PAL.leaf3 });

// Detailstufe: 0 = Garten (sparsam, viele Pflanzen), 1 = Porträt/Drehansicht (volle Pracht)
let LOD = 1;
const hi = (a, b) => (LOD ? a : b);
function head(type, look, s = 1) {
  const g = headShape(type, look, s);
  return look.glow ? setEmissive(g, 1 + look.glow) : g;
}
const mixHex = (a, b, t) => { const A = col(a), B = col(b); return '#' + A.map((v, k) => Math.round((v + (B[k] - v) * t) * 255).toString(16).padStart(2, '0')).join(''); };
const pc = (look, i) => (look.petals ? look.petals[i % look.petals.length] : look.petal);
const GOLD = 2.399963; // goldener Winkel – Samen- und Blütenstände wie in der Natur

// Kelchblätter unter der Blüte: lassen jeden Kopf „am Stiel sitzen“
function calyx(s = 1, n = 5, len = 0.07, tilt = -0.5) {
  const g = new Geo();
  for (let i = 0; i < n; i++) g.add(petal(len * s, 0.028 * s, PAL.leaf2, { cup: 0.2, curl: 0.2, tip: 0.6, colorTip: PAL.leaf3 }), T(0, -0.004, 0, (i / n) * P * 2 + 0.4, tilt));
  g.add(sphere(0.03 * s, PAL.leaf2, hi(7, 5), hi(5, 4), 1.1), T(0, -0.012 * s, 0));
  return g;
}
// Normalen wie auf einer Kugel um einen Mittelpunkt: gefüllte Blüten wirken rund und plastisch
function roundNormals(g, cy, lift = 0) {
  for (let i = 0; i < g.d.length; i += 11) {
    const x = g.d[i], y = g.d[i + 1] + cy, z = g.d[i + 2], l = Math.hypot(x, y, z) || 1;
    const nx = x / l, ny = y / l + lift, nz = z / l, nl = Math.hypot(nx, ny, nz) || 1;
    g.d[i + 3] = nx / nl; g.d[i + 4] = ny / nl; g.d[i + 5] = nz / nl;
  }
  return g;
}
// Ein Kranz aus n Blütenblättern
function ring(g, n, len, wid, color, opts, tilt, y = 0, phase = 0, s = 1) {
  for (let i = 0; i < n; i++) g.add(petal(len * s, wid * s, typeof color === 'function' ? color(i) : color, opts), T(0, y * s, 0, (i / n) * P * 2 + phase, tilt));
}
// Staubgefäße in der Mitte
function stamens(g, n, len, color, headColor, s = 1, spread = 0.35) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * P * 2 + 0.3;
    const st = new Geo().add(cylinder(0.004 * s, 0.005 * s, len * s, color, 4)).add(sphere(0.011 * s, headColor, 5, 4, 1.5), T(0, len * s, 0));
    g.add(st, T(0, 0.01 * s, 0, a, -spread));
  }
}
// Punktmuster (Samen, Pollen) nach der Sonnenblumen-Spirale
function spiral(g, n, rMax, y, size, colors, s = 1, bowl = 0) {
  for (let i = 0; i < n; i++) {
    const r = rMax * Math.sqrt((i + 0.5) / n) * s, a = i * GOLD;
    g.add(sphere(size * s, colors[i % colors.length], hi(5, 4), hi(4, 3)), T(Math.cos(a) * r, y * s - bowl * (r / s) * (r / s), Math.sin(a) * r));
  }
}

function headShape(type, look, s) {
  const g = new Geo();
  if (type === 'daisy') {
    // zwei versetzte Kränze aus feinen Blütenblättern, gewölbte Mitte mit Pollenpunkten
    ring(g, 14, 0.17, 0.036, look.petal, { cup: 0.15, curl: 0.1, tip: 0.35, colorTip: look.tip }, -0.18, 0, 0, s);
    ring(g, hi(14, 10), 0.15, 0.034, look.tip, { cup: 0.2, curl: 0.2, tip: 0.35, colorTip: look.petal }, -0.42, 0.006, P / 14, s);
    g.add(sphere(0.06 * s, look.center, hi(12, 9), hi(8, 6), 0.5), T(0, 0.012 * s, 0));
    spiral(g, hi(18, 6), 0.045, 0.036, 0.007, [mixHex(look.center, '#000000', 0.25), mixHex(look.center, '#ffffff', 0.2)], s);
    g.add(calyx(s, 5, 0.06));
  } else if (type === 'tulip') {
    // Kelch aus drei äußeren und drei inneren, aufrechten Blättern
    const cup = new Geo();
    for (let i = 0; i < 3; i++) {
      const c = pc(look, i), tipc = look.petals ? mixHex(c, '#ffffff', 0.35) : look.tip;
      cup.add(petal(0.21 * s, 0.095 * s, c, { cup: 0.5, curl: 0.12, tip: 0.2, colorTip: tipc, under: 1 }), T(0, 0, 0, (i / 3) * P * 2, -1.05));
    }
    for (let i = 0; i < 3; i++) {
      const c = pc(look, i + 3), tipc = look.petals ? mixHex(c, '#ffffff', 0.35) : mixHex(look.tip, '#ffffff', 0.25);
      cup.add(petal(0.2 * s, 0.09 * s, c, { cup: 0.5, curl: 0.25, tip: 0.2, colorTip: tipc, under: 1 }), T(0, 0.004 * s, 0, (i / 3) * P * 2 + P / 3, -1.22));
    }
    roundNormals(cup, 0.06 * s, 0.35);
    g.add(cup);
    g.add(sphere(0.035 * s, look.center, 8, 6), T(0, 0.05 * s, 0));
    stamens(g, 6, 0.09, '#2a2230', '#1d1a22', s, 0.12);
    g.add(calyx(s, 3, 0.05, -0.9));
  } else if (type === 'sunflower') {
    // doppelter Kranz, Samenscheibe als Spirale, heller Pollenrand
    ring(g, 20, 0.21, 0.055, look.petal, { cup: 0.2, curl: 0.1, tip: 0.55, colorTip: look.tip }, -0.08, 0, 0, s);
    ring(g, 20, 0.18, 0.05, look.tip, { cup: 0.25, curl: 0.28, tip: 0.55, colorTip: look.petal }, -0.3, 0.008, P / 20, s);
    g.add(sphere(0.135 * s, look.center, 16, 9, 0.36), T(0, 0.012 * s, 0));
    spiral(g, hi(46, 14), 0.11, 0.05, 0.011, ['#3d1f0a', '#6b3a14', '#4a2508'], s, 0.25);
    for (let i = 0; i < hi(18, 8); i++) { const a = (i / 18) * P * 2; g.add(sphere(0.011 * s, '#e9b63a', 5, 4), T(Math.cos(a) * 0.125 * s, 0.03 * s, Math.sin(a) * 0.125 * s)); }
    g.add(calyx(s, 8, 0.12, -0.3));
  } else if (type === 'lavender') {
    // Ähre aus vielen kleinen Blütchen in Wirteln
    const spike = icosphere(0.035 * s, look.petal, 1, true, 0.2, 5).paint((p, n, c) => (p[1] > 0.012 * s ? col(look.tip) : c));
    g.add(spike, T(0, 0.15 * s, 0, 0, 0, 0, 1, 4.6, 1));
    for (let k = 0; k < hi(6, 4); k++) for (let j = 0; j < hi(3, 2); j++) {
      const a = k * 1.1 + j * (P * 2 / 3), y = 0.03 * s + k * 0.045 * s, r = 0.03 * s * (1 - k * 0.1);
      g.add(icosphere(0.02 * s, j % 2 ? look.tip : look.petal, 0, true), T(Math.cos(a) * r, y, Math.sin(a) * r));
    }
  } else if (type === 'rose') {
    // fünf ineinanderliegende Kränze, innen dunkler und enger
    const rings = [[3, 0.055, -1.5, 0.6], [4, 0.075, -1.3, 0.55], [5, 0.1, -0.95, 0.45], [6, 0.13, -0.55, 0.35], [8, 0.155, -0.22, 0.25]];
    const bloom = new Geo();
    rings.forEach(([n, l, tilt, cup], ri) => {
      const c = ri < 2 ? look.center : ri === 2 ? mixHex(look.center, look.petal, 0.5) : look.petal;
      const tipc = mixHex(c, look.tip, ri >= 3 ? 0.45 : 0.3); // Spitzen nur leicht aufgehellt, damit die Grundfarbe (z. B. Gold) sichtbar bleibt
      for (let i = 0; i < n; i++) bloom.add(petal(l * s, l * 0.78 * s, c, { cup, curl: 0.38, tip: 0.05, colorTip: tipc, under: 0.95, fold: 0.05 }), T(0, ri * 0.004, 0, (i / n) * P * 2 + ri * 0.7, tilt));
    });
    roundNormals(bloom, 0.06 * s);
    g.add(bloom);
    g.add(calyx(s, 5, 0.08, -0.4));
  } else if (type === 'cornflower') {
    // fein gefranste, trichterförmige Blütenkrone mit schuppigem Köpfchen darunter
    ring(g, 10, 0.12, 0.05, (i) => pc(look, i), { cup: 0.25, curl: 0.15, tip: 0.05, colorTip: look.tip, fold: 0.2 }, -0.4, 0.01, 0, s);
    ring(g, 6, 0.07, 0.03, look.tip, { cup: 0.35, curl: 0.25, tip: 0.1, colorTip: look.center }, -0.95, 0.03, 0.3, s);
    g.add(sphere(0.03 * s, look.center, 8, 6), T(0, 0.035 * s, 0));
    g.add(icosphere(0.04 * s, PAL.leaf2, 1, true, 0.25, 3), T(0, -0.02 * s, 0, 0, 0, 0, 1, 1.25, 1));
  } else if (type === 'poppy') {
    // vier große, knittrige Blätter, zwei kleinere innen, dunkle Mitte mit Staubgefäßen
    const cup = new Geo();
    for (let i = 0; i < 4; i++) cup.add(petal(0.19 * s, 0.17 * s, pc(look, i), { cup: 0.55, curl: 0.1, tip: 0.05, colorTip: look.tip, under: 1, fold: 0.12 }), T(0, 0, 0, (i / 4) * P * 2 + (i % 2) * 0.2, -0.75 - (i % 2) * 0.12));
    for (let i = 0; i < 2; i++) cup.add(petal(0.15 * s, 0.13 * s, mixHex(pc(look, i), '#ffffff', 0.12), { cup: 0.6, curl: 0.2, tip: 0.05, colorTip: look.tip, under: 1, fold: 0.15 }), T(0, 0.006 * s, 0, (i / 2) * P * 2 + 0.85, -0.95));
    roundNormals(cup, 0.05 * s);
    g.add(cup);
    g.add(sphere(0.045 * s, look.center, 10, 8, 0.8), T(0, 0.04 * s, 0));
    stamens(g, 12, 0.06, '#2a2230', '#3b3344', s, 0.55);
  } else if (type === 'lily') {
    // sechs lange, zurückgebogene Blätter mit Sprenkeln, lange Staubgefäße
    const spot = mixHex(look.petal, '#7a1a3a', 0.55);
    for (let i = 0; i < 6; i++) {
      const pg = new Geo().add(petal(0.25 * s, 0.075 * s, pc(look, i), { cup: 0.28, curl: 0.55, tip: 0.85, colorTip: look.tip, under: 0.95 }));
      for (let k = 0; k < 6; k++) { const u = 0.12 + (k % 3) * 0.1, v = (k < 3 ? -0.35 : 0.35) * (1 + (k % 3) * 0.3); const w = 0.075 * s * Math.sin(P * Math.min(1, u * 0.925 + 0.0375)); pg.add(sphere(0.007 * s, spot, 4, 3), T(v * w, 0.28 * w * v * v + 0.55 * 0.25 * s * u * u + 0.004, u * 0.25 * s)); }
      g.add(pg, T(0, 0, 0, (i / 6) * P * 2 + (i % 2) * 0.25, -0.72 - (i % 2) * 0.1));
    }
    stamens(g, 6, 0.15, '#c9e07a', '#e0701c', s, 0.3);
    g.add(cylinder(0.006 * s, 0.006 * s, 0.17 * s, '#cfe08a', 5), T(0, 0.01 * s, 0));
    g.add(sphere(0.012 * s, '#7fbf4a', 5, 4), T(0, 0.18 * s, 0));
    g.add(sphere(0.03 * s, look.center, 8, 6), T(0, 0.02 * s, 0));
    g.add(calyx(s, 3, 0.06, -0.8));
  } else if (type === 'hydrangea') {
    // Ballen aus vielen vierblättrigen Einzelblüten
    const R = rng(Math.round(s * 100) + 7), cols = look.petals || [look.petal, look.tip, mixHex(look.petal, look.tip, 0.5)];
    g.add(icosphere(0.11 * s, mixHex(look.petal, look.tip, 0.5), 1, false, 0.1, 3), T(0, 0.06 * s, 0));
    for (let i = 0; i < hi(64, 24); i++) {
      const u = R() * 1.7 - 0.7, a = i * GOLD, r = Math.sqrt(1 - u * u);
      const n = [Math.cos(a) * r, u, Math.sin(a) * r];
      const c = cols[i % cols.length], fl = new Geo();
      for (let k = 0; k < 4; k++) fl.add(petal(0.06 * s, 0.04 * s, c, { cup: 0.25, curl: 0.1, tip: 0.2, colorTip: mixHex(c, '#ffffff', 0.3) }), T(0, 0, 0, (k / 4) * P * 2 + R(), -0.25));
      fl.add(sphere(0.008 * s, look.center, 4, 3), T(0, 0.006 * s, 0));
      g.add(fl, mul(T(n[0] * 0.155 * s, 0.06 * s + n[1] * 0.15 * s, n[2] * 0.155 * s), dirMat(n)));
    }
  } else if (type === 'orchid') {
    // drei Kelchblätter, zwei breite Flügel und die Lippe mit Schlund
    for (let i = 0; i < 3; i++) g.add(petal(0.15 * s, 0.05 * s, look.petal, { cup: 0.1, curl: -0.08, tip: 0.6, colorTip: look.tip }), T(0, 0, 0, (i / 3) * P * 2 + P, -0.3));
    for (let i = 0; i < 2; i++) g.add(petal(0.13 * s, 0.095 * s, look.tip, { cup: 0.2, curl: 0.05, tip: 0.1, colorTip: look.petal, fold: 0.08 }), T(0, 0.006 * s, 0, P * 0.35 + i * P * 1.3, -0.25));
    const lip = new Geo().add(petal(0.07 * s, 0.05 * s, look.center, { cup: 0.55, curl: 0.4, tip: 0.1, colorTip: mixHex(look.center, look.petal, 0.4) }));
    for (let k = 0; k < 5; k++) lip.add(sphere(0.005 * s, mixHex(look.petal, '#7a1030', 0.5), 4, 3), T((k - 2) * 0.009 * s, 0.01 * s, 0.025 * s + Math.abs(k - 2) * 0.006 * s));
    for (let i = 0; i < lip.d.length; i += 11) { const l = Math.hypot(lip.d[i + 3], lip.d[i + 4] + 1.2, lip.d[i + 5]); lip.d[i + 3] /= l; lip.d[i + 4] = (lip.d[i + 4] + 1.2) / l; lip.d[i + 5] /= l; }
    g.add(lip, T(0, 0.012 * s, 0, P / 4 + P, -0.5));
    g.add(sphere(0.02 * s, mixHex(look.center, '#ffffff', 0.3), 6, 5), T(0, 0.02 * s, -0.01 * s));
  } else if (type === 'dahlia') {
    // Pompon: fünf Kränze spitzer Blätter nach der Spirale
    const rings = [[8, 0.06, -1.15], [10, 0.09, -0.85], [12, 0.12, -0.55], [14, 0.15, -0.3], [16, 0.17, -0.08]].slice(hi(0, 1));
    const bloom = new Geo();
    rings.forEach(([n, l, tilt], ri) => {
      const c = mixHex(look.tip, look.petal, ri / 4);
      for (let i = 0; i < n; i++) bloom.add(petal(l * s, 0.05 * s, c, { cup: 0.35, curl: 0.3, tip: 0.9, colorTip: look.tip, fold: 0.3, under: 0.9 }), T(0, ri * 0.005, 0, (i / n) * P * 2 + ri * GOLD, tilt));
    });
    roundNormals(bloom, 0.07 * s);
    g.add(bloom);
    g.add(sphere(0.03 * s, look.center, 8, 6), T(0, 0.04 * s, 0));
    g.add(calyx(s, 6, 0.08, -0.35));
  } else if (type === 'peony') {
    // üppige, gekräuselte Kugel aus breiten Blättern
    const rings = [[5, 0.07, -1.35, 0.65], [7, 0.1, -1.05, 0.55], [9, 0.13, -0.7, 0.45], [11, 0.16, -0.38, 0.35], [12, 0.18, -0.1, 0.25]].slice(hi(0, 1));
    const bloom = new Geo();
    rings.forEach(([n, l, tilt, cup], ri) => {
      const c0 = mixHex(look.center, look.petal, Math.min(1, ri / 3));
      for (let i = 0; i < n; i++) bloom.add(petal(l * s, l * 0.85 * s, look.petals ? pc(look, i + ri) : c0, { cup, curl: 0.42, tip: 0.08, colorTip: look.tip, fold: 0.12, under: 0.92 }), T(0, ri * 0.004, 0, (i / n) * P * 2 + ri * GOLD, tilt));
    });
    roundNormals(bloom, 0.07 * s);
    g.add(bloom);
    stamens(g, 8, 0.07, '#f3d35a', '#f0b020', s, 0.2);
    g.add(calyx(s, 5, 0.08, -0.4));
  } else if (type === 'magnolia') {
    // große Schale aus neun Blättern – außen rosa, innen hell – auf kahlem Zweig
    const cup = new Geo();
    [[-1.0, 0], [-0.75, P / 3], [-0.45, P / 6]].forEach(([tilt, ph], ri) => {
      for (let i = 0; i < 3; i++) cup.add(petal(0.24 * s, 0.1 * s, look.center, { cup: 0.45, curl: 0.18, tip: 0.3, colorTip: look.tip, under: 1, fold: 0.05 }), T(0, ri * 0.006 * s, 0, (i / 3) * P * 2 + ph, tilt));
    });
    roundNormals(cup, 0.08 * s, 0.25);
    g.add(cup);
    g.add(cylinder(0.012 * s, 0.02 * s, 0.07 * s, '#e3b3c8', 7), T(0, 0.02 * s, 0));
    spiral(g, 12, 0.02, 0.085, 0.008, ['#d9a0be', '#f2c6da'], s);
    g.add(calyx(s, 3, 0.05, -1.1));
  } else if (type === 'daffodil') {
    // Narzisse: sechs flache Blätter, davor die Trompete mit gewelltem Rand
    ring(g, 6, 0.15, 0.07, look.tip, { cup: 0.1, curl: 0.05, tip: 0.5, colorTip: look.petal }, -0.2, 0, 0, s);
    const prof = [[0.02, 0], [0.045, 0.02], [0.05, 0.08], [0.062, 0.11], [0.075, 0.125]].map(([r, y]) => [r * s, y * s]);
    const tr = lathe(prof, look.center, hi(16, 10)).paint((p, n, c) => (p[1] > 0.1 * s ? col(mixHex(look.center, '#ffffff', 0.25)) : c));
    for (let i = 0; i < tr.d.length; i += 11) { const l = Math.hypot(tr.d[i + 3], tr.d[i + 4] + 1.4, tr.d[i + 5]); tr.d[i + 3] /= l; tr.d[i + 4] = (tr.d[i + 4] + 1.4) / l; tr.d[i + 5] /= l; }
    g.add(tr, T(0, 0.01 * s, 0));
    stamens(g, 4, 0.07, '#e6c23a', '#ff9e1a', s, 0.15);
    g.add(calyx(s, 3, 0.05, -0.9));
  } else if (type === 'poinsettia') {
    // Weihnachtsstern: grüne Blätter unten, rote Hochblätter als Stern, gelbe Knöpfchen in der Mitte
    ring(g, 6, 0.2, 0.08, PAL.leaf2, { cup: 0.1, curl: 0.05, tip: 0.8, colorTip: PAL.leaf1 }, -0.1, -0.01, 0.3, s);
    ring(g, 7, 0.18, 0.07, look.petal, { cup: 0.12, curl: 0.08, tip: 0.8, colorTip: look.tip }, -0.15, 0.005, 0, s);
    ring(g, 5, 0.12, 0.055, look.tip, { cup: 0.15, curl: 0.15, tip: 0.8, colorTip: look.petal }, -0.4, 0.012, 0.5, s);
    for (let i = 0; i < hi(7, 5); i++) { const a = i * GOLD, r = (i ? 0.02 : 0) * s; g.add(sphere(0.011 * s, i % 2 ? look.center : '#8fd34f', 5, 4), T(Math.cos(a) * r, 0.025 * s, Math.sin(a) * r)); }
  } else if (type === 'moonflower') {
    // Trichterblüte wie eine Winde: Röhre, darüber fünf breite Blätter zu einem Stern, heller Schlund
    const prof = [[0.015, 0], [0.03, 0.04], [0.05, 0.08], [0.08, 0.1]].map(([r, y]) => [r * s, y * s]);
    g.add(lathe(prof, mixHex(look.petal, look.center, 0.5), hi(16, 10)));
    const star = new Geo();
    for (let i = 0; i < 5; i++) star.add(petal(0.16 * s, 0.115 * s, look.petal, { cup: -0.12, curl: 0.12, tip: 0.1, colorTip: look.tip, under: 0.9 }), T(0, 0, 0, (i / 5) * P * 2, -0.45));
    star.paint((p, n, c) => { const a = Math.atan2(p[2], p[0]); const d = Math.hypot(p[0], p[2]); return d < 0.05 * s || Math.cos(a * 5) > 0.75 ? col(mixHex(look.center, look.petal, Math.min(1, d / (0.16 * s)))) : c; });
    g.add(star, T(0, 0.1 * s, 0));
    g.add(sphere(0.012 * s, mixHex(look.center, '#ffffff', 0.4), 6, 4), T(0, 0.1 * s, 0));
    g.add(calyx(s, 5, 0.06, -0.85));
  }
  return g;
}

function bud(look, s = 1) {
  const g = new Geo();
  g.add(sphere(0.05 * s, PAL.leaf2, 8, 6, 1.5), T(0, 0.03 * s, 0));
  for (let i = 0; i < 4; i++) g.add(petal(0.07 * s, 0.035 * s, PAL.leaf1, { cup: 0.5, curl: 0.2, tip: 0.6, colorTip: PAL.leaf3 }), T(0, 0.01, 0, (i / 4) * P * 2 + 0.4, -1.3));
  if (look) for (let i = 0; i < 4; i++) g.add(petal(0.09 * s, 0.045 * s, look.petal, { cup: 0.6, curl: 0.2, tip: 0.6, colorTip: look.tip }), T(0, 0.02, 0, (i / 4) * P * 2, -1.25));
  return g;
}

const TALL = { daisy: 0.32, tulip: 0.52, sunflower: 1.05, lavender: 0.5, rose: 0.46, orchid: 0.55, cornflower: 0.46, poppy: 0.5, lily: 0.6, hydrangea: 0.42, dahlia: 0.55, peony: 0.5, magnolia: 0.68, moonflower: 0.58, daffodil: 0.4, poinsettia: 0.38 };
const STEMS = { daisy: 3, cornflower: 3, rose: 3, lavender: 5, poppy: 2, hydrangea: 2, dahlia: 2, peony: 2, moonflower: 3, daffodil: 3 };
const STEMS_LOW = { daisy: 2, cornflower: 2, rose: 2, lavender: 4, poppy: 2, hydrangea: 1, dahlia: 1, peony: 1, moonflower: 2, daffodil: 2 };
const HEAD_TILT = { sunflower: -0.55, lavender: 0, magnolia: -0.3, moonflower: -0.6, lily: -0.35, orchid: -0.2, daffodil: -0.45 };

// Eine Pflanze in Stufe 0 (Spross) … 3 (Blüte)
export function plant(seedId, stage, shiny = false, seed = 1, lod = 0) {
  LOD = lod;
  const type = SEEDS[seedId]?.model || seedId;
  const g = new Geo(), R = rng(seed * 31 + stage);
  const look = shiny ? brighten(FLOWER_LOOK[seedId] || FLOWER_LOOK[type]) : FLOWER_LOOK[seedId] || FLOWER_LOOK[type];
  if (stage === 0) {
    g.add(icosphere(0.2, PAL.soilDark, 1, true), T(0, -0.02, 0, 0, 0, 0, 1, 0.35, 1));
    g.add(cylinder(0.02, 0.024, 0.14, PAL.stem, 5), T(0, 0, 0));
    g.add(leaf(0.16, 0.08), T(0, 0.12, 0, 0.3, -0.5));
    g.add(leaf(0.16, 0.08), T(0, 0.12, 0, 0.3 + P, -0.5));
    return g.windByHeight(0, 0.25, 0.4);
  }
  const tall = TALL[type] || 0.5;
  const grow = stage === 1 ? 0.5 : stage === 2 ? 0.78 : 1;
  const h = tall * grow;
  const stems = (lod ? STEMS : STEMS_LOW)[type] || 1;
  // Blätter am Boden
  const nl = type === 'sunflower' ? 4 : type === 'magnolia' ? 2 : 3;
  for (let i = 0; i < nl; i++) {
    const big = type === 'sunflower' ? 0.24 : type === 'tulip' ? 0.3 : type === 'peony' || type === 'dahlia' ? 0.19 : 0.15;
    g.add(leaf(big * (0.6 + grow * 0.4), (type === 'tulip' ? 0.06 : 0.07) * (type === 'sunflower' ? 1.8 : 1)), T(0, 0.02 + (type === 'sunflower' ? i * h * 0.18 : 0), 0, (i / nl) * P * 2 + R(), type === 'tulip' ? -1.0 : -0.35));
  }
  if (type === 'rose' || type === 'hydrangea' || type === 'peony') for (let i = 0; i < hi(7, 4); i++) g.add(icosphere(0.09 + R() * 0.04, R() > 0.5 ? PAL.leaf2 : PAL.leaf1, 1, false, 0.2, i), T((R() - 0.5) * 0.22, 0.12 + R() * h * 0.5, (R() - 0.5) * 0.22));
  // Blätter am Stiel
  if (stage >= 2 && type !== 'lavender' && type !== 'magnolia') for (let i = 0; i < 2; i++) g.add(leaf(0.11, 0.05), T(0, h * (0.35 + i * 0.25), 0, R() * P * 2, -0.6));
  for (let k = 0; k < stems; k++) {
    const a = (k / stems) * P * 2 + R(), off = stems > 1 ? 0.06 + R() * 0.05 : 0;
    const sh = h * (stems > 1 ? 0.75 + R() * 0.3 : 1), bend = (R() - 0.5) * 0.12;
    const sm = new Geo().add(stem(sh, bend, type === 'sunflower' ? 0.04 : type === 'magnolia' ? 0.03 : 0.02));
    const top = [bend, sh, 0];
    if (stage === 3) {
      const tilt = HEAD_TILT[type] ?? -0.15;
      sm.add(head(type, look, type === 'sunflower' ? 1.15 : 1), T(top[0], top[1], top[2], 0, tilt, 0));
      // Orchideen und Mondwinden tragen mehrere Blüten am Stiel
      if (type === 'orchid') for (let j = 0; j < 2; j++) sm.add(head(type, look, 0.72 - j * 0.12), T(bend * 0.8 + (j ? -0.07 : 0.07), sh * (0.74 - j * 0.2), 0.03, j ? 2.4 : -0.8, -0.5, 0));
      if (type === 'moonflower' && k === 0) sm.add(head(type, look, 0.7), T(bend * 0.6 - 0.06, sh * 0.55, 0.04, 1.8, -0.7, 0));
    } else if (type === 'lavender') {
      sm.add(head(type, stage === 2 ? look : { petal: PAL.leaf2, tip: PAL.leaf3 }, 0.8), T(top[0], top[1], top[2]));
    } else {
      sm.add(bud(stage === 2 ? look : null, type === 'sunflower' ? 1.8 : 1), T(top[0], top[1], top[2]));
    }
    g.add(sm, T(Math.cos(a) * off, 0, Math.sin(a) * off, a));
  }
  g.windByHeight(0.05, tall * 1.1, 1);
  const k = PLANT_SCALE[type] * (['starRose', 'crystalRose', 'dragonLily', 'moonRose'].includes(seedId) ? 1.12 : SEEDS[seedId]?.slow ? 1.22 : 1);
  return new Geo().add(g, T(0, 0, 0, 0, 0, 0, k));
}
export const PLANT_SCALE = { daisy: 2.3, tulip: 2.1, sunflower: 1.5, lavender: 1.9, rose: 2.15, orchid: 2.1, cornflower: 2.1, poppy: 2.0, lily: 1.9, hydrangea: 1.9, dahlia: 2.0, peony: 2.0, magnolia: 1.75, moonflower: 1.5, daffodil: 2.0, poinsettia: 2.1 };

// Porträt für Sammlung und Saatgut: die Blüte groß im Bild, kurzer Stiel mit zwei Blättern
const FACE_UP = { daisy: 0.55, sunflower: 0.5, cornflower: 0.4, poppy: 0.45, lily: 0.4, orchid: 0.35, moonflower: 0.15, daffodil: 0.4, poinsettia: 0.5 };
export function portrait(seedId, shiny = false) {
  const type = SEEDS[seedId]?.model || seedId;
  const base = shiny ? brighten(FLOWER_LOOK[seedId] || FLOWER_LOOK[type]) : FLOWER_LOOK[seedId] || FLOWER_LOOK[type];
  const look = base.glow ? { ...base, glow: Math.min(base.glow, 0.3) } : base; // im Porträt nicht überstrahlen
  LOD = 1;
  const g = new Geo();
  const s = type === 'lavender' ? 1.1 : type === 'orchid' || type === 'cornflower' ? 1.25 : type === 'daisy' ? 0.85 : 1;
  g.add(stem(0.2, 0.03, type === 'sunflower' ? 0.03 : 0.02));
  g.add(leaf(0.13, 0.055), T(0.01, 0.06, 0, 0.9, -0.55));
  g.add(leaf(0.12, 0.05), T(-0.01, 0.1, 0, 0.9 + P, -0.6));
  const tilt = FACE_UP[type] ?? 0.12;
  g.add(head(type, look, s), T(0.03 * 0.5, 0.2, 0, 0, tilt, 0));
  return g;
}

// Funkelnder Stern (für goldene Blumen, Tau)
export function sparkle(color = '#fffbe6', s = 0.06) {
  const g = new Geo(), c = col(color);
  const pts = [[0, s * 2, 0], [0, -s * 2, 0], [s * 2, 0, 0], [-s * 2, 0, 0], [0, 0, s * 2], [0, 0, -s * 2]];
  for (const p of pts) g.add(sphere(s * 0.35, c, 4, 3), T(p[0] * 0.25, p[1] * 0.25, p[2] * 0.25));
  g.add(sphere(s * 0.6, c, 6, 4));
  for (const p of pts) g.add(cylinder(0.0, s * 0.35, s * 2, c, 4, false), mul(T(0, 0, 0), dirMat(p)));
  return g;
}
function dirMat(p) {
  const d = v3.norm(p);
  const rx = Math.acos(Math.max(-1, Math.min(1, d[1])));
  const ry = Math.atan2(d[0], d[2]);
  return T(0, 0, 0, ry, rx);
}

// ---------------- Haus ----------------
export function house() {
  const g = new Geo();
  const W = 4.4, D = 3.4, H = 2.5;
  g.add(roundedBox(W + 0.25, 0.32, D + 0.25, 0.08, '#b3aaa0', 2), T(0, 0.16, 0));
  g.add(roundedBox(W, H, D, 0.1, PAL.wall, 2).shadeByHeight(0.3, H, 0.86, 1.03), T(0, 0.3 + H / 2, 0));
  // Fachwerk-Balken
  const beam = (w, h, d, x, y, z) => g.add(roundedBox(w, h, d, 0.03, PAL.beam, 1), T(x, y, z));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) beam(0.2, H + 0.05, 0.2, sx * (W / 2 - 0.05), 0.3 + H / 2, sz * (D / 2 - 0.05));
  beam(W + 0.05, 0.16, 0.16, 0, 0.36 + H, D / 2 + 0.02);
  beam(0.16, 0.16, D + 0.05, W / 2 + 0.02, 0.36 + H, 0);
  // Giebel (Dreieck) vorne/hinten auf der Breitseite X
  const roofH = 1.55;
  for (const sx of [-1, 1]) g.add(extrude([[-D / 2, 0], [D / 2, 0], [0, roofH]], 0.2, PAL.wall), mul(T(sx * (W / 2 - 0.1), 0.3 + H, 0, P / 2), T(0, 0, 0)));
  // Dach: zwei Schrägen
  const slope = Math.hypot(D / 2 + 0.4, roofH + 0.25), ang = Math.atan2(roofH + 0.25, D / 2 + 0.4);
  for (const sz of [-1, 1]) {
    const m = T(0, 0.3 + H + roofH / 2 + 0.08, sz * (D / 4 + 0.2), 0, sz * ang);
    g.add(roundedBox(W + 0.7, 0.2, slope + 0.1, 0.08, PAL.roof, 2), m);
    for (let r = 1; r < 6; r++) g.add(roundedBox(W + 0.72, 0.06, 0.08, 0.03, PAL.roofDark, 1), mul(m, T(0, 0.1, -slope / 2 + (r * slope) / 6)));
  }
  g.add(roundedBox(W + 0.8, 0.22, 0.26, 0.1, PAL.roofDark, 2), T(0, 0.3 + H + roofH + 0.18, 0));
  // Schornstein
  g.add(roundedBox(0.55, 1.3, 0.55, 0.06, '#c4664e', 2), T(-1.2, 0.3 + H + roofH - 0.1, -0.6));
  g.add(roundedBox(0.68, 0.14, 0.68, 0.05, '#8e4a3a', 2), T(-1.2, 0.3 + H + roofH + 0.58, -0.6));
  // Tür (+Z-Seite)
  const dz = D / 2 + 0.03;
  g.add(roundedBox(0.95, 1.75, 0.1, 0.05, PAL.door, 2), T(-0.6, 0.3 + 0.88, dz));
  g.add(roundedBox(1.15, 0.12, 0.16, 0.04, PAL.white, 1), T(-0.6, 0.3 + 1.82, dz));
  for (const sx of [-1, 1]) g.add(roundedBox(0.1, 1.85, 0.14, 0.04, PAL.white, 1), T(-0.6 + sx * 0.53, 0.3 + 0.92, dz));
  g.add(sphere(0.055, '#ffd75e', 8, 6), T(-0.27, 0.3 + 0.9, dz + 0.08));
  g.add(roundedBox(0.4, 0.4, 0.04, 0.05, PAL.glass, 2), T(-0.6, 0.3 + 1.35, dz + 0.04), { emissive: 0.8 });
  // Stufe
  g.add(roundedBox(1.4, 0.18, 0.6, 0.06, '#c9c1b5', 2), T(-0.6, 0.09, dz + 0.3));
  // Fenster
  const win = (x, y, z, ry) => {
    const m = T(x, y, z, ry);
    g.add(roundedBox(0.95, 0.95, 0.06, 0.04, PAL.glass, 2), m, { emissive: 1 });
    g.add(roundedBox(1.08, 0.12, 0.14, 0.04, PAL.white, 1), mul(m, T(0, 0.5, 0.02)));
    g.add(roundedBox(1.08, 0.12, 0.14, 0.04, PAL.white, 1), mul(m, T(0, -0.5, 0.02)));
    g.add(roundedBox(0.12, 1.0, 0.14, 0.04, PAL.white, 1), mul(m, T(0.5, 0, 0.02)));
    g.add(roundedBox(0.12, 1.0, 0.14, 0.04, PAL.white, 1), mul(m, T(-0.5, 0, 0.02)));
    g.add(roundedBox(0.06, 0.9, 0.08, 0.02, PAL.white, 1), mul(m, T(0, 0, 0.03)));
    g.add(roundedBox(0.9, 0.06, 0.08, 0.02, PAL.white, 1), mul(m, T(0, 0, 0.03)));
    // Fensterläden
    for (const s of [-1, 1]) g.add(roundedBox(0.3, 1.0, 0.06, 0.04, '#5fae96', 2), mul(m, T(s * 0.72, 0, 0.0)));
    // Blumenkasten
    g.add(roundedBox(1.0, 0.2, 0.26, 0.05, PAL.woodDark, 2), mul(m, T(0, -0.66, 0.16)));
    const R = rng(Math.round(x * 10 + z));
    for (let i = 0; i < 6; i++) {
      g.add(icosphere(0.09, PAL.leaf2, 1), mul(m, T(-0.38 + i * 0.15, -0.53, 0.18)));
      g.add(sphere(0.055, ['#ff6f9a', '#ffd23f', '#ffffff', '#ff8f5a'][Math.floor(R() * 4)], 6, 5), mul(m, T(-0.38 + i * 0.15, -0.46, 0.25 + R() * 0.05)));
    }
  };
  win(1.05, 0.3 + 1.35, dz, 0);
  win(W / 2 + 0.03, 0.3 + 1.35, -0.55, P / 2);
  // Lampe neben der Tür
  g.add(roundedBox(0.2, 0.28, 0.2, 0.05, '#4a4a52', 2), T(0.05, 0.3 + 1.75, dz + 0.12));
  g.add(roundedBox(0.14, 0.2, 0.14, 0.04, '#ffe9a8', 2), T(0.05, 0.3 + 1.73, dz + 0.13), { emissive: 1 });
  return g;
}

// ---------------- Teich ----------------
export function pondRim(rx, rz) {
  const g = new Geo(), R = rng(9);
  g.add(disk(rx + 0.1, '#3d8fb8', 28, rz + 0.1), T(0, 0.015, 0));
  const n = 26;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * P * 2, s = 0.3 + R() * 0.18;
    g.add(icosphere(s, R() > 0.5 ? PAL.stone : '#b9b2a8', 1, false, 0.18, i), T(Math.cos(a) * (rx + 0.15), 0.06, Math.sin(a) * (rz + 0.15), R() * 6, 0, 0, 1, 0.55, 1));
  }
  // Schilf
  for (let i = 0; i < 7; i++) {
    const a = -0.6 + i * 0.13, x = Math.cos(a) * (rx - 0.2), z = Math.sin(a) * (rz - 0.2), h = 0.9 + R() * 0.5;
    const reed = new Geo().add(cylinder(0.015, 0.025, h, '#5c9e3a', 5));
    if (i % 2 === 0) reed.add(cylinder(0.045, 0.045, 0.22, '#7a4a28', 7), T(0, h - 0.1, 0));
    reed.add(leaf(0.5, 0.04, '#6fb243'), T(0, 0.05, 0, R() * 6, -1.1));
    g.add(reed.windByHeight(0, h, 1), T(x, 0.02, z, 0, (R() - 0.5) * 0.15));
  }
  // Seerosenblätter + Blüte
  for (const [x, z, s] of [[-0.6, 0.3, 0.32], [0.5, -0.4, 0.26], [-0.1, -0.55, 0.22], [0.75, 0.35, 0.2]]) {
    const pad = disk(s, '#4fae45', 14);
    g.add(pad, T(x, 0.075, z, R() * 6));
  }
  const lily = new Geo();
  for (let i = 0; i < 8; i++) lily.add(petal(0.14, 0.06, '#ffd0e6', { cup: 0.3, curl: 0.4, tip: 0.6, colorTip: '#ff8fc0' }), T(0, 0, 0, (i / 8) * P * 2, -0.4));
  lily.add(sphere(0.04, '#ffd23f', 6, 5));
  g.add(lily, T(-0.6, 0.09, 0.3));
  return g;
}

// ---------------- Pflanzenwelt ----------------
export function tree(seed = 1, kind = 'round', detail = 2) {
  const g = new Geo(), R = rng(seed);
  if (kind === 'pine') {
    g.add(cylinder(0.14, 0.22, 1.0, PAL.trunk, 7), T(0, 0, 0));
    const tiers = 4;
    for (let i = 0; i < tiers; i++) {
      const r = 1.3 - i * 0.26, y = 0.7 + i * 0.65;
      g.add(cylinder(0.0, r, 1.1, i % 2 ? PAL.pine : '#4aa85c', 9).shadeByHeight(0, 1.1, 0.8, 1.1), T(0, y, 0, R() * 3));
    }
    return g.windByHeight(1, 4, 0.25);
  }
  const h = 1.5 + R() * 0.6;
  const trunk = new Geo().add(cylinder(0.17, 0.27, h, PAL.trunk, 8));
  trunk.add(cylinder(0.06, 0.1, 0.8, PAL.trunk, 6), T(0, h * 0.6, 0, R() * 6, 0, 0.9));
  g.add(trunk);
  const greens = [PAL.leaf1, PAL.leaf2, PAL.leaf3, '#5cbf3f'];
  const blobs = [[0, h + 0.7, 0, 1.15], [0.75, h + 0.35, 0.2, 0.8], [-0.65, h + 0.4, -0.25, 0.85], [0.1, h + 0.25, -0.75, 0.75], [-0.2, h + 0.35, 0.75, 0.75], [0.2, h + 1.35, 0.1, 0.7]];
  blobs.forEach(([x, y, z, r], i) => {
    const b = icosphere(r * (0.9 + R() * 0.2), greens[(i + seed) % greens.length], detail, false, 0.12, i + seed);
    b.paint((p, n, c) => v3.scale(c, 0.82 + 0.28 * (n[1] * 0.5 + 0.5)));
    g.add(b, T(x, y, z));
  });
  if (kind === 'apple') for (let i = 0; i < 9; i++) { const a = R() * P * 2, yy = h + 0.2 + R() * 1.2; g.add(sphere(0.1, '#e8383d', 6, 4), T(Math.cos(a) * (0.95 + R() * 0.2), yy, Math.sin(a) * (0.95 + R() * 0.2))); }
  return g.windByHeight(h, h + 2.2, 0.35);
}

export function bush(seed = 1, flowers = null) {
  const g = new Geo(), R = rng(seed);
  for (let i = 0; i < 4; i++) {
    const r = 0.38 + R() * 0.2;
    const b = icosphere(r, R() > 0.5 ? PAL.leaf2 : PAL.leaf1, 1, false, 0.15, i + seed);
    b.paint((p, n, c) => v3.scale(c, 0.8 + 0.3 * (n[1] * 0.5 + 0.5)));
    g.add(b, T((R() - 0.5) * 0.6, r * 0.8, (R() - 0.5) * 0.6));
  }
  if (flowers) for (let i = 0; i < 9; i++) { const a = R() * P * 2, y = 0.3 + R() * 0.55; g.add(icosphere(0.075, flowers, 0, false), T(Math.cos(a) * 0.5, y, Math.sin(a) * 0.5)); }
  return g.windByHeight(0.2, 1.2, 0.2);
}

export function hedge(len, seed = 2) {
  const g = new Geo(), R = rng(seed);
  g.add(roundedBox(len, 1.3, 1.1, 0.4, PAL.leaf2, 2).shadeByHeight(0, 1.3, 0.7, 1.05), T(0, 0.65, 0));
  for (let x = -len / 2 + 0.5; x < len / 2; x += 0.8) {
    const b = icosphere(0.5 + R() * 0.15, R() > 0.4 ? PAL.leaf2 : PAL.leaf1, 1, false, 0.12, Math.round(x * 10));
    b.paint((p, n, c) => v3.scale(c, 0.8 + 0.3 * (n[1] * 0.5 + 0.5)));
    g.add(b, T(x, 1.1 + R() * 0.15, (R() - 0.5) * 0.3));
  }
  return g.windByHeight(0.8, 1.8, 0.1);
}

export function rock(seed = 1, s = 0.5) {
  return icosphere(s, seed % 2 ? PAL.stone : '#b5aea4', 1, true, 0.22, seed).paint((p, n, c) => v3.scale(c, 0.78 + 0.3 * (n[1] * 0.5 + 0.5)));
}

export function wildflowers(R, count, area, avoid) {
  const g = new Geo(), cs = ['#ffffff', '#ffd84a', '#ff9fc6', '#b9a3ff', '#ff7a6b'];
  let placed = 0, guard = 0;
  while (placed < count && guard++ < count * 20) {
    const x = (R() - 0.5) * area, z = (R() - 0.5) * area;
    if (avoid(x, z)) continue;
    const c = cs[Math.floor(R() * cs.length)];
    const f = new Geo().add(cylinder(0.008, 0.01, 0.22, PAL.stem, 4)).add(icosphere(0.045, c, 0, true), T(0, 0.23, 0));
    g.add(f.windByHeight(0, 0.25, 1), T(x, 0, z));
    placed++;
  }
  return g;
}

// ---------------- Zaun ----------------
export function picketFence(len, gateGap = 0, gateX = 0) {
  const g = new Geo();
  const step = 0.32, n = Math.floor(len / step);
  const inGate = (x) => gateGap && Math.abs(x - gateX) < gateGap / 2 + 0.05;
  for (let i = 0; i <= n; i++) {
    const x = -len / 2 + i * step;
    if (inGate(x)) continue;
    g.add(box(0.12, 0.72, 0.05, PAL.white), T(x, 0.36, 0));
    g.add(extrude([[-0.06, 0], [0.06, 0], [0, 0.1]], 0.05, PAL.white), T(x, 0.72, 0));
  }
  const rail = (x0, x1) => { for (const y of [0.22, 0.55]) g.add(box(x1 - x0, 0.07, 0.05, '#ece6da'), T((x0 + x1) / 2, y, -0.05)); };
  if (gateGap) { rail(-len / 2, gateX - gateGap / 2); rail(gateX + gateGap / 2, len / 2); } else rail(-len / 2, len / 2);
  for (let x = -len / 2; x <= len / 2 + 0.01; x += len / Math.max(1, Math.round(len / 3))) {
    if (inGate(x)) continue;
    g.add(roundedBox(0.16, 0.95, 0.16, 0.04, PAL.white, 1), T(x, 0.47, -0.02));
    g.add(sphere(0.1, PAL.white, 8, 6), T(x, 0.98, -0.02));
  }
  if (gateGap) for (const s of [-1, 1]) {
    g.add(roundedBox(0.22, 1.25, 0.22, 0.05, PAL.woodDark, 2), T(gateX + s * gateGap / 2, 0.62, 0));
    g.add(sphere(0.13, PAL.woodLight, 8, 6), T(gateX + s * gateGap / 2, 1.3, 0));
  }
  return g;
}

// ---------------- Wolken ----------------
export function cloud(seed = 1) {
  const g = new Geo(), R = rng(seed);
  for (let i = 0; i < 5; i++) g.add(sphere(1.6 + R() * 1.4, '#ffffff', 12, 8, 0.7), T((i - 2) * 1.9 + R(), R() * 0.6, (R() - 0.5) * 1.5));
  return g;
}

// ---------------- Dekoration (kaufbar) ----------------
export const DECO_MODELS = {
  bench() {
    const g = new Geo();
    for (let i = 0; i < 3; i++) g.add(roundedBox(1.8, 0.07, 0.15, 0.03, PAL.wood, 2), T(0, 0.48, -0.18 + i * 0.18));
    for (let i = 0; i < 2; i++) g.add(roundedBox(1.8, 0.14, 0.06, 0.03, PAL.wood, 2), T(0, 0.78 + i * 0.2, -0.3, 0, -0.15));
    for (const s of [-1, 1]) {
      g.add(roundedBox(0.08, 0.5, 0.5, 0.03, '#3e4450', 1), T(s * 0.75, 0.24, 0));
      g.add(roundedBox(0.08, 0.6, 0.08, 0.03, '#3e4450', 1), T(s * 0.75, 0.75, -0.3));
    }
    return g;
  },
  lantern() {
    const g = new Geo();
    g.add(cylinder(0.05, 0.07, 1.5, '#3e4450', 8));
    g.add(cylinder(0.14, 0.18, 0.08, '#3e4450', 8), T(0, 0, 0));
    g.add(roundedBox(0.3, 0.36, 0.3, 0.05, '#3e4450', 2), T(0, 1.66, 0));
    g.add(roundedBox(0.22, 0.3, 0.22, 0.05, '#ffe7a3', 2), T(0, 1.66, 0), { emissive: 1 });
    g.add(cylinder(0.0, 0.24, 0.16, '#3e4450', 4), T(0, 1.84, 0, P / 4));
    return g;
  },
  birdbath() {
    const g = new Geo();
    g.add(lathe([[0.28, 0], [0.3, 0.08], [0.12, 0.18], [0.1, 0.6], [0.14, 0.72], [0.5, 0.82], [0.55, 0.92], [0.0, 0.92]], '#cfc8bd', 16));
    g.add(disk(0.46, PAL.water, 16), T(0, 0.9, 0));
    return g;
  },
  wheelbarrow() {
    const g = new Geo();
    g.add(roundedBox(1.0, 0.36, 0.7, 0.1, '#e6553f', 2), T(0, 0.55, 0, 0, 0, 0.1));
    g.add(roundedBox(0.8, 0.1, 0.5, 0.05, PAL.soil, 2), T(0, 0.72, 0, 0, 0, 0.1));
    g.add(cylinder(0.24, 0.24, 0.1, '#33363d', 14), T(0.62, 0.24, -0.05, 0, P / 2));
    for (const s of [-1, 1]) {
      g.add(roundedBox(1.2, 0.06, 0.06, 0.02, PAL.woodDark, 1), T(-0.35, 0.5, s * 0.3, 0, 0, -0.12));
      g.add(roundedBox(0.06, 0.38, 0.06, 0.02, '#33363d', 1), T(-0.3, 0.2, s * 0.25));
    }
    for (let i = 0; i < 4; i++) g.add(sphere(0.09, ['#ff6f9a', '#ffd23f', '#ffffff', '#9a7be8'][i], 6, 5), T(-0.2 + i * 0.15, 0.82, (i % 2 - 0.5) * 0.2));
    return g;
  },
  flowerpots() {
    const g = new Geo();
    [[0, 0, 1], [0.55, 0.2, 0.8], [0.2, 0.55, 0.7]].forEach(([x, z, s], i) => {
      g.add(lathe([[0.2 * s, 0], [0.28 * s, 0.4 * s], [0.32 * s, 0.42 * s], [0.32 * s, 0.5 * s], [0.0, 0.5 * s]], '#d9774a', 14), T(x, 0, z));
      g.add(icosphere(0.24 * s, PAL.leaf2, 1, false, 0.15, i), T(x, 0.6 * s, z));
      for (let k = 0; k < 4; k++) g.add(sphere(0.06, ['#ff6f9a', '#ffd23f', '#ffffff'][i], 6, 5), T(x + Math.cos(k * 1.6) * 0.15 * s, 0.72 * s, z + Math.sin(k * 1.6) * 0.15 * s));
    });
    return g;
  },
  pumpkins() {
    const g = new Geo();
    [[0, 0, 0.42], [0.6, 0.15, 0.3], [0.15, 0.6, 0.24]].forEach(([x, z, r]) => {
      const p = sphere(r, '#f28a1f', 16, 10, 0.75).displace((q) => { const a = Math.atan2(q[2], q[0]); const k = 1 + Math.cos(a * 8) * 0.06; return [q[0] * k, q[1], q[2] * k]; });
      p.paint((q, n, c) => v3.scale(c, 0.85 + 0.2 * (n[1] * 0.5 + 0.5)));
      g.add(p, T(x, r * 0.72, z));
      g.add(cylinder(0.03, 0.05, 0.16, '#5b7a2e', 6), T(x, r * 1.4, z, 0, 0.2));
    });
    g.add(leaf(0.3, 0.12, '#6aa84a'), T(0.3, 0.05, 0.3, 1.2, -0.1));
    return g;
  },
  mailbox() {
    const g = new Geo();
    g.add(roundedBox(0.12, 1.1, 0.12, 0.03, PAL.woodDark, 1), T(0, 0.55, 0));
    g.add(roundedBox(0.36, 0.34, 0.6, 0.15, '#3f7fd8', 3), T(0, 1.25, 0));
    g.add(roundedBox(0.04, 0.3, 0.08, 0.02, '#ff4a4a', 1), T(0.2, 1.35, 0.1));
    return g;
  },
  wateringcan() {
    const g = new Geo();
    g.add(cylinder(0.2, 0.22, 0.38, '#5bb0e0', 14));
    g.add(cylinder(0.025, 0.04, 0.45, '#5bb0e0', 6), T(0.18, 0.12, 0, 0, 0, -0.9));
    g.add(roundedBox(0.06, 0.3, 0.06, 0.03, '#4a9bcf', 1), T(-0.05, 0.48, 0, 0, 0, 0.5));
    return g;
  },
};

// ---------------- Tiere (Teile für Animation) ----------------
function eye(g, x, y, z, s = 0.045) {
  g.add(sphere(s, '#1d1d24', 8, 6), T(x, y, z));
  g.add(sphere(s * 0.35, '#ffffff', 5, 4), T(x + s * 0.3, y + s * 0.35, z + s * 0.55), { emissive: 0 });
}

export function fox(skin = 'default') {
  const C = skin === 'arctic' ? { fur: '#f2f4f8', dark: '#c9cfda', belly: '#ffffff', leg: '#8e96a6' } : { fur: '#f07a2a', dark: '#c95a1c', belly: '#fff6ea', leg: '#3f2a20' };
  const body = new Geo().add(sphere(0.32, C.fur, 14, 10), T(0, 0.48, 0, 0, 0, 0, 0.85, 0.75, 1.25));
  body.add(sphere(0.2, C.belly, 10, 8), T(0, 0.46, 0.27, 0, 0, 0, 1, 1.1, 0.8));
  const head = new Geo();
  head.add(sphere(0.21, C.fur, 14, 10), T(0, 0, 0, 0, 0, 0, 1, 0.9, 1));
  head.add(sphere(0.13, C.belly, 10, 8), T(0, -0.06, 0.08, 0, 0, 0, 1.1, 0.8, 1));
  head.add(cylinder(0.02, 0.1, 0.2, C.fur, 10), T(0, -0.02, 0.15, 0, P / 2 - 0.15));
  head.add(sphere(0.035, '#1d1d24', 7, 5), T(0, 0.0, 0.36));
  for (const s of [-1, 1]) {
    head.add(cylinder(0.0, 0.08, 0.2, C.fur, 8), T(s * 0.11, 0.13, -0.02, 0, -0.15, s * -0.3));
    head.add(cylinder(0.0, 0.035, 0.08, C.dark, 6), T(s * 0.145, 0.25, -0.04, 0, -0.15, s * -0.3));
    eye(head, s * 0.085, 0.04, 0.16);
  }
  const tail = new Geo().add(sphere(0.15, C.fur, 12, 8), T(0, 0, -0.26, 0, 0, 0, 0.9, 0.9, 2.0));
  tail.add(sphere(0.1, C.belly, 10, 7), T(0, 0.01, -0.55, 0, 0, 0, 0.9, 0.9, 1.3));
  const leg = new Geo().add(cylinder(0.045, 0.05, 0.3, C.leg, 7), T(0, -0.3, 0)).add(sphere(0.055, C.leg, 7, 5, 0.7), T(0, -0.3, 0.02));
  return { body, head, tail, leg, headPos: [0, 0.78, 0.36], tailPos: [0, 0.55, -0.32], legPos: [[-0.13, 0.33, 0.22], [0.13, 0.33, 0.22], [-0.13, 0.33, -0.2], [0.13, 0.33, -0.2]] };
}

export function hedgehog(skin = 'default') {
  const body = new Geo();
  const spikes = icosphere(0.3, '#6a4a34', 2, true, 0, 3);
  // Stacheln: Ecken nach außen ziehen
  spikes.displace((p) => { const l = Math.hypot(p[0], p[1], p[2]); const k = 1 + (Math.sin(p[0] * 40) * Math.cos(p[2] * 37) > 0.2 ? 0.25 : 0); return [p[0] * k, p[1] * k, p[2] * k * 1.05].map((v) => v * (l ? 1 : 1)); });
  spikes.paint((p, n, c) => (n[1] > 0.6 ? col('#8a6448') : c));
  body.add(spikes, T(0, 0.26, -0.03, 0, 0, 0, 1, 0.8, 1.15));
  body.add(sphere(0.2, '#e8cfa8', 10, 8), T(0, 0.2, 0.18, 0, 0, 0, 1, 0.9, 1));
  body.add(cylinder(0.02, 0.11, 0.18, '#e8cfa8', 10), T(0, 0.17, 0.3, 0, P / 2 - 0.1));
  body.add(sphere(0.035, '#1d1d24', 6, 5), T(0, 0.19, 0.48));
  for (const s of [-1, 1]) { eye(body, s * 0.08, 0.26, 0.31, 0.03); body.add(sphere(0.045, '#e8cfa8', 6, 5), T(s * 0.13, 0.33, 0.22)); }
  if (skin === 'autumn') {
    body.add(petal(0.22, 0.12, '#e8641f', { cup: 0.2, curl: 0.2, tip: 0.8, colorTip: '#ffb02e' }), T(0.02, 0.5, -0.1, 0.4, -0.2));
    body.add(sphere(0.04, '#c02a2a', 6, 5), T(-0.1, 0.5, 0.05));
  }
  const foot = new Geo().add(sphere(0.055, '#5a3c28', 7, 5, 0.7));
  return { body, foot, feetPos: [[-0.13, 0.04, 0.12], [0.13, 0.04, 0.12], [-0.13, 0.04, -0.14], [0.13, 0.04, -0.14]] };
}

export function owl() {
  const body = new Geo();
  body.add(sphere(0.26, '#8b6a4a', 14, 10), T(0, 0.3, 0, 0, 0, 0, 1, 1.25, 0.95));
  body.add(sphere(0.19, '#e9d2b0', 12, 8), T(0, 0.25, 0.1, 0, 0, 0, 1, 1.2, 0.8));
  for (const s of [-1, 1]) body.add(sphere(0.14, '#6d5038', 10, 8), T(s * 0.22, 0.32, -0.02, 0, 0, s * 0.2, 0.5, 1.2, 0.9));
  for (const s of [-1, 1]) body.add(sphere(0.05, '#f2a03a', 6, 5), T(s * 0.08, 0.0, 0.1, 0, 0, 0, 1, 0.5, 1.3));
  const head = new Geo();
  head.add(sphere(0.22, '#8b6a4a', 14, 10), T(0, 0, 0, 0, 0, 0, 1.1, 0.9, 1));
  for (const s of [-1, 1]) {
    head.add(sphere(0.1, '#f4e6cc', 10, 8), T(s * 0.09, 0.0, 0.14, 0, 0, 0, 1, 1, 0.5));
    head.add(sphere(0.06, '#ffd23f', 10, 8), T(s * 0.09, 0.0, 0.18));
    head.add(sphere(0.035, '#1d1d24', 8, 6), T(s * 0.09, 0.0, 0.22));
    head.add(sphere(0.012, '#ffffff', 4, 3), T(s * 0.09 + 0.012, 0.015, 0.25));
    head.add(cylinder(0.0, 0.05, 0.12, '#6d5038', 6), T(s * 0.15, 0.15, 0.0, 0, -0.2, s * -0.4));
  }
  head.add(cylinder(0.0, 0.03, 0.08, '#f2a03a', 6), T(0, -0.03, 0.2, 0, P / 2 + 0.4));
  const lid = new Geo();
  for (const s of [-1, 1]) lid.add(sphere(0.066, '#7a5a3e', 10, 8, 1), T(s * 0.09, 0.0, 0.185));
  return { body, head, lid, headPos: [0, 0.68, 0] };
}

export function butterfly(c1 = '#5ab4ff', c2 = '#ffd23f') {
  const body = new Geo().add(sphere(0.025, '#2e2a3a', 6, 5, 3.2), T(0, 0, 0, 0, P / 2));
  for (const s of [-1, 1]) body.add(cylinder(0.003, 0.004, 0.08, '#2e2a3a', 3), T(s * 0.01, 0.0, 0.05, 0, -0.9, s * 0.4));
  const wing = (s) => {
    const g = new Geo();
    g.add(petal(0.13, 0.08, c1, { cup: 0, curl: 0, tip: 0.1, colorTip: c2 }), T(0, 0, 0.02, s * P / 2 + s * 0.35, 0));
    g.add(petal(0.09, 0.06, c1, { cup: 0, curl: 0, tip: 0.2, colorTip: '#ffffff' }), T(0, 0, -0.02, s * P / 2 - s * 0.55, 0));
    return g;
  };
  return { body, wingL: wing(-1), wingR: wing(1) };
}

export function firefly() {
  return new Geo().add(sphere(0.045, '#fff2a0', 6, 4)).add(sphere(0.022, '#ffffff', 4, 3));
}

// Bunte Blumenrabatte (Streifen entlang X, zentriert). gaps: [[x0,x1], ...] frei lassen
export function flowerBorder(len, width, seed = 1, gaps = []) {
  const g = new Geo(), R = rng(seed);
  const cs = ['#ff6f9a', '#ffd23f', '#ffffff', '#b9a3ff', '#ff8f5a', '#ff4d7a'];
  const free = (x) => gaps.some(([a, b]) => x > a && x < b);
  for (let x = -len / 2; x < len / 2; x += 0.42) {
    if (free(x)) continue;
    const z = (R() - 0.5) * width * 0.6;
    const b = icosphere(0.22 + R() * 0.1, R() > 0.5 ? PAL.leaf2 : PAL.leaf1, 1, false, 0.15, Math.round(x * 7));
    b.paint((p, n, c) => v3.scale(c, 0.8 + 0.3 * (n[1] * 0.5 + 0.5)));
    g.add(b, T(x, 0.16, z));
    const c = cs[Math.floor(R() * cs.length)];
    for (let k = 0; k < 4; k++) { const a = R() * P * 2; g.add(icosphere(0.075, c, 0, false), T(x + Math.cos(a) * 0.17, 0.3 + R() * 0.12, z + Math.sin(a) * 0.17)); }
  }
  return g.windByHeight(0.1, 0.5, 0.25);
}

// Rundes Zierbeet mit Steinrand und dichten Blumen
export function roundFlowerBed(r, seed, colors) {
  const g = new Geo(), R = rng(seed);
  g.add(cylinder(r, r + 0.05, 0.16, PAL.soil, 22), T(0, 0, 0));
  const n = Math.round(r * 14);
  for (let i = 0; i < n; i++) { const a = (i / n) * P * 2; g.add(icosphere(0.17, R() > 0.5 ? PAL.stone : '#cfc6b8', 1, false, 0.15, i), T(Math.cos(a) * (r + 0.05), 0.12, Math.sin(a) * (r + 0.05), R() * 6, 0, 0, 1, 0.7, 1)); }
  for (let i = 0; i < Math.round(r * r * 9); i++) {
    const a = R() * P * 2, d = Math.sqrt(R()) * (r - 0.2), x = Math.cos(a) * d, z = Math.sin(a) * d;
    const b = icosphere(0.16 + R() * 0.08, R() > 0.5 ? PAL.leaf2 : PAL.leaf1, 1, false, 0.15, i + seed);
    g.add(b, T(x, 0.25, z));
    const c = colors[i % colors.length];
    for (let k = 0; k < 3; k++) { const aa = R() * P * 2; g.add(icosphere(0.075, c, 0, false), T(x + Math.cos(aa) * 0.13, 0.38 + R() * 0.1, z + Math.sin(aa) * 0.13)); }
  }
  return g.windByHeight(0.2, 0.55, 0.3);
}

// ---------------- Bewässerung ----------------
export function sprinkler() {
  const g = new Geo();
  g.add(cylinder(0.15, 0.17, 0.07, '#2a7fd6', 12), T(0, 0, 0));
  g.add(cylinder(0.05, 0.06, 0.8, '#ffd23f', 10), T(0, 0, 0));
  g.add(cylinder(0.075, 0.075, 0.06, '#2a7fd6', 10), T(0, 0.4, 0));
  g.add(cylinder(0.075, 0.075, 0.06, '#2a7fd6', 10), T(0, 0.74, 0));
  // Schlauch zum Beet
  g.add(cylinder(0.022, 0.022, 0.75, '#3fbe2c', 6, false), T(0.04, 0.03, 0.04, 0, 0, -1.5));
  return g;
}
export function sprinklerHead() {
  const g = new Geo();
  g.add(sphere(0.1, '#4aa3ff', 10, 8), T(0, 0, 0));
  g.add(sphere(0.045, '#ffffff', 6, 5), T(0, 0.08, 0));
  for (const dir of [1, -1]) {
    g.add(cylinder(0.026, 0.03, 0.2, '#2a7fd6', 6), T(0, 0, 0, dir > 0 ? 0 : P, P / 2 - 0.5));
    // Wasserstrahl als glitzernder Tropfen-Bogen
    for (let i = 1; i <= 9; i++) {
      const t = i / 9, z = (0.2 + t * 1.05) * dir, y = 0.1 + Math.sin(t * P * 0.95) * 0.42 - t * 0.3;
      g.add(sphere(0.05 - t * 0.022, '#aee4ff', 6, 5), T(0, y, z));
    }
  }
  return g;
}

// ---------------- Gewächshaus ----------------
export function greenhouse(restored = true) {
  const g = new Geo(), R = rng(13);
  const W = 4.0, D = 2.8, H = 1.9, roofH = 1.1;
  const frame = restored ? '#fbfbf7' : '#a9a294';
  const glass = restored ? '#bfe9f2' : '#8fa79a';
  g.add(roundedBox(W + 0.3, 0.3, D + 0.3, 0.06, restored ? '#c9c1b5' : '#9c968d', 1), T(0, 0.15, 0));
  // Glaswände
  for (const [w, x, z, ry] of [[W, 0, D / 2, 0], [W, 0, -D / 2, 0], [D, W / 2, 0, P / 2], [D, -W / 2, 0, P / 2]]) {
    g.add(roundedBox(w - 0.1, H - 0.1, 0.05, 0.02, glass, 1), T(x, 0.3 + H / 2, z, ry), { emissive: restored ? 0.55 : 0 });
  }
  // Rahmen
  const post = (x, z, h = H) => g.add(roundedBox(0.09, h, 0.09, 0.02, frame, 1), T(x, 0.3 + h / 2, z));
  for (let i = 0; i <= 4; i++) { post(-W / 2 + (i * W) / 4, D / 2); post(-W / 2 + (i * W) / 4, -D / 2); }
  for (let i = 1; i < 3; i++) { post(W / 2, -D / 2 + (i * D) / 3); post(-W / 2, -D / 2 + (i * D) / 3); }
  for (const z of [D / 2, -D / 2]) { g.add(roundedBox(W + 0.1, 0.08, 0.1, 0.02, frame, 1), T(0, 0.3 + H, z)); g.add(roundedBox(W + 0.1, 0.06, 0.08, 0.02, frame, 1), T(0, 0.3 + H * 0.5, z)); }
  for (const x of [W / 2, -W / 2]) g.add(roundedBox(0.1, 0.08, D + 0.1, 0.02, frame, 1), T(x, 0.3 + H, 0));
  // Glasdach (Giebel entlang X)
  const slope = Math.hypot(D / 2, roofH), ang = Math.atan2(roofH, D / 2);
  for (const sz of [-1, 1]) {
    g.add(roundedBox(W + 0.1, 0.05, slope, 0.02, glass, 1), T(0, 0.3 + H + roofH / 2, sz * D / 4, 0, sz * ang), { emissive: restored ? 0.55 : 0 });
    for (let i = 0; i <= 4; i++) g.add(roundedBox(0.07, 0.07, slope + 0.05, 0.02, frame, 1), T(-W / 2 + (i * W) / 4, 0.33 + H + roofH / 2, sz * D / 4, 0, sz * ang));
  }
  g.add(roundedBox(W + 0.2, 0.1, 0.12, 0.03, frame, 1), T(0, 0.3 + H + roofH, 0));
  for (const x of [W / 2, -W / 2]) g.add(extrude([[-D / 2, 0], [D / 2, 0], [0, roofH]], 0.04, glass), T(x, 0.3 + H, 0, P / 2), { emissive: restored ? 0.55 : 0 });
  // Tür
  g.add(roundedBox(0.9, 1.6, 0.06, 0.03, restored ? '#5fae96' : '#7a7a6a', 1), T(0, 0.3 + 0.8, D / 2 + 0.04));
  g.add(sphere(0.04, '#ffd75e', 6, 5), T(0.3, 0.3 + 0.85, D / 2 + 0.09));
  // Pflanzen innen (durch das Glas angedeutet) und Töpfe vor der Tür
  for (let i = 0; i < 6; i++) g.add(icosphere(0.32 + R() * 0.12, restored ? PAL.leaf1 : '#6d8a4a', 1, false, 0.15, i), T(-1.4 + i * 0.56, 0.75, -0.6 + (i % 2) * 0.5));
  if (restored) for (const x of [-0.85, 0.85]) {
    g.add(lathe([[0.16, 0], [0.22, 0.3], [0.25, 0.32], [0.25, 0.38], [0, 0.38]], '#d9774a', 12), T(x, 0, D / 2 + 0.45));
    g.add(icosphere(0.2, PAL.leaf2, 1, false, 0.15, 3), T(x, 0.5, D / 2 + 0.45));
    for (let k = 0; k < 3; k++) g.add(sphere(0.06, ['#ff6f9a', '#ffd23f', '#9a7be8'][k], 6, 5), T(x + Math.cos(k * 2) * 0.12, 0.6, D / 2 + 0.45 + Math.sin(k * 2) * 0.12));
  } else {
    // Verwildert: Ranken und Gras
    const tuft = grassTuft(R, 0.6, ['#6aa83e', '#5c9a36', '#7cbf3f']);
    for (let i = 0; i < 10; i++) g.add(tuft, T(-W / 2 + R() * W, 0.28, D / 2 + 0.1 + R() * 0.3, R() * 6));
    for (let i = 0; i < 8; i++) g.add(icosphere(0.18, '#5c9a36', 1, false, 0.2, i), T(-W / 2 + R() * W, 0.6 + R() * 1.2, D / 2 + 0.05));
  }
  return g;
}

// ---------------- Event-Deko (Herbstfest) ----------------
DECO_MODELS.pumpkinLantern = () => {
  const g = new Geo();
  const p = sphere(0.5, '#f28a1f', 16, 10, 0.78).displace((q) => { const a = Math.atan2(q[2], q[0]); const k = 1 + Math.cos(a * 8) * 0.06; return [q[0] * k, q[1], q[2] * k]; });
  g.add(p, T(0, 0.4, 0));
  g.add(cylinder(0.04, 0.06, 0.2, '#5b7a2e', 6), T(0, 0.75, 0, 0, 0.2));
  // freundliches Lichtfenster (Blume statt Gesicht)
  for (let i = 0; i < 6; i++) g.add(sphere(0.07, '#ffe39a', 6, 4, 0.5), T(Math.cos((i / 6) * P * 2) * 0.14, 0.45 + Math.sin((i / 6) * P * 2) * 0.14, 0.46, 0, P / 2), { emissive: 1 });
  g.add(sphere(0.08, '#fff2c0', 6, 4, 0.5), T(0, 0.45, 0.47, 0, P / 2), { emissive: 1 });
  g.add(leaf(0.3, 0.12, '#6aa84a'), T(0.2, 0.05, 0.3, 1.2, -0.1));
  return g;
};
DECO_MODELS.leafPile = () => {
  const g = new Geo(), R = rng(29);
  const cs = ['#e8641f', '#ffb02e', '#c9381f', '#f2c14e', '#a85a28'];
  g.add(icosphere(0.55, '#c9661f', 1, false, 0.2, 2), T(0, 0.05, 0, 0, 0, 0, 1.3, 0.45, 1.1));
  for (let i = 0; i < 40; i++) {
    const a = R() * P * 2, d = Math.sqrt(R()) * 0.7;
    g.add(petal(0.18, 0.1, cs[i % cs.length], { cup: 0.1, curl: 0.15, tip: 0.8, colorTip: cs[(i + 2) % cs.length] }), T(Math.cos(a) * d, 0.12 + (0.7 - d) * 0.35, Math.sin(a) * d * 0.85, R() * 6, -0.3 + R() * 0.6));
  }
  return g;
};

// ---------------- Mehr Deko zum Verschönern ----------------
DECO_MODELS.fountain = () => {
  const g = new Geo();
  const stone = '#d9d2c5', stoneDark = '#b8afa2';
  g.add(lathe([[0, 0], [0.95, 0], [0.98, 0.08], [0.98, 0.38], [0.86, 0.42], [0.8, 0.12], [0, 0.12]], stone, 28));
  g.add(cylinder(0.82, 0.82, 0.04, '#5fc4ef', 28), T(0, 0.3, 0), { emissive: 0.15 });
  g.add(cylinder(0.14, 0.2, 0.75, stoneDark, 12), T(0, 0.3, 0));
  g.add(lathe([[0, 0], [0.48, 0.05], [0.5, 0.15], [0.42, 0.18], [0.0, 0.1]], stone, 20), T(0, 1.0, 0));
  g.add(cylinder(0.4, 0.4, 0.03, '#7fd3f5', 20), T(0, 1.12, 0), { emissive: 0.15 });
  g.add(cylinder(0.06, 0.09, 0.35, stoneDark, 8), T(0, 1.1, 0));
  g.add(sphere(0.1, stone, 10, 8), T(0, 1.5, 0));
  // Wasserstrahlen
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * P * 2;
    for (let i = 1; i <= 6; i++) {
      const t = i / 6, d = 0.12 + t * 0.55, y = 1.5 + Math.sin(t * P) * 0.25 - t * 0.35;
      g.add(sphere(0.045 - t * 0.015, '#bfe9ff', 5, 4), T(Math.cos(a) * d, y, Math.sin(a) * d), { emissive: 0.2 });
    }
  }
  return g;
};
DECO_MODELS.arch = () => {
  const g = new Geo(), R = rng(41);
  const white = '#fbfbf7';
  for (const s of [-1, 1]) g.add(roundedBox(0.12, 1.7, 0.12, 0.03, white, 1), T(s * 0.85, 0.85, 0));
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * P, x = Math.cos(a) * 0.85, y = 1.7 + Math.sin(a) * 0.55;
    g.add(roundedBox(0.16, 0.1, 0.12, 0.03, white, 1), T(x, y, 0, 0, 0, a - P / 2));
  }
  // Ranken mit Rosen
  const leaves = ['#4fae3b', '#6ac646'], roses = ['#e3253f', '#ff6f9a', '#ff8fb1'];
  for (let i = 0; i < 26; i++) {
    const t = R(), side = R() < 0.5 ? -1 : 1;
    let x, y;
    if (t < 0.55) { x = side * 0.85; y = 0.2 + R() * 1.5; } else { const a = R() * P; x = Math.cos(a) * 0.85; y = 1.7 + Math.sin(a) * 0.55; }
    g.add(icosphere(0.13 + R() * 0.06, leaves[i % 2], 1, false, 0.2, i), T(x + (R() - 0.5) * 0.12, y, (R() - 0.5) * 0.18));
    if (i % 2 === 0) g.add(sphere(0.075, roses[i % 3], 8, 6, 0.85), T(x + (R() - 0.5) * 0.1, y + 0.05, 0.12 * (R() < 0.5 ? -1 : 1)));
  }
  return g.windByHeight(1.2, 2.4, 0.15);
};
DECO_MODELS.birdhouse = () => {
  const g = new Geo();
  g.add(cylinder(0.05, 0.06, 1.5, PAL.woodDark, 8));
  g.add(roundedBox(0.42, 0.42, 0.38, 0.04, '#7cc4e8', 1), T(0, 1.68, 0));
  g.add(extrude([[-0.3, 0], [0.3, 0], [0, 0.26]], 0.5, '#e2654a'), T(0, 1.89, 0));
  g.add(cylinder(0.075, 0.075, 0.02, '#2d2a36', 12), T(0, 1.7, 0.2, 0, P / 2));
  g.add(cylinder(0.015, 0.015, 0.12, PAL.woodDark, 5), T(0, 1.58, 0.22, 0, P / 2));
  g.add(sphere(0.06, '#ffd23f', 6, 5), T(0.12, 1.93, 0.05));
  return g;
};
DECO_MODELS.beehive = () => {
  const g = new Geo(), R = rng(7);
  for (const [x, z] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) g.add(cylinder(0.04, 0.04, 0.3, PAL.woodDark, 6), T(x, 0, z));
  const cols = ['#fff3c4', '#ffd56b', '#fff3c4'];
  cols.forEach((c, i) => g.add(roundedBox(0.66, 0.26, 0.6, 0.04, c, 1), T(0, 0.43 + i * 0.27, 0)));
  g.add(roundedBox(0.76, 0.08, 0.7, 0.03, '#d98a3a', 1), T(0, 1.26, 0));
  g.add(roundedBox(0.2, 0.04, 0.02, 0.01, '#3a2a1e', 1), T(0, 0.34, 0.31));
  for (let i = 0; i < 5; i++) {
    const b = new Geo().add(sphere(0.035, '#ffcf1f', 6, 5, 0.8)).add(sphere(0.025, '#ffffff', 5, 4), T(0, 0.03, 0, 0, 0, 0, 1, 0.4, 1.4));
    g.add(b, T((R() - 0.5) * 0.9, 0.7 + R() * 0.8, 0.35 + R() * 0.3));
  }
  return g;
};
DECO_MODELS.planter = () => {
  const g = new Geo(), R = rng(17);
  g.add(lathe([[0, 0], [0.32, 0], [0.42, 0.5], [0.46, 0.55], [0.46, 0.62], [0.38, 0.6], [0, 0.55]], '#d07a45', 20));
  g.add(cylinder(0.38, 0.38, 0.03, PAL.soil, 16), T(0, 0.56, 0));
  const fl = ['#ff6f9a', '#ffd23f', '#ffffff', '#9a7be8'];
  for (let i = 0; i < 9; i++) g.add(icosphere(0.14 + R() * 0.05, i % 2 ? PAL.leaf1 : PAL.leaf2, 1, false, 0.2, i), T((R() - 0.5) * 0.5, 0.7 + R() * 0.15, (R() - 0.5) * 0.5));
  for (let i = 0; i < 12; i++) g.add(sphere(0.065, fl[i % 4], 7, 5, 0.8), T((R() - 0.5) * 0.6, 0.82 + R() * 0.15, (R() - 0.5) * 0.6));
  return g.windByHeight(0.6, 1.0, 0.3);
};
DECO_MODELS.pathStone = () => steppingStones([[-0.32, -0.08], [0.32, 0.1]], 11);
DECO_MODELS.hedgeBlock = () => {
  const g = new Geo(), R = rng(5);
  g.add(roundedBox(1.6, 0.85, 0.7, 0.28, PAL.leaf2, 2).shadeByHeight(0, 0.85, 0.7, 1.05), T(0, 0.43, 0));
  for (let x = -0.55; x <= 0.56; x += 0.55) {
    const b = icosphere(0.33 + R() * 0.08, R() > 0.4 ? PAL.leaf2 : PAL.leaf1, 1, false, 0.12, Math.round(x * 10) + 3);
    b.paint((p, n, c) => v3.scale(c, 0.8 + 0.3 * (n[1] * 0.5 + 0.5)));
    g.add(b, T(x, 0.75 + R() * 0.08, (R() - 0.5) * 0.15));
  }
  return g.windByHeight(0.6, 1.2, 0.08);
};
DECO_MODELS.tableSet = () => {
  const g = new Geo();
  g.add(cylinder(0.45, 0.45, 0.05, '#fbfbf7', 20), T(0, 0.72, 0));
  g.add(cylinder(0.05, 0.08, 0.72, '#3e4450', 8));
  g.add(cylinder(0.25, 0.28, 0.04, '#3e4450', 12));
  for (const s of [-1, 1]) {
    const c = new Geo();
    c.add(roundedBox(0.42, 0.06, 0.42, 0.03, PAL.wood, 1), T(0, 0.45, 0));
    c.add(roundedBox(0.42, 0.45, 0.06, 0.03, PAL.wood, 1), T(0, 0.7, -0.2));
    for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) c.add(cylinder(0.025, 0.025, 0.45, '#3e4450', 5), T(x, 0, z));
    g.add(c, T(s * 0.75, 0, 0, s > 0 ? -P / 2 : P / 2));
  }
  // Sonnenschirm mit Streifen
  g.add(cylinder(0.025, 0.025, 2.0, '#fbfbf7', 6), T(0, 0.75, 0));
  const shade = lathe([[0, 0.38], [0.5, 0.22], [1.0, 0.0], [1.02, -0.05], [0, 0.0]], '#ff6f9a', 24);
  shade.paint((p, n, c) => (Math.floor(((Math.atan2(p[2], p[0]) + P) / (P * 2)) * 12) % 2 ? col('#ffffff') : c));
  g.add(shade, T(0, 2.3, 0));
  g.add(sphere(0.05, '#fbfbf7', 6, 5), T(0, 2.7, 0));
  return g;
};

// ---------------- Zubehör ----------------
DECO_MODELS.pinwheel = () => {
  const g = new Geo();
  g.add(cylinder(0.025, 0.03, 1.2, '#fbfbf7', 6));
  const cols = ['#ff6f9a', '#ffd23f', '#5ab4ff', '#7be86a'];
  for (let i = 0; i < 4; i++) {
    const blade = new Geo().add(petal(0.22, 0.13, cols[i], { cup: 0.4, curl: -0.2, tip: 0.2, under: 0.9 }), T(0, 0, 0, 0, -P / 2)); // zeigt nach oben
    g.add(blade, T(0, 1.22, 0.05, 0, 0, (i / 4) * P * 2 + 0.4));
  }
  g.add(sphere(0.035, '#fbfbf7', 6, 5), T(0, 1.22, 0.07));
  return g;
};
DECO_MODELS.hoseReel = () => {
  const g = new Geo();
  for (const s of [-1, 1]) {
    g.add(cylinder(0.33, 0.33, 0.05, '#3fbe2c', 18), T(s * 0.2, 0.42, 0, 0, 0, P / 2));
    g.add(roundedBox(0.05, 0.5, 0.05, 0.02, '#2f7d1f', 1), T(s * 0.22, 0.25, -0.12, 0, 0.3));
    g.add(roundedBox(0.05, 0.5, 0.05, 0.02, '#2f7d1f', 1), T(s * 0.22, 0.25, 0.12, 0, -0.3));
  }
  g.add(cylinder(0.24, 0.24, 0.36, '#2e8f3a', 16), T(0, 0.42, 0, 0, 0, P / 2));
  for (let i = 0; i < 6; i++) g.add(cylinder(0.25, 0.25, 0.035, i % 2 ? '#56c23d' : '#3aa82e', 16), T(-0.16 + i * 0.064, 0.42, 0, 0, 0, P / 2));
  g.add(cylinder(0.02, 0.02, 0.55, '#ffd23f', 6), T(0.32, 0.42, 0, 0, 0, P / 2 + 0.2));
  return g;
};
DECO_MODELS.rainBarrel = () => {
  const g = new Geo();
  g.add(lathe([[0, 0], [0.34, 0], [0.4, 0.35], [0.36, 0.72], [0, 0.72]], '#6f9fd8', 18));
  for (const y of [0.15, 0.55]) g.add(cylinder(0.385, 0.385, 0.04, '#40628f', 18), T(0, y, 0));
  g.add(cylinder(0.33, 0.33, 0.02, '#5fc4ef', 18), T(0, 0.72, 0), { emissive: 0.1 });
  g.add(cylinder(0.025, 0.025, 0.12, '#c8d0dc', 6), T(0.28, 0.12, 0.22, 0, P / 2 - 0.4));
  g.add(cylinder(0.04, 0.05, 0.05, '#c8d0dc', 6), T(0.33, 0.12, 0.27));
  return g;
};
DECO_MODELS.compostBin = () => {
  const g = new Geo(), R = rng(3);
  for (let k = 0; k < 4; k++) for (let h = 0; h < 4; h++) {
    const side = k % 2 ? 0.55 : -0.55, along = k < 2;
    g.add(roundedBox(along ? 1.15 : 0.08, 0.14, along ? 0.08 : 1.15, 0.03, h % 2 ? PAL.wood : PAL.woodDark, 1), T(along ? 0 : side, 0.1 + h * 0.17, along ? side : 0));
  }
  g.add(icosphere(0.45, '#5a3a20', 1, false, 0.25, 4), T(0, 0.45, 0, 0, 0, 0, 1.1, 0.5, 1.1));
  for (let i = 0; i < 6; i++) g.add(petal(0.15, 0.08, ['#7bbf3a', '#e8641f', '#c9a13a'][i % 3], { cup: 0.1, curl: 0.2, tip: 0.6 }), T((R() - 0.5) * 0.6, 0.66, (R() - 0.5) * 0.6, R() * 6, -0.2));
  return g;
};
DECO_MODELS.insectHotel = () => {
  const g = new Geo(), R = rng(9);
  for (const s of [-1, 1]) g.add(roundedBox(0.07, 0.95, 0.4, 0.02, PAL.woodDark, 1), T(s * 0.38, 0.6, 0));
  g.add(extrude([[-0.5, 0], [0.5, 0], [0, 0.32]], 0.46, '#e2654a'), T(0, 1.06, 0));
  g.add(roundedBox(0.76, 0.06, 0.4, 0.02, PAL.woodDark, 1), T(0, 0.13, 0));
  g.add(roundedBox(0.76, 0.05, 0.38, 0.02, PAL.woodDark, 1), T(0, 0.55, 0));
  for (const s of [-1, 1]) g.add(cylinder(0.04, 0.04, 0.15, PAL.woodDark, 6), T(s * 0.3, 0, 0));
  // Fächer: Bambusröhrchen, Zapfen, Holzscheiben
  for (let i = 0; i < 18; i++) g.add(cylinder(0.04, 0.04, 0.3, i % 3 ? '#d8b26a' : '#c48a46', 8), T(-0.28 + (i % 6) * 0.11, 0.21 + Math.floor(i / 6) * 0.1, 0.02, 0, P / 2));
  for (let i = 0; i < 6; i++) g.add(icosphere(0.08, '#8a5a36', 1, true, 0.25, i), T(-0.25 + (i % 3) * 0.25, 0.68 + Math.floor(i / 3) * 0.17, 0.06));
  g.add(sphere(0.03, '#e3241c', 6, 5), T(0.15, 0.95, 0.2));
  void R;
  return g;
};
DECO_MODELS.stringLights = () => {
  const g = new Geo();
  for (const s of [-1, 1]) {
    g.add(cylinder(0.05, 0.06, 1.9, PAL.woodDark, 8), T(s * 1.1, 0, 0));
    g.add(sphere(0.07, PAL.woodDark, 6, 5), T(s * 1.1, 1.92, 0));
  }
  const cols = ['#ffd27a', '#ff9fc6', '#bfe9ff', '#ffe9a0'];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, x = -1.1 + t * 2.2, y = 1.85 - Math.sin(t * P) * 0.35;
    g.add(cylinder(0.006, 0.006, 0.1, '#3a3a3a', 3), T(x, y - 0.05, 0, 0, 0, P / 2));
    if (i % 2 === 0 && i > 0 && i < 24) g.add(sphere(0.045, cols[(i / 2) % cols.length], 7, 5, 1.2), T(x, y - 0.07, 0), { emissive: 1 });
  }
  return g;
};

// ---------- v3.4: Beleuchtung & Händler ----------
DECO_MODELS.groundLights = () => {
  const g = new Geo();
  const caps = ['#7fe3ff', '#ffd27a', '#c9a4ff'];
  [[-0.22, -0.12, 0.34], [0.2, -0.18, 0.26], [0.02, 0.22, 0.3]].forEach(([x, z, h], i) => {
    g.add(cylinder(0.045, 0.06, h, '#f3ead8', 8), T(x, 0, z));
    g.add(sphere(0.15, caps[i], 12, 8, 0.55), T(x, h, z), { emissive: 1 });
    g.add(sphere(0.03, '#ffffff', 6, 4), T(x + 0.06, h + 0.07, z + 0.05));
  });
  g.add(disk(0.42, '#5f9e3f', 16), T(0, 0.01, 0));
  return g;
};
DECO_MODELS.torch = () => {
  const g = new Geo();
  g.add(cylinder(0.035, 0.05, 1.05, '#b78a4a', 8), T(0, 0, 0));
  for (const y of [0.25, 0.55, 0.85]) g.add(cylinder(0.055, 0.055, 0.03, '#8a6430', 8), T(0, y, 0));
  g.add(cylinder(0.09, 0.06, 0.16, '#5b4630', 8), T(0, 1.02, 0));
  g.add(sphere(0.1, '#ffb43a', 10, 8, 1.3), T(0, 1.2, 0), { emissive: 1 });
  g.add(sphere(0.055, '#fff2a8', 8, 6, 1.4), T(0, 1.24, 0), { emissive: 1 });
  return g;
};
DECO_MODELS.lampPost = () => {
  const g = new Geo();
  g.add(cylinder(0.16, 0.2, 0.12, '#2f3542', 10));
  g.add(cylinder(0.05, 0.06, 2.0, '#2f3542', 8), T(0, 0.1, 0));
  g.add(sphere(0.07, '#2f3542', 8, 6), T(0, 2.12, 0));
  for (const sx of [-1, 1]) {
    g.add(cylinder(0.025, 0.025, 0.42, '#2f3542', 6), T(sx * 0.2, 1.95, 0, 0, 0, sx * P / 2));
    g.add(cylinder(0.02, 0.02, 0.1, '#2f3542', 6), T(sx * 0.4, 1.85, 0));
    g.add(roundedBox(0.2, 0.26, 0.2, 0.04, '#2f3542', 2), T(sx * 0.4, 1.7, 0));
    g.add(roundedBox(0.15, 0.21, 0.15, 0.04, '#ffe7a3', 2), T(sx * 0.4, 1.7, 0), { emissive: 1 });
    g.add(cylinder(0.0, 0.17, 0.12, '#2f3542', 4), T(sx * 0.4, 1.83, 0, P / 4));
  }
  return g;
};

// Verkaufskarren des Händlers (steht vor dem Zaun)
export function traderCart() {
  const g = new Geo();
  const wood = '#b97a45', dark = '#7a4a26';
  g.add(roundedBox(1.9, 0.5, 1.0, 0.08, wood, 2), T(0, 0.75, 0));
  g.add(roundedBox(1.95, 0.08, 1.05, 0.03, dark, 1), T(0, 1.0, 0));
  for (const sx of [-1, 1]) {
    g.add(cylinder(0.36, 0.36, 0.08, dark, 16), T(sx * 0.62, 0.36, 0.56, 0, P / 2));
    g.add(cylinder(0.08, 0.08, 0.1, '#e8c070', 10), T(sx * 0.62, 0.36, 0.6, 0, P / 2));
    g.add(cylinder(0.035, 0.035, 1.25, dark, 6), T(sx * 0.88, 1.0, -0.42));
    g.add(cylinder(0.035, 0.035, 1.25, dark, 6), T(sx * 0.88, 1.0, 0.42));
  }
  // gestreiftes Dach
  for (let i = 0; i < 8; i++) {
    const x = -0.95 + (i + 0.5) * (1.9 / 8);
    g.add(roundedBox(1.9 / 8, 0.06, 1.25, 0.02, i % 2 ? '#ffffff' : '#ff5e97', 1), T(x, 2.3, 0, 0, 0.12, 0));
  }
  for (let i = 0; i < 8; i++) g.add(sphere(0.07, i % 2 ? '#ffffff' : '#ff5e97', 8, 6), T(-0.84 + i * 0.24, 2.2, 0.66));
  // Eimer mit Blumen
  const cols = ['#ff6f9a', '#ffd23f', '#9b6df0', '#5ab4ff', '#ff8a3d'];
  for (let i = 0; i < 5; i++) {
    const x = -0.72 + i * 0.36;
    g.add(cylinder(0.13, 0.1, 0.24, '#9aa6b5', 10), T(x, 1.04, 0.1));
    for (let k = 0; k < 4; k++) g.add(sphere(0.075, cols[(i + k) % cols.length], 7, 5), T(x + Math.cos(k * 1.6) * 0.07, 1.36 + (k % 2) * 0.05, 0.1 + Math.sin(k * 1.6) * 0.07));
  }
  // Schild
  g.add(roundedBox(0.9, 0.28, 0.05, 0.04, '#fff6e0', 2), T(0, 0.8, 0.53));
  g.add(roundedBox(0.6, 0.06, 0.02, 0.02, '#e2287f', 1), T(0, 0.84, 0.56));
  g.add(roundedBox(0.4, 0.05, 0.02, 0.02, '#3fa52b', 1), T(0, 0.74, 0.56));
  // Laterne am Karren
  g.add(roundedBox(0.16, 0.2, 0.16, 0.03, '#ffe7a3', 2), T(0.88, 1.75, 0.5), { emissive: 1 });
  return g;
}

// ---------------- Anlass-Deko (Herzblüte, Ostern, Muttertag, Sommer, Gruselnacht, Silvester, Winter) ----------------
function heart(r, color) {
  const g = new Geo();
  g.add(sphere(r * 0.55, color, 10, 8), T(-r * 0.42, r * 0.35, 0));
  g.add(sphere(r * 0.55, color, 10, 8), T(r * 0.42, r * 0.35, 0));
  g.add(sphere(r * 0.62, color, 10, 8, 1.15).displace((q) => [q[0] * (1 - Math.max(0, -q[1]) / (r * 0.62) * 0.75), q[1], q[2] * 0.85]), T(0, r * 0.05, 0));
  return g;
}
DECO_MODELS.heartBalloons = () => {
  const g = new Geo();
  g.add(sphere(0.08, '#9aa0ad', 8, 6, 0.4), T(0, 0.03, 0));
  [[0, 1.55, 0, '#ff3d6e', 0.26], [-0.28, 1.35, 0.12, '#ff6f9a', 0.22], [0.26, 1.28, -0.1, '#ff2a5a', 0.2]].forEach(([x, y, z, c, r]) => {
    g.add(cylinder(0.006, 0.006, y - 0.15, '#dcdcdc', 4), T(x * 0.15, 0.05, z * 0.15, 0, Math.atan2(Math.hypot(x, z), y)));
    g.add(heart(r, c), T(x, y, z, 0.3));
    g.add(sphere(0.05, '#fff', 6, 5), T(x - r * 0.3, y + r * 0.45, z + r * 0.4), { emissive: 0.2 });
  });
  return g;
};
DECO_MODELS.loveSeat = () => {
  const g = DECO_MODELS.bench ? DECO_MODELS.bench() : new Geo();
  for (let i = 0; i < 3; i++) g.add(heart(0.14, '#ff3d6e'), T(-0.5 + i * 0.5, 1.05, -0.33, 0, 0.1));
  return g;
};
DECO_MODELS.eggBasket = () => {
  const g = new Geo(), R = rng(11);
  g.add(lathe([[0, 0], [0.3, 0.02], [0.4, 0.3], [0.42, 0.36], [0.36, 0.36], [0.3, 0.12], [0, 0.1]], PAL.wood, 18));
  g.add(cylinder(0.025, 0.025, 1.1, PAL.woodDark, 6), T(-0.38, 0.3, 0, 0, 0, P / 2 - 0.35));
  g.add(cylinder(0.025, 0.025, 1.1, PAL.woodDark, 6), T(0.38, 0.3, 0, 0, 0, -(P / 2 - 0.35)));
  g.add(icosphere(0.3, '#8fd34f', 1, false, 0.2, 2), T(0, 0.25, 0, 0, 0, 0, 1, 0.45, 1));
  const cs = ['#ff6f9a', '#5fd35a', '#4aa3ff', '#ffd23f', '#b48cff', '#ff9f1c'];
  for (let i = 0; i < 7; i++) { const a = i * 2.4, d = i ? 0.17 : 0; g.add(sphere(0.09, cs[i % cs.length], 10, 8, 1.3), T(Math.cos(a) * d, 0.4 + (i ? 0 : 0.06), Math.sin(a) * d, R() * 3, (R() - 0.5) * 0.6)); }
  return g;
};
DECO_MODELS.eggTree = () => {
  const g = new Geo(), R = rng(5);
  g.add(lathe([[0, 0], [0.22, 0], [0.24, 0.1], [0.14, 0.14], [0, 0.14]], '#7a6a5a', 14));
  g.add(cylinder(0.03, 0.045, 1.3, '#8a6a4a', 7), T(0, 0.12, 0));
  const cs = ['#ff6f9a', '#5fd35a', '#4aa3ff', '#ffd23f', '#b48cff'];
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9 + 0.3, len = 0.45 + R() * 0.25, y = 0.6 + i * 0.1;
    g.add(cylinder(0.012, 0.02, len, '#8a6a4a', 5), T(0, y, 0, a, -1.1));
    const ex = Math.sin(a) * len * 0.85, ez = Math.cos(a) * len * 0.85;
    g.add(cylinder(0.004, 0.004, 0.08, '#ddd', 3), T(ex, y + len * 0.42 - 0.08, ez));
    g.add(sphere(0.055, cs[i % cs.length], 8, 7, 1.3), T(ex, y + len * 0.42 - 0.14, ez));
    for (let k = 0; k < 3; k++) g.add(sphere(0.03, '#ffe6f2', 5, 4), T(Math.sin(a) * len * (0.3 + k * 0.2), y + len * 0.42 * (0.3 + k * 0.2) + 0.02, Math.cos(a) * len * (0.3 + k * 0.2)));
  }
  return g;
};
DECO_MODELS.bouquetVase = () => {
  const g = new Geo(), R = rng(9);
  g.add(lathe([[0, 0], [0.16, 0], [0.2, 0.1], [0.12, 0.38], [0.15, 0.5], [0.12, 0.52], [0, 0.5]], '#8fd6ff', 16));
  const cs = ['#ff4d7a', '#ffd23f', '#ff9f1c', '#f27ad0', '#ffffff'];
  for (let i = 0; i < 9; i++) {
    const a = i * 0.72, d = i ? 0.12 : 0, h = 0.5 + R() * 0.25;
    g.add(cylinder(0.012, 0.012, h, PAL.stem, 5), T(Math.cos(a) * 0.05, 0.3, Math.sin(a) * 0.05, 0, Math.cos(a) * d * 0.8, Math.sin(a) * d * 0.8));
    const hd = new Geo();
    for (let k = 0; k < 8; k++) hd.add(petal(0.11, 0.045, cs[i % cs.length], { cup: 0.2, curl: 0.15, tip: 0.4, colorTip: '#ffffff' }), T(0, 0, 0, (k / 8) * P * 2, -0.35));
    hd.add(sphere(0.035, '#ffcf2e', 8, 6, 0.6));
    g.add(hd, T(Math.cos(a) * d * 2.2, 0.3 + h, Math.sin(a) * d * 2.2, 0, -0.2));
  }
  for (let k = 0; k < 4; k++) g.add(leaf(0.2, 0.08), T(0, 0.5, 0, k * 1.6, -0.4));
  g.add(cylinder(0.14, 0.14, 0.03, '#ff6f9a', 12), T(0, 0.3, 0));
  return g;
};
DECO_MODELS.parasol = () => {
  const g = new Geo();
  g.add(cylinder(0.03, 0.035, 2.0, '#f3eee4', 8), T(0, 0, 0));
  const top = lathe([[0, 0.3], [0.5, 0.18], [0.85, 0.05], [1.0, 0]], '#ffffff', 16).paint((p) => (Math.floor((Math.atan2(p[2], p[0]) + P) / (P / 4)) % 2 ? col('#ff5a6e') : col('#fff8f0')));
  g.add(top, T(0, 1.75, 0));
  g.add(sphere(0.05, '#ffd23f', 6, 5), T(0, 2.08, 0));
  // Liegestuhl
  g.add(roundedBox(0.55, 0.05, 0.75, 0.02, '#f0c66e', 1), T(0.55, 0.3, 0.1, 0, -0.1));
  g.add(roundedBox(0.55, 0.05, 0.55, 0.02, '#f0c66e', 1), T(0.55, 0.55, -0.45, 0, -0.9));
  for (const s of [-1, 1]) { g.add(box(0.05, 0.3, 0.05, PAL.woodDark), T(0.55 + s * 0.27, 0.15, 0.4)); g.add(box(0.05, 0.3, 0.05, PAL.woodDark), T(0.55 + s * 0.27, 0.15, -0.2)); }
  return g;
};
DECO_MODELS.ghostLantern = () => {
  const g = new Geo();
  const body = lathe([[0, 0.95], [0.22, 0.88], [0.3, 0.6], [0.28, 0.25], [0.3, 0.05], [0, 0.05]], '#f4f6ff', 16).displace((q) => (q[1] < 0.2 ? [q[0] * (1 + Math.cos(Math.atan2(q[2], q[0]) * 5) * 0.12), q[1] + Math.cos(Math.atan2(q[2], q[0]) * 5) * 0.05, q[2] * (1 + Math.cos(Math.atan2(q[2], q[0]) * 5) * 0.12)] : q));
  g.add(body, T(0, 0.2, 0), { emissive: 0.75 });
  for (const s of [-1, 1]) g.add(sphere(0.045, '#2a2340', 6, 5, 1.2), T(s * 0.1, 0.85, 0.26));
  g.add(sphere(0.045, '#2a2340', 7, 5, 0.5), T(0, 0.72, 0.27, 0, P / 2));
  for (const s of [-1, 1]) g.add(sphere(0.06, '#ffb3c6', 6, 5, 0.5), T(s * 0.19, 0.74, 0.22, 0, P / 2));
  for (const s of [-1, 1]) g.add(sphere(0.07, '#f4f6ff', 6, 5, 1.6), T(s * 0.3, 0.55, 0.05, 0, 0, s * 0.8), { emissive: 0.75 });
  g.add(sphere(0.12, '#c9b8ff', 8, 6, 0.3), T(0, 0.02, 0), { emissive: 0.6 });
  return g;
};
DECO_MODELS.cauldron = () => {
  const g = new Geo();
  g.add(lathe([[0, 0.1], [0.3, 0.12], [0.42, 0.3], [0.44, 0.55], [0.38, 0.62], [0.42, 0.66], [0.3, 0.66]], '#2f3340', 20));
  for (let i = 0; i < 3; i++) g.add(cylinder(0.035, 0.045, 0.14, '#2f3340', 6), T(Math.cos(i * 2.1) * 0.3, 0, Math.sin(i * 2.1) * 0.3));
  g.add(cylinder(0.3, 0.3, 0.04, '#7cff4a', 20), T(0, 0.62, 0), { emissive: 0.9 });
  for (let i = 0; i < 7; i++) { const a = i * 2.4, d = i ? 0.15 + (i % 3) * 0.05 : 0; g.add(sphere(0.035 + (i % 3) * 0.015, '#b8ff7a', 7, 5), T(Math.cos(a) * d, 0.66 + (i % 2) * 0.05, Math.sin(a) * d), { emissive: 0.9 }); }
  g.add(cylinder(0.012, 0.012, 0.9, '#8a6a4a', 5), T(0.3, 0.5, 0.1, 0, 0, 0.5));
  for (const y of [0.05, 0.12]) g.add(cylinder(0.05, 0.05, 0.4, '#8a5a36', 6), T(0, y, 0, y * 20, 0, P / 2));
  g.add(sphere(0.12, '#ff8a2a', 8, 6, 1.4), T(0, 0.08, 0), { emissive: 0.8 });
  return g;
};
DECO_MODELS.fireworks = () => {
  const g = new Geo();
  g.add(roundedBox(0.8, 0.3, 0.6, 0.03, PAL.wood, 1), T(0, 0.15, 0));
  g.add(icosphere(0.3, '#c9a874', 1, false, 0.15, 3), T(0, 0.28, 0, 0, 0, 0, 1.2, 0.3, 0.9));
  const cs = ['#ff3d6e', '#4aa3ff', '#ffd23f', '#5fd35a', '#b48cff'];
  for (let i = 0; i < 5; i++) {
    const x = -0.28 + i * 0.14, z = (i % 2 ? 0.12 : -0.1), h = 0.7 + (i % 3) * 0.15, tilt = (i - 2) * 0.12;
    g.add(cylinder(0.012, 0.012, h + 0.3, '#eee', 4), T(x, 0.1, z, 0, 0, tilt));
    g.add(cylinder(0.04, 0.04, 0.35, cs[i], 8), T(x, 0.3 + h * 0.45, z, 0, 0, tilt));
    g.add(cylinder(0.0, 0.04, 0.12, '#fff2a8', 8), T(x, 0.65 + h * 0.45, z, 0, 0, tilt), { emissive: 0.6 });
  }
  for (let i = 0; i < 10; i++) { const a = i * 0.63, r = 0.5 + (i % 2) * 0.15; g.add(sparkle(cs[i % cs.length], 0.07), T(Math.cos(a) * r * 0.6, 1.35 + Math.sin(a) * r * 0.5, Math.sin(a) * 0.1), { emissive: 1 }); }
  return g;
};
DECO_MODELS.snowman = () => {
  const g = new Geo();
  g.add(sphere(0.42, '#f7fbff', 14, 10), T(0, 0.38, 0));
  g.add(sphere(0.32, '#f7fbff', 14, 10), T(0, 0.95, 0));
  g.add(sphere(0.24, '#f7fbff', 14, 10), T(0, 1.38, 0));
  for (const s of [-1, 1]) g.add(sphere(0.035, '#222', 5, 4), T(s * 0.08, 1.44, 0.21));
  g.add(cylinder(0.0, 0.035, 0.22, '#ff8a2a', 6), T(0, 1.38, 0.2, 0, P / 2));
  for (let i = 0; i < 3; i++) g.add(sphere(0.03, '#222', 5, 4), T(0, 1.05 - i * 0.13, 0.3));
  g.add(cylinder(0.26, 0.26, 0.08, '#e23a4a', 12), T(0, 1.17, 0));
  g.add(roundedBox(0.12, 0.3, 0.08, 0.02, '#e23a4a', 1), T(0.15, 1.02, 0.2, 0.3));
  g.add(cylinder(0.3, 0.3, 0.04, '#222', 12), T(0, 1.58, 0));
  g.add(cylinder(0.19, 0.2, 0.26, '#222', 12), T(0, 1.6, 0));
  for (const s of [-1, 1]) g.add(cylinder(0.02, 0.03, 0.5, '#8a6a4a', 5), T(s * 0.28, 0.95, 0, 0, 0, s * 1.2));
  return g;
};
DECO_MODELS.xmasTree = () => {
  const g = new Geo();
  g.add(cylinder(0.08, 0.1, 0.4, '#8a5a36', 8));
  g.add(lathe([[0, 0], [0.35, 0], [0.38, 0.06], [0, 0.08]], '#c23a3a', 10));
  for (let i = 0; i < 3; i++) g.add(cylinder(0.0, 0.62 - i * 0.16, 0.65, i % 2 ? '#2f8f4a' : '#3aa35a', 10), T(0, 0.35 + i * 0.45, 0, i * 0.3));
  const cs = ['#ff3d6e', '#ffd23f', '#4aa3ff', '#ff9f1c'];
  for (let i = 0; i < 14; i++) { const a = i * 2.4, y = 0.5 + (i / 14) * 1.25, r = (0.58 - (i / 14) * 0.45); g.add(sphere(0.055, cs[i % cs.length], 7, 6), T(Math.cos(a) * r, y, Math.sin(a) * r), { emissive: 0.5 }); }
  for (let i = 0; i < 12; i++) { const a = i * 1.9 + 1, y = 0.6 + (i / 12) * 1.15, r = (0.55 - (i / 12) * 0.42); g.add(sphere(0.03, '#fff2a8', 5, 4), T(Math.cos(a) * r, y, Math.sin(a) * r), { emissive: 1 }); }
  g.add(sparkle('#ffe27a', 0.16), T(0, 1.98, 0), { emissive: 1 });
  return g;
};

// ---------------- Album-Belohnungen ----------------
DECO_MODELS.trophy = () => {
  const g = new Geo();
  g.add(roundedBox(0.6, 0.18, 0.6, 0.03, '#e9e4dc', 1), T(0, 0.09, 0));
  g.add(cylinder(0.14, 0.18, 0.12, '#d9b24a', 12), T(0, 0.18, 0));
  g.add(cylinder(0.04, 0.05, 0.25, '#e8c35a', 8), T(0, 0.3, 0));
  g.add(lathe([[0.05, 0], [0.2, 0.05], [0.26, 0.3], [0.22, 0.5], [0.25, 0.52], [0.21, 0.52], [0.18, 0.3], [0.04, 0.05]], '#f2cd5c', 20), T(0, 0.55, 0), { emissive: 0.15 });
  for (const sx of [-1, 1]) { g.add(lathe([[0.03, 0], [0.03, 0.3]], '#e8c35a', 8).displace((q) => [q[0] + Math.sin(q[1] / 0.3 * P) * 0.12, q[1], q[2]]), T(sx * 0.27, 0.7, 0, 0, 0, sx * 0.1)); }
  g.add(sparkle('#fff6c8', 0.1), T(0.2, 1.08, 0.2), { emissive: 1 });
  g.add(sparkle('#fff6c8', 0.07), T(-0.22, 0.9, 0.15), { emissive: 1 });
  return g;
};
DECO_MODELS.goldenBench = () => {
  const g = DECO_MODELS.bench ? DECO_MODELS.bench() : new Geo();
  g.paint((p, n, c) => (c[0] > 0.5 && c[1] > 0.4 && c[2] < 0.45 ? col('#e8bf4e') : c[0] < 0.3 ? col('#b8902a') : c));
  for (let i = 0; i < 5; i++) g.add(petal(0.12, 0.05, '#ff6f9a', { cup: 0.2, curl: 0.2, tip: 0.4, colorTip: '#ffd1dc' }), T(-0.7 + i * 0.35, 0.9 + (i % 2) * 0.08, -0.32, 0, -0.4));
  for (let i = 0; i < 6; i++) g.add(leaf(0.12, 0.05), T(-0.8 + i * 0.32, 0.82, -0.33, i * 1.3, -0.3));
  return g;
};
DECO_MODELS.flowerPress = () => {
  const g = new Geo();
  g.add(roundedBox(0.7, 0.06, 0.5, 0.02, PAL.woodDark, 1), T(0, 0.03, 0));
  for (let i = 0; i < 4; i++) g.add(box(0.66, 0.02, 0.46, i % 2 ? '#fff6e0' : '#f3e3c3'), T(0, 0.08 + i * 0.03, 0));
  g.add(roundedBox(0.7, 0.06, 0.5, 0.02, PAL.wood, 1), T(0, 0.23, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { g.add(cylinder(0.02, 0.02, 0.3, '#8a8a8a', 6), T(sx * 0.3, 0.02, sz * 0.2)); g.add(cylinder(0.045, 0.045, 0.04, '#d9b24a', 6), T(sx * 0.3, 0.27, sz * 0.2)); }
  for (let i = 0; i < 5; i++) g.add(petal(0.09, 0.04, ['#ff6f9a', '#ffd23f', '#9a7be8', '#4aa3ff', '#ff5a3c'][i], { cup: 0, curl: 0, tip: 0.5 }), T(-0.2 + i * 0.1, 0.265, 0.05, i * 1.2));
  return g;
};

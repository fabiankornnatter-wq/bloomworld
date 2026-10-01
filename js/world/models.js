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
  goldRose: { petal: '#f5a300', tip: '#ffd84a', center: '#d27000' },
  moonOrchid: { petal: '#e9eeff', tip: '#c9b8ff', center: '#fff6c4', glow: 0.55 },
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
  iceLily: { petal: '#e6f8ff', tip: '#7fd3ff', center: '#c4f1ff', glow: 0.6 },
  rainbowHydrangea: { petals: ['#ff6f9a', '#ffd23f', '#7be86a', '#5ab4ff', '#b48cff'], petal: '#ff6f9a', tip: '#ffffff', center: '#ffffff' },
  dragonLily: { petal: '#6a0a24', tip: '#ffb81c', center: '#ffd23f', glow: 0.35 },
  crystalRose: { petal: '#cfefff', tip: '#ffffff', center: '#8fd6ff', glow: 0.85 },
  moonRose: { petal: '#dfe6ff', tip: '#fbfcff', center: '#a9b8ff', glow: 0.9 },
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

function head(type, look, s = 1) {
  const g = headShape(type, look, s);
  return look.glow ? setEmissive(g, 1 + look.glow) : g;
}
const mixHex = (a, b, t) => { const A = col(a), B = col(b); return '#' + A.map((v, k) => Math.round((v + (B[k] - v) * t) * 255).toString(16).padStart(2, '0')).join(''); };
const pc = (look, i) => (look.petals ? look.petals[i % look.petals.length] : look.petal);
function headShape(type, look, s) {
  const g = new Geo();
  if (type === 'daisy') {
    for (let i = 0; i < 13; i++) g.add(petal(0.17 * s, 0.035 * s, look.petal, { cup: 0.15, curl: 0.12, tip: 0.3, colorTip: look.tip }), T(0, 0, 0, (i / 13) * P * 2, -0.2));
    g.add(sphere(0.055 * s, look.center, 10, 7, 0.55), T(0, 0.01, 0));
  } else if (type === 'tulip') {
    // Tulpen zeigen vor allem die Außenseite: Normalen zeigen nach außen-oben, damit der Kelch hell leuchtet
    const cup = new Geo();
    for (let i = 0; i < 6; i++) {
      const c = pc(look, i), tipc = look.petals ? mixHex(c, '#ffffff', 0.35) : look.tip;
      cup.add(petal(0.2 * s, 0.085 * s, c, { cup: 0.45, curl: 0.15, tip: 0.2, colorTip: tipc, under: 1 }), T(0, 0, 0, (i / 6) * P * 2 + (i % 2) * 0.3, -1.05 - (i % 2) * 0.15));
    }
    for (let i = 0; i < cup.d.length; i += 11) {
      const x = cup.d[i], z = cup.d[i + 2], l = Math.hypot(x, 0.5 * s * 0.12, z) || 1;
      const nx = x / l, ny = (0.06 * s) / l, nz = z / l, nl = Math.hypot(nx, ny + 0.35, nz);
      cup.d[i + 3] = nx / nl; cup.d[i + 4] = (ny + 0.35) / nl; cup.d[i + 5] = nz / nl;
    }
    g.add(cup);
    g.add(sphere(0.05 * s, look.center, 8, 6), T(0, 0.04, 0));
  } else if (type === 'sunflower') {
    for (let i = 0; i < 18; i++) g.add(petal(0.2 * s, 0.055 * s, look.petal, { cup: 0.2, curl: 0.1, tip: 0.5, colorTip: look.tip }), T(0, 0, 0, (i / 18) * P * 2, -0.1 - (i % 2) * 0.12));
    g.add(sphere(0.13 * s, look.center, 14, 8, 0.38), T(0, 0.015, 0));
    const R = rng(4);
    for (let i = 0; i < 16; i++) { const a = R() * P * 2, r = R() * 0.1 * s; g.add(sphere(0.012 * s, '#4a2508', 5, 4), T(Math.cos(a) * r, 0.055 * s, Math.sin(a) * r)); }
  } else if (type === 'lavender') {
    const spike = icosphere(0.04 * s, look.petal, 1, true, 0.25, 5).paint((p, n, c) => (p[1] > 0.015 * s ? col(look.tip) : c));
    g.add(spike, T(0, 0.14 * s, 0, 0, 0, 0, 1, 4.2, 1));
    for (let k = 0; k < 4; k++) g.add(icosphere(0.022 * s, look.petal, 0, true), T(Math.cos(k * 1.6) * 0.025 * s, 0.05 * s + k * 0.045 * s, Math.sin(k * 1.6) * 0.025 * s));
  } else if (type === 'rose') {
    const rings = [[4, 0.07, -1.35, 0.5], [5, 0.1, -0.95, 0.45], [6, 0.13, -0.55, 0.35], [7, 0.15, -0.25, 0.25]];
    const bloom = new Geo();
    rings.forEach(([n, l, tilt, cup], ri) => {
      for (let i = 0; i < n; i++) bloom.add(petal(l * s, l * 0.75 * s, ri < 2 ? look.center : look.petal, { cup, curl: 0.35, tip: 0, colorTip: look.tip, under: 0.95 }), T(0, ri * 0.004, 0, (i / n) * P * 2 + ri * 0.7, tilt));
    });
    // Rosenblüte wie eine Kugel beleuchten: Normalen zeigen vom Blütenkern nach außen
    for (let i = 0; i < bloom.d.length; i += 11) {
      const x = bloom.d[i], y = bloom.d[i + 1] + 0.06 * s, z = bloom.d[i + 2], l = Math.hypot(x, y, z) || 1;
      bloom.d[i + 3] = x / l; bloom.d[i + 4] = y / l; bloom.d[i + 5] = z / l;
    }
    g.add(bloom);
  } else if (type === 'cornflower') {
    // fein gefranste blaue Blütenkrone
    for (let i = 0; i < 9; i++) g.add(petal(0.12 * s, 0.05 * s, pc(look, i), { cup: 0.2, curl: 0.1, tip: 0.05, colorTip: look.tip, fold: 0.15 }), T(0, 0.01, 0, (i / 9) * P * 2, -0.35));
    for (let i = 0; i < 5; i++) g.add(petal(0.07 * s, 0.035 * s, look.tip, { cup: 0.3, curl: 0.2, tip: 0.1 }), T(0, 0.03, 0, (i / 5) * P * 2 + 0.3, -0.9));
    g.add(sphere(0.035 * s, look.center, 8, 6), T(0, 0.03, 0));
  } else if (type === 'poppy') {
    // vier große, leicht gewölbte Blütenblätter mit dunkler Mitte
    const cup = new Geo();
    for (let i = 0; i < 4; i++) cup.add(petal(0.19 * s, 0.17 * s, pc(look, i), { cup: 0.55, curl: 0.1, tip: 0.05, colorTip: look.tip, under: 1 }), T(0, 0, 0, (i / 4) * P * 2 + (i % 2) * 0.2, -0.75 - (i % 2) * 0.12));
    for (let i = 0; i < cup.d.length; i += 11) { const x = cup.d[i], y = cup.d[i + 1] + 0.05 * s, z = cup.d[i + 2], l = Math.hypot(x, y, z) || 1; cup.d[i + 3] = x / l; cup.d[i + 4] = y / l; cup.d[i + 5] = z / l; }
    g.add(cup);
    g.add(sphere(0.045 * s, look.center, 10, 8, 0.8), T(0, 0.04, 0));
    for (let i = 0; i < 10; i++) { const a = (i / 10) * P * 2; g.add(sphere(0.012 * s, '#2a2230', 4, 3), T(Math.cos(a) * 0.05 * s, 0.05, Math.sin(a) * 0.05 * s)); }
  } else if (type === 'lily') {
    // sechs lange, nach außen gebogene Blütenblätter und Staubgefäße
    for (let i = 0; i < 6; i++) g.add(petal(0.24 * s, 0.07 * s, pc(look, i), { cup: 0.25, curl: 0.55, tip: 0.85, colorTip: look.tip, under: 0.95 }), T(0, 0, 0, (i / 6) * P * 2 + (i % 2) * 0.25, -0.75));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * P * 2 + 0.25, st = new Geo().add(cylinder(0.005, 0.006, 0.14 * s, '#c9e07a', 4)).add(sphere(0.014 * s, '#e0701c', 5, 4, 1.6), T(0, 0.14 * s, 0));
      g.add(st, T(0, 0.02, 0, a, -0.3));
    }
    g.add(sphere(0.03 * s, look.center, 8, 6), T(0, 0.02, 0));
  } else if (type === 'hydrangea') {
    // Ballen aus vielen kleinen Blüten
    const R = rng(Math.round(s * 100) + 7), cols = look.petals || [look.petal, look.tip, look.petal];
    g.add(icosphere(0.13 * s, look.petal, 1, false, 0.1, 3), T(0, 0.05 * s, 0));
    for (let i = 0; i < 24; i++) {
      const u = R() * 2 - 1, a = R() * P * 2, r = Math.sqrt(1 - u * u);
      const n = [Math.cos(a) * r, Math.abs(u) * 0.9 + 0.1, Math.sin(a) * r];
      const c = cols[i % cols.length];
      g.add(icosphere(0.048 * s, c, 0, false, 0.15, i), T(n[0] * 0.15 * s, 0.05 * s + n[1] * 0.13 * s, n[2] * 0.15 * s, 0, 0, 0, 1, 0.7, 1));
    }
  } else if (type === 'orchid') {
    for (let i = 0; i < 3; i++) g.add(petal(0.14 * s, 0.05 * s, look.petal, { cup: 0.1, curl: -0.05, tip: 0.6, colorTip: look.tip }), T(0, 0, 0, (i / 3) * P * 2 + P, -0.3, 0));
    for (let i = 0; i < 2; i++) g.add(petal(0.12 * s, 0.085 * s, look.tip, { cup: 0.15, curl: 0.05, tip: 0.1, colorTip: look.petal }), T(0, 0.005, 0, P * 0.35 + i * P * 1.3, -0.25));
    g.add(petal(0.08 * s, 0.06 * s, look.center, { cup: 0.6, curl: 0.4, tip: 0.1, colorTip: '#ff9fcf' }), T(0, 0.01, 0, P / 4 + P, -0.5));
  }
  return g;
}

function bud(look, s = 1) {
  const g = new Geo();
  g.add(sphere(0.05 * s, PAL.leaf2, 8, 6, 1.5), T(0, 0.03 * s, 0));
  if (look) for (let i = 0; i < 4; i++) g.add(petal(0.09 * s, 0.045 * s, look.petal, { cup: 0.6, curl: 0.2, tip: 0.6 }), T(0, 0.02, 0, (i / 4) * P * 2, -1.25));
  return g;
}

// Eine Pflanze in Stufe 0 (Spross) … 3 (Blüte)
export function plant(seedId, stage, shiny = false, seed = 1) {
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
  const tall = { daisy: 0.32, tulip: 0.52, sunflower: 1.05, lavender: 0.5, rose: 0.46, orchid: 0.55, cornflower: 0.46, poppy: 0.5, lily: 0.6, hydrangea: 0.42 }[type];
  const grow = stage === 1 ? 0.5 : stage === 2 ? 0.78 : 1;
  const h = tall * grow;
  const stems = type === 'daisy' || type === 'cornflower' || type === 'rose' ? 3 : type === 'lavender' ? 5 : type === 'poppy' || type === 'hydrangea' ? 2 : 1;
  // Blätter am Boden
  const nl = type === 'sunflower' ? 4 : 3;
  for (let i = 0; i < nl; i++) {
    const big = type === 'sunflower' ? 0.24 : type === 'tulip' ? 0.3 : 0.15;
    g.add(leaf(big * (0.6 + grow * 0.4), (type === 'tulip' ? 0.06 : 0.07) * (type === 'sunflower' ? 1.8 : 1)), T(0, 0.02 + (type === 'sunflower' ? i * h * 0.18 : 0), 0, (i / nl) * P * 2 + R(), type === 'tulip' ? -1.0 : -0.35));
  }
  if (type === 'rose' || type === 'hydrangea') for (let i = 0; i < 7; i++) g.add(icosphere(0.09 + R() * 0.04, R() > 0.5 ? PAL.leaf2 : PAL.leaf1, 1, false, 0.2, i), T((R() - 0.5) * 0.22, 0.12 + R() * h * 0.5, (R() - 0.5) * 0.22));
  for (let k = 0; k < stems; k++) {
    const a = (k / stems) * P * 2 + R(), off = stems > 1 ? 0.06 + R() * 0.05 : 0;
    const sh = h * (stems > 1 ? 0.75 + R() * 0.3 : 1), bend = (R() - 0.5) * 0.12;
    const sm = new Geo().add(stem(sh, bend, type === 'sunflower' ? 0.04 : 0.02));
    const top = [bend, sh, 0];
    if (stage === 3) {
      const tilt = type === 'sunflower' ? -0.55 : type === 'lavender' ? 0 : -0.15;
      sm.add(head(type, look, type === 'sunflower' ? 1.15 : 1), T(top[0], top[1], top[2], 0, tilt, 0));
    } else if (type === 'lavender') {
      sm.add(head(type, stage === 2 ? look : { petal: PAL.leaf2, tip: PAL.leaf3 }, 0.8), T(top[0], top[1], top[2]));
    } else {
      sm.add(bud(stage === 2 ? look : null, type === 'sunflower' ? 1.8 : 1), T(top[0], top[1], top[2]));
    }
    g.add(sm, T(Math.cos(a) * off, 0, Math.sin(a) * off, a));
  }
  g.windByHeight(0.05, tall * 1.1, 1);
  const k = PLANT_SCALE[type] * (['starRose', 'crystalRose', 'dragonLily', 'moonRose'].includes(seedId) ? 1.12 : 1);
  return new Geo().add(g, T(0, 0, 0, 0, 0, 0, k));
}
export const PLANT_SCALE = { daisy: 2.3, tulip: 2.1, sunflower: 1.5, lavender: 1.9, rose: 2.15, orchid: 2.1, cornflower: 2.1, poppy: 2.0, lily: 1.9, hydrangea: 1.9 };

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

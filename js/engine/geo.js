// Geometrie-Baukasten: erzeugt Dreiecke mit Normale, Farbe (+Leuchtkraft) und Wind-Gewicht.
// Ein Vertex = 11 Floats: x y z | nx ny nz | r g b emissive | wind
import { m4, v3 } from './math.js';

export const STRIDE = 11;

function asColor(c) {
  if (typeof c === 'string') {
    const n = parseInt(c.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  return c;
}
export const col = asColor;

export class Geo {
  constructor() { this.d = []; }
  get count() { return this.d.length / STRIDE; }

  vert(p, n, c, e = 0, w = 0) { this.d.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], e, w); }

  // Dreieck mit Vertex-Normalen; Wicklung wird automatisch nach außen gedreht.
  triN(a, b, c, na, nb, nc, ca, cb = ca, cc = ca, e = 0) {
    const fn = v3.cross(v3.sub(b, a), v3.sub(c, a));
    const ref = [na[0] + nb[0] + nc[0], na[1] + nb[1] + nc[1], na[2] + nb[2] + nc[2]];
    if (v3.dot(fn, ref) < 0) { [b, c] = [c, b]; [nb, nc] = [nc, nb]; [cb, cc] = [cc, cb]; }
    this.vert(a, na, ca, e); this.vert(b, nb, cb, e); this.vert(c, nc, cc, e);
  }

  // Flaches Dreieck; outward gibt die gewünschte Außenrichtung an.
  tri(a, b, c, color, outward, e = 0) {
    let n = v3.norm(v3.cross(v3.sub(b, a), v3.sub(c, a)));
    if (outward && v3.dot(n, outward) < 0) { [b, c] = [c, b]; n = v3.scale(n, -1); }
    const C = asColor(color);
    this.vert(a, n, C, e); this.vert(b, n, C, e); this.vert(c, n, C, e);
  }

  quad(a, b, c, d, color, outward, e = 0) { this.tri(a, b, c, color, outward, e); this.tri(a, c, d, color, outward, e); }

  // Fügt eine andere Geometrie transformiert hinzu. opts: color, tint, emissive, wind
  add(g, mat, opts = {}) {
    const s = g.d, d = this.d;
    const C = opts.color ? asColor(opts.color) : null, T = opts.tint ? asColor(opts.tint) : null;
    for (let i = 0; i < s.length; i += STRIDE) {
      let p = [s[i], s[i + 1], s[i + 2]], n = [s[i + 3], s[i + 4], s[i + 5]];
      if (mat) { p = m4.point(mat, p); n = v3.norm(m4.dir(mat, n)); }
      let r = s[i + 6], gg = s[i + 7], b = s[i + 8];
      if (C) { r = C[0]; gg = C[1]; b = C[2]; }
      if (T) { r *= T[0]; gg *= T[1]; b *= T[2]; }
      const e = opts.emissive !== undefined ? opts.emissive : s[i + 9];
      const w = opts.wind !== undefined ? opts.wind : s[i + 10];
      d.push(p[0], p[1], p[2], n[0], n[1], n[2], r, gg, b, e, w);
    }
    return this;
  }

  // Wind-Gewicht nach Höhe setzen (für Pflanzen, die sich im Wind wiegen).
  windByHeight(y0, y1, amount = 1, pow = 1.5) {
    for (let i = 0; i < this.d.length; i += STRIDE) {
      const t = Math.max(0, Math.min(1, (this.d[i + 1] - y0) / (y1 - y0)));
      this.d[i + 10] = Math.pow(t, pow) * amount;
    }
    return this;
  }

  // Dezente "Umgebungsverdeckung": unten dunkler, oben heller.
  shadeByHeight(y0, y1, low = 0.75, high = 1.05) {
    for (let i = 0; i < this.d.length; i += STRIDE) {
      const t = Math.max(0, Math.min(1, (this.d[i + 1] - y0) / (y1 - y0)));
      const f = low + (high - low) * t;
      this.d[i + 6] *= f; this.d[i + 7] *= f; this.d[i + 8] *= f;
    }
    return this;
  }

  // Farbe abhängig von der Position (z.B. Verlauf)
  paint(fn) {
    for (let i = 0; i < this.d.length; i += STRIDE) {
      const c = fn([this.d[i], this.d[i + 1], this.d[i + 2]], [this.d[i + 3], this.d[i + 4], this.d[i + 5]], [this.d[i + 6], this.d[i + 7], this.d[i + 8]]);
      if (c) { this.d[i + 6] = c[0]; this.d[i + 7] = c[1]; this.d[i + 8] = c[2]; }
    }
    return this;
  }

  displace(fn) {
    for (let i = 0; i < this.d.length; i += STRIDE) {
      const p = fn([this.d[i], this.d[i + 1], this.d[i + 2]], [this.d[i + 3], this.d[i + 4], this.d[i + 5]]);
      this.d[i] = p[0]; this.d[i + 1] = p[1]; this.d[i + 2] = p[2];
    }
    return this;
  }

  bounds() {
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    for (let i = 0; i < this.d.length; i += STRIDE) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], this.d[i + k]); mx[k] = Math.max(mx[k], this.d[i + k]); }
    return { min: mn, max: mx };
  }
}

// ---------- Grundformen ----------

// Abgerundeter Quader (zentriert, Unterkante bei y = -h/2)
export function roundedBox(w, h, d, r, color, k = 1) {
  const g = new Geo(), C = asColor(color);
  const H = [w / 2, h / 2, d / 2];
  r = Math.min(r, H[0], H[1], H[2]);
  const I = [H[0] - r, H[1] - r, H[2] - r];
  const coords = (hh, rr) => {
    const a = [];
    for (let i = 0; i <= k; i++) a.push(-hh + rr * (i / k));
    for (let i = 0; i <= k; i++) { const v = hh - rr + rr * (i / k); if (v > a[a.length - 1] + 1e-6) a.push(v); }
    return a;
  };
  const cs = [coords(H[0], r), coords(H[1], r), coords(H[2], r)];
  const map = (p) => {
    const c = [Math.max(-I[0], Math.min(I[0], p[0])), Math.max(-I[1], Math.min(I[1], p[1])), Math.max(-I[2], Math.min(I[2], p[2]))];
    let n = v3.sub(p, c); const l = v3.len(n);
    n = l < 1e-9 ? null : v3.scale(n, 1 / l);
    return n ? { p: v3.add(c, v3.scale(n, r)), n } : { p, n: null };
  };
  for (let axis = 0; axis < 3; axis++) {
    for (const sgn of [-1, 1]) {
      const u = (axis + 1) % 3, v = (axis + 2) % 3;
      const U = cs[u], V = cs[v];
      const pt = (i, j) => { const p = [0, 0, 0]; p[axis] = sgn * H[axis]; p[u] = U[i]; p[v] = V[j]; const m = map(p); const fnrm = [0, 0, 0]; fnrm[axis] = sgn; return { p: m.p, n: m.n || fnrm }; };
      for (let i = 0; i < U.length - 1; i++) for (let j = 0; j < V.length - 1; j++) {
        const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), dd = pt(i, j + 1);
        g.triN(a.p, b.p, c.p, a.n, b.n, c.n, C);
        g.triN(a.p, c.p, dd.p, a.n, c.n, dd.n, C);
      }
    }
  }
  return g;
}

export function box(w, h, d, color) {
  const g = new Geo(), x = w / 2, y = h / 2, z = d / 2;
  const P = (a, b, c) => [a * x, b * y, c * z];
  const faces = [[[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1], [1, 0, 0]], [[-1, -1, 1], [-1, 1, 1], [-1, 1, -1], [-1, -1, -1], [-1, 0, 0]],
    [[-1, 1, -1], [-1, 1, 1], [1, 1, 1], [1, 1, -1], [0, 1, 0]], [[-1, -1, 1], [-1, -1, -1], [1, -1, -1], [1, -1, 1], [0, -1, 0]],
    [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1], [0, 0, 1]], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1], [0, 0, -1]]];
  for (const [a, b, c, dd, n] of faces) g.quad(P(...a), P(...b), P(...c), P(...dd), color, n);
  return g;
}

// Glatte Kugel (UV)
export function sphere(r, color, ws = 14, hs = 10, sy = 1) {
  const g = new Geo(), C = asColor(color);
  const P = (i, j) => { const th = (j / hs) * Math.PI, ph = (i / ws) * Math.PI * 2; const n = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]; return { p: [n[0] * r, n[1] * r * sy, n[2] * r], n: v3.norm([n[0], n[1] / sy, n[2]]) }; };
  for (let j = 0; j < hs; j++) for (let i = 0; i < ws; i++) {
    const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
    if (j > 0) g.triN(a.p, b.p, c.p, a.n, b.n, c.n, C);
    if (j < hs - 1) g.triN(a.p, c.p, d.p, a.n, c.n, d.n, C);
  }
  return g;
}

// Ikosaeder-Kugel, optional verformt (organische Baumkronen, Steine)
export function icosphere(r, color, detail = 2, flat = false, noise = 0, seed = 1) {
  const t = (1 + Math.sqrt(5)) / 2;
  let verts = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(v3.norm);
  let faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let d = 0; d < detail; d++) {
    const cache = new Map(), nf = [];
    const mid = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (cache.has(k)) return cache.get(k); verts.push(v3.norm(v3.scale(v3.add(verts[a], verts[b]), 0.5))); cache.set(k, verts.length - 1); return verts.length - 1; };
    for (const [a, b, c] of faces) { const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a); nf.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    faces = nf;
  }
  const n3 = (p) => Math.sin(p[0] * 3.1 + seed) * Math.sin(p[1] * 2.7 + seed * 1.7) * Math.sin(p[2] * 3.3 + seed * 0.7);
  const pos = verts.map((v) => v3.scale(v, r * (1 + noise * n3(v))));
  const g = new Geo(), C = asColor(color);
  // glatte Normalen über Nachbarflächen
  const vn = pos.map(() => [0, 0, 0]);
  for (const [a, b, c] of faces) { const fn = v3.cross(v3.sub(pos[b], pos[a]), v3.sub(pos[c], pos[a])); for (const i of [a, b, c]) { vn[i][0] += fn[0]; vn[i][1] += fn[1]; vn[i][2] += fn[2]; } }
  for (const [a, b, c] of faces) {
    if (flat) g.tri(pos[a], pos[b], pos[c], C, v3.add(v3.add(pos[a], pos[b]), pos[c]));
    else g.triN(pos[a], pos[b], pos[c], v3.norm(vn[a]), v3.norm(vn[b]), v3.norm(vn[c]), C);
  }
  return g;
}

// Zylinder/Kegel, Unterkante y=0
export function cylinder(rt, rb, h, color, seg = 12, caps = true) {
  const g = new Geo(), C = asColor(color);
  const slope = (rb - rt) / h;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    const n0 = v3.norm([c0, slope, s0]), n1 = v3.norm([c1, slope, s1]);
    const b0 = [c0 * rb, 0, s0 * rb], b1 = [c1 * rb, 0, s1 * rb], t0 = [c0 * rt, h, s0 * rt], t1 = [c1 * rt, h, s1 * rt];
    g.triN(b0, b1, t1, n0, n1, n1, C);
    if (rt > 0.0001) g.triN(b0, t1, t0, n0, n1, n0, C);
    if (caps) {
      if (rt > 0.0001) g.tri([0, h, 0], t0, t1, C, [0, 1, 0]);
      g.tri([0, 0, 0], b1, b0, C, [0, -1, 0]);
    }
  }
  return g;
}

// Drehkörper aus Profil [[radius, y], ...] von unten nach oben
export function lathe(profile, color, seg = 16) {
  const g = new Geo(), C = asColor(color);
  const pn = profile.map((p, i) => {
    const a = profile[Math.max(0, i - 1)], b = profile[Math.min(profile.length - 1, i + 1)];
    const dr = b[0] - a[0], dy = b[1] - a[1];
    return v3.norm([dy, -dr, 0]);
  });
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    for (let j = 0; j < profile.length - 1; j++) {
      const P = (a, k) => [Math.cos(a) * profile[k][0], profile[k][1], Math.sin(a) * profile[k][0]];
      const N = (a, k) => v3.norm([Math.cos(a) * pn[k][0], pn[k][1], Math.sin(a) * pn[k][0]]);
      const p00 = P(a0, j), p10 = P(a1, j), p11 = P(a1, j + 1), p01 = P(a0, j + 1);
      const n00 = N(a0, j), n10 = N(a1, j), n11 = N(a1, j + 1), n01 = N(a0, j + 1);
      if (profile[j][0] > 1e-4 || profile[j + 1][0] > 1e-4) {
        g.triN(p00, p10, p11, n00, n10, n11, C);
        g.triN(p00, p11, p01, n00, n11, n01, C);
      }
    }
  }
  return g;
}

// Flacher, beidseitiger, gebogener Streifen: Blütenblatt oder Blatt.
// Liegt entlang +Z, Breite in X. cup = Wölbung quer, curl = Biegung nach oben entlang der Länge.
export function petal(len, wid, color, { cup = 0.25, curl = 0.3, tip = 0.8, segL = 3, segW = 1, colorTip = null, fold = 0 } = {}) {
  const g = new Geo(), C = asColor(color), CT = colorTip ? asColor(colorTip) : C;
  const W = (u) => wid * Math.pow(Math.sin(Math.PI * Math.min(1, u * (0.5 + tip * 0.5) + (1 - tip) * 0.25)), 0.8) * (u < 0.02 ? 0.3 : 1);
  const S = (u, v) => {
    const w = W(u), x = v * w;
    const y = cup * w * v * v + curl * len * u * u - fold * Math.abs(v) * w;
    return [x, y, u * len];
  };
  const NRM = (u, v) => {
    const e = 0.01, p = S(u, v), pu = S(Math.min(1, u + e), v), pv = S(u, Math.min(1, v + e));
    let n = v3.cross(v3.sub(pv, p), v3.sub(pu, p));
    if (n[1] < 0) n = v3.scale(n, -1);
    return v3.norm(n);
  };
  const colAt = (u) => v3.lerp(C, CT, u);
  for (let i = 0; i < segL; i++) for (let j = 0; j < segW * 2; j++) {
    const u0 = i / segL, u1 = (i + 1) / segL, va = -1 + j / segW, vb = -1 + (j + 1) / segW;
    const a = S(u0, va), b = S(u1, va), c = S(u1, vb), d = S(u0, vb);
    const na = NRM(u0, va), nb = NRM(u1, va), nc = NRM(u1, vb), nd = NRM(u0, vb);
    // Oberseite
    g.triN(a, b, c, na, nb, nc, colAt(u0), colAt(u1), colAt(u1));
    g.triN(a, c, d, na, nc, nd, colAt(u0), colAt(u1), colAt(u0));
    // Unterseite (etwas dunkler)
    const k = 0.82, neg = (n) => v3.scale(n, -1), dk = (c2) => v3.scale(c2, k);
    g.triN(a, c, b, neg(na), neg(nc), neg(nb), dk(colAt(u0)), dk(colAt(u1)), dk(colAt(u1)));
    g.triN(a, d, c, neg(na), neg(nd), neg(nc), dk(colAt(u0)), dk(colAt(u0)), dk(colAt(u1)));
  }
  return g;
}

// Konvexes Polygon (in XY) entlang Z extrudiert, zentriert in Z
export function extrude(poly, depth, color) {
  const g = new Geo(), C = asColor(color), hz = depth / 2;
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  for (let i = 1; i < poly.length - 1; i++) {
    g.tri([poly[0][0], poly[0][1], hz], [poly[i][0], poly[i][1], hz], [poly[i + 1][0], poly[i + 1][1], hz], C, [0, 0, 1]);
    g.tri([poly[0][0], poly[0][1], -hz], [poly[i + 1][0], poly[i + 1][1], -hz], [poly[i][0], poly[i][1], -hz], C, [0, 0, -1]);
  }
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const out = [(a[0] + b[0]) / 2 - cx, (a[1] + b[1]) / 2 - cy, 0];
    g.quad([a[0], a[1], hz], [b[0], b[1], hz], [b[0], b[1], -hz], [a[0], a[1], -hz], C, out);
  }
  return g;
}

// Flache Scheibe nach oben (y=0)
export function disk(r, color, seg = 20, rz = r) {
  const g = new Geo(), C = asColor(color);
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    g.tri([0, 0, 0], [Math.cos(a0) * r, 0, Math.sin(a0) * rz], [Math.cos(a1) * r, 0, Math.sin(a1) * rz], C, [0, 1, 0]);
  }
  return g;
}

// Gelände-Gitter mit Höhenfunktion und Farbfunktion
export function terrain(x0, z0, x1, z1, nx, nz, heightFn, colorFn) {
  const g = new Geo();
  const P = (i, j) => { const x = x0 + ((x1 - x0) * i) / nx, z = z0 + ((z1 - z0) * j) / nz; return [x, heightFn(x, z), z]; };
  const N = (x, z) => { const e = 0.2; return v3.norm([heightFn(x - e, z) - heightFn(x + e, z), 2 * e, heightFn(x, z - e) - heightFn(x, z + e)]); };
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1);
    const ca = colorFn(a), cb = colorFn(b), cc = colorFn(c), cd = colorFn(d);
    g.triN(a, b, c, N(a[0], a[2]), N(b[0], b[2]), N(c[0], c[2]), ca, cb, cc);
    g.triN(a, c, d, N(a[0], a[2]), N(c[0], c[2]), N(d[0], d[2]), ca, cc, cd);
  }
  return g;
}

export const T = m4.trs;

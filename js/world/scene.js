// Die Gartenwelt: baut die Szene auf, animiert Tiere/Effekte, steuert Kamera und Antippen.
import { Renderer } from '../engine/gl.js';
import { Geo, T, sphere, petal, box, cylinder } from '../engine/geo.js';
import { m4, v3, rng, clamp, lerp } from '../engine/math.js';
import * as M from './models.js';
import { environment } from './sky.js';
import * as C from '../config.js';
import { bedVisible } from '../game.js';

const { SEEDS, BED_COUNT } = C;
const PI = Math.PI;
export const BED_SPACING = 3.1;
const OX = 0.4, OZ = 1.0;
const BED_TOP = 0.56;

// Laufwege
const FOX_PATH = [[-7.45, -3.75], [8.25, -3.75], [8.25, 5.75], [-7.45, 5.75]];
const HOG_PATH = [[-4.25, -0.55], [5.05, -0.55], [5.05, 2.55], [-4.25, 2.55]];

// Geometrie um den Mittelpunkt (x/z) zentrieren – dann lässt sie sich sauber drehen und platzieren
function centered(geo) {
  const b = geo.bounds();
  const cx = (b.min[0] + b.max[0]) / 2, cz = (b.min[2] + b.max[2]) / 2;
  return { geo: new Geo().add(geo, T(-cx, 0, -cz)), h: b.max[1] };
}

export class World {
  constructor(canvas, quality) {
    this.r = new Renderer(canvas, quality);
    this.canvas = canvas;
    this.time = 0;
    this.beds = [];
    this.particles = [];
    this.cam = { yaw: PI / 4, pitch: 0.62, zoom: 1, target: [0.4, 0, 0.4], fovy: 0.9 };
    this.camAnim = null;
    this.meshCache = new Map();
    this.decoObjs = [];
    this.decoInfo = {};
    this.landObjs = [];
    this.G = 0;
    this.ghPos = [...C.DEFAULT_GH];
    this.build();
  }

  mesh(key, make) {
    if (!this.meshCache.has(key)) this.meshCache.set(key, this.r.mesh(make()));
    return this.meshCache.get(key);
  }

  add(geo, model, opts) { return this.r.addObject(this.r.mesh(geo), model || m4.identity(), opts); }

  build() {
    const R = rng(42);
    // Gelände
    const gr = M.ground();
    this.ground = gr;
    this.add(gr.geo, null, { shadow: false });
    this.add(M.plaza(BED_SPACING * 5 + 1.2, BED_SPACING * 3 + 1.2), T(OX, 0.0, OZ), { shadow: false });

    // Haus, Teich (fest)
    this.housePos = [-6.0, -6.6];
    this.add(M.house(), T(this.housePos[0], 0, this.housePos[1]));
    this.pond = { x: 6.6, z: -7.5, rx: 2.4, rz: 1.65 };
    this.add(M.pondRim(this.pond.rx, this.pond.rz), T(this.pond.x, 0, this.pond.z));
    this.add(diskGeo(this.pond.rx, this.pond.rz), T(this.pond.x, 0.06, this.pond.z), { mode: 1, shadow: false });

    // Feste Gartenstücke (siehe C.OBSTACLES)
    this.add(M.tree(3, 'apple'), T(-8.3, 0, 8.4, 0, 0, 0, 0.85));
    this.add(M.tree(5, 'round'), T(-9.3, 0, -8.9, 1.2, 0, 0, 0.7));
    this.add(M.roundFlowerBed(1.25, 31, ['#ff6f9a', '#ffd23f', '#ffffff']), T(-3.0, 0, 8.4));
    this.add(M.roundFlowerBed(1.05, 32, ['#9a7be8', '#ffffff', '#ff8fc0']), T(7.2, 0, 8.0));
    this.add(M.DECO_MODELS.wateringcan(), T(-6.0, 0, 7.3, 0.7));

    // Gewächshaus (verwittert, bis es restauriert wird) – zentriert, damit es sich verschieben lässt
    this.ghMeshes = [M.greenhouse(true), M.greenhouse(false)].map((g) => this.r.mesh(centered(g).geo));
    this.ghRestored = this.r.addObject(this.ghMeshes[0], m4.identity(), { visible: false });
    this.ghBroken = this.r.addObject(this.ghMeshes[1], m4.identity());

    // Außenwelt: Bäume und Büsche jenseits der größten Gartenerweiterung
    const outside = new Geo();
    for (let i = 0; i < 60; i++) {
      const a = R() * PI * 2, d = 27 + R() * 26;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (x > 8 && z > 8 && d < 34) continue; // Blick frei halten
      const kind = R() < 0.35 ? 'pine' : R() < 0.2 ? 'apple' : 'round';
      outside.add(M.tree(i + 10, kind, 1), T(x, gr.height(x, z), z, R() * 6, 0, 0, 0.9 + R() * 0.7));
    }
    for (let i = 0; i < 34; i++) {
      const a = R() * PI * 2, d = 23 + R() * 12, x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (x > 6 && z > 6 && d < 28) continue;
      outside.add(M.bush(i + 50, R() < 0.3 ? ['#ffffff', '#ff8fc0', '#ffd84a'][i % 3] : null), T(x, gr.height(x, z), z, R() * 6, 0, 0, 1 + R()));
    }
    this.add(outside);

    // Wolken
    this.clouds = [];
    const cR = rng(77);
    for (let i = 0; i < 7; i++) {
      const a = -PI * 0.25 - PI * 0.75 + (i / 7) * PI * 1.6 + cR() * 0.3, d = 75 + cR() * 25;
      const o = this.add(M.cloud(i + 1), m4.identity(), { shadow: false, fog: 0.25 });
      this.clouds.push({ o, a, d, y: 22 + cR() * 14, s: 1 + cR() * 0.8 });
    }

    // Beete (Position kommt aus dem Spielstand, siehe syncLayout)
    this.bedMeshes = [1, 2, 3].map((l) => this.mesh('bed' + l, () => M.raisedBed(false, l)));
    const sprBody = this.mesh('spr', () => M.sprinkler()), sprHead = this.mesh('sprHead', () => M.sprinklerHead());
    for (let i = 0; i < BED_COUNT; i++) {
      const frame = this.r.addObject(this.bedMeshes[0], m4.identity());
      const wild = this.r.addObject(this.mesh('bedLocked', () => M.raisedBed(true)), m4.identity(), { visible: false });
      const plants = this.r.addObject({ buf: this.r.gl.createBuffer(), count: 0 }, m4.identity());
      const spr = this.r.addObject(sprBody, m4.identity(), { visible: false });
      const head = this.r.addObject(sprHead, m4.identity(), { visible: false, shadow: false });
      this.beds.push({ frame, wild, plants, spr, head, sp: [0, 0], pos: [0, 0, 0], shown: true, key: '', lvl: 1, sparkles: [] });
      this.placeBed(i, C.DEFAULT_BEDS[i]);
    }
    this.placeGreenhouse(C.DEFAULT_GH);

    // Markierung beim Verschieben
    this.marker = this.r.addObject({ buf: this.r.gl.createBuffer(), count: 0 }, m4.identity(), { visible: false, mode: 2, shadow: false });

    this.buildLand(C.LAND[0].half);
    this.buildAnimals();
    this.buildEffects();
  }

  // Alles, was am Zaun hängt – wird bei einer Gartenerweiterung neu gebaut
  buildLand(G) {
    for (const o of this.landObjs) { this.r.removeObject(o); this.r.freeMesh(o.mesh); }
    this.landObjs = [];
    this.G = G;
    const add = (geo, model, opts) => { const o = this.add(geo, model, opts); this.landObjs.push(o); return o; };
    const sh = (v) => (Math.abs(v) >= 9 ? v + Math.sign(v) * (G - 10.2) : v); // am Rand bleiben
    const gr = this.ground, R = rng(42 + Math.round(G));
    add(M.lawn(G * 2), T(0, 0.005, 0), { shadow: false });
    const stones = [];
    for (let z = 6.9; z < G + 0.2; z += 0.9) stones.push([OX + (Math.round(z) % 2 ? 0.12 : -0.12), z]);
    add(M.steppingStones(stones), null, { shadow: false });
    // Zaun & Hecke
    add(M.picketFence(G * 2, 0), T(G, 0, 0, PI / 2));
    add(M.picketFence(G * 2, 2.0, OX), T(0, 0, G));
    add(M.hedge(G * 2 + 1.1, 3), T(-G - 0.3, 0, 0, PI / 2));
    add(M.hedge(G * 2 + 1.1, 5), T(0, 0, -G - 0.3));
    // Büsche und Steine am Rand
    const bushes = [[-3.4, -9.6, '#ffffff'], [-9.2, -3.8, null], [2.9, -9.7, '#ff8fc0'], [-2.7, -9.7, null], [-9.4, 9.6, '#b9a3ff'], [9.6, -3.6, '#ffd84a']];
    bushes.forEach(([x, z, f], i) => add(M.bush(i + 3, f), T(sh(x), 0, sh(z), R() * 6, 0, 0, 0.9 + R() * 0.3)));
    for (const [x, z, s] of [[-9.6, 6.0, 0.5], [3.6, -9.9, 0.32], [9.6, -9.8, 0.45], [-5.4, 9.5, 0.3], [5.9, 9.6, 0.32], [9.3, 7.0, 0.28]]) add(M.rock(Math.round(x * 3), s), T(sh(x), s * 0.27, sh(z), R() * 6));
    // Gras und Wildblumen: nur am Rand im Garten (Platz zum Gestalten bleibt frei) und draußen auf der Wiese
    const inGarden = (x, z) => Math.abs(x) < G && Math.abs(z) < G;
    const inside = (x, z) => x > -G + 0.6 && x < G - 1.4 && z > -G + 0.6 && z < G - 1.4;
    const tufts = new Geo(), tR = rng(9);
    const tuft = M.grassTuft(tR, 0.32);
    for (let i = 0; i < 300; i++) {
      const x = (tR() - 0.5) * 70, z = (tR() - 0.5) * 70;
      if (inGarden(x, z) || Math.hypot(x, z) > 34) continue;
      tufts.add(tuft, T(x, gr.height(x, z), z, tR() * 6, 0, 0, 0.8 + tR() * 0.6));
    }
    for (let t = -G; t < G; t += 0.7) {
      tufts.add(tuft, T(G - 0.35, 0, t + tR() * 0.3, tR() * 6));
      if (Math.abs(t - OX) > 1.4) tufts.add(tuft, T(t + tR() * 0.3, 0, G - 0.35, tR() * 6));
      tufts.add(tuft, T(-G + 0.35, 0, t + tR() * 0.3, tR() * 6));
      tufts.add(tuft, T(t + tR() * 0.3, 0, -G + 0.35, tR() * 6));
    }
    add(tufts, null, { shadow: false });
    add(M.wildflowers(rng(17), Math.round(G * 6), G * 2, (x, z) => inside(x, z) || !inGarden(x, z) || (Math.abs(x - OX) < 1 && z > G - 2)), null, { shadow: false });
    add(M.flowerBorder(G * 2 - 1.2, 1.1, 21, [[OX - 1.5, OX + 1.5]]), T(0, 0, G - 0.85), { shadow: false });
    add(M.flowerBorder(G * 2 - 1.2, 1.1, 22, [[-G, -G + 6.9]]), T(G - 0.85, 0, 0, PI / 2), { shadow: false });
    add(M.wildflowers(rng(18), 200, 70, (x, z) => Math.abs(x) < G + 0.8 && Math.abs(z) < G + 0.8 || Math.hypot(x, z) > 34), null, { shadow: false });
    // Büsche und Blumen vor dem Zaun, Briefkasten am Tor
    const front = new Geo(), fR = rng(23);
    for (let k = 0; k < Math.round(G * 1.6); k++) {
      const t = -G + 1.2 + k * 1.3 + fR() * 0.6, off = G + 1.2 + fR() * 1.8;
      if (Math.abs(t - OX) < 1.6 || (k % 2 && t > OX - 5.4 && t < OX - 1.8)) continue;
      if (k % 2) front.add(M.bush(80 + k, fR() < 0.5 ? ['#ff8fc0', '#ffffff', '#ffd84a'][k % 3] : null), T(t, 0, off, fR() * 6, 0, 0, 0.8 + fR() * 0.4));
      else front.add(M.bush(90 + k, null), T(off, 0, t, fR() * 6, 0, 0, 0.8 + fR() * 0.4));
    }
    add(front);
    add(M.DECO_MODELS.mailbox(), T(OX + 1.8, 0, G + 0.6, -PI / 2));
    // Verkaufskarren des Händlers vor dem Tor
    this.cartPos = [OX - 3.6, G + 1.9];
    this.cartObj = add(M.traderCart(), T(this.cartPos[0], 0, this.cartPos[1], 0.12));
    this.cartObj.visible = !!this.cartOn;
    this.syncLights();
    if (this.owl) this.owl.pos[2] = G;
    this.clampTarget?.();
  }

  // ---------- Positionen aus dem Spielstand ----------
  syncLayout(s) {
    const G = C.LAND[s.land].half;
    if (G !== this.G) this.buildLand(G);
    s.layout.beds.forEach((p, i) => { this.beds[i].shown = bedVisible(s, i); this.placeBed(i, p); });
    this.placeGreenhouse(s.layout.gh);
    this.syncDecor(s.decor);
  }

  placeBed(i, [x, z, r], lift = 0) {
    const b = this.beds[i], ry = (r || 0) * PI / 2, sc = b.scale || 1;
    b.pos = [x, z, r || 0];
    const m = T(x, lift, z, ry, 0, 0, sc, 1, sc);
    b.frame.model = m; b.wild.model = T(x, lift, z, ry);
    b.plants.model = T(x, BED_TOP + lift, z, ry);
    const c = m4.point(m, [-1.02, 0, 1.02]); // Sprinkler an der vorderen linken Ecke
    b.sp = [c[0], c[2]];
    b.spr.model = T(c[0], 0.12 + lift, c[2]);
    b.head.model = T(c[0], 0.95 + lift, c[2]);
  }

  placeGreenhouse([x, z, r], lift = 0) {
    this.ghPos = [x, z, r || 0];
    const m = T(x, lift, z, (r || 0) * PI / 2);
    this.ghRestored.model = m; this.ghBroken.model = m;
  }

  decoMesh(id) {
    if (!this.decoInfo[id]) {
      const c = centered(M.DECO_MODELS[id]());
      this.decoInfo[id] = { mesh: this.r.mesh(c.geo), h: c.h };
    }
    return this.decoInfo[id];
  }

  // Händler-Karren zeigen (ab Level 2)
  setTrader(on) { this.cartOn = !!on; if (this.cartObj) this.cartObj.visible = this.cartOn; this.syncLights(); }

  // Lichtquellen sammeln: Deko-Lichter, Haustür, Händler-Karren
  syncLights() {
    const L = [[this.housePos[0] + 0.7, 2.0, this.housePos[1] + 2.0, 4.5]];
    if (this.cartOn && this.cartPos) L.push([this.cartPos[0] + 0.9, 1.8, this.cartPos[1] + 0.5, 4]);
    (this.decorList || []).forEach((d) => {
      const l = C.LIGHTS[d.id];
      if (!l || d.stored) return;
      if (d.id === 'stringLights') { const a = (d.r || 0) * PI / 2, c = Math.cos(a), s = Math.sin(a); L.push([d.x - c * 0.6, l[0], d.z + s * 0.6, l[1] * 0.75], [d.x + c * 0.6, l[0], d.z - s * 0.6, l[1] * 0.75]); }
      else L.push([d.x, l[0], d.z, l[1]]);
    });
    this.lightList = L;
  }

  syncDecor(list) {
    this.decorList = list;
    this.syncLights();
    list.forEach((d, k) => {
      let o = this.decoObjs[k];
      if (!o || o.id !== d.id) {
        if (o) this.r.removeObject(o.obj);
        o = { id: d.id, obj: this.r.addObject(this.decoMesh(d.id).mesh, m4.identity()) };
        this.decoObjs[k] = o;
      }
      o.obj.visible = !d.stored;
      o.obj.model = T(d.x, 0, d.z, d.r * PI / 2);
    });
    while (this.decoObjs.length > list.length) this.r.removeObject(this.decoObjs.pop().obj);
  }

  // Objekt während des Ziehens bewegen (ohne den Spielstand zu ändern)
  preview(ref, x, z, r, lift = 0) {
    if (ref.type === 'bed') this.placeBed(ref.i, [x, z, r], lift);
    else if (ref.type === 'gh') this.placeGreenhouse([x, z, r], lift);
    else { const o = this.decoObjs[ref.k]; if (o) o.obj.model = T(x, lift, z, r * PI / 2); }
  }

  // Rahmen am Boden, grün = Platz frei, rot = belegt
  showMarker(x, z, w, d, ok) {
    const key = `${w}|${d}|${ok}`;
    if (this.marker.key !== key) {
      // etwas größer als das Objekt, damit der Rahmen sichtbar bleibt
      const g = new Geo(), c = ok ? '#4be36a' : '#ff4d5e', t = 0.14, W = w + 0.3, D = d + 0.3, hw = W / 2, hd = D / 2;
      for (const [px, pz, sx, sz] of [[0, -hd, W, t], [0, hd, W, t], [-hw, 0, t, D], [hw, 0, t, D]]) g.add(box(sx, 0.06, sz, c), T(px, 0, pz));
      for (const [px, pz] of [[-hw, -hd], [hw, -hd], [-hw, hd], [hw, hd]]) g.add(box(0.32, 0.08, 0.32, c), T(px, 0, pz));
      this.r.updateMesh(this.marker.mesh, g);
      this.marker.key = key;
    }
    this.marker.model = T(x, 0.04, z);
    this.marker.visible = true;
  }
  hideMarker() { this.marker.visible = false; }

  syncGreenhouse(unlocked) {
    this.ghRestored.visible = !!unlocked;
    this.ghBroken.visible = !unlocked;
  }

  buildAnimals() {
    const part = (geo, opts) => this.r.addObject(this.r.mesh(geo), m4.identity(), opts);
    this.foxSkins = {};
    for (const skin of ['default', 'arctic']) {
      const f = M.fox(skin);
      this.foxSkins[skin] = { body: this.r.mesh(f.body), head: this.r.mesh(f.head), tail: this.r.mesh(f.tail), leg: this.r.mesh(f.leg) };
      if (skin === 'default') this.foxRig = f;
    }
    const fs = this.foxSkins.default;
    this.fox = {
      parts: { body: this.r.addObject(fs.body), head: this.r.addObject(fs.head), tail: this.r.addObject(fs.tail), legs: [0, 1, 2, 3].map(() => this.r.addObject(fs.leg)) },
      pos: [...FOX_PATH[0]], target: 1, heading: 0, state: 'walk', timer: 0, phase: 0, look: 0, hop: 0,
    };
    this.hogSkins = {};
    for (const skin of ['default', 'autumn']) { const h = M.hedgehog(skin); this.hogSkins[skin] = { body: this.r.mesh(h.body), foot: this.r.mesh(h.foot) }; if (skin === 'default') this.hogRig = h; }
    const hs = this.hogSkins.default;
    this.hog = { parts: { body: this.r.addObject(hs.body), feet: [0, 1, 2, 3].map(() => this.r.addObject(hs.foot)) }, pos: [...HOG_PATH[0]], target: 1, heading: 0, state: 'walk', timer: 0, phase: 0, hop: 0 };

    const ow = M.owl();
    this.owlRig = ow;
    this.owl = { parts: { body: part(ow.body), head: part(ow.head), lid: part(ow.lid, { shadow: false }) }, pos: [OX - 1.0, 1.4, this.G], vis: 0, look: 0, blink: 0, hop: 0 };

    const cols = [['#5ab4ff', '#ffd23f'], ['#ff9a3c', '#ffe7a0'], ['#ff7ac8', '#ffffff']];
    this.butterflies = cols.map(([a, b], i) => {
      const bf = M.butterfly(a, b);
      return { parts: { body: part(bf.body, { shadow: false }), wingL: part(bf.wingL, { shadow: false }), wingR: part(bf.wingR, { shadow: false }) }, seed: i * 2.1 + 0.5, vis: 1 };
    });
  }

  buildEffects() {
    const ffMesh = this.r.mesh(M.firefly());
    const R = rng(5);
    this.fireflies = Array.from({ length: 12 }, (_, i) => {
      const homes = [[7.3, -6.4], [-8.6, 5], [-9.6, -2.4], [3.0, -10], [9.2, -9.6], [-4, -9.6]];
      const h = homes[i % homes.length];
      return { o: this.r.addObject(ffMesh, m4.identity(), { mode: 2, shadow: false, fog: 0.4 }), home: [h[0] + (R() - 0.5) * 3, h[1] + (R() - 0.5) * 3], s: R() * 10 };
    });
    const dewMesh = this.r.mesh(M.sparkle('#ffffff', 0.05));
    this.dew = Array.from({ length: 22 }, () => {
      let x, z;
      do { x = (R() - 0.5) * 21; z = (R() - 0.5) * 21; } while (Math.abs(x - OX) < 8.6 && Math.abs(z - OZ) < 5.5);
      return { o: this.r.addObject(dewMesh, m4.identity(), { mode: 2, shadow: false }), p: [x, 0.12, z], s: R() * 10 };
    });
    this.goldSpark = this.r.mesh(M.sparkle('#fff4b0', 0.07));
    this.heartMesh = this.r.mesh(heartGeo());
    this.coinMesh = this.r.mesh(coinGeo());
    this.ringMesh = this.r.mesh(ringGeo());
  }

  // ---------- Spielzustand -> Szene ----------
  syncBeds(infos) {
    infos.forEach((info, i) => {
      const bed = this.beds[i];
      bed.frame.visible = !info.locked;
      bed.wild.visible = !!info.locked && !info.hidden;
      if (bed.lvl !== info.lvl) { bed.lvl = info.lvl; bed.frame.mesh = this.bedMeshes[(info.lvl || 1) - 1]; }
      const sc = C.BED_SIZES[(info.size || 1) - 1]?.scale || 1;
      if (bed.scale !== sc) { bed.scale = sc; bed.key = null; this.placeBed(i, bed.pos); }
      bed.spr.visible = bed.head.visible = !info.locked && !!info.sprinkler;
      bed.plants.visible = !info.locked;
      let key = 'empty';
      if (info.seed) key = `${info.seed}|${info.stage}|${info.shiny ? 1 : 0}|${info.var}|${info.size || 1}`;
      if (key === bed.key) return;
      const wasStage = bed.stage; bed.stage = info.stage;
      // Wachstums-Sprung: Pflanzen „ploppen“ kurz, wenn sie eine Stufe weiter sind
      if (info.seed && wasStage !== undefined && info.stage > (wasStage ?? -1) && bed.key !== 'empty') { bed.pop = 0.45; this.growRing(i); }
      bed.key = key;
      const tall = info.seed && SEEDS[info.seed].model === 'sunflower';
      bed.h = !info.seed ? 0 : info.stage === 0 ? 0.35 : (tall ? 1.7 : 0.95) * (info.stage === 1 ? 0.55 : info.stage === 2 ? 0.8 : 1);
      const g = new Geo();
      if (info.seed) {
        const sz = info.size || 1, sc = C.BED_SIZES[sz - 1]?.scale || 1;
        const base = tall ? [[-0.45, -0.45], [0.45, -0.45], [0.45, 0.45], [-0.45, 0.45]] : [[0, 0], [-0.55, -0.5], [0.55, -0.5], [0.55, 0.5], [-0.55, 0.5]];
        const extra = sz === 2 ? [[0, -0.72], [0, 0.72]] : sz === 3 ? [[0, -0.8], [0, 0.8], [-0.8, 0], [0.8, 0]] : [];
        const spots = [...base.map(([a, b]) => [a * sc, b * sc]), ...extra.map(([a, b]) => [a * sc, b * sc])];
        const R = rng(info.var + 1);
        spots.forEach(([x, z], k) => {
          const pg = this.plantGeo(info.seed, info.stage, info.shiny, (info.var + k) % 3);
          g.add(pg, T(x + (R() - 0.5) * 0.12, 0, z + (R() - 0.5) * 0.12, R() * PI * 2, 0, 0, 0.88 + R() * 0.24));
        });
      }
      this.r.updateMesh(bed.plants.mesh, g);
      for (const s of bed.sparkles) this.r.removeObject(s.o);
      bed.sparkles = [];
      if ((info.shiny || info.seed === 'starRose') && info.stage === 3) {
        // Position relativ zum Beet – so wandern die Funken beim Verschieben mit
        for (let k = 0; k < 4; k++) bed.sparkles.push({ o: this.r.addObject(this.goldSpark, m4.identity(), { mode: 2, shadow: false }), rel: [k % 2 ? 0.6 : -0.6, BED_TOP + 0.6 + k * 0.12, k > 1 ? 0.5 : -0.5], s: k * 1.7 });
      }
    });
  }

  plantGeo(seed, stage, shiny, v) {
    const key = `${seed}|${stage}|${shiny}|${v}`;
    if (!this._plantGeo) this._plantGeo = new Map();
    if (!this._plantGeo.has(key)) this._plantGeo.set(key, M.plant(seed, stage, shiny, v + 1));
    return this._plantGeo.get(key);
  }

  syncSkins(active) {
    const fs = this.foxSkins[active.fox] || this.foxSkins.default;
    const p = this.fox.parts;
    p.body.mesh = fs.body; p.head.mesh = fs.head; p.tail.mesh = fs.tail; p.legs.forEach((l) => (l.mesh = fs.leg));
    const hs = this.hogSkins[active.hedgehog] || this.hogSkins.default;
    this.hog.parts.body.mesh = hs.body; this.hog.parts.feet.forEach((f) => (f.mesh = hs.foot));
  }

  // ---------- Effekte ----------
  // Staubwölkchen beim Absetzen eines Objekts
  burstAt(x, z) {
    const mesh = this.mesh('dust', () => sphere(0.09, '#e8dcc4', 6, 4));
    const R = Math.random;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * PI * 2;
      this.particles.push({ o: this.r.addObject(mesh, m4.identity(), { shadow: false }), p: [x + Math.cos(a) * 0.9, 0.12, z + Math.sin(a) * 0.9], v: [Math.cos(a) * 1.2, 0.8 + R() * 0.6, Math.sin(a) * 1.2], rot: 0, spin: 0, life: 0.6, max: 0.6, g: 2 });
    }
  }

  burst(i, kind, seed) {
    const [x, z] = this.beds[i].pos;
    const look = seed ? M.FLOWER_LOOK[seed] : null;
    const color = kind === 'plant' ? '#7a4b2b' : kind === 'water' ? '#5ab4ff' : kind === 'magic' ? '#ffe36b' : (look?.petal || look?.petals?.[0] || '#ffffff');
    const key = 'p' + color;
    const mesh = kind === 'magic' ? this.goldSpark : this.mesh(key, () => (kind === 'plant' || kind === 'water' ? sphere(kind === 'water' ? 0.05 : 0.07, color, 5, 4) : petal(0.14, 0.07, color, { cup: 0.3, curl: 0.2, tip: 0.5 })));
    const R = Math.random;
    const n = kind === 'plant' ? 10 : 16;
    for (let k = 0; k < n; k++) {
      const a = R() * PI * 2, sp = kind === 'plant' ? 1.2 : 2.2;
      this.particles.push({ o: this.r.addObject(mesh, m4.identity(), { shadow: false, ...(kind === 'magic' ? { mode: 2 } : {}) }), p: [x + (R() - 0.5) * 1.2, BED_TOP + 0.3, z + (R() - 0.5) * 1.2], v: [Math.cos(a) * sp * R(), 2.5 + R() * 2.5, Math.sin(a) * sp * R()], rot: R() * 6, spin: (R() - 0.5) * 12, life: 1.1, max: 1.1, g: kind === 'plant' ? 9 : 5 });
    }
  }

  // Münzregen beim Ernten (aufsteigend, dann fallend)
  coinRain(i, n = 6) {
    const [x, z] = this.beds[i].pos, R = Math.random;
    for (let k = 0; k < n; k++) this.particles.push({ o: this.r.addObject(this.coinMesh, m4.identity(), { shadow: false }), p: [x + (R() - 0.5) * 0.8, BED_TOP + 0.5, z + (R() - 0.5) * 0.8], v: [(R() - 0.5) * 1.4, 3.5 + R() * 2, (R() - 0.5) * 1.4], rot: R() * 6, spin: 6 + R() * 8, life: 1.3, max: 1.3, g: 7 });
  }
  // Ring, der beim Wachstumsschub aufsteigt
  growRing(i) {
    const [x, z] = this.beds[i].pos;
    this.particles.push({ o: this.r.addObject(this.ringMesh, m4.identity(), { shadow: false, mode: 2 }), p: [x, BED_TOP + 0.1, z], v: [0, 0.9, 0], rot: 0, spin: 0, life: 0.7, max: 0.7, g: -0.4, grow: 1.6 });
  }
  // Wasserspritzer beim Gießen: Tropfen fallen von oben
  splash(i) {
    const [x, z] = this.beds[i].pos, R = Math.random;
    const mesh = this.mesh('pdrop', () => sphere(0.045, '#7cc8ff', 5, 4, 1.6));
    for (let k = 0; k < 22; k++) this.particles.push({ o: this.r.addObject(mesh, m4.identity(), { shadow: false }), p: [x + (R() - 0.5) * 1.6, BED_TOP + 1.6 + R() * 0.8, z + (R() - 0.5) * 1.6], v: [(R() - 0.5) * 0.3, -1 - R() * 2, (R() - 0.5) * 0.3], rot: 0, spin: 0, life: 0.5 + R() * 0.3, max: 0.8, g: 6 });
  }

  hearts(p) {
    for (let k = 0; k < 5; k++) {
      const R = Math.random;
      this.particles.push({ o: this.r.addObject(this.heartMesh, m4.identity(), { mode: 2, shadow: false }), p: [p[0] + (R() - 0.5) * 0.4, p[1] + 0.6, p[2] + (R() - 0.5) * 0.4], v: [(R() - 0.5) * 0.6, 1.4 + R(), (R() - 0.5) * 0.6], rot: 0, spin: 0, life: 1.4, max: 1.4, g: -0.5, face: true });
    }
  }

  // ---------- Animation ----------
  update(dt, env) {
    this.time += dt;
    const t = this.time;
    const night = env.name === 'night';

    // Wolken ziehen langsam
    for (const c of this.clouds) {
      c.a += dt * 0.004;
      c.o.model = T(Math.cos(c.a) * c.d, c.y, Math.sin(c.a) * c.d, -c.a, 0, 0, c.s);
    }

    this.walker(this.fox, FOX_PATH, dt, night ? 0.55 : 1.15, (st) => {
      const p = this.fox.parts, rig = this.foxRig;
      const base = T(st.pos[0], st.hop, st.pos[1], st.heading, 0, 0, 1.55);
      const sit = st.state === 'sit' ? 1 : 0;
      const bodyM = mulM(base, T(0, -0.08 * sit, 0, 0, -0.25 * sit));
      p.body.model = bodyM;
      p.head.model = mulM(bodyM, T(rig.headPos[0], rig.headPos[1] + Math.sin(t * 6) * 0.01 * (1 - sit) + 0.05 * sit, rig.headPos[2], st.look, 0.15 * sit));
      p.tail.model = mulM(bodyM, T(rig.tailPos[0], rig.tailPos[1], rig.tailPos[2], Math.sin(t * (sit ? 3 : 8)) * 0.35, -0.25 + 0.2 * sit));
      p.legs.forEach((l, k) => {
        const lp = rig.legPos[k];
        const swing = st.state === 'walk' ? Math.sin(st.phase * 2 + (k === 0 || k === 3 ? 0 : PI)) * 0.55 : 0;
        const fold = sit && k >= 2 ? -1.2 : 0;
        l.model = mulM(bodyM, T(lp[0], lp[1], lp[2], 0, swing + fold));
      });
    });

    this.walker(this.hog, HOG_PATH, dt, 0.42, (st) => {
      const p = this.hog.parts, rig = this.hogRig;
      const sniff = st.state === 'sit' ? Math.sin(t * 9) * 0.03 : 0;
      const base = T(st.pos[0], Math.abs(Math.sin(st.phase * 2)) * 0.03 + st.hop, st.pos[1], st.heading, sniff, 0, 1.7);
      p.body.model = base;
      p.feet.forEach((f, k) => {
        const fp = rig.feetPos[k];
        const step = st.state === 'walk' ? Math.sin(st.phase * 2 + (k % 2 ? PI : 0)) * 0.05 : 0;
        f.model = mulM(base, T(fp[0], fp[1], fp[2] + step));
      });
    });

    // Eule (nachts)
    const ow = this.owl;
    ow.vis = lerp(ow.vis, night || env.fireflies > 0.5 ? 1 : 0, Math.min(1, dt * 2));
    const ovis = ow.vis > 0.02;
    for (const k of ['body', 'head', 'lid']) ow.parts[k].visible = ovis;
    if (ovis) {
      ow.blink -= dt;
      if (ow.blink < -0.15) ow.blink = 2 + Math.random() * 3;
      ow.hop = Math.max(0, ow.hop - dt * 3);
      const s = ow.vis;
      const base = T(ow.pos[0], ow.pos[1] + Math.sin(ow.hop * PI) * 0.25, ow.pos[2], PI / 4 + 0.15, 0, 0, s * 1.5);
      ow.parts.body.model = base;
      const look = Math.sin(t * 0.35) * 0.9;
      const head = mulM(base, T(this.owlRig.headPos[0], this.owlRig.headPos[1], this.owlRig.headPos[2], look));
      ow.parts.head.model = head;
      ow.parts.lid.model = mulM(head, T(0, 0.04, 0, 0, 0, 0, 1, ow.blink < 0 ? 1 : 0.05, 1));
    }

    // Schmetterlinge (tagsüber)
    this.butterflies.forEach((b, i) => {
      const show = env.name !== 'night' ? 1 : 0;
      b.vis = lerp(b.vis, show, Math.min(1, dt * 1.5));
      const vis = b.vis > 0.02;
      for (const k of ['body', 'wingL', 'wingR']) b.parts[k].visible = vis;
      if (!vis) return;
      const s = b.seed, tt = t * 0.32 + s;
      const x = OX + Math.sin(tt * 1.3) * 6.2 + Math.sin(tt * 2.9) * 0.8;
      const z = OZ + Math.cos(tt * 0.9 + i) * 4.0;
      const y = 1.7 + Math.sin(tt * 3.1) * 0.35 + i * 0.2;
      const dx = Math.cos(tt * 1.3) * 1.3 * 6.2, dz = -Math.sin(tt * 0.9 + i) * 0.9 * 4.0;
      const heading = Math.atan2(dx, dz);
      const base = T(x, y, z, heading, 0, 0, 2.4 * b.vis);
      const flap = Math.sin(t * 18 + s * 3) * 0.9;
      b.parts.body.model = base;
      b.parts.wingL.model = mulM(base, T(0, 0, 0, 0, 0, -flap));
      b.parts.wingR.model = mulM(base, T(0, 0, 0, 0, 0, flap));
    });

    // Glühwürmchen
    const ff = env.fireflies;
    for (const f of this.fireflies) {
      f.o.visible = ff > 0.05;
      if (!f.o.visible) continue;
      const tt = t * 0.5 + f.s;
      const pulse = 0.55 + 0.45 * Math.sin(t * 3 + f.s * 5);
      f.o.model = T(f.home[0] + Math.sin(tt * 1.1) * 1.4, 0.6 + Math.sin(tt * 1.7) * 0.4 + (f.s % 1) * 0.8, f.home[1] + Math.cos(tt * 0.8) * 1.4, 0, 0, 0, ff * pulse * 2.2);
    }
    // Tau am Morgen
    for (const d of this.dew) {
      d.o.visible = env.dew > 0.05;
      if (!d.o.visible) continue;
      const tw = Math.max(0, Math.sin(t * 2.2 + d.s * 3));
      d.o.model = T(d.p[0], d.p[1], d.p[2], t + d.s, 0.6, 0, env.dew * tw * 1.2);
    }
    // Sprinkler drehen sich
    for (const bed of this.beds) if (bed.head.visible) bed.head.model = T(bed.sp[0], 0.95, bed.sp[1], t * 1.4 + bed.sp[0]);
    // Funkeln (Funkelblüten, Sternenrose)
    for (const bed of this.beds) {
      if (bed.pop > 0) {
        bed.pop -= dt;
        const k = Math.max(0, bed.pop / 0.45), sc = 1 + Math.sin(k * PI) * 0.18;
        const [x, z, r] = bed.pos; bed.plants.model = T(x, BED_TOP, z, (r || 0) * PI / 2, 0, 0, sc, 1 + Math.sin(k * PI) * 0.28, sc);
        if (bed.pop <= 0) bed.plants.model = T(x, BED_TOP, z, (r || 0) * PI / 2);
      }
    }
    for (const bed of this.beds) for (const s of bed.sparkles) {
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 2.5 + s.s));
      s.o.model = T(bed.pos[0] + s.rel[0], s.rel[1] + Math.sin(t * 1.5 + s.s) * 0.08, bed.pos[1] + s.rel[2], t * 0.8 + s.s, 0.5, 0, tw);
    }
    // Partikel
    for (let k = this.particles.length - 1; k >= 0; k--) {
      const q = this.particles[k];
      q.life -= dt;
      if (q.life <= 0) { this.r.removeObject(q.o); this.particles.splice(k, 1); continue; }
      q.v[1] -= q.g * dt;
      q.p = v3.add(q.p, v3.scale(q.v, dt));
      q.rot += q.spin * dt;
      let sc = Math.min(1, q.life / q.max * 2.5);
      if (q.grow) sc = (1 - q.life / q.max) * q.grow + 0.3;
      q.o.model = q.face ? T(q.p[0], q.p[1], q.p[2], this.cam.yaw, 0, 0, sc) : q.grow ? T(q.p[0], q.p[1], q.p[2], 0, 0, 0, sc, 1, sc) : T(q.p[0], q.p[1], q.p[2], q.rot, q.rot * 0.7, 0, sc);
    }
    this.updateCamera(dt);
  }

  walker(a, path, dt, speed, apply) {
    a.timer -= dt;
    if (a.state === 'walk') {
      const tgt = path[a.target];
      const d = v3.sub([tgt[0], 0, tgt[1]], [a.pos[0], 0, a.pos[1]]);
      const dist = Math.hypot(d[0], d[2]);
      const want = Math.atan2(d[0], d[2]);
      let dh = want - a.heading; while (dh > PI) dh -= PI * 2; while (dh < -PI) dh += PI * 2;
      a.heading += dh * Math.min(1, dt * 4);
      const step = Math.min(dist, speed * dt * (Math.abs(dh) > 1 ? 0.3 : 1));
      a.pos[0] += Math.sin(a.heading) * step; a.pos[1] += Math.cos(a.heading) * step;
      a.phase += dt * speed * 5;
      a.look = lerp(a.look || 0, 0, dt * 3);
      if (dist < 0.2) {
        a.target = (a.target + 1) % path.length;
        if (Math.random() < 0.45) { a.state = 'sit'; a.timer = 2.5 + Math.random() * 3; }
      }
    } else {
      a.look = Math.sin(this.time * 0.9) * 0.6;
      if (a.timer <= 0) a.state = 'walk';
    }
    a.hop = Math.max(0, (a.hop || 0) - dt * 3);
    const st = { ...a, hop: Math.sin(Math.min(1, a.hop) * PI) * 0.35 };
    apply(st);
  }

  animalPos(id) {
    if (id === 'fox') return [this.fox.pos[0], 0.75, this.fox.pos[1]];
    if (id === 'hedgehog') return [this.hog.pos[0], 0.4, this.hog.pos[1]];
    if (id === 'owl') return [this.owl.pos[0], this.owl.pos[1] + 0.6, this.owl.pos[2]];
    return null;
  }

  poke(id) {
    const p = this.animalPos(id);
    if (!p) return;
    if (id === 'fox') { this.fox.hop = 1; this.fox.state = 'sit'; this.fox.timer = 2.5; }
    if (id === 'hedgehog') { this.hog.hop = 1; this.hog.state = 'sit'; this.hog.timer = 2.5; }
    if (id === 'owl') this.owl.hop = 1;
    this.hearts(p);
  }

  // ---------- Kamera ----------
  cameraState() {
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    const fovy = aspect < 1 ? 0.92 : 0.72;
    const hf = 2 * Math.atan(Math.tan(fovy / 2) * aspect);
    const fitW = aspect < 1 ? lerp(13.6, 18.5, clamp((aspect - 0.46) / 0.54, 0, 1)) : 23, fitH = 14.5;
    const dW = fitW / 2 / Math.tan(hf / 2), dH = fitH / 2 / Math.tan(fovy / 2);
    const dist = Math.max(dW, aspect < 1 ? 0 : dH) * this.cam.zoom;
    const c = this.cam, cp = Math.cos(c.pitch);
    const eye = [c.target[0] + Math.sin(c.yaw) * cp * dist, Math.sin(c.pitch) * dist, c.target[2] + Math.cos(c.yaw) * cp * dist];
    return { eye, target: c.target, fovy, near: 0.5, far: 400, dist };
  }

  pan(dxPx, dyPx) {
    const cs = this.cameraState();
    const k = (2 * cs.dist * Math.tan(cs.fovy / 2)) / this.canvas.clientHeight;
    const right = [Math.cos(this.cam.yaw), 0, -Math.sin(this.cam.yaw)];
    const fwd = [-Math.sin(this.cam.yaw), 0, -Math.cos(this.cam.yaw)];
    const t = this.cam.target;
    t[0] -= (right[0] * dxPx - fwd[0] * dyPx / Math.sin(this.cam.pitch + 0.35)) * k;
    t[2] -= (right[2] * dxPx - fwd[2] * dyPx / Math.sin(this.cam.pitch + 0.35)) * k;
    this.clampTarget();
    this.camAnim = null;
  }

  zoomBy(f) { this.cam.zoom = clamp(this.cam.zoom * f, 0.5, 1.45 * Math.max(1, this.G / 10.2)); this.camAnim = null; }

  clampTarget() {
    const t = this.cam.target, lim = this.G - 1.7;
    t[0] = clamp(t[0], -lim, lim); t[2] = clamp(t[2], -lim, lim);
  }

  focus(x, z, zoom) { this.camAnim = { to: [x, 0, z], zoom: zoom ?? this.cam.zoom }; }
  resetView() { this.focus(0.4, 0.4, 1); }
  focusBed(i) { const [x, z] = this.beds[i].pos; this.focus(x, z, 0.8); }

  updateCamera(dt) {
    if (!this.camAnim) return;
    const a = this.camAnim, k = Math.min(1, dt * 4);
    this.cam.target = v3.lerp(this.cam.target, a.to, k);
    this.cam.zoom = lerp(this.cam.zoom, a.zoom, k);
    if (v3.len(v3.sub(this.cam.target, a.to)) < 0.01 && Math.abs(this.cam.zoom - a.zoom) < 0.002) this.camAnim = null;
  }

  // ---------- Antippen ----------
  pick(px, py) {
    const { o, d } = this.r.ray(px, py);
    let best = null;
    const consider = (t, hit) => { if (t > 0 && (!best || t < best.t)) best = { t, ...hit }; };
    // 1) Erde auf Beethöhe, 2) Holzrahmen, 3) Pflanzen (nur so hoch wie sie wirklich sind)
    const ts = d[1] < 0 ? (BED_TOP - o[1]) / d[1] : -1;
    const hp = v3.add(o, v3.scale(d, ts));
    this.beds.forEach((b, i) => {
      if (!b.shown) return;
      const [x, z] = b.pos;
      const hw = 1.2 * (b.scale || 1);
      if (ts > 0 && Math.abs(hp[0] - x) < hw && Math.abs(hp[2] - z) < hw) consider(ts, { type: 'bed', index: i });
      const tf = rayBox(o, d, [x - hw, 0, z - hw], [x + hw, BED_TOP, z + hw]);
      if (tf !== null) consider(tf, { type: 'bed', index: i });
      if (b.h) {
        const tp = rayBox(o, d, [x - hw + 0.25, BED_TOP, z - hw + 0.25], [x + hw - 0.25, BED_TOP + b.h, z + hw - 0.25]);
        if (tp !== null) consider(tp, { type: 'bed', index: i });
      }
    });
    {
      const [gx, gz, gr] = this.ghPos, [w, dd] = gr % 2 ? [C.GH_SIZE[1], C.GH_SIZE[0]] : C.GH_SIZE;
      const tg = rayBox(o, d, [gx - w / 2, 0, gz - dd / 2], [gx + w / 2, 3.2, gz + dd / 2]);
      if (tg !== null) consider(tg, { type: 'greenhouse' });
    }
    if (this.cartPos && this.cartOn) {
      const [cx, cz] = this.cartPos;
      const tc = rayBox(o, d, [cx - 1.1, 0, cz - 0.7], [cx + 1.1, 2.5, cz + 0.8]);
      if (tc !== null) consider(tc, { type: 'trader' });
    }
    for (const id of ['fox', 'hedgehog', 'owl']) {
      if (id === 'owl' && this.owl.vis < 0.5) continue;
      const p = this.animalPos(id), r = id === 'fox' ? 0.95 : 0.7;
      const t = raySphere(o, d, p, r);
      if (t !== null) consider(t - 0.5, { type: 'animal', id });
    }
    if (!best && d[1] < 0) best = { t: -o[1] / d[1], type: 'ground' };
    return best;
  }

  screenOf(p) { return this.r.project(p); }
  bedScreen(i, ready) { const [x, z] = this.beds[i].pos; return this.r.project([x + 0.5, BED_TOP + (ready ? 0.55 : 0.35), z + 0.5]); }
  bedCenterScreen(i) { const [x, z] = this.beds[i].pos; return this.r.project([x + 0.3, BED_TOP, z + 0.3]); }
  // Blase über der vorderen linken Ecke des Gewächshauses (weg von den Knöpfen am rechten Rand)
  greenhouseScreen() { return this.r.project(m4.point(T(this.ghPos[0], 0, this.ghPos[1], (this.ghPos[2] || 0) * PI / 2), [-1.1, 3.1, 0.9])); }
  objectScreen(ref, y = 1.2) {
    const p = ref.type === 'bed' ? this.beds[ref.i].pos : ref.type === 'gh' ? this.ghPos : this.decoObjs[ref.k] ? [this.decoObjs[ref.k].obj.model[12], this.decoObjs[ref.k].obj.model[14]] : null;
    return p ? this.r.project([p[0], y, p[1]]) : null;
  }

  // Schnittpunkt mit dem Boden (für das Verschieben)
  groundAt(px, py) {
    const { o, d } = this.r.ray(px, py);
    if (d[1] >= -1e-4) return null;
    const t = -o[1] / d[1];
    return [o[0] + d[0] * t, o[2] + d[2] * t];
  }

  // Was lässt sich an dieser Stelle verschieben? (Beete, Gewächshaus, Deko)
  pickEditable(px, py, s) {
    const { o, d } = this.r.ray(px, py);
    let best = null;
    const consider = (t, ref) => { if (t !== null && t > 0 && (!best || t < best.t)) best = { t, ref }; };
    const boxAt = (x, z, w, dd, h) => rayBox(o, d, [x - w / 2, 0, z - dd / 2], [x + w / 2, h, z + dd / 2]);
    this.beds.forEach((b, i) => { if (b.shown) consider(boxAt(b.pos[0], b.pos[1], 2.4 * (b.scale || 1), 2.4 * (b.scale || 1), BED_TOP + Math.max(0.3, b.h || 0)), { type: 'bed', i }); });
    { const [gx, gz, gr] = this.ghPos, [w, dd] = gr % 2 ? [C.GH_SIZE[1], C.GH_SIZE[0]] : C.GH_SIZE; consider(boxAt(gx, gz, w, dd, 3.2), { type: 'gh' }); }
    s.decor.forEach((dc, k) => {
      if (dc.stored) return;
      const [w, dd] = dc.r % 2 ? [C.DECO[dc.id].size[1], C.DECO[dc.id].size[0]] : C.DECO[dc.id].size;
      // kleine Deko etwas großzügiger treffen
      consider(boxAt(dc.x, dc.z, Math.max(w, 0.9), Math.max(dd, 0.9), Math.max(0.6, this.decoMesh(dc.id).h)), { type: 'deco', k });
    });
    return best ? best.ref : null;
  }

  render(env) {
    const cam = this.cameraState();
    // höchstens 12 Lichter: die nächsten zur Bildmitte
    let lights = this.lightList || [];
    const amt = Math.min(1, (env.emis || 0) * 1.15);
    if (lights.length > 12) { const [tx, , tz] = this.cam.target; lights = [...lights].sort((a, b) => Math.hypot(a[0] - tx, a[2] - tz) - Math.hypot(b[0] - tx, b[2] - tz)).slice(0, 12); }
    const arr = this._lightArr || (this._lightArr = new Float32Array(48));
    arr.fill(0); lights.forEach((l, i) => arr.set(l, i * 4));
    this.r.render(cam, { ...env, lights: arr, lightN: amt > 0.01 ? lights.length : 0, lightAmt: amt, shadowCenter: [this.cam.target[0] * 0.5, 0, this.cam.target[2] * 0.5], shadowRadius: 17 }, this.time);
  }

  // ---------- Drehansicht (Sammlung) ----------
  // Liefert Einzelbilder einer Rundum-Ansicht; jedes Bild wird erst bei Bedarf gerendert.
  turntable(kind, id, { shiny = false, stage = 3, frames = 48, size = 320 } = {}) {
    const m = this.iconGeo(kind, id, { shiny, stage });
    if (!m) return null;
    const env = { ...environment(0.3), fogNear: 1e4, fogFar: 2e4, emis: 0, wind: 0 };
    const b = m.geo.bounds();
    const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
    // Radius so wählen, dass das Modell in jeder Drehung ins Bild passt
    const hx = Math.max(Math.abs(b.min[0] - c[0]), Math.abs(b.max[0] - c[0]), Math.abs(b.min[2] - c[2]), Math.abs(b.max[2] - c[2]));
    const rad = Math.max(hx * 1.42, (b.max[1] - b.min[1]) * 0.5) * 1.12;
    const pitch = Math.min(m.pitch, 0.42), dist = rad / Math.tan(0.26);
    const o = this.r.addObject(this.r.mesh(m.geo), m4.identity(), { iconOnly: true, visible: false });
    const cache = [];
    let alive = true;
    return {
      count: frames,
      frame: (i) => {
        if (!alive) return null;
        i = ((Math.round(i) % frames) + frames) % frames;
        if (!cache[i]) {
          const yaw = m.yaw + (i / frames) * PI * 2;
          const eye = [c[0] + Math.sin(yaw) * Math.cos(pitch) * dist, c[1] + Math.sin(pitch) * dist, c[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
          const ld = v3.norm([eye[0] - c[0] - dist * 0.35, eye[1] - c[1] + dist * 0.6, eye[2] - c[2]]);
          cache[i] = this.r.renderCanvas([o], { eye, target: c, fovy: 0.52, near: 0.05, far: 200 }, { ...env, lightDir: ld, skyCol: v3.scale(env.skyCol, 1.08), gndCol: v3.scale(env.gndCol, 1.15) }, size);
        }
        return cache[i];
      },
      dispose: () => { if (!alive) return; alive = false; this.r.removeObject(o); this.r.freeMesh(o.mesh); cache.length = 0; },
    };
  }

  // Modell für Symbole und Drehansicht
  iconGeo(kind, id, { shiny = false, stage = 3 } = {}) {
    const assemble = (rig, legs) => {
      const g = new Geo().add(rig.body);
      if (rig.head) g.add(rig.head, T(...rig.headPos));
      if (rig.tail) g.add(rig.tail, T(...rig.tailPos, 0, -0.25));
      if (legs) rig.legPos.forEach((p) => g.add(rig.leg, T(...p)));
      if (rig.feetPos) rig.feetPos.forEach((p) => g.add(rig.foot, T(...p)));
      return g;
    };
    if (kind === 'flower') {
      if (!SEEDS[id]) return null;
      return { geo: new Geo().add(M.plant(id, stage, shiny, 2, 1)), yaw: PI / 4, pitch: SEEDS[id].model === 'sunflower' ? 0.3 : 0.5 };
    }
    if (kind === 'deco') return M.DECO_MODELS[id] ? { geo: M.DECO_MODELS[id](), yaw: PI / 4, pitch: 0.38 } : null;
    if (kind === 'animal') {
      if (id === 'fox' || id === 'arctic') return { geo: assemble(M.fox(id === 'arctic' ? 'arctic' : 'default'), true), yaw: PI / 3, pitch: 0.38 };
      if (id === 'hedgehog' || id === 'autumn') return { geo: assemble(M.hedgehog(id === 'autumn' ? 'autumn' : 'default')), yaw: PI / 4, pitch: 0.38 };
      if (id === 'owl') { const ow = M.owl(); return { geo: new Geo().add(ow.body).add(ow.head, T(...ow.headPos)), yaw: 0.2, pitch: 0.2 }; }
      if (id === 'butterfly') { const bf = M.butterfly('#5ab4ff', '#ffd23f'); return { geo: new Geo().add(bf.body).add(bf.wingL, T(0, 0, 0, 0, 0, -0.5)).add(bf.wingR, T(0, 0, 0, 0, 0, 0.5)), yaw: 0.3, pitch: 1.0 }; }
    }
    return null;
  }

  // ---------- Symbole für die Oberfläche ----------
  makeIcons() {
    const env = { ...environment(0.3), fogNear: 1e4, fogFar: 2e4, emis: 0, wind: 0 };
    const shot = (geo, opts = {}) => {
      const b = geo.bounds();
      const c = [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.min[2] + b.max[2]) / 2];
      const rad = Math.max(b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]) * 0.62 * (opts.pad || 1);
      const yaw = opts.yaw ?? PI / 4, pitch = opts.pitch ?? 0.38, dist = rad / Math.tan(0.26);
      const eye = [c[0] + Math.sin(yaw) * Math.cos(pitch) * dist, c[1] + Math.sin(pitch) * dist, c[2] + Math.cos(yaw) * Math.cos(pitch) * dist];
      const o = this.r.addObject(this.r.mesh(geo), m4.identity(), { iconOnly: true, visible: false });
      // Licht von schräg vorn-oben (Kameraseite), damit Blütenblätter nicht im Schatten liegen
      const ld = v3.norm([eye[0] - c[0] - dist * 0.35, eye[1] - c[1] + dist * 0.6, eye[2] - c[2]]);
      const url = this.r.renderIcon([o], { eye, target: c, fovy: 0.52, near: 0.05, far: 200 }, { ...env, lightDir: ld, skyCol: v3.scale(env.skyCol, 1.08), gndCol: v3.scale(env.gndCol, 1.15) }, opts.size || 128, opts.bg);
      this.r.removeObject(o); this.r.freeMesh(o.mesh);
      return url;
    };
    const icons = { flower: {}, shiny: {}, deco: {}, animal: {}, skin: {}, bedLvl: {} };
    for (const id of Object.keys(SEEDS)) {
      // Porträt: Blüte groß, leicht von vorn-oben
      const cup = ['tulip', 'rose', 'peony', 'dahlia', 'magnolia', 'hydrangea', 'lavender'].includes(SEEDS[id].model);
      const bg = ICON_BG[SEEDS[id].tier || (SEEDS[id].rare ? 'selten' : SEEDS[id].slow ? 'slow' : 'normal')];
      const o = { yaw: 0.35, pitch: cup ? 0.42 : 0.62, pad: 0.92, size: 160, bg };
      icons.flower[id] = shot(new Geo().add(M.portrait(id, false)), o);
      icons.shiny[id] = shot(new Geo().add(M.portrait(id, true)), { ...o, bg: ICON_BG.shiny });
    }
    for (const id of Object.keys(M.DECO_MODELS)) icons.deco[id] = shot(M.DECO_MODELS[id]());
    const assemble = (rig, legs) => {
      const g = new Geo().add(rig.body);
      if (rig.head) g.add(rig.head, T(...rig.headPos));
      if (rig.tail) g.add(rig.tail, T(...rig.tailPos, 0, -0.25));
      if (legs) rig.legPos.forEach((p) => g.add(rig.leg, T(...p)));
      if (rig.feetPos) rig.feetPos.forEach((p) => g.add(rig.foot, T(...p)));
      return g;
    };
    icons.animal.fox = shot(assemble(M.fox('default'), true), { yaw: PI / 3 });
    icons.skin.arctic = shot(assemble(M.fox('arctic'), true), { yaw: PI / 3 });
    icons.animal.hedgehog = shot(assemble(M.hedgehog('default')), { yaw: PI / 4 });
    icons.skin.autumn = shot(assemble(M.hedgehog('autumn')), { yaw: PI / 4 });
    const ow = M.owl();
    icons.animal.owl = shot(new Geo().add(ow.body).add(ow.head, T(...ow.headPos)), { yaw: 0.2, pitch: 0.2 });
    const bf = M.butterfly('#5ab4ff', '#ffd23f');
    icons.animal.butterfly = shot(new Geo().add(bf.body).add(bf.wingL, T(0, 0, 0, 0, 0, -0.5)).add(bf.wingR, T(0, 0, 0, 0, 0, 0.5)), { yaw: 0.3, pitch: 1.0 });
    icons.bed = shot(M.raisedBed(false));
    for (const l of [1, 2, 3]) icons.bedLvl[l] = shot(M.raisedBed(false, l));
    icons.sprinkler = shot(new Geo().add(M.sprinkler()).add(M.sprinklerHead(), T(0, 0.83, 0)), { pitch: 0.45 });
    icons.greenhouse = shot(M.greenhouse(true), { pitch: 0.42 });
    return icons;
  }
}

// Hintergrundfarben der Blumen-Symbole nach Seltenheit
const ICON_BG = {
  normal: ['#ffffff', '#e4f6d6'], slow: ['#ffffff', '#fdebc8'], selten: ['#ffffff', '#ffe0ec'],
  episch: ['#ffffff', '#e6dcff'], 'legendär': ['#fff9e0', '#ffe39a'], shiny: ['#ffffff', '#fff3b8'],
};

// ---------- Hilfsfunktionen ----------
function mulM(a, b) { return m4.mul(a, b); }

function diskGeo(rx, rz) {
  const g = new Geo();
  const seg = 32, rings = 3, C = [0.3, 0.72, 0.9], E = [0.2, 0.55, 0.78];
  for (let r = 0; r < rings; r++) for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * PI * 2, a1 = ((i + 1) / seg) * PI * 2;
    const f0 = r / rings, f1 = (r + 1) / rings;
    const p = (a, f) => [Math.cos(a) * rx * f, 0, Math.sin(a) * rz * f];
    const c0 = v3.lerp(E, C, f0), c1 = v3.lerp(E, C, f1);
    const n = [0, 1, 0];
    g.triN(p(a0, f0), p(a0, f1), p(a1, f1), n, n, n, c0, c1, c1);
    if (r > 0) g.triN(p(a0, f0), p(a1, f1), p(a1, f0), n, n, n, c0, c1, c0);
  }
  return g;
}

function coinGeo() {
  const g = new Geo();
  g.add(cylinder(0.11, 0.11, 0.035, '#ffd23f', 12), T(0, 0, 0, 0, PI / 2));
  g.add(cylinder(0.07, 0.07, 0.04, '#f0a810', 10), T(0, 0, 0, 0, PI / 2));
  return g;
}
function ringGeo() {
  const g = new Geo(), seg = 24;
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * PI * 2, a1 = ((i + 1) / seg) * PI * 2;
    g.add(box(0.1, 0.02, 0.06, '#c8ffb0'), T(Math.cos((a0 + a1) / 2) * 0.9, 0, Math.sin((a0 + a1) / 2) * 0.9, -(a0 + a1) / 2));
  }
  return g;
}
function heartGeo() {
  const g = new Geo(), c = [1, 0.35, 0.55];
  g.add(sphere(0.09, c, 8, 6), T(-0.07, 0.05, 0));
  g.add(sphere(0.09, c, 8, 6), T(0.07, 0.05, 0));
  g.add(sphere(0.1, c, 8, 6), T(0, -0.04, 0, 0, 0, 0, 1, 1.1, 0.6));
  return g;
}

function rayBox(o, d, mn, mx) {
  let t0 = -Infinity, t1 = Infinity;
  for (let k = 0; k < 3; k++) {
    if (Math.abs(d[k]) < 1e-9) { if (o[k] < mn[k] || o[k] > mx[k]) return null; continue; }
    let a = (mn[k] - o[k]) / d[k], b = (mx[k] - o[k]) / d[k];
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return null;
  }
  return t1 < 0 ? null : Math.max(t0, 0);
}

function raySphere(o, d, c, r) {
  const oc = v3.sub(o, c), b = v3.dot(oc, d), cc = v3.dot(oc, oc) - r * r, h = b * b - cc;
  if (h < 0) return null;
  const t = -b - Math.sqrt(h);
  return t > 0 ? t : null;
}

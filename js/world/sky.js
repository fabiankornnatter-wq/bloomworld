// Tag-Nacht-Zyklus: Sonnenstand, Licht- und Himmelsfarben über den Tag.
// phase: 0 = Sonnenaufgang, ~0.35 = Mittag, ~0.63 = Sonnenuntergang, 0.72–0.95 = Nacht
import { v3, lerp, smooth } from '../engine/math.js';

const K = [
  { p: 0.00, el: 5, az: 110, sun: [1.0, 0.68, 0.5], si: 0.6, sky: [0.52, 0.52, 0.66], gnd: [0.32, 0.28, 0.28], top: [0.46, 0.57, 0.84], fog: [1.0, 0.8, 0.7], emis: 0.35, stars: 0.12, dew: 1.0, ff: 0.0, wind: 0.6 },
  { p: 0.07, el: 17, az: 125, sun: [1.0, 0.88, 0.72], si: 0.68, sky: [0.47, 0.51, 0.63], gnd: [0.33, 0.3, 0.26], top: [0.45, 0.68, 0.94], fog: [0.96, 0.9, 0.82], emis: 0.0, stars: 0.0, dew: 0.85, ff: 0.0, wind: 0.7 },
  { p: 0.18, el: 40, az: 150, sun: [1.0, 0.96, 0.88], si: 0.72, sky: [0.44, 0.5, 0.62], gnd: [0.34, 0.31, 0.25], top: [0.34, 0.62, 0.96], fog: [0.8, 0.89, 0.98], emis: 0.0, stars: 0.0, dew: 0.1, ff: 0.0, wind: 0.9 },
  { p: 0.35, el: 58, az: 190, sun: [1.0, 0.97, 0.9], si: 0.74, sky: [0.43, 0.5, 0.62], gnd: [0.35, 0.32, 0.25], top: [0.3, 0.58, 0.96], fog: [0.78, 0.88, 0.98], emis: 0.0, stars: 0.0, dew: 0.0, ff: 0.0, wind: 1.0 },
  { p: 0.50, el: 34, az: 245, sun: [1.0, 0.91, 0.76], si: 0.72, sky: [0.45, 0.5, 0.6], gnd: [0.35, 0.31, 0.25], top: [0.34, 0.58, 0.92], fog: [0.86, 0.87, 0.9], emis: 0.0, stars: 0.0, dew: 0.0, ff: 0.0, wind: 0.9 },
  { p: 0.60, el: 13, az: 280, sun: [1.0, 0.6, 0.3], si: 0.85, sky: [0.54, 0.45, 0.53], gnd: [0.38, 0.27, 0.23], top: [0.42, 0.47, 0.78], fog: [1.0, 0.68, 0.46], emis: 0.3, stars: 0.0, dew: 0.0, ff: 0.0, wind: 0.6 },
  { p: 0.66, el: 3, az: 292, sun: [1.0, 0.46, 0.27], si: 0.6, sky: [0.47, 0.4, 0.55], gnd: [0.3, 0.23, 0.25], top: [0.3, 0.32, 0.62], fog: [0.93, 0.5, 0.42], emis: 0.75, stars: 0.12, dew: 0.0, ff: 0.2, wind: 0.4 },
  { p: 0.73, el: 46, az: 170, sun: [0.5, 0.58, 0.82], si: 0.55, sky: [0.25, 0.3, 0.47], gnd: [0.15, 0.16, 0.23], top: [0.06, 0.09, 0.22], fog: [0.17, 0.21, 0.35], emis: 1.0, stars: 0.85, dew: 0.0, ff: 1.0, wind: 0.3 },
  { p: 0.90, el: 46, az: 170, sun: [0.5, 0.58, 0.82], si: 0.55, sky: [0.25, 0.3, 0.47], gnd: [0.15, 0.16, 0.23], top: [0.06, 0.09, 0.22], fog: [0.17, 0.21, 0.35], emis: 1.0, stars: 0.85, dew: 0.0, ff: 1.0, wind: 0.3 },
  { p: 0.96, el: 30, az: 140, sun: [0.62, 0.6, 0.74], si: 0.5, sky: [0.36, 0.37, 0.53], gnd: [0.22, 0.21, 0.26], top: [0.2, 0.26, 0.5], fog: [0.56, 0.5, 0.62], emis: 0.75, stars: 0.4, dew: 0.6, ff: 0.3, wind: 0.4 },
];

const dirOf = (el, az) => {
  const e = (el * Math.PI) / 180, a = (az * Math.PI) / 180;
  return [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)];
};

export function phaseName(p) {
  if (p < 0.15 || p >= 0.95) return 'morning';
  if (p < 0.55) return 'day';
  if (p < 0.7) return 'evening';
  return 'night';
}

export const PHASE_LABEL = { morning: 'Morgen', day: 'Tag', evening: 'Abend', night: 'Nacht' };

export function environment(phase) {
  phase = ((phase % 1) + 1) % 1;
  let i = 0;
  while (i < K.length - 1 && K[i + 1].p <= phase) i++;
  const a = K[i], b = i + 1 < K.length ? K[i + 1] : { ...K[0], p: 1 };
  const t = smooth((phase - a.p) / (b.p - a.p || 1));
  const L = (k) => lerp(a[k], b[k], t), C = (k) => v3.lerp(a[k], b[k], t);
  const lightDir = v3.norm(v3.lerp(dirOf(Math.max(a.el, 14), a.az), dirOf(Math.max(b.el, 14), b.az), t));
  // Sichtbare Sonne am Himmel (nur tagsüber)
  const day = phase < 0.69;
  const sunEl = day ? Math.sin((phase / 0.69) * Math.PI) * 60 - 2 : -20;
  const sunAz = 110 + (phase / 0.69) * 185;
  const si = L('si');
  return {
    phase,
    name: phaseName(phase),
    lightDir,
    sunDir: dirOf(sunEl, sunAz),
    sunVis: day ? 1 : 0,
    sunCol: v3.scale(C('sun'), si),
    sunDiscCol: [1, 0.92, 0.75],
    skyCol: C('sky'),
    gndCol: C('gnd'),
    skyTop: C('top'),
    fogCol: C('fog'),
    emis: L('emis'),
    emisCol: [1.0, 0.78, 0.42],
    stars: L('stars'),
    dew: L('dew'),
    fireflies: L('ff'),
    wind: 0.05 * L('wind'),
    fogNear: 34,
    fogFar: 95,
    sat: 1.06,
  };
}

// Klänge und ruhige Hintergrundmusik – komplett im Browser erzeugt (keine Audiodateien nötig).
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Sound {
  constructor() {
    this.ctx = null;
    this.musicOn = true; this.soundOn = true; this.musicVol = 0.5; this.soundVol = 0.8;
    this.night = false;
    this.nextBeat = 0; this.beat = 0; this.timer = null;
  }

  // Muss nach einer Nutzeraktion aufgerufen werden (Browser-Regel für Audio)
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.master = this.ctx.createGain(); this.master.connect(this.ctx.destination);
        this.sfxGain = this.ctx.createGain(); this.sfxGain.connect(this.master);
        this.musicGain = this.ctx.createGain(); this.musicGain.connect(this.master);
        // weiches Echo für die Musik
        this.delay = this.ctx.createDelay(1); this.delay.delayTime.value = 0.36;
        const fb = this.ctx.createGain(); fb.gain.value = 0.28;
        const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
        this.delay.connect(lp); lp.connect(fb); fb.connect(this.delay); lp.connect(this.musicGain);
        this.applyVolumes();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.startMusic();
      return true;
    } catch (e) { console.warn('Audio nicht verfügbar', e); return false; }
  }

  set(opts) {
    Object.assign(this, opts);
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.sfxGain.gain.setTargetAtTime(this.soundOn ? this.soundVol * 0.9 : 0, t, 0.05);
    this.musicGain.gain.setTargetAtTime(this.musicOn ? this.musicVol * 0.35 : 0, t, 0.3);
  }

  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend(); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }

  // ---------- Effekte ----------
  tone(freq, dur, { type = 'sine', vol = 0.3, at = 0, slide = 0, attack = 0.005, dest } = {}) {
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain);
    o.start(t); o.stop(t + dur + 0.05);
  }

  noise(dur, { vol = 0.2, at = 0, freq = 800, q = 1, type = 'lowpass' } = {}) {
    const c = this.ctx, t = c.currentTime + at;
    const len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(); s.buffer = buf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.sfxGain); s.start(t);
  }

  play(name) {
    if (!this.ctx || !this.soundOn) return;
    try {
      switch (name) {
        case 'tap': this.tone(900, 0.06, { type: 'triangle', vol: 0.15, slide: 0.6 }); break;
        case 'open': this.noise(0.18, { vol: 0.12, freq: 1800, type: 'bandpass', q: 0.8 }); this.tone(520, 0.12, { vol: 0.08, slide: 1.5 }); break;
        case 'plant': this.noise(0.12, { vol: 0.35, freq: 500 }); this.tone(240, 0.16, { vol: 0.25, slide: 0.5 }); this.tone(660, 0.1, { type: 'triangle', vol: 0.08, at: 0.08 }); break;
        case 'harvest': [72, 76, 79, 84].forEach((n, i) => this.tone(NOTE(n + 12), 0.22, { type: 'triangle', vol: 0.18, at: i * 0.06 })); this.noise(0.25, { vol: 0.08, freq: 6000, type: 'highpass' }); break;
        case 'coin': this.tone(NOTE(83), 0.08, { type: 'square', vol: 0.06 }); this.tone(NOTE(88), 0.25, { type: 'square', vol: 0.06, at: 0.07 }); break;
        case 'gold': [79, 83, 86, 91, 95].forEach((n, i) => this.tone(NOTE(n), 0.35, { type: 'triangle', vol: 0.16, at: i * 0.07 })); break;
        case 'error': this.tone(220, 0.12, { type: 'triangle', vol: 0.2 }); this.tone(175, 0.18, { type: 'triangle', vol: 0.2, at: 0.11 }); break;
        case 'buy': [76, 81, 88].forEach((n, i) => this.tone(NOTE(n), 0.25, { type: 'triangle', vol: 0.16, at: i * 0.08 })); break;
        case 'level': [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => this.tone(NOTE(n + 12), 0.4, { type: 'triangle', vol: 0.17, at: i * 0.08 })); break;
        case 'animal': this.tone(1200, 0.12, { vol: 0.12, slide: 1.6 }); this.tone(1500, 0.14, { vol: 0.1, slide: 1.4, at: 0.13 }); break;
        case 'unlock': this.noise(0.3, { vol: 0.2, freq: 400 }); [67, 72, 76].forEach((n, i) => this.tone(NOTE(n + 12), 0.3, { type: 'triangle', vol: 0.15, at: 0.1 + i * 0.08 })); break;
      }
    } catch { /* Audio-Fehler nie das Spiel stören lassen */ }
  }

  // ---------- Musik: sanfte Akkorde + Pentatonik-Melodie ----------
  startMusic() {
    if (this.timer || !this.ctx) return;
    this.nextBeat = this.ctx.currentTime + 0.2;
    this.timer = setInterval(() => this.schedule(), 120);
  }

  schedule() {
    const c = this.ctx;
    if (!c || c.state !== 'running') return;
    const spb = this.night ? 0.82 : 0.68; // Sekunden pro Schlag
    const chords = [[48, 55, 64, 67], [45, 52, 60, 64], [41, 48, 57, 60], [43, 50, 59, 62]];
    const scale = [72, 74, 76, 79, 81, 84, 86, 88];
    while (this.nextBeat < c.currentTime + 0.5) {
      const bar = Math.floor(this.beat / 8) % 4, inBar = this.beat % 8;
      const t = this.nextBeat - c.currentTime;
      if (this.musicOn && this.musicVol > 0) {
        if (inBar === 0) {
          for (const n of chords[bar]) this.tone(NOTE(n), spb * 7.5, { type: 'sine', vol: 0.05, at: t, attack: 0.6, dest: this.musicGain });
          this.tone(NOTE(chords[bar][0] - 12), spb * 3.5, { type: 'triangle', vol: 0.07, at: t, attack: 0.05, dest: this.musicGain });
        }
        if (inBar === 4) this.tone(NOTE(chords[bar][0] - 12 + 7), spb * 3, { type: 'triangle', vol: 0.05, at: t, attack: 0.05, dest: this.musicGain });
        const p = this.night ? 0.22 : 0.42;
        if (Math.random() < p) {
          const n = scale[Math.floor(Math.random() * scale.length)];
          this.tone(NOTE(n), spb * 1.6, { type: 'triangle', vol: 0.055, at: t, attack: 0.01, dest: this.delay });
          this.tone(NOTE(n), spb * 1.6, { type: 'sine', vol: 0.05, at: t, attack: 0.01, dest: this.musicGain });
        }
      }
      this.nextBeat += spb / 2;
      this.beat++;
    }
  }
}

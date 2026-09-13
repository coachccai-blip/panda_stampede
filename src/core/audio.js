// Direction sonore (§14) — tout est synthétisé au WebAudio : aucun fichier
// audio à charger, donc aucun asset binaire dans le dépôt.
// La musique est ADDITIVE : plus l'armée grossit, plus de couches entrent.

const BPM = 104;
const STEP = 60 / BPM / 2;     // croche
const LOOKAHEAD = 0.18;

// Pentatonique mineure (do), ambiance asiatique légère.
const SCALE = [261.63, 311.13, 349.23, 392.0, 466.16, 523.25, 622.25, 698.46];

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this.intensity = 0;        // 0 → 4, piloté par la taille de l'armée
    this.playing = false;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.noiseBuffer = null;
    this.mood = 'run';
  }

  init() {
    if (this.ready) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);

      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.42;
      this.musicBus.connect(this.master);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.9;
      this.sfxBus.connect(this.master);

      const len = Math.floor(this.ctx.sampleRate * 1.2);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buf;

      this.ready = true;
      return true;
    } catch (err) {
      console.warn('[audio] indisponible', err);
      return false;
    }
  }

  resume() {
    if (!this.init()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(v) {
    this.muted = !!v;
    if (this.ready) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, t, 0.05);
    }
  }

  setIntensity(level) {
    this.intensity = Math.max(0, Math.min(4, level | 0));
  }

  setMood(mood) {
    this.mood = mood;
  }

  startMusic(mood = 'run') {
    if (!this.init()) return;
    this.resume();
    this.mood = mood;
    if (this.playing) return;
    this.playing = true;
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    const tick = () => {
      if (!this.playing) return;
      try {
        while (this.nextTime < this.ctx.currentTime + LOOKAHEAD) {
          this.scheduleStep(this.step, this.nextTime);
          this.nextTime += STEP;
          this.step = (this.step + 1) % 16;
        }
      } catch { /* on ne casse jamais la boucle de jeu pour du son */ }
      this.timer = window.setTimeout(tick, 30);
    };
    tick();
  }

  stopMusic() {
    this.playing = false;
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = null;
  }

  scheduleStep(step, time) {
    const i = this.intensity;
    const boss = this.mood === 'boss';

    // Couche 0 — taiko grave, toujours présent
    if (step % 4 === 0 || (boss && step % 2 === 0)) this.kick(time, step === 0 ? 1 : 0.75);
    if (step === 6 || step === 14) this.kick(time, 0.5);

    // Couche 1 — bois / rim
    if (i >= 1 && (step === 4 || step === 12)) this.woodblock(time, 0.7);
    if (i >= 1 && boss && step === 10) this.woodblock(time, 0.5);

    // Couche 2 — shaker en croches
    if (i >= 2 && step % 2 === 1) this.shaker(time, 0.35 + (i >= 3 ? 0.1 : 0));

    // Couche 3 — pluck pentatonique (guzheng simplifié)
    if (i >= 3 && (step === 0 || step === 3 || step === 6 || step === 11)) {
      const idx = (step + (boss ? 2 : 0)) % SCALE.length;
      this.pluck(time, SCALE[idx], 0.5);
    }

    // Couche 4 — nappe de gong sur le premier temps
    if (i >= 4 && step === 0) this.gongPad(time, boss ? 0.4 : 0.28);
  }

  // ---------- briques de synthèse ----------

  env(node, time, attack, decay, peak) {
    const g = node.gain;
    g.setValueAtTime(0.0001, time);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0002), time + attack);
    g.exponentialRampToValueAtTime(0.0001, time + attack + decay);
  }

  kick(time, vol = 1) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(150, time);
    o.frequency.exponentialRampToValueAtTime(46, time + 0.16);
    this.env(g, time, 0.005, 0.24, 0.9 * vol);
    o.connect(g); g.connect(this.musicBus);
    o.start(time); o.stop(time + 0.35);
  }

  woodblock(time, vol = 1) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(920, time);
    o.frequency.exponentialRampToValueAtTime(520, time + 0.06);
    this.env(g, time, 0.003, 0.09, 0.35 * vol);
    o.connect(g); g.connect(this.musicBus);
    o.start(time); o.stop(time + 0.16);
  }

  noise(time, dur, freq, q, vol, bus) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    this.env(g, time, 0.004, dur, vol);
    src.connect(f); f.connect(g); g.connect(bus || this.musicBus);
    src.start(time); src.stop(time + dur + 0.05);
  }

  shaker(time, vol = 0.4) {
    this.noise(time, 0.07, 6200, 1.4, vol * 0.5);
  }

  pluck(time, freq, vol = 0.5) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(3400, time);
    f.frequency.exponentialRampToValueAtTime(900, time + 0.3);
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq, time);
    this.env(g, time, 0.006, 0.42, 0.3 * vol);
    o.connect(f); f.connect(g); g.connect(this.musicBus);
    o.start(time); o.stop(time + 0.55);
  }

  gongPad(time, vol = 0.3) {
    [1, 1.5, 2.02].forEach((mult, idx) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = idx === 0 ? 'sine' : 'triangle';
      o.frequency.setValueAtTime(130.8 * mult, time);
      this.env(g, time, 0.25, 1.5, (vol * 0.35) / (idx + 1));
      o.connect(g); g.connect(this.musicBus);
      o.start(time); o.stop(time + 2.2);
    });
  }

  // ---------- effets de jeu ----------

  sfx(name, opts = {}) {
    if (!this.init() || this.muted) return;
    const t = this.ctx.currentTime + 0.005;
    switch (name) {
      case 'pickup': this.blip(t, 780, 0.09, 0.25); break;
      case 'gatePlus': this.blip(t, 620, 0.1, 0.3); this.blip(t + 0.06, 930, 0.1, 0.26); break;
      case 'gateMinus': this.blip(t, 330, 0.16, 0.3, 'sawtooth'); break;
      case 'style': this.sweep(t, 420, 1100, 0.22, 0.3); break;
      case 'fight': this.impact(t, 1.0); break;
      case 'fightLost': this.impact(t, 0.8); this.sweep(t + 0.05, 300, 90, 0.5, 0.35, 'sawtooth'); break;
      case 'tame': this.chime(t, opts.big ? 1 : 0.7); break;
      case 'tamePartial': this.chime(t, 0.45, true); break;
      case 'formation': this.sweep(t, 500, 1600, 0.3, 0.28); this.blip(t + 0.14, 1320, 0.16, 0.22); break;
      case 'boss': this.gongHit(t); break;
      case 'bossHit': this.impact(t, 0.65); break;
      case 'hurt': this.sweep(t, 260, 110, 0.28, 0.3, 'square'); break;
      case 'win': this.fanfare(t); break;
      case 'lose': this.sweep(t, 400, 80, 0.9, 0.35, 'sawtooth'); this.gongHit(t + 0.1, 0.5); break;
      case 'ui': this.blip(t, 540, 0.06, 0.2); break;
      case 'buy': this.blip(t, 660, 0.08, 0.25); this.blip(t + 0.07, 990, 0.12, 0.22); break;
      case 'deny': this.blip(t, 180, 0.14, 0.25, 'square'); break;
      default: break;
    }
  }

  blip(time, freq, dur, vol, type = 'triangle') {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, time);
    this.env(g, time, 0.005, dur, vol);
    o.connect(g); g.connect(this.sfxBus);
    o.start(time); o.stop(time + dur + 0.1);
  }

  sweep(time, from, to, dur, vol, type = 'triangle') {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(from, time);
    o.frequency.exponentialRampToValueAtTime(Math.max(to, 20), time + dur);
    this.env(g, time, 0.01, dur, vol);
    o.connect(g); g.connect(this.sfxBus);
    o.start(time); o.stop(time + dur + 0.1);
  }

  impact(time, vol = 1) {
    // Nuage de poussière « comics » : percussif, franc, sans violence sonore.
    this.noise(time, 0.28, 240, 0.8, 0.5 * vol, this.sfxBus);
    this.noise(time + 0.02, 0.18, 1400, 0.9, 0.25 * vol, this.sfxBus);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(180, time);
    o.frequency.exponentialRampToValueAtTime(52, time + 0.22);
    this.env(g, time, 0.004, 0.3, 0.7 * vol);
    o.connect(g); g.connect(this.sfxBus);
    o.start(time); o.stop(time + 0.4);
  }

  chime(time, vol = 1, minor = false) {
    // Carillon doux et chaleureux pour la conversion (§14).
    const base = 523.25;
    const ratios = minor ? [1, 1.19, 1.5] : [1, 1.25, 1.5, 2];
    ratios.forEach((r, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(base * r, time + i * 0.055);
      this.env(g, time + i * 0.055, 0.01, 0.9 - i * 0.1, 0.3 * vol);
      o.connect(g); g.connect(this.sfxBus);
      o.start(time + i * 0.055); o.stop(time + i * 0.055 + 1.1);
    });
  }

  gongHit(time, vol = 1) {
    [1, 1.48, 2.1, 2.9].forEach((m, i) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.setValueAtTime(98 * m, time);
      this.env(g, time, 0.02, 1.8 - i * 0.25, (0.42 * vol) / (i + 1));
      o.connect(g); g.connect(this.sfxBus);
      o.start(time); o.stop(time + 2.4);
    });
    this.noise(time, 0.5, 900, 0.5, 0.18 * vol, this.sfxBus);
  }

  fanfare(time) {
    [0, 2, 4, 7].forEach((semi, i) => {
      const f = 392 * Math.pow(2, semi / 12);
      this.blip(time + i * 0.11, f, 0.3, 0.3);
    });
    this.gongHit(time + 0.42, 0.8);
  }
}

export const Audio = new AudioEngine();

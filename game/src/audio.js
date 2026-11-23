// WebAudio music + SFX, all synthesized — no audio files.
// Everything is guarded: no context exists until the first user gesture.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.musicTimer = null;
    this.musicStep = 0;
    this.engineOsc = null;
    this.engineGain = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this._startEngineHum();
    } catch (e) {
      this.ctx = null;
    }
  }

  _startEngineHum() {
    if (!this.ctx) return;
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0.0;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineOsc.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.ctx.destination);
    this.engineOsc.start();
  }

  setEngine(speed01) {
    if (!this.engineOsc || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 140, t, 0.08);
    this.engineGain.gain.setTargetAtTime(0.015 + speed01 * 0.05, t, 0.1);
  }

  // A slow sunset-drive loop: warm bass notes with a soft hat tick.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 0, 65.41, 0, 49, 0, 58.27, 0, 55, 0, 65.41, 0, 73.42, 0, 65.41, 0];
    this.musicTimer = setInterval(() => {
      if (!this.ctx || this.muted) return;
      const note = bass[this.musicStep % bass.length];
      if (note) this._tone(note, 0.5, 0.05, 'triangle');
      if (this.musicStep % 2 === 0) this._noiseBurst(0.03, 0.04, 6000);
      if (this.musicStep % 8 === 4) this._tone(220, 0.3, 0.02, 'sine');
      this.musicStep += 1;
    }, 340);
  }

  stopMusic() {
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  _tone(freq, dur, vol, type) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur);
  }

  _noiseBurst(dur, vol, freq) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.ctx.destination);
    src.start(t);
  }

  shot() {
    this._noiseBurst(0.09, 0.25, 900);
    this._tone(140, 0.08, 0.12, 'square');
  }

  crash() {
    this._noiseBurst(0.25, 0.3, 300);
    this._tone(70, 0.25, 0.15, 'sawtooth');
  }

  siren() {
    if (!this.ctx) return;
    this._tone(880, 0.35, 0.05, 'sine');
    setTimeout(() => this._tone(660, 0.35, 0.05, 'sine'), 380);
  }

  pickup() {
    this._tone(660, 0.12, 0.08, 'sine');
    setTimeout(() => this._tone(990, 0.18, 0.08, 'sine'), 110);
  }

  missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this._tone(f, 0.22, 0.09, 'triangle'), i * 120));
  }
}

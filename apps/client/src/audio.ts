import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Zero-asset audio: a small Web Audio synth plays an Indian pentatonic (Bhupali)
 * BGM loop plus a handful of sound effects. No files to fetch, no bandwidth.
 */

const PREF_KEY = 'yaaparam.audio';
type Prefs = { music: boolean; sfx: boolean; volume: number };
const loadPrefs = (): Prefs => {
  try { return { music: true, sfx: true, volume: 0.6, ...JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}') }; }
  catch { return { music: true, sfx: true, volume: 0.6 }; }
};
const savePrefs = (p: Prefs) => { try { localStorage.setItem(PREF_KEY, JSON.stringify(p)); } catch { /* private mode */ } };

// Bhupali (major pentatonic) over two octaves, from Sa=D4.
const SCALE = [293.66, 329.63, 369.99, 440.00, 493.88, 587.33, 659.25, 739.99, 880.00];
// A 16-step melody, indices into SCALE (-1 = rest). Loops with light variation via the tabla underneath.
const MELODY = [0, 2, 4, 2, 5, 4, 2, -1, 4, 5, 7, 5, 4, 2, 0, -1];
const STEP_SEC = 0.28;

class Synth {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  musicGain: GainNode | null = null;
  sfxGain: GainNode | null = null;
  step = 0;
  nextStepTime = 0;
  timer: ReturnType<typeof setInterval> | null = null;
  running = false;

  ensure() {
    if (this.ctx) return this.ctx;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.35;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.9;
    this.sfxGain.connect(this.master);
    return this.ctx;
  }

  setVolume(v: number) { if (this.master) this.master.gain.value = v; }

  /** A short plucked-string style tone: quick attack, exponential decay, gentle detune for a sitar-ish buzz. */
  private pluck(ctx: AudioContext, dest: GainNode, freq: number, t: number, dur: number) {
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth'; osc2.type = 'sawtooth';
    osc.frequency.value = freq; osc2.frequency.value = freq * 1.006;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = freq * 4;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(filt); osc2.connect(filt); filt.connect(g); g.connect(dest);
    osc.start(t); osc2.start(t); osc.stop(t + dur); osc2.stop(t + dur);
  }

  /** A tabla-ish thump: short filtered noise burst + a low sine click. */
  private tabla(ctx: AudioContext, dest: GainNode, t: number, high: boolean) {
    const dur = 0.12;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass'; filt.frequency.value = high ? 1800 : 220; filt.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(high ? 0.35 : 0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    noise.connect(filt); filt.connect(g); g.connect(dest);
    noise.start(t); noise.stop(t + dur);
  }

  private scheduleStep(t: number) {
    if (!this.ctx || !this.musicGain) return;
    const note = MELODY[this.step % MELODY.length]!;
    if (note >= 0) this.pluck(this.ctx, this.musicGain, SCALE[note]!, t, STEP_SEC * 1.6);
    if (this.step % 4 === 0) this.tabla(this.ctx, this.musicGain, t, false);
    else if (this.step % 2 === 0) this.tabla(this.ctx, this.musicGain, t, true);
    this.step++;
  }

  startMusic() {
    const ctx = this.ensure();
    if (ctx.state === 'suspended') void ctx.resume();
    if (this.running) return;
    this.running = true;
    this.nextStepTime = ctx.currentTime + 0.05;
    this.timer = setInterval(() => {
      // Standard look-ahead scheduler: queue any steps due in the next 100ms.
      while (this.nextStepTime < ctx.currentTime + 0.1) {
        this.scheduleStep(this.nextStepTime);
        this.nextStepTime += STEP_SEC;
      }
    }, 40);
  }

  stopMusic() {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  sfx(name: 'dice' | 'buy' | 'coin' | 'jail' | 'victory') {
    const ctx = this.ensure();
    if (ctx.state === 'suspended') void ctx.resume();
    const dest = this.sfxGain!;
    const t = ctx.currentTime;
    if (name === 'dice') {
      for (let i = 0; i < 5; i++) this.tabla(ctx, dest, t + i * 0.05, true);
    } else if (name === 'coin' || name === 'buy') {
      [880, 1318.5].forEach((f, i) => this.pluck(ctx, dest, f, t + i * 0.06, 0.35));
    } else if (name === 'jail') {
      [220, 196].forEach((f, i) => this.pluck(ctx, dest, f, t + i * 0.1, 0.3));
    } else if (name === 'victory') {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.pluck(ctx, dest, f, t + i * 0.12, 0.6));
    }
  }
}

const synth = new Synth();

export function useAudio() {
  const [prefs, setPrefs] = useState(loadPrefs);
  const started = useRef(false);

  useEffect(() => { synth.setVolume(prefs.volume); savePrefs(prefs); }, [prefs]);

  useEffect(() => {
    if (prefs.music && started.current) synth.startMusic();
    else synth.stopMusic();
  }, [prefs.music]);

  // Music needs a user gesture to start (autoplay policy); arm it on first tap/key anywhere.
  useEffect(() => {
    if (started.current) return;
    const arm = () => {
      started.current = true;
      if (prefs.music) synth.startMusic();
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
    };
    window.addEventListener('pointerdown', arm, { once: true });
    window.addEventListener('keydown', arm, { once: true });
    return () => { window.removeEventListener('pointerdown', arm); window.removeEventListener('keydown', arm); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMusic = useCallback(() => setPrefs((p) => ({ ...p, music: !p.music })), []);
  const toggleSfx = useCallback(() => setPrefs((p) => ({ ...p, sfx: !p.sfx })), []);
  const setVolume = useCallback((volume: number) => setPrefs((p) => ({ ...p, volume })), []);
  const play = useCallback((name: 'dice' | 'buy' | 'coin' | 'jail' | 'victory') => {
    if (prefs.sfx) synth.sfx(name);
  }, [prefs.sfx]);

  return { music: prefs.music, sfxOn: prefs.sfx, volume: prefs.volume, toggleMusic, toggleSfx, setVolume, play };
}
export type Audio = ReturnType<typeof useAudio>;

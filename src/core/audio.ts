/**
 * Sound-effect sink handed to the game via GameContext.audio. Concrete impls
 * are WebAudioBus (real playback) and SilentBus (no-op, for tests/muting).
 */
export interface AudioBus {
  /** Play the SFX registered under `sfxKey`; `opts` tunes it (e.g. weapon, size). */
  play(sfxKey: string, opts?: Record<string, number>): void;
  /** Enable/disable all playback (mute toggle). */
  setEnabled(enabled: boolean): void;
}
/** Numeric tuning parameters for one SFX play call (meaning is per-SFX). */
export type SfxOpts = Record<string, number>;
/** A registered sound effect: its lookup `key` and a synth routine. */
export interface SfxDef {
  key: string;                                        // registry key, e.g. 'shoot' | 'explosion'
  play(ac: AudioContext, opts: SfxOpts): void;        // synthesize+schedule the sound on `ac` now
}

/** Registry of sound effects by key, populated by registerSfx() below. */
const SFX = new Map<string, SfxDef>();
/** Add (or replace) a sound effect definition in the SFX registry. */
export function registerSfx(def: SfxDef): void { SFX.set(def.key, def); }

let audioCtx: AudioContext | null = null;   // lazily-created shared AudioContext (null until first sound)
/**
 * Lazily create (and resume) the shared AudioContext. Returns null when the
 * browser has no Web Audio support. Resuming handles browsers that start the
 * context suspended until a user gesture.
 */
export function getAudio(): AudioContext | null {
  if (!audioCtx) {
    // Prefer standard AudioContext, fall back to webkit-prefixed (older Safari).
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AC = w.AudioContext || w.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/** AudioBus that synthesizes SFX through the Web Audio API. */
export class WebAudioBus implements AudioBus {
  enabled = true;              // when false, play() is a no-op (mute)
  play(sfxKey: string, opts?: SfxOpts): void {
    if (!this.enabled) return;
    const def = SFX.get(sfxKey);
    if (!def) return;          // unknown key → silently ignore
    try {
      const ac = getAudio();
      if (!ac) return;
      def.play(ac, opts ?? {});
    } catch { /* ignore */ }   // never let an audio glitch crash the game loop
  }
  setEnabled(v: boolean): void { this.enabled = v; }
}

/** No-op AudioBus for headless tests or when sound is unavailable. */
export class SilentBus implements AudioBus {
  play(_sfxKey: string, _opts?: SfxOpts): void {}
  setEnabled(_enabled: boolean): void {}
}

/** All currently-registered SFX keys (used to assert registry contents in tests). */
export function SFX_REGISTRY_KEYS(): string[] { return [...SFX.keys()]; }

registerSfx({
  key: 'shoot',
  play(ac, opts) {
    const weapon = opts.weapon ?? 0;      // weapon index selects timbre/pitch (0=vulcan, 1=laser, 2=plasma…)
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    if (weapon === 1) {
      // Laser: falling square-wave chirp over 0.15s.
      osc.type = 'square';
      osc.frequency.setValueAtTime(520 + Math.random() * 60, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(260, ac.currentTime + 0.14);
      gain.gain.setValueAtTime(0.10, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
      osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.15);
    } else {
      // Default shot: short blip that drops to half its base pitch.
      osc.type = 'square';
      const base = [880, 440, 660][weapon];   // base frequency (Hz) per weapon index
      osc.frequency.setValueAtTime(base + Math.random() * 40, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(base * 0.5, ac.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.1);
      osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.1);
    }
  },
});

registerSfx({
  key: 'explosion',
  play(ac, opts) {
    const size = opts.size ?? 1;          // explosion scale: larger = louder + lower-passed
    const len = ac.sampleRate * 0.4;      // 0.4s of noise samples
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    // Fill with white noise that fades out linearly over the buffer.
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();
    src.buffer = buf;
    filter.type = 'lowpass';
    filter.frequency.value = 300 + size * 200;   // bigger blasts let through lower rumble
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
    gain.gain.setValueAtTime(Math.min(1, 0.15 + size * 0.1), ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
    src.start(ac.currentTime);
  },
});

registerSfx({
  key: 'powerup',
  play(ac) {
    // Rising three-note arpeggio (C5-E5-G5), each note staggered by 0.09s.
    [523, 659, 784].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ac.currentTime + i * 0.09;   // note start time
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.start(t); osc.stop(t + 0.16);
    });
  },
});

registerSfx({
  key: 'bomb',
  play(ac) {
    const len = ac.sampleRate * 1.0;      // 1s of noise
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();
    src.buffer = buf;
    filter.type = 'lowpass';
    // Filter sweeps up (whoosh) then back down (rumble) for the bomb boom.
    filter.frequency.setValueAtTime(80, ac.currentTime);
    filter.frequency.linearRampToValueAtTime(900, ac.currentTime + 0.3);
    filter.frequency.exponentialRampToValueAtTime(50, ac.currentTime + 1.0);
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
    gain.gain.setValueAtTime(0.6, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 1.0);
    src.start(ac.currentTime);
  },
});

/**
 * Sound-effect sink handed to the game via GameContext.audio. Concrete impls
 * are WebAudioBus (real playback) and SilentBus (no-op, for tests/muting).
 */
export interface AudioBus {
  /** Play the SFX registered under `sfxKey`; `opts` tunes it (e.g. weapon, size). */
  play(sfxKey: string, opts?: Record<string, number>): void;
  /** Enable/disable all playback (mute toggle). */
  setEnabled(enabled: boolean): void;
  /** Scale this bus's output level, 0..1. */
  setVolume(v: number): void;
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

let masterGain: GainNode | null = null;   // shared output node; SFX + music connect here
let masterVolume = 0.7;                    // 0..1, applied to masterGain

/** Lazily create the shared master GainNode (SFX + music route through it). Null when no AudioContext. */
export function getMasterGain(): GainNode | null {
  const ac = getAudio();
  if (!ac) return null;
  if (!masterGain) {
    masterGain = ac.createGain();
    masterGain.gain.value = masterVolume;
    masterGain.connect(ac.destination);
  }
  return masterGain;
}

/** Current master volume (0..1). */
export function getMasterVolume(): number { return masterVolume; }

/** Set master volume (clamped 0..1) and apply it to the live master gain if present. */
export function setMasterVolume(v: number): void {
  masterVolume = Math.max(0, Math.min(1, v));
  if (masterGain) masterGain.gain.value = masterVolume;
}

/** Output node SFX/music should connect to: master gain, or destination as a fallback. */
export function outputNode(): AudioNode | null {
  return getMasterGain() ?? getAudio()?.destination ?? null;
}

/** AudioBus that synthesizes SFX through the Web Audio API. */
export class WebAudioBus implements AudioBus {
  enabled = true;              // when false, play() is a no-op (mute)
  private sfxVol = 1.0;
  setVolume(v: number): void { this.sfxVol = Math.max(0, Math.min(1, v)); }
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
  setVolume(_v: number): void {}
}

/** All currently-registered SFX keys (used to assert registry contents in tests). */
export function SFX_REGISTRY_KEYS(): string[] { return [...SFX.keys()]; }

registerSfx({
  key: 'shoot',
  play(ac, opts) {
    const weapon = opts.weapon ?? 0;      // weapon index selects timbre/pitch (0=vulcan, 1=spread, 2=missile, 3=plasma)
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(outputNode() ?? ac.destination);
    if (weapon === 1) {
      // Laser: falling square-wave chirp over 0.15s.
      osc.type = 'square';
      osc.frequency.setValueAtTime(520 + Math.random() * 60, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(260, ac.currentTime + 0.14);
      gain.gain.setValueAtTime(0.10, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
      osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.15);
    } else if (weapon === 3) {
      // Plasma: bright sawtooth crackle with a fast upward chirp.
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(700, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, ac.currentTime + 0.06);
      gain.gain.setValueAtTime(0.09, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.09);
      osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.09);
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
    src.connect(filter); filter.connect(gain); gain.connect(outputNode() ?? ac.destination);
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
      osc.connect(gain); gain.connect(outputNode() ?? ac.destination);
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
    const t0 = ac.currentTime;

    // Layer 1: sharp initial crack — a short, bright noise burst for the flash's impact.
    const crackLen = ac.sampleRate * 0.12;
    const crackBuf = ac.createBuffer(1, crackLen, ac.sampleRate);
    const cd = crackBuf.getChannelData(0);
    for (let i = 0; i < crackLen; i++) cd[i] = (Math.random() * 2 - 1) * (1 - i / crackLen);
    const crackSrc = ac.createBufferSource();
    const crackFilter = ac.createBiquadFilter();
    const crackGain = ac.createGain();
    crackSrc.buffer = crackBuf;
    crackFilter.type = 'highpass';
    crackFilter.frequency.value = 1200;
    crackSrc.connect(crackFilter); crackFilter.connect(crackGain); crackGain.connect(outputNode() ?? ac.destination);
    crackGain.gain.setValueAtTime(0.9, t0);
    crackGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
    crackSrc.start(t0);

    // Layer 2: deep sub-bass boom — pitch-dropping sine for weight and body.
    const boomOsc = ac.createOscillator();
    const boomGain = ac.createGain();
    boomOsc.type = 'sine';
    boomOsc.connect(boomGain); boomGain.connect(outputNode() ?? ac.destination);
    boomOsc.frequency.setValueAtTime(150, t0);
    boomOsc.frequency.exponentialRampToValueAtTime(35, t0 + 0.6);
    boomGain.gain.setValueAtTime(1.0, t0);
    boomGain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.1);
    boomOsc.start(t0); boomOsc.stop(t0 + 1.1);

    // Layer 3: long noise rumble, filter sweeping up (whoosh) then back down (decay).
    const len = ac.sampleRate * 1.4;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();
    src.buffer = buf;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(100, t0);
    filter.frequency.linearRampToValueAtTime(1400, t0 + 0.25);
    filter.frequency.exponentialRampToValueAtTime(45, t0 + 1.4);
    src.connect(filter); filter.connect(gain); gain.connect(outputNode() ?? ac.destination);
    gain.gain.setValueAtTime(0.8, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 1.4);
    src.start(t0);

    // Layer 4: descending siren sweep riding on top, for a dramatic sci-fi edge.
    const sirenOsc = ac.createOscillator();
    const sirenFilter = ac.createBiquadFilter();
    const sirenGain = ac.createGain();
    sirenOsc.type = 'sawtooth';
    sirenFilter.type = 'lowpass';
    sirenFilter.frequency.value = 2200;
    sirenOsc.connect(sirenFilter); sirenFilter.connect(sirenGain); sirenGain.connect(outputNode() ?? ac.destination);
    sirenOsc.frequency.setValueAtTime(900, t0);
    sirenOsc.frequency.exponentialRampToValueAtTime(120, t0 + 0.7);
    sirenGain.gain.setValueAtTime(0.001, t0);
    sirenGain.gain.linearRampToValueAtTime(0.25, t0 + 0.05);
    sirenGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.75);
    sirenOsc.start(t0); sirenOsc.stop(t0 + 0.75);
  },
});

registerSfx({
  key: 'graze',
  play(ac) {
    // Soft, very short high tick.
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    const out = outputNode() ?? ac.destination;
    osc.connect(gain); gain.connect(out);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, ac.currentTime);
    gain.gain.setValueAtTime(0.05, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.05);
    osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.06);
  },
});

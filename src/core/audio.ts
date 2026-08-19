export interface AudioBus {
  play(sfxKey: string, opts?: Record<string, number>): void;
  setEnabled(enabled: boolean): void;
}
export type SfxOpts = Record<string, number>;
export interface SfxDef { key: string; play(ac: AudioContext, opts: SfxOpts): void; }

const SFX = new Map<string, SfxDef>();
export function registerSfx(def: SfxDef): void { SFX.set(def.key, def); }

let audioCtx: AudioContext | null = null;
export function getAudio(): AudioContext | null {
  if (!audioCtx) {
    const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const AC = w.AudioContext || w.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export class WebAudioBus implements AudioBus {
  enabled = true;
  play(sfxKey: string, opts?: SfxOpts): void {
    if (!this.enabled) return;
    const def = SFX.get(sfxKey);
    if (!def) return;
    try {
      const ac = getAudio();
      if (!ac) return;
      def.play(ac, opts ?? {});
    } catch { /* ignore */ }
  }
  setEnabled(v: boolean): void { this.enabled = v; }
}

export class SilentBus implements AudioBus {
  play(_sfxKey: string, _opts?: SfxOpts): void {}
  setEnabled(_enabled: boolean): void {}
}

export function SFX_REGISTRY_KEYS(): string[] { return [...SFX.keys()]; }

registerSfx({
  key: 'shoot',
  play(ac, opts) {
    const weapon = opts.weapon ?? 0;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    if (weapon === 1) {
      osc.type = 'square';
      osc.frequency.setValueAtTime(520 + Math.random() * 60, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(260, ac.currentTime + 0.14);
      gain.gain.setValueAtTime(0.10, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
      osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.15);
    } else {
      osc.type = 'square';
      const base = [880, 440, 660][weapon];
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
    const size = opts.size ?? 1;
    const len = ac.sampleRate * 0.4;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();
    src.buffer = buf;
    filter.type = 'lowpass';
    filter.frequency.value = 300 + size * 200;
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
    gain.gain.setValueAtTime(Math.min(1, 0.15 + size * 0.1), ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
    src.start(ac.currentTime);
  },
});

registerSfx({
  key: 'powerup',
  play(ac) {
    [523, 659, 784].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ac.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.start(t); osc.stop(t + 0.16);
    });
  },
});

registerSfx({
  key: 'bomb',
  play(ac) {
    const len = ac.sampleRate * 1.0;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    const gain = ac.createGain();
    src.buffer = buf;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(80, ac.currentTime);
    filter.frequency.linearRampToValueAtTime(900, ac.currentTime + 0.3);
    filter.frequency.exponentialRampToValueAtTime(50, ac.currentTime + 1.0);
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
    gain.gain.setValueAtTime(0.6, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 1.0);
    src.start(ac.currentTime);
  },
});

// Deprecated delegates: the old Player.ts/Powerup.ts/Bullet.ts/particles callers
// still import these until Tasks 5-8 migrate them. Deleted in Task 8. They honor g.soundOn.
const deprecatedBus = new WebAudioBus();
export function sfxShoot(weapon: number, g: { soundOn: boolean }): void {
  if (!g.soundOn) return;
  deprecatedBus.play('shoot', { weapon });
}
export function sfxExplosion(size: number, g: { soundOn: boolean }): void {
  if (!g.soundOn) return;
  deprecatedBus.play('explosion', { size });
}
export function sfxPowerup(g: { soundOn: boolean }): void {
  if (!g.soundOn) return;
  deprecatedBus.play('powerup');
}
export function sfxBomb(g: { soundOn: boolean }): void {
  if (!g.soundOn) return;
  deprecatedBus.play('bomb');
}

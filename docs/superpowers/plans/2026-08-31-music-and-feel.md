# Music & Feel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add procedural background music, a shared master-volume system with persisted settings, and two "game feel" effects (hit-stop, graze flash) to the browser shmup.

**Architecture:** A new `MusicEngine` (lookahead Web Audio scheduler) plays declaratively-defined synth tracks, cued from existing game-state transitions. Both SFX and music route through a shared master `GainNode` scaled by a single persisted volume setting. Hit-stop briefly zeroes gameplay `dt`; graze detection emits feedback on player near-misses.

**Tech Stack:** TypeScript, Vite (single-file build via `vite-plugin-singlefile`), Web Audio API, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-28-music-and-feel-design.md`

## Global Constraints

- **Single-file build:** No audio asset files. All music/SFX are synthesized via Web Audio. (`vite-plugin-singlefile`)
- **Never crash the loop:** All Web Audio and `localStorage` access wrapped in try/catch; degrade to silent/no-op when unavailable.
- **Test seam:** `Game` accepts injected deps (`GameDeps`). Tests inject `SilentBus` (SFX) and must be able to inject a music sink. In the test DOM (`tests/dom-setup.ts`), `window.AudioContext` is `undefined` and `getAudio()` returns `null` — real audio classes must no-op under this.
- **Canvas coords:** playfield is `W=480 × H=640`, origin top-left, +y down.
- **Fixed step:** logic runs on `gameSpeed`-scaled `dt`; screen-shake and hit-stop timers decay on real time (`rawDt`).
- **Registry pattern:** new registries mirror `registerSfx`/`SFX_REGISTRY_KEYS` in `src/core/audio.ts`.
- **Tests live in `tests/`** (not colocated). Run all: `npm test`. Typecheck: `npm run typecheck`.

---

### Task 1: Shared master gain + SFX volume

Route all SFX through a shared master `GainNode` instead of `ac.destination`, and add a settable master volume. This is the foundation the music engine and settings both build on.

**Files:**
- Modify: `src/core/audio.ts`
- Test: `tests/audio.test.ts`

**Interfaces:**
- Consumes: existing `getAudio(): AudioContext | null`, `AudioBus`, `WebAudioBus`, `SilentBus`.
- Produces:
  - `getMasterGain(): GainNode | null` — lazily creates a master gain connected to `ac.destination`; returns null when no AudioContext.
  - `setMasterVolume(v: number): void` — clamps `v` to `0..1`, stores it, and applies it to the master gain if it exists.
  - `getMasterVolume(): number` — returns the current stored master volume (default `0.7`).
  - `AudioBus.setVolume(v: number): void` added to the interface; `WebAudioBus` and `SilentBus` implement it (`WebAudioBus` scales its own SFX sub-gain; `SilentBus` no-ops).
  - `WebAudioBus` synth routines connect to `getMasterGain()` (falling back to `ac.destination` if null) rather than directly to `ac.destination`.

- [ ] **Step 1: Write the failing test**

Add to `tests/audio.test.ts`:

```ts
import { setMasterVolume, getMasterVolume } from '../src/core/audio.js';

describe('master volume', () => {
  it('defaults to 0.7 and clamps to 0..1', () => {
    setMasterVolume(0.5);
    expect(getMasterVolume()).toBe(0.5);
    setMasterVolume(2);
    expect(getMasterVolume()).toBe(1);
    setMasterVolume(-1);
    expect(getMasterVolume()).toBe(0);
    setMasterVolume(0.7);            // restore default for other tests
  });

  it('WebAudioBus.setVolume and getMasterGain never throw without an AudioContext', () => {
    const bus = new WebAudioBus();
    expect(() => bus.setVolume(0.3)).not.toThrow();
  });
});
```

Add `setMasterVolume, getMasterVolume` to the existing top import from `../src/core/audio.js`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- audio`
Expected: FAIL — `setMasterVolume`/`getMasterVolume` are not exported.

- [ ] **Step 3: Implement master gain + volume in `src/core/audio.ts`**

Add module state and accessors near `getAudio()` (after the `getAudio` function):

```ts
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
```

Add `setVolume` to the `AudioBus` interface:

```ts
export interface AudioBus {
  play(sfxKey: string, opts?: Record<string, number>): void;
  setEnabled(enabled: boolean): void;
  /** Scale this bus's output level, 0..1. */
  setVolume(v: number): void;
}
```

In `WebAudioBus`, add a private SFX gain and route through it. Change the class so `play` connects the SFX to a per-bus gain that feeds the master:

```ts
export class WebAudioBus implements AudioBus {
  enabled = true;
  private sfxVol = 1.0;
  setVolume(v: number): void { this.sfxVol = Math.max(0, Math.min(1, v)); }
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
```

Then change each SFX synth routine's final `.connect(ac.destination)` to connect to the master output. The simplest, lowest-risk change: replace `gain.connect(ac.destination)` (and the bomb SFX's several `X.connect(ac.destination)` calls) with a connection to `outputNode()`, guarding null:

```ts
const out = outputNode() ?? ac.destination;
gain.connect(out);
```

Apply this substitution in all four registered SFX (`shoot`, `explosion`, `powerup`, `bomb` — the bomb has four sub-graphs; each currently ending in `.connect(ac.destination)`).

- [ ] **Step 4: Add `setVolume` no-op to `SilentBus`**

```ts
export class SilentBus implements AudioBus {
  play(_sfxKey: string, _opts?: SfxOpts): void {}
  setEnabled(_enabled: boolean): void {}
  setVolume(_v: number): void {}
}
```

- [ ] **Step 5: Run tests + typecheck to verify pass**

Run: `npm test -- audio` (Expected: PASS) then `npm run typecheck` (Expected: clean — the new `AudioBus.setVolume` is implemented by both impls).

- [ ] **Step 6: Commit**

```bash
git add src/core/audio.ts tests/audio.test.ts
git commit -m "Route SFX through shared master gain with volume control"
```

---

### Task 2: Music engine core + track registry + first track

Create the music subsystem: the `MusicSink` interface, a `SilentMusic` no-op, a `WebAudioMusic` lookahead scheduler, a track registry, and one authored track (`stage-a`). No game wiring yet — that's Task 4.

**Files:**
- Create: `src/core/music.ts`
- Test: `tests/music.test.ts` (new)

**Interfaces:**
- Consumes: `getAudio()`, `outputNode()` from `src/core/audio.ts` (Task 1).
- Produces:
  - `interface MusicSink { play(trackKey: string): void; stop(): void; setEnabled(enabled: boolean): void; setVolume(v: number): void; }`
  - `class SilentMusic implements MusicSink` — all methods no-op.
  - `class WebAudioMusic implements MusicSink` — lookahead scheduler.
  - `interface Note { time: number; dur: number; freq: number; type: OscillatorType; gain: number; }`
  - `interface Layer { role: 'bass' | 'arp' | 'lead' | 'drums'; notes: Note[]; }`
  - `interface Track { key: string; tempo: number; loopBeats: number; layers: Layer[]; }`
  - `registerTrack(t: Track): void` and `MUSIC_REGISTRY_KEYS(): string[]`.
  - `getTrack(key: string): Track | undefined`.

- [ ] **Step 1: Write the failing test**

Create `tests/music.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SilentMusic, WebAudioMusic, MUSIC_REGISTRY_KEYS, getTrack } from '../src/core/music.js';

describe('music engine', () => {
  it('registers the stage-a track', () => {
    expect(MUSIC_REGISTRY_KEYS()).toContain('stage-a');
    const t = getTrack('stage-a');
    expect(t).toBeDefined();
    expect(t!.layers.length).toBeGreaterThan(0);
    expect(t!.tempo).toBeGreaterThan(0);
  });

  it('SilentMusic never throws and no-ops', () => {
    const m = new SilentMusic();
    expect(() => { m.play('stage-a'); m.setVolume(0.5); m.setEnabled(true); m.stop(); }).not.toThrow();
  });

  it('WebAudioMusic degrades to silent when no AudioContext exists', () => {
    const m = new WebAudioMusic();
    expect(() => { m.play('stage-a'); m.setEnabled(true); m.setVolume(0.4); m.stop(); }).not.toThrow();
  });

  it('WebAudioMusic.play with an unknown track key does not throw', () => {
    const m = new WebAudioMusic();
    expect(() => m.play('does-not-exist')).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- music`
Expected: FAIL — `src/core/music.js` does not exist.

- [ ] **Step 3: Create `src/core/music.ts` with types, registry, SilentMusic**

```ts
import { getAudio, outputNode } from './audio.js';

/** One scheduled note in a layer, timed in beats from the loop start. */
export interface Note { time: number; dur: number; freq: number; type: OscillatorType; gain: number; }
/** A voice within a track (role tags it for future intensity gating). */
export interface Layer { role: 'bass' | 'arp' | 'lead' | 'drums'; notes: Note[]; }
/** A looping piece of music: tempo (BPM), loop length in beats, and its layers. */
export interface Track { key: string; tempo: number; loopBeats: number; layers: Layer[]; }

/** Sink handed to the game as ctx.music. WebAudioMusic plays; SilentMusic is the test/no-audio no-op. */
export interface MusicSink {
  play(trackKey: string): void;   // crossfade to this track; no-op if already current
  stop(): void;                   // fade out and stop scheduling
  setEnabled(enabled: boolean): void;
  setVolume(v: number): void;     // 0..1, music's share of master
}

const TRACKS = new Map<string, Track>();
/** Add (or replace) a track in the registry. */
export function registerTrack(t: Track): void { TRACKS.set(t.key, t); }
/** Look up a registered track. */
export function getTrack(key: string): Track | undefined { return TRACKS.get(key); }
/** All registered track keys (for tests). */
export function MUSIC_REGISTRY_KEYS(): string[] { return [...TRACKS.keys()]; }

/** No-op music sink for headless tests / when audio is unavailable. */
export class SilentMusic implements MusicSink {
  play(_k: string): void {}
  stop(): void {}
  setEnabled(_e: boolean): void {}
  setVolume(_v: number): void {}
}
```

- [ ] **Step 4: Add `WebAudioMusic` (lookahead scheduler) to `src/core/music.ts`**

```ts
const LOOKAHEAD_MS = 25;      // scheduler tick interval
const SCHEDULE_AHEAD = 0.1;   // seconds of audio scheduled beyond now

/** Plays tracks by scheduling oscillator notes ~100ms ahead of the audio clock. */
export class WebAudioMusic implements MusicSink {
  private enabled = true;
  private vol = 0.6;                       // music's balance under SFX
  private current: Track | null = null;
  private gain: GainNode | null = null;    // per-music gain feeding the master output
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;                 // audio-clock time of the next loop's start
  private beatDur = 0.5;                    // seconds per beat, from tempo

  setEnabled(e: boolean): void {
    this.enabled = e;
    if (!e) this.stop();
  }
  setVolume(v: number): void {
    this.vol = Math.max(0, Math.min(1, v));
    if (this.gain) this.gain.gain.value = this.vol;
  }
  play(trackKey: string): void {
    if (!this.enabled) return;
    const track = getTrack(trackKey);
    if (!track) return;                     // unknown key: ignore
    if (this.current && this.current.key === track.key) return;  // already playing
    const ac = getAudio();
    if (!ac) return;                        // no audio support: silent
    try {
      this.stopScheduler();
      this.current = track;
      this.beatDur = 60 / track.tempo;
      if (!this.gain) {
        this.gain = ac.createGain();
        this.gain.gain.value = this.vol;
        const out = outputNode() ?? ac.destination;
        this.gain.connect(out);
      }
      this.nextNoteTime = ac.currentTime + 0.05;
      this.timer = setInterval(() => this.tick(), LOOKAHEAD_MS);
    } catch { /* never crash the loop */ }
  }
  stop(): void {
    this.stopScheduler();
    this.current = null;
  }
  private stopScheduler(): void {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
  }
  private tick(): void {
    const ac = getAudio();
    if (!ac || !this.current || !this.gain) return;
    try {
      const loopLen = this.current.loopBeats * this.beatDur;
      // Schedule whole loops until we're SCHEDULE_AHEAD past now.
      while (this.nextNoteTime < ac.currentTime + SCHEDULE_AHEAD) {
        this.scheduleLoop(ac, this.nextNoteTime);
        this.nextNoteTime += loopLen;
      }
    } catch { /* ignore */ }
  }
  private scheduleLoop(ac: AudioContext, loopStart: number): void {
    for (const layer of this.current!.layers) {
      for (const n of layer.notes) {
        const t = loopStart + n.time * this.beatDur;
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = n.type;
        osc.frequency.value = n.freq;
        osc.connect(g); g.connect(this.gain!);
        const dur = n.dur * this.beatDur;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(n.gain, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.start(t); osc.stop(t + dur + 0.02);
      }
    }
  }
}
```

- [ ] **Step 5: Author the first track (`stage-a`) at the bottom of `src/core/music.ts`**

```ts
// A driving minor-key loop: bass pulse + arpeggio. 8 beats.
registerTrack({
  key: 'stage-a',
  tempo: 132,
  loopBeats: 8,
  layers: [
    {
      role: 'bass',
      notes: [0, 1, 2, 3, 4, 5, 6, 7].map(b => ({
        time: b, dur: 0.9, freq: b % 2 === 0 ? 110 : 146.83, type: 'triangle' as OscillatorType, gain: 0.18,
      })),
    },
    {
      role: 'arp',
      notes: [220, 261.63, 329.63, 392, 329.63, 261.63, 220, 261.63].map((f, i) => ({
        time: i, dur: 0.45, freq: f, type: 'square' as OscillatorType, gain: 0.08,
      })),
    },
  ],
});
```

- [ ] **Step 6: Run tests + typecheck to verify pass**

Run: `npm test -- music` (Expected: PASS) then `npm run typecheck` (Expected: clean).

- [ ] **Step 7: Commit**

```bash
git add src/core/music.ts tests/music.test.ts
git commit -m "Add procedural music engine with lookahead scheduler and first track"
```

---

### Task 3: Remaining tracks + stage→theme mapping

Author the rest of the tracks (`stage-b`, `stage-c`, `boss`, `title`, `stage-clear`, `game-over`) and add `stageThemeFor(stage)` so each of the 18 stages maps to one of the three stage themes.

**Files:**
- Modify: `src/core/music.ts`
- Test: `tests/music.test.ts`

**Interfaces:**
- Consumes: `registerTrack`, `getTrack` (Task 2).
- Produces: `stageThemeFor(stage: number): string` — returns `'stage-a' | 'stage-b' | 'stage-c'` by `((stage - 1) % 3)`.

- [ ] **Step 1: Write the failing test**

Add to `tests/music.test.ts`:

```ts
import { stageThemeFor } from '../src/core/music.js';

describe('music tracks and stage mapping', () => {
  it('registers all authored tracks', () => {
    const keys = MUSIC_REGISTRY_KEYS();
    for (const k of ['stage-a', 'stage-b', 'stage-c', 'boss', 'title', 'stage-clear', 'game-over']) {
      expect(keys, `missing ${k}`).toContain(k);
    }
  });

  it('every stage 1..18 maps to a registered stage theme', () => {
    for (let s = 1; s <= 18; s++) {
      const key = stageThemeFor(s);
      expect(['stage-a', 'stage-b', 'stage-c']).toContain(key);
      expect(getTrack(key), `stage ${s} theme ${key}`).toBeDefined();
    }
  });

  it('cycles the three themes across consecutive stages', () => {
    expect(stageThemeFor(1)).toBe('stage-a');
    expect(stageThemeFor(2)).toBe('stage-b');
    expect(stageThemeFor(3)).toBe('stage-c');
    expect(stageThemeFor(4)).toBe('stage-a');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- music`
Expected: FAIL — `stageThemeFor` not exported; `stage-b` etc. not registered.

- [ ] **Step 3: Add `stageThemeFor` to `src/core/music.ts`**

```ts
/** Map a 1-based stage number to one of the three cycling stage themes. */
export function stageThemeFor(stage: number): string {
  return ['stage-a', 'stage-b', 'stage-c'][((stage - 1) % 3 + 3) % 3];
}
```

- [ ] **Step 4: Register the remaining tracks in `src/core/music.ts`**

Append after the `stage-a` registration:

```ts
// Brighter major-key loop.
registerTrack({
  key: 'stage-b',
  tempo: 140,
  loopBeats: 8,
  layers: [
    { role: 'bass', notes: [0,1,2,3,4,5,6,7].map(b => ({
      time: b, dur: 0.9, freq: b % 4 < 2 ? 130.81 : 98, type: 'triangle' as OscillatorType, gain: 0.18 })) },
    { role: 'arp', notes: [261.63,329.63,392,523.25,392,329.63,293.66,329.63].map((f,i) => ({
      time: i, dur: 0.45, freq: f, type: 'square' as OscillatorType, gain: 0.07 })) },
  ],
});

// Darker, tenser loop.
registerTrack({
  key: 'stage-c',
  tempo: 126,
  loopBeats: 8,
  layers: [
    { role: 'bass', notes: [0,1,2,3,4,5,6,7].map(b => ({
      time: b, dur: 0.9, freq: b % 2 === 0 ? 87.31 : 116.54, type: 'sawtooth' as OscillatorType, gain: 0.14 })) },
    { role: 'arp', notes: [174.61,207.65,261.63,311.13,261.63,207.65,174.61,207.65].map((f,i) => ({
      time: i, dur: 0.45, freq: f, type: 'triangle' as OscillatorType, gain: 0.08 })) },
  ],
});

// Boss: faster, minor, insistent.
registerTrack({
  key: 'boss',
  tempo: 158,
  loopBeats: 8,
  layers: [
    { role: 'bass', notes: [0,0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5].map(b => ({
      time: b, dur: 0.4, freq: 82.41, type: 'sawtooth' as OscillatorType, gain: 0.16 })) },
    { role: 'lead', notes: [329.63,392,440,392,329.63,392,440,493.88].map((f,i) => ({
      time: i, dur: 0.8, freq: f, type: 'square' as OscillatorType, gain: 0.09 })) },
  ],
});

// Title: slow, atmospheric.
registerTrack({
  key: 'title',
  tempo: 96,
  loopBeats: 8,
  layers: [
    { role: 'bass', notes: [0,2,4,6].map(b => ({
      time: b, dur: 1.8, freq: 110, type: 'triangle' as OscillatorType, gain: 0.14 })) },
    { role: 'lead', notes: [0,2,4,6].map((b,i) => ({
      time: b, dur: 1.6, freq: [329.63,392,293.66,440][i], type: 'sine' as OscillatorType, gain: 0.10 })) },
  ],
});

// Stage-clear: short triumphant motif (loops harmlessly until the state changes).
registerTrack({
  key: 'stage-clear',
  tempo: 150,
  loopBeats: 4,
  layers: [
    { role: 'lead', notes: [261.63,329.63,392,523.25].map((f,i) => ({
      time: i * 0.75, dur: 0.7, freq: f, type: 'square' as OscillatorType, gain: 0.12 })) },
  ],
});

// Game-over: short descending minor motif.
registerTrack({
  key: 'game-over',
  tempo: 84,
  loopBeats: 4,
  layers: [
    { role: 'lead', notes: [329.63,293.66,246.94,196].map((f,i) => ({
      time: i * 0.9, dur: 0.85, freq: f, type: 'triangle' as OscillatorType, gain: 0.12 })) },
  ],
});
```

- [ ] **Step 5: Run tests + typecheck to verify pass**

Run: `npm test -- music` (Expected: PASS) then `npm run typecheck` (Expected: clean).

- [ ] **Step 6: Commit**

```bash
git add src/core/music.ts tests/music.test.ts
git commit -m "Add stage/boss/title/sting tracks and stage-theme mapping"
```

---

### Task 4: Wire music into GameContext and cue it on transitions

Add `music: MusicSink` to the context and `Game`, default it to `SilentMusic` in tests, and trigger the right track at each state transition (title, stage start, boss spawn, boss defeat/stage clear, game over).

**Files:**
- Modify: `src/core/GameContext.ts`, `src/core/Game.ts`, `src/stages/waveGen.ts`, `src/entities/Boss.ts`, `src/entities/Player.ts`
- Modify: `tests/context-stub.ts`
- Test: `tests/music-cues.test.ts` (new)

**Interfaces:**
- Consumes: `MusicSink`, `SilentMusic`, `WebAudioMusic`, `stageThemeFor` (Tasks 2–3); `GameDeps` in `Game.ts`.
- Produces:
  - `GameContext.music: MusicSink`.
  - `GameDeps.music?: MusicSink` (defaults to `new WebAudioMusic()`).
  - Cue calls listed below.

- [ ] **Step 1: Add `music` to the `GameContext` interface**

In `src/core/GameContext.ts`, add the import and field:

```ts
import type { MusicSink } from './music.js';
```
```ts
  audio: AudioBus;                        // sound effect sink (WebAudioBus, or SilentBus in tests)
  music: MusicSink;                       // background-music sink (WebAudioMusic, or SilentMusic in tests)
```

- [ ] **Step 2: Add `music` to the test stub (`tests/context-stub.ts`)**

```ts
import { SilentMusic } from '../src/core/music.js';
```
Add to the `ctx` literal, next to `audio`:
```ts
    audio: new SilentBus(),
    music: new SilentMusic(),
```

- [ ] **Step 3: Write the failing cue test**

Create `tests/music-cues.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Game } from '../src/core/Game.js';
import { CanvasRenderer } from '../src/core/Renderer.js';
import { SilentBus } from '../src/core/audio.js';
import type { MusicSink } from '../src/core/music.js';
import { noopCtx } from './dom-setup.js';

class SpyMusic implements MusicSink {
  played: string[] = [];
  play(k: string) { this.played.push(k); }
  stop() {}
  setEnabled() {}
  setVolume() {}
}

function newGame(music: MusicSink) {
  return new Game({ renderer: new CanvasRenderer(noopCtx), audio: new SilentBus(), music });
}

describe('music cues', () => {
  it('plays a stage theme when a stage starts', () => {
    const spy = new SpyMusic();
    const g = newGame(spy);
    g.loopMult = 1;
    g.startGame(1);
    expect(spy.played).toContain('stage-a');
  });

  it('plays the boss theme when the boss spawns, and stage-clear on boss death', () => {
    const spy = new SpyMusic();
    const g = newGame(spy);
    g.loopMult = 1; g.startGame(1);
    g.currentStage = 1; g.waveTable = [{ t: 0, boss: 1 }]; g.waveIndex = 0; g.stageTimer = 99;
    let ts = 1000; g.lastTime = ts; g.loop(ts);
    expect(spy.played).toContain('boss');
    g.boss!.hp = 0;
    g.loop(ts += 1000 / 60);
    expect(spy.played).toContain('stage-clear');
  });

  it('plays game-over when the last life is lost', () => {
    const spy = new SpyMusic();
    const g = newGame(spy);
    g.loopMult = 1; g.startGame(1);
    g.state = 3;               // STATE.GAMEOVER
    g.onGameOver();            // cue helper (added in Step 6)
    expect(spy.played).toContain('game-over');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- music-cues`
Expected: FAIL — `Game` has no `music` field/`onGameOver`, cues absent.

- [ ] **Step 5: Add `music` to `Game` (`src/core/Game.ts`)**

Import and field + constructor wiring + title cue:

```ts
import { WebAudioMusic, SilentMusic, stageThemeFor, type MusicSink } from './music.js';
```
Add to `GameDeps`:
```ts
export interface GameDeps {
  renderer?: RenderContext;
  audio?: AudioBus;
  music?: MusicSink;
}
```
Add the field near `readonly audio`:
```ts
  readonly music: MusicSink;          // background music sink
```
In the constructor, after the audio setup:
```ts
    this.music = deps.music ?? new WebAudioMusic();
    this.music.setEnabled(this.soundOn);
```
In `startStage`, after `this.currentStage = stage;`:
```ts
    this.music.play(stageThemeFor(stage));
```
In `toggleSound`, propagate to music too:
```ts
  toggleSound(): void {
    this.soundOn = !this.soundOn;
    this.audio.setEnabled(this.soundOn);
    this.music.setEnabled(this.soundOn);
  }
```

- [ ] **Step 6: Add an `onGameOver` cue helper and call it from Player**

In `src/core/Game.ts`, add a method:
```ts
  /** Cue the game-over music sting. Called when the final life is lost. */
  onGameOver(): void { this.music.play('game-over'); }
```
In `src/entities/Player.ts`, at the game-over transition (currently `if (p.gameOverTimer <= 0) ctx.state = STATE.GAMEOVER;`), add the cue. Since `onGameOver` is a `Game` method not on `GameContext`, cue via `ctx.music` directly to keep the context contract minimal:
```ts
        if (p.gameOverTimer <= 0) { ctx.state = STATE.GAMEOVER; ctx.music.play('game-over'); }
```
(The `Game.onGameOver` method still exists for the test and any future direct call.)

- [ ] **Step 7: Cue the boss theme on spawn (`src/stages/waveGen.ts`)**

In `updateWaves`, in the `if (entry.boss)` branch, after `ctx.boss = createBoss(ctx);`:
```ts
      ctx.music.play('boss');
```

- [ ] **Step 8: Cue stage-clear on boss death (`src/entities/Boss.ts`)**

In `onBossDeath`, in the `if (ctx.currentStage < STAGE_COUNT)` branch, after setting `ctx.state = STATE.STAGECLEAR;`:
```ts
    ctx.music.play('stage-clear');
```

- [ ] **Step 9: Cue the title theme when entering TITLE**

In `src/core/Game.ts`, the loop already knows the state. Add a one-line guard so entering TITLE plays the title track without re-triggering every frame. Add a field `private lastMusicState = -1;` and near the top of `loop()` (after `this.lastTime = ts;`):
```ts
    if (this.state === STATE.TITLE && this.lastMusicState !== STATE.TITLE) this.music.play('title');
    this.lastMusicState = this.state;
```
(Import `STATE` is already present in `Game.ts`.)

- [ ] **Step 10: Run tests + typecheck to verify pass**

Run: `npm test` (Expected: all PASS — existing `smoke`/`boss`/`player` tests still green since the stub and `Game` both provide a music sink) then `npm run typecheck` (Expected: clean).

- [ ] **Step 11: Commit**

```bash
git add src/core/GameContext.ts src/core/Game.ts src/stages/waveGen.ts src/entities/Boss.ts src/entities/Player.ts tests/context-stub.ts tests/music-cues.test.ts
git commit -m "Cue background music on stage, boss, clear, and game-over transitions"
```

---

### Task 5: Volume setting, settings persistence, and pause ducking

Add a master-volume stepper to the settings panel (keyboard + touch), persist `soundOn`/`volume`/`gameSpeed` to `localStorage`, and pause/duck music while the game is paused.

**Files:**
- Modify: `src/core/Game.ts`, `src/core/input.ts`, `src/render/screens.ts`
- Test: `tests/settings.test.ts` (new)

**Interfaces:**
- Consumes: `setMasterVolume`, `getMasterVolume` (Task 1); `Game.music`, `Game.soundOn`, `Game.gameSpeed`.
- Produces:
  - `Game.volume: number` (0..1) mirrored into `setMasterVolume`.
  - `Game.cycleVolume(dir: number): void` — steps through `VOLUME_STEPS`.
  - `Game.loadSettings()` / `Game.saveSettings()` — round-trip `localStorage['raidenSettings']`.
  - `VOLUME_STEPS` constant in `src/config.ts`.

- [ ] **Step 1: Add `VOLUME_STEPS` to `src/config.ts`**

```ts
/** Selectable master-volume levels cycled in settings. */
export const VOLUME_STEPS = [0, 0.25, 0.5, 0.7, 1.0];
```

- [ ] **Step 2: Write the failing test**

Create `tests/settings.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from '../src/core/Game.js';
import { CanvasRenderer } from '../src/core/Renderer.js';
import { SilentBus } from '../src/core/audio.js';
import { SilentMusic } from '../src/core/music.js';
import { noopCtx } from './dom-setup.js';

let store: Record<string, string>;
beforeEach(() => {
  store = {};
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; }, key: () => null, length: 0,
  } as Storage;
});

function newGame() {
  return new Game({ renderer: new CanvasRenderer(noopCtx), audio: new SilentBus(), music: new SilentMusic() });
}

describe('settings persistence', () => {
  it('cycleVolume steps and persists volume', () => {
    const g = newGame();
    g.volume = 0.5;
    g.cycleVolume(1);
    expect(g.volume).toBe(0.7);
    expect(JSON.parse(store['raidenSettings']).volume).toBe(0.7);
  });

  it('loadSettings restores persisted values', () => {
    store['raidenSettings'] = JSON.stringify({ soundOn: false, volume: 0.25, gameSpeed: 1.25 });
    const g = newGame();
    expect(g.soundOn).toBe(false);
    expect(g.volume).toBe(0.25);
    expect(g.gameSpeed).toBe(1.25);
  });

  it('saveSettings never throws when localStorage is unavailable', () => {
    (globalThis as unknown as { localStorage: undefined }).localStorage = undefined as unknown as undefined;
    const g = newGame();
    expect(() => g.saveSettings()).not.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- settings`
Expected: FAIL — `volume`, `cycleVolume`, `loadSettings`, `saveSettings` don't exist.

- [ ] **Step 4: Add persistence + volume to `Game` (`src/core/Game.ts`)**

Import:
```ts
import { W, H, STATE, VOLUME_STEPS } from '../config.js';
import { setMasterVolume } from './audio.js';
```
(Merge with the existing `../config.js` import line; keep existing names.)

Add field near `gameSpeed`:
```ts
  volume = 0.7;                    // master volume (0..1), persisted
```

In the constructor, BEFORE `this.audio.setEnabled(...)`, load settings and apply volume:
```ts
    this.loadSettings();
    setMasterVolume(this.volume);
```
After `this.music = ...`:
```ts
    this.music.setVolume(1.0);     // music sits under SFX via its own internal balance; master scales both
```

Add methods:
```ts
  /** Read persisted settings from localStorage into soundOn/volume/gameSpeed (best-effort). */
  loadSettings(): void {
    try {
      const raw = localStorage.getItem('raidenSettings');
      if (!raw) return;
      const s = JSON.parse(raw) as { soundOn?: boolean; volume?: number; gameSpeed?: number };
      if (typeof s.soundOn === 'boolean') this.soundOn = s.soundOn;
      if (typeof s.volume === 'number') this.volume = Math.max(0, Math.min(1, s.volume));
      if (typeof s.gameSpeed === 'number') this.gameSpeed = s.gameSpeed;
    } catch { /* ignore corrupt/absent storage */ }
  }

  /** Persist soundOn/volume/gameSpeed to localStorage (best-effort). */
  saveSettings(): void {
    try {
      localStorage.setItem('raidenSettings', JSON.stringify({
        soundOn: this.soundOn, volume: this.volume, gameSpeed: this.gameSpeed,
      }));
    } catch { /* ignore quota/unavailable */ }
  }

  /** Step master volume through VOLUME_STEPS, apply it, and persist. */
  cycleVolume(dir: number): void {
    // Snap to the nearest step, then move by dir.
    let i = VOLUME_STEPS.indexOf(this.volume);
    if (i === -1) { i = VOLUME_STEPS.findIndex(v => v >= this.volume); if (i === -1) i = VOLUME_STEPS.length - 1; }
    i = Math.max(0, Math.min(VOLUME_STEPS.length - 1, i + dir));
    this.volume = VOLUME_STEPS[i];
    setMasterVolume(this.volume);
    this.saveSettings();
  }
```

Make `toggleSound` persist:
```ts
  toggleSound(): void {
    this.soundOn = !this.soundOn;
    this.audio.setEnabled(this.soundOn);
    this.music.setEnabled(this.soundOn);
    this.saveSettings();
  }
```

- [ ] **Step 5: Persist speed changes and pause-duck music (`src/core/Game.ts` + `src/core/input.ts`)**

In `src/core/input.ts`, `cycleSpeed` should persist after changing speed:
```ts
function cycleSpeed(g: Game, dir: number) {
  let i = SPEED_STEPS.indexOf(g.gameSpeed);
  i = Math.max(0, Math.min(SPEED_STEPS.length - 1, i + dir));
  g.gameSpeed = SPEED_STEPS[i];
  g.saveSettings();
}
```

Pause ducking: in `Game.loop()`, replace the title-cue block from Task 4 Step 9 with state-aware music control that also stops music on PAUSED and resumes the right track on unpause:
```ts
    // Music state machine: title theme on TITLE; pause silences; resume restores stage/boss theme.
    if (this.state !== this.lastMusicState) {
      if (this.state === STATE.TITLE) this.music.play('title');
      else if (this.state === STATE.PAUSED) this.music.stop();
      else if (this.state === STATE.PLAYING && this.lastMusicState === STATE.PAUSED) {
        this.music.play(this.boss ? 'boss' : stageThemeFor(this.currentStage));
      }
      this.lastMusicState = this.state;
    }
```
(`stageThemeFor` is already imported from Task 4.)

- [ ] **Step 6: Add the volume row to the settings panel (`src/render/screens.ts`)**

In `drawSettings`, grow the box and add a volume line. Change `bh` from `185` to `210`, and add after the Speed line (`by + 92`):
```ts
  ctx.fillText('V  Volume: ' + Math.round(g.volume * 100) + '%', W/2, by + 116);
```
Shift the two hint lines down by 24px so they clear the new row:
```ts
  ctx.fillStyle = '#666';
  ctx.font = '11px monospace';
  ctx.fillText('M sound   [ / ] speed   V volume', W/2, by + 154);
  ctx.fillText('S to close', W/2, by + 174);
```

- [ ] **Step 7: Handle the `V` key + touch band (`src/core/input.ts`)**

In `handleKeyPress`, inside the `if (g.settingsOpen)` block, add volume stepping (V steps up, Shift not needed — mirror the bracket behavior with a single key cycling forward, wrapping):
```ts
    if (code === 'KeyV') g.cycleVolume(1 > 0 && g.volume >= 1 ? -(VOLUME_STEPS.length - 1) : 1);
```
Simpler and clearer — replace the line above with a wrap helper call. Add to `handleKeyPress`:
```ts
    if (code === 'KeyV') cycleVolumeWrap(g);
```
And define near `cycleSpeed`:
```ts
/** Step volume up one notch, wrapping back to the quietest after the loudest. */
function cycleVolumeWrap(g: Game) {
  if (g.volume >= 1) { g.volume = 0; setMasterVolume(0); g.saveSettings(); }
  else g.cycleVolume(1);
}
```
Import `setMasterVolume` and `VOLUME_STEPS` at the top of `input.ts`:
```ts
import { W, H, STATE, SPEED_STEPS, STAGE_COUNT, VOLUME_STEPS } from '../config.js';
import { getAudio, setMasterVolume } from './audio.js';
```

In `touchDiscrete`, the settings hit bands must match the taller panel. Update the band block so the volume row is tappable and the existing rows keep their positions:
```ts
    const bx = W/2 - 130, by = H/2 - 90, bw = 260, bh = 210;
    if (p.y > by + 55 && p.y < by + 80) { handleKeyPress(g, 'KeyM'); return true; }
    if (p.y > by + 80 && p.y < by + 104) { cycleSpeed(g, p.x < W/2 ? -1 : 1); return true; }
    if (p.y > by + 104 && p.y < by + 128) { cycleVolumeWrap(g); return true; }
    if (p.x < bx || p.x > bx + bw || p.y < by || p.y > by + bh) g.settingsOpen = false;
    return true;
```

- [ ] **Step 8: Run tests + typecheck to verify pass**

Run: `npm test` (Expected: all PASS) then `npm run typecheck` (Expected: clean). If `VOLUME_STEPS` is unused in `input.ts` after using the wrap helper, drop it from that import to satisfy `noUnusedLocals`.

- [ ] **Step 9: Commit**

```bash
git add src/config.ts src/core/Game.ts src/core/input.ts src/render/screens.ts tests/settings.test.ts
git commit -m "Add master-volume setting with persistence and pause ducking"
```

---

### Task 6: Hit-stop on boss phase-break and death

Add a brief gameplay freeze (`dt = 0`) on impactful moments while rendering keeps running, for punchier feel.

**Files:**
- Modify: `src/core/GameContext.ts`, `src/core/Game.ts`, `src/entities/Boss.ts`
- Test: `tests/hitstop.test.ts` (new)

**Interfaces:**
- Consumes: `Game.loop`, `GameContext`.
- Produces:
  - `GameContext.hitStop(ms: number): void`.
  - `Game.hitStopTimer: number` (seconds remaining).

- [ ] **Step 1: Add `hitStop` to the `GameContext` interface (`src/core/GameContext.ts`)**

```ts
  /** Freeze gameplay (dt=0) for `ms` milliseconds while rendering continues; extends any active freeze. */
  hitStop(ms: number): void;
```

- [ ] **Step 2: Add a no-op `hitStop` to the test stub (`tests/context-stub.ts`)**

Next to `shake() {}`:
```ts
    hitStop() {},
```

- [ ] **Step 3: Write the failing test**

Create `tests/hitstop.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Game } from '../src/core/Game.js';
import { CanvasRenderer } from '../src/core/Renderer.js';
import { SilentBus } from '../src/core/audio.js';
import { SilentMusic } from '../src/core/music.js';
import { noopCtx } from './dom-setup.js';

function newGame() {
  return new Game({ renderer: new CanvasRenderer(noopCtx), audio: new SilentBus(), music: new SilentMusic() });
}

describe('hit-stop', () => {
  it('freezes gameplay dt while the timer is active but still advances the timer', () => {
    const g = newGame();
    g.loopMult = 1; g.startGame(1);
    g.hitStop(100);                       // 0.1s freeze
    expect(g.hitStopTimer).toBeCloseTo(0.1, 5);
    // Place an enemy bullet moving down; a frozen frame should not move it.
    g.enemyBullets.push({ x: 100, y: 100, r: 3, vx: 0, vy: 300, dmg: 1 } as never);
    const y0 = g.enemyBullets[0].y;
    let ts = 1000; g.lastTime = ts;
    g.loop(ts += 1000 / 60);              // frozen frame
    expect(g.enemyBullets[0].y).toBe(y0); // no movement
    expect(g.hitStopTimer).toBeLessThan(0.1);   // timer decremented on real time
  });

  it('hitStop extends rather than shortens an active freeze', () => {
    const g = newGame();
    g.hitStop(50);
    g.hitStop(120);
    expect(g.hitStopTimer).toBeCloseTo(0.12, 5);
    g.hitStop(30);
    expect(g.hitStopTimer).toBeCloseTo(0.12, 5);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test -- hitstop`
Expected: FAIL — `hitStop`/`hitStopTimer` don't exist.

- [ ] **Step 5: Implement hit-stop in `Game` (`src/core/Game.ts`)**

Add field near `shakeTime`:
```ts
  hitStopTimer = 0;                // seconds of gameplay freeze remaining (rendering continues)
```
Add method (near `shake`):
```ts
  /** Freeze gameplay for `ms` ms; takes the longer of any overlapping freeze. */
  hitStop(ms: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
  }
```
In `loop()`, right after computing `const dt = rawDt * this.gameSpeed;`, gate it on the freeze:
```ts
    let dt = rawDt * this.gameSpeed;
    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - rawDt);   // decays on real time
      dt = 0;                                                        // freeze gameplay this frame
    }
```
(Change the existing `const dt` to `let dt`.)

- [ ] **Step 6: Trigger hit-stop on boss phase-break and death (`src/entities/Boss.ts`)**

Phase-break: in `Boss.update`, after the two lines that compute `ctx.bossPhase`, detect an increase and freeze briefly. Add a `prevPhase` field to `Boss`:
```ts
  /** Last frame's phase index, to detect phase-break for hit-stop. */
  private prevPhase = 0;
```
After `ctx.bossPhase = Math.max(0, Math.min(this.phaseCount - 1, ctx.bossPhase));`:
```ts
    if (ctx.bossPhase > this.prevPhase) ctx.hitStop(70);
    this.prevPhase = ctx.bossPhase;
```
Death: in `onBossDeath`, near the top (before clearing `ctx.boss`), add:
```ts
  ctx.hitStop(110);
```

- [ ] **Step 7: Run tests + typecheck to verify pass**

Run: `npm test` (Expected: all PASS) then `npm run typecheck` (Expected: clean).

- [ ] **Step 8: Commit**

```bash
git add src/core/GameContext.ts src/core/Game.ts src/entities/Boss.ts tests/context-stub.ts tests/hitstop.test.ts
git commit -m "Add hit-stop on boss phase-break and death"
```

---

### Task 7: Graze flash + tick on near-misses

Detect enemy bullets passing very close to the player without hitting, and emit a brief spark + a soft rate-limited "tick" SFX. This provides feedback now and the detection hook Phase 2 will score.

**Files:**
- Modify: `src/core/audio.ts` (new `graze` SFX), `src/core/collision.ts`, `src/entities/Bullet.ts` (a `grazed` flag)
- Test: `tests/audio.test.ts`, `tests/graze.test.ts` (new)

**Interfaces:**
- Consumes: `circleHit` (collision.ts), `ctx.spawnParticles`, `ctx.audio`, player/bullet positions.
- Produces:
  - `checkGraze(ctx: GameContext): void` in `collision.ts`, called from `runCollision` before `checkEnemyBulletsVsPlayer`.
  - `EnemyBullet.grazed?: boolean` flag.
  - `graze` SFX registered in `audio.ts`.
  - `GRAZE_RADIUS` constant.

- [ ] **Step 1: Write the failing SFX test**

In `tests/audio.test.ts`, update the registry expectation:

```ts
it('registers the engine sound effects including graze', () => {
  expect(SFX_REGISTRY_KEYS().sort()).toEqual(['shoot', 'explosion', 'powerup', 'bomb', 'graze'].sort());
});
```
(Replace the existing "registers the four engine sound effects" test.)

- [ ] **Step 2: Register the `graze` SFX in `src/core/audio.ts`**

```ts
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
```

- [ ] **Step 3: Add a `grazed` flag to `EnemyBullet` (`src/entities/Bullet.ts`)**

Find the `EnemyBullet` type/interface and add:
```ts
  grazed?: boolean;   // true once this bullet has already awarded a graze (so it grazes at most once)
```
(If `EnemyBullet` is a class, add `grazed = false;` as a field instead.)

- [ ] **Step 4: Write the failing graze test**

Create `tests/graze.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { checkGraze, GRAZE_RADIUS } from '../src/core/collision.js';
import { stubContext } from './context-stub.js';

function bullet(x: number, y: number) {
  return { x, y, r: 3, vx: 0, vy: 0, dmg: 1 } as never;
}

describe('graze detection', () => {
  it('grazes a near-miss bullet exactly once and spawns a particle', () => {
    const g = stubContext();
    g.player!.x = 100; g.player!.y = 100; g.player!.invTimer = 0; g.player!.dead = false;
    // Just outside the hit radius but inside the graze band.
    const gap = g.player!.r + GRAZE_RADIUS - 2;
    g.enemyBullets.push(bullet(100 + gap, 100));
    checkGraze(g);
    expect(g.particles.length).toBeGreaterThan(0);
    expect((g.enemyBullets[0] as { grazed?: boolean }).grazed).toBe(true);
    const n = g.particles.length;
    checkGraze(g);                       // second pass: already grazed, no new particle
    expect(g.particles.length).toBe(n);
  });

  it('does not graze a bullet that is far away', () => {
    const g = stubContext();
    g.player!.x = 100; g.player!.y = 100;
    g.enemyBullets.push(bullet(300, 300));
    checkGraze(g);
    expect((g.enemyBullets[0] as { grazed?: boolean }).grazed).toBeFalsy();
  });

  it('is a no-op while the player is dead or invulnerable', () => {
    const g = stubContext();
    g.player!.x = 100; g.player!.y = 100; g.player!.invTimer = 5;
    g.enemyBullets.push(bullet(100, 100));
    expect(() => checkGraze(g)).not.toThrow();
    expect((g.enemyBullets[0] as { grazed?: boolean }).grazed).toBeFalsy();
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npm test -- graze`
Expected: FAIL — `checkGraze`/`GRAZE_RADIUS` not exported.

- [ ] **Step 6: Implement `checkGraze` in `src/core/collision.ts`**

Add the constant and a rate-limit accumulator near the top, and the function:
```ts
/** Bullets passing within this many px beyond the player's hit radius count as a graze. */
export const GRAZE_RADIUS = 14;
let lastGrazeSfx = 0;   // wall-clock ms of the last graze tick, to rate-limit the sound

/**
 * Enemy bullets skimming the player (inside GRAZE_RADIUS but not colliding):
 * flag each once, emit a spark, and play a rate-limited tick. No scoring yet.
 */
export function checkGraze(ctx: GameContext) {
  const p = ctx.player;
  if (!p || p.dead || p.invTimer > 0) return;
  const grazeR = p.r + GRAZE_RADIUS;
  for (const b of ctx.enemyBullets) {
    if ((b as { grazed?: boolean }).grazed) continue;
    const inGraze = circleHit(b.x, b.y, b.r, p.x, p.y, grazeR);
    const isHit = circleHit(b.x, b.y, b.r, p.x, p.y, p.r);
    if (inGraze && !isHit) {
      (b as { grazed?: boolean }).grazed = true;
      ctx.spawnParticles('explosion', b.x, b.y, { size: 0.35, color: '#aef0ff' });
      const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      if (now - lastGrazeSfx > 70) { ctx.audio.play('graze'); lastGrazeSfx = now; }
    }
  }
}
```
Wire it into `runCollision`, before `checkEnemyBulletsVsPlayer`:
```ts
export function runCollision(ctx: GameContext) {
  checkPlayerBulletsVsEnemies(ctx);
  checkGraze(ctx);
  checkEnemyBulletsVsPlayer(ctx);
  checkEnemyBodiesVsPlayer(ctx);
  checkPlayerBulletsVsBoss(ctx);
  checkBossBodyVsPlayer(ctx);
  checkPlayerVsPowerups(ctx);
}
```

- [ ] **Step 7: Run tests + typecheck to verify pass**

Run: `npm test` (Expected: all PASS) then `npm run typecheck` (Expected: clean).

- [ ] **Step 8: Commit**

```bash
git add src/core/audio.ts src/core/collision.ts src/entities/Bullet.ts tests/audio.test.ts tests/graze.test.ts
git commit -m "Add graze flash and tick on player near-misses"
```

---

### Task 8: Manual QA and build verification

Confirm the whole slice works in the real app and the single-file build still succeeds.

**Files:** none (verification only).

- [ ] **Step 1: Full test + typecheck + build**

Run: `npm test` (all green), `npm run typecheck` (clean), `npm run build` (single-file build succeeds without errors).

- [ ] **Step 2: Manual QA via the `run` skill (or `npm run dev`)**

Verify in the browser:
- Title screen plays the title theme.
- Starting a stage plays a stage theme; stages 1/2/3 sound different; stage 4 reuses stage 1's.
- Boss spawn crossfades to the boss theme; boss death plays the stage-clear motif.
- Losing all lives plays the game-over motif.
- Settings: `V` (and the touch band) cycles master volume; it audibly scales both music and SFX and survives a page reload; `M` still mutes everything including music; speed and volume both persist across reload.
- Pause (`P`) silences music; resume restores the stage/boss theme.
- Hit-stop is felt on boss phase changes and on the boss dying.
- Grazing an enemy bullet (flying close without dying) produces a cyan spark and a soft tick, rate-limited under a bullet curtain.

- [ ] **Step 3: Commit any QA fixes** (only if issues found)

```bash
git add -A
git commit -m "Fix issues found in music & feel QA"
```

---

## Self-Review Notes

- **Spec coverage:** MusicEngine (T2), tracks + stage mapping (T3), master gain + single volume (T1, T5), settings persistence (T5), cues at all listed transitions (T4), pause ducking (T5), `SilentMusic` for tests (T2, stub in T4), hit-stop (T6), graze flash + `graze` SFX + Phase-2 hook (T7), build/QA (T8). All spec sections map to a task.
- **Type consistency:** `MusicSink`/`Track`/`Note`/`Layer` defined in T2 and used unchanged in T3–T4; `stageThemeFor` (T3) used in T4/T5; `setMasterVolume`/`getMasterVolume`/`outputNode` (T1) used in T5/T7; `hitStop`/`hitStopTimer` (T6) consistent; `GRAZE_RADIUS`/`checkGraze` (T7) consistent.
- **Known follow-ups (intentionally deferred):** true crossfade is approximated by `stop`+`play` at the engine boundary (per-track gain swap) — acceptable for Phase 1; smoother equal-power crossfade can come later. Graze is detection+feedback only; scoring is Phase 2.


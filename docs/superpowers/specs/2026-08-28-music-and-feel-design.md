# Phase 1: Music & Feel — Design

**Date:** 2026-08-28
**Status:** Approved for planning
**Goal:** Make the game feel dramatically more alive and premium by adding
procedural background music, a shared volume system, and two high-impact
"game feel" effects (hit-stop and graze flash). This is the first slice of a
four-phase roadmap to make the game more attractive (Phase 2 scoring &
leaderboard, Phase 3 content depth, Phase 4 accessibility & meta).

## Motivation

The game currently has rich procedurally-synthesized SFX but **no background
music at all** — the single biggest audio gap for a shmup. The build compiles
to one self-contained HTML file (`vite-plugin-singlefile`), so audio assets are
not viable (a short loop would be megabytes of base64). Procedural/synthesized
music keeps the single-file constraint, matches the existing chiptune SFX
aesthetic, loops seamlessly, and can react to game state.

Alongside music, two small mechanics deliver outsized "feel" per line of code:
**hit-stop** (brief freeze on impactful hits) and **graze flash** (feedback for
near-misses), the latter also seeding Phase 2's graze scoring.

## Non-goals

- No licensed/orchestral audio files (would break the single-file build).
- No scoring changes (graze *scoring* is Phase 2; Phase 1 only adds the
  detection + visual/audio feedback).
- No new gameplay-balance changes beyond hit-stop's brief time freeze.

## Architecture

### 1. MusicEngine (`src/core/music.ts`, new)

A lookahead scheduler — the standard glitch-free approach to Web Audio
sequencing. The engine schedules notes ~100 ms ahead of the audio clock via a
`setInterval` (~25 ms) tick, so timing is unaffected by game-loop stutter.

**Interface (mirrors AudioBus so tests get a no-op impl):**

```ts
export interface MusicSink {
  play(trackKey: string): void;   // crossfade to this track (no-op if already playing it)
  stop(): void;                   // fade out and halt scheduling
  setEnabled(enabled: boolean): void;
  setVolume(v: number): void;     // 0..1, music's share of master
}
```

- `WebAudioMusic implements MusicSink` — real playback.
- `SilentMusic implements MusicSink` — no-op for headless tests.

**Track registry** (mirrors `registerSfx`): `registerTrack({ key, tempo, layers })`.
A track is a tempo (BPM) plus layers; each layer is an array of notes
`{ time, dur, freq, type, gain }` over a loop length, plus a layer role (bass /
arp / lead / drums) used for boss-intensity gating later. `MUSIC_REGISTRY_KEYS()`
exposes keys for tests (parallels `SFX_REGISTRY_KEYS()`).

**Tracks authored in Phase 1:**
- `title` — menu theme.
- `stage-a`, `stage-b`, `stage-c` — cycled across the 18 stages by
  `(stage-1) % 3` (or similar), so stages feel varied without 18 hand-authored
  tunes.
- `boss` — tenser, faster boss theme.
- Short stings (one-shot, non-looping, engine returns to caller-chosen track
  after): `stage-clear`, `game-over`.

**Crossfades:** track changes fade the outgoing master over ~0.4 s while fading
in the new one, so boss→stage transitions don't hard-cut.

### 2. Shared master gain + volume (`src/core/audio.ts`, modified)

Today each SFX connects directly to `ac.destination` and there is only a
sound on/off toggle. Change:

- Introduce a **shared master `GainNode`** created lazily alongside the
  `AudioContext`. Both SFX (`WebAudioBus`) and music (`WebAudioMusic`) connect
  through it instead of straight to `destination`.
- `WebAudioBus` gains a `setVolume(v)` that scales its SFX output; music has its
  own `setVolume`. A single **master volume** (see settings) scales the shared
  gain; per-source volumes are fixed internal balance constants (music sits a
  bit under SFX).
- Expose a small helper to get/set master volume so `Game` and settings can
  drive it.

This is a contained refactor: the `AudioBus` interface gains an optional
`setVolume`; `SilentBus` implements it as a no-op. Existing `def.play(ac, opts)`
signatures are unchanged — synth routines just connect to the master gain
(passed in or fetched) rather than `ac.destination`. Simplest implementation:
route via a module-level `masterGain()` accessor that synth code connects to.

### 3. Settings & persistence (`src/render/screens.ts`, `src/core/input.ts`,
`src/core/Game.ts`, modified)

- Keep **Sound: ON/OFF** (existing `M` toggle / touch band).
- Add **Volume: NN%** stepper, controlled like the existing speed stepper
  (`[` / `]` currently drive speed; add a second row + keys, or reuse a
  selected-row model). Single master volume per the approved decision.
- **Persist settings** to `localStorage['raidenSettings']` (JSON: `soundOn`,
  `volume`, `gameSpeed`). Load in the `Game` constructor; save on change.
  Currently sound/speed reset every reload — this fixes that as a bonus.
- The settings panel box height (`bh`) grows to fit the new row; the touch
  hit-test bands in `input.ts` (`touchDiscrete`) are updated to match, since the
  comment there notes they mirror the panel geometry.

### 4. Music cue integration (transition points already located)

`Game` owns a `music: MusicSink` field (constructed `WebAudioMusic`, or injected
`SilentMusic` in tests, parallel to `audio`). `GameContext` gains `music:
MusicSink` so entity/wave code can trigger cues. Cues:

| Event | Location | Cue |
|---|---|---|
| Enter title | state→TITLE | `music.play('title')` |
| Stage start | `Game.startStage` | `music.play(stageThemeFor(stage))` |
| Boss spawn | `waveGen.ts:~185` (`ctx.boss = createBoss`) | `music.play('boss')` (crossfade) |
| Boss defeat / stage clear | `Boss.ts:~190`, `Game.updateStageClear` | `stage-clear` sting |
| Victory | `Boss.ts:~200` | hold/`title` or victory sting |
| Game over | `Player.ts:~48` (state→GAMEOVER) | `game-over` sting |
| Pause | state→PAUSED | duck/pause music; resume on unpause |

`toggleSound` also drives `music.setEnabled`. Master volume changes call both
`audio.setVolume` and `music.setVolume` (or the shared master accessor).

### 5. Hit-stop (`src/core/Game.ts`, modified)

Add `hitStopTimer` (seconds). A new `GameContext.hitStop(ms)` sets it to
`max(current, ms/1000)`. In `loop()`, when `hitStopTimer > 0`: decrement it by
`rawDt` and set gameplay `dt = 0` (world frozen) while rendering continues
normally. Screen shake already uses `rawDt`, so it keeps animating.

Triggers (Phase 1): boss **phase-break** (`bossPhase` increments in `Boss.ts`)
→ ~70 ms; boss **death** (`Boss.ts:~188`) → ~110 ms. Kept small so play feels
punchy, not sluggish.

### 6. Graze flash (`src/core/collision.ts` or a small graze pass, modified)

During enemy-bullet processing, when a bullet passes within a small graze
radius of the player hitbox **without** colliding, emit: a brief spark particle
(reuse `spawnParticles`) at the bullet position + a soft high "tick" SFX
(new `graze` SFX, rate-limited so a curtain of bullets doesn't machine-gun the
sound). Each bullet grazes at most once (a `grazed` flag on the bullet).

Phase 1 does **not** score grazes — it only provides feedback and the detection
hook. Phase 2 reads the same signal to award points/multiplier.

## Data flow

```
AudioContext ──▶ masterGain ──▶ destination
                   ▲     ▲
   WebAudioBus ────┘     └──── WebAudioMusic (lookahead scheduler → per-layer osc/gain)
        ▲                            ▲
   ctx.audio.play(sfx)          ctx.music.play(track)  ← game state transitions
```

Master volume (settings, persisted) scales `masterGain`. Music/SFX internal
balance are fixed constants.

## Error handling

- All Web Audio access stays wrapped in try/catch (as `WebAudioBus.play`
  already is) — an audio glitch must never crash the loop.
- `getAudio()` may return null (no Web Audio support); `WebAudioMusic` must
  degrade to silent (never schedule, never throw).
- Scheduler interval is cleared on `stop()` and guarded against a null context.
- localStorage reads/writes wrapped in try/catch (private-mode / quota safety).

## Testing

- **New unit tests** (Vitest, parallel to existing `audio`/registry tests):
  - Music registry: `MUSIC_REGISTRY_KEYS()` contains the authored tracks; every
    stage maps to a registered track via `stageThemeFor`.
  - `SilentMusic` satisfies `MusicSink` and no-ops (used everywhere `SilentBus`
    is used in existing tests — inject both into `Game` test deps).
  - Cue logic: entering states / starting stages / boss spawn call the expected
    `music.play(key)` (assert via a spy `MusicSink`).
  - Hit-stop: `hitStop(ms)` sets timer; a frozen frame advances gameplay by 0
    but still decrements the timer and runs shake decay.
  - Graze: a bullet within graze radius but outside hit radius sets `grazed`
    and emits one particle; a direct hit does not graze; the SFX is
    rate-limited.
  - Settings persistence: round-trip `raidenSettings` through save/load.
- **`GameDeps`** extended with optional `music?: MusicSink` so tests inject a
  spy/silent engine. Existing tests that build `Game` with `SilentBus` keep
  working (music defaults to `SilentMusic` when a bus stub is given, or we
  default `music` to `SilentMusic` whenever `audio` is a non-WebAudio bus).
- Manual QA (`/run`): music plays and loops on title/stages/boss; crossfades on
  boss spawn and stage clear; volume stepper audibly scales everything and
  persists across reload; sound OFF silences music too; hit-stop is felt on
  boss phase/death; grazing a bullet flashes + ticks without dying.

## Files touched

- `src/core/music.ts` — **new**: MusicEngine, MusicSink, WebAudioMusic,
  SilentMusic, track registry + authored tracks, `stageThemeFor`.
- `src/core/audio.ts` — shared master gain, `setVolume`, master-volume accessor;
  SFX route through master; add `graze` SFX.
- `src/core/Game.ts` — `music` field, `hitStopTimer` + `hitStop()`, cue calls,
  settings load/save, volume wiring, pause ducking.
- `src/core/GameContext.ts` — add `music: MusicSink` and `hitStop(ms)`.
- `src/core/input.ts` — volume stepper keys + touch bands; settings persistence
  triggers.
- `src/render/screens.ts` — settings panel volume row + resized box.
- `src/stages/waveGen.ts` — boss-spawn music cue.
- `src/entities/Boss.ts` — boss-defeat cue, hit-stop on phase-break/death.
- `src/entities/Player.ts` — game-over cue.
- `src/core/collision.ts` — graze detection pass.
- Test files under `src/**/*.test.ts` — new music/hit-stop/graze/settings tests;
  update `Game` construction to inject `SilentMusic`.

## Rollout / sequencing within Phase 1

1. Master gain + volume refactor in `audio.ts` (+ settings persistence scaffold).
2. MusicEngine core + one track (`stage-a`) + wiring into `startStage`/title.
3. Remaining tracks + boss/stage-clear/game-over cues + crossfades.
4. Settings UI volume row (keyboard + touch).
5. Hit-stop.
6. Graze flash.

Each step is independently testable and leaves the game runnable.

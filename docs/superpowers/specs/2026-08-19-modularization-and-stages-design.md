# Raiden — Modularization, Build Step, and Stage Expansion Design

**Date:** 2026-08-19
**Status:** Approved for planning

## Goals

1. **More content, harder game.** Add 10 new stages (9–18, total 18) and steepen the
   difficulty curve, which currently tops out at a gentle 2.25× speed multiplier.
2. **Modularize the monolith.** The game is a single 2700-line `index.html` with one
   `<script>` block. Split it into ES modules with pragmatic OOP, add a real build step,
   and still deploy as a static page on GitHub Pages for public access.

These are sequenced: **modularize first (behavior-preserving), then add content.** The
refactor must reproduce the current 8-stage game identically before any new stage or
difficulty change lands, so "did the refactor break anything?" stays a separate question
from "is the new content good?".

## Non-Goals

- No new weapons, enemy visual types, or boss art. New bosses reuse the 8 existing visual
  archetypes via recolor + phase mixing.
- No gameplay-mechanic redesign (scoring, powerups, charge shot, loop mode stay as-is).
- No difficulty selector (Easy/Normal/Hard) — single curve for everyone.
- No unrelated refactoring beyond what modularization requires.

## Architecture

### Source layout

```
src/
  main.js              # entry: constructs Game, wires systems, starts loop
  config.js            # W, H, FPS, STEP, tunable difficulty constants, STAGE_COUNT
  core/
    Game.js            # state machine, main loop, owns shared mutable state
    input.js           # keyboard + analog touch stick -> InputState
    audio.js           # sound toggle + SFX
  entities/
    Player.js          # class Player
    Enemy.js           # class Enemy + ENEMY_CFG
    Bullet.js          # player/enemy bullet pools + factory
    Boss.js            # class Boss: data-driven fire + draw dispatch
    Powerup.js         # class Powerup / drops
  stages/
    stageData.js       # STAGES[] — 18 data-driven stage definitions
    waveGen.js         # buildWaveTable(stageDef) -> runtime wave entries
    background.js      # background system driven by stageDef.bg
  render/
    hud.js             # in-game HUD, boss HP bar
    screens.js         # title / pause / gameover / victory / stageclear
index.html             # canvas element + <script type="module" src="/src/main.js">
```

### OOP depth: pragmatic

- **Classes** (with `update(dt)` / `draw(ctx)` where applicable): `Player`, `Enemy`,
  `Boss`, `Bullet`, `Powerup`. These have identity + per-instance state, so a class is the
  natural fit.
- **Function modules** (stateless procedures): `input`, `audio`, `background`, `waveGen`,
  `hud`, `screens`.
- **`Game`** owns what are currently file-level globals: `ctx`, `state`, `diffMult`,
  `score`, entity arrays (`enemies`, `playerBullets`, `enemyBullets`, `powerups`,
  `particles`), `currentStage`, `loopMult`, timers. Systems receive what they need as
  arguments rather than reaching for globals. No module keeps its own copy of shared
  mutable game state.

Each module has a single clear purpose, a small interface, and can be reasoned about
without reading the others' internals.

## Build & Deploy

- **Bundler:** Vite + `vite-plugin-singlefile`.
- `npm run dev` — hot-reload dev server for local iteration.
- `npm run build` — emits `dist/index.html` as a **single self-contained file** (all JS
  and CSS inlined, no `assets/` directory). This guarantees GitHub Pages serves it
  correctly at any repo subpath with zero base-path configuration.
- **Deployment:** a GitHub Actions workflow builds `src/` and publishes to GitHub Pages on
  push to `main`. `src/` remains the single source of truth; built output is never
  hand-edited. `node_modules/` (and `dist/` if the workflow builds fresh) are gitignored.
- New files: `package.json`, `vite.config.js`, `.gitignore`, `.github/workflows/pages.yml`.

## Stage Model (data-driven)

Stages become plain data objects in `STAGES[]`:

```js
{
  id: 12,
  bg: { baseFill: '#...', starColor: [...], features: ['clouds', 'hulls'] },
  diff: 3.4,                    // per-stage speed multiplier (replaces STAGE_DIFF)
  waves: [ /* declarative wave descriptors */ ],
  boss: {
    archetype: 3,               // which of the 8 existing drawBossN visuals to use
    tint: '#7fe',               // recolor
    hpScale: 2.1,               // multiplied into base boss HP
    phaseCount: 4,
    patterns: ['aimSpread', 'ring', 'laserSweep'],  // assembled from existing fire behaviors
    speed: 66,
  }
}
```

### Waves

- Wave descriptors are declarative: `{ type, formation: 'v'|'sin'|'line'|'turret', count,
  spacing, at, elite? }`.
- `waveGen.js` expands descriptors into the same runtime entries the engine already
  consumes today (objects with `t`, `type`, `path`/`x`/`y`, `eliteHp`, `boss`).
- The existing 8 hand-authored switch-cases are **ported into descriptor form**
  (behavior-preserving). Stages 9–18 are authored as new descriptor data — no per-stage
  bespoke wave code.

### Bosses

- Reuse the 8 existing visual archetypes (`drawBoss1..8`) and existing fire functions,
  now parameterized by `tint`, `phaseCount`, `patterns[]`, `hpScale`, `speed`.
- Fire behaviors are extracted into a named, reusable set drawn from the current code:
  `aimSpread`, `ring`, `sideAlternate`, `laserSweep`, `spawnMinions`, `aimBurst`.
- A stage 9–18 boss = existing archetype + tint + a chosen phase/pattern mix. Distinct feel
  via recolor and pattern combination; zero new draw code.
- Victory triggers after stage 18. `STAGE_COUNT = 18`. Loop mode (`loopMult`) stacks on top
  as today.

## Difficulty: steeper multi-lever curve

Today only `diffMult` (speed) and boss HP scale, capping at 2.25×. New model derives every
lever from stage id, exposed as named constants in `config.js` for one-surface tuning.

| Lever | Now | New (stage 1 → 18) |
|---|---|---|
| `diffMult` (enemy + bullet speed) | 1.0 → 2.25 | 1.0 → ~3.6, steeper past stage 8 |
| Enemy HP | flat | scaling factor per stage |
| Enemy fire rate | flat-ish | interval shrinks with stage |
| Enemy bullet count | fixed per pattern | +1 stream at milestone stages |
| Wave density | hand-set | tighter spacing in later stages |
| Boss HP | 800 → 2000 | 800 → ~4500 |
| Boss phases | 3–5 | up to 6 for stages 15–18 |

- Early stages (1–4) get only a **modest** bump so the opening still teaches the player.
- Steepening is concentrated in stages 6+ where the game currently feels too easy.
- Named tuning constants (e.g. `HP_PER_STAGE`, `FIRERATE_DECAY`, `DIFF_CURVE`) live in
  `config.js`.

Starting numbers are a first pass. "Harder" is subjective — after it runs we playtest and
retune the constants together.

## Migration Plan (high level)

1. Scaffold Vite project (`package.json`, `vite.config.js`, `.gitignore`), move the
   current `<script>`/`<style>` out of `index.html` into `src/` modules **preserving logic
   exactly**. Get the 8-stage game running identically under `npm run dev` and verify
   `npm run build` produces a working single-file `dist/index.html`.
2. Introduce the data-driven `stageData.js` / `waveGen.js` and port the existing 8 stages
   into descriptor form — still behavior-preserving.
3. Extract boss fire behaviors into the named reusable set; parameterize `Boss`.
4. Add stages 9–18 (data + boss configs). Set `STAGE_COUNT = 18`.
5. Apply the multi-lever difficulty curve via `config.js` constants.
6. Add the GitHub Actions Pages workflow.
7. Playtest and retune constants.

Verification checkpoints: the game must be visually/behaviorally identical after step 1 and
step 2 before new content is added.

## Risks

- **Behavior drift during refactor.** Mitigated by the identical-first-then-extend
  sequencing and explicit verification checkpoints.
- **GitHub Pages path issues.** Mitigated by single-file output (no external asset paths).
- **Difficulty overshoot.** Mitigated by centralized tuning constants + a playtest pass.

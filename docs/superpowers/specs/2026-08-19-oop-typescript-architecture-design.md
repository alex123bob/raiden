# Raiden — TypeScript + SOLID Entity Architecture (Design)

Date: 2026-08-19
Status: Approved for planning

## Goal

Convert the codebase to TypeScript and restructure it from its current
procedural style (factory functions returning plain data-bags + free functions
that take the game object `g`) into a **composition-first, SOLID-aligned entity
architecture** where every kind of in-game variation — boss shape, enemy
motion, bullet effect, bullet sound, powerup effect, particle visual,
background feature — is added **by extension** (dropping in one definition file
and registering it) rather than by editing `switch`/`if`-chains spread across
files.

This is explicitly *not* a gameplay change. Every behavioral assertion in the
existing test suite must still hold.

## Motivation / Problem

A survey of the current engine found the same anti-pattern in nearly every
subsystem: **a `type` field plus a `switch`/`if`-chain duplicated across
several files** (draw, update, fire). Adding a new variant means editing
multiple switches in multiple files — a direct Open/Closed violation.

| Family | Variants today | Current variation mechanism |
|---|---|---|
| Boss | 8 archetypes | `archetype` number → `switch` over 8 draw fns; patterns are data |
| Enemy | 4 types | `type` number → 3 separate switches (draw / fire / movement) |
| Bullet (player) | 3 kinds × 5 levels | `type` string → switch in draw + update |
| Bullet (enemy) | 1 kind, many patterns | plain objects; `firePattern` name-dispatch (already data-driven) |
| Powerup | 2 (weapon / bomb) | `isBomb` + `type` branch |
| Particle | 2 (explosion / bomb flash) | `bomb` boolean branch |
| Background feature | 7 features + 3 star layers | `feature` string → parallel if-chains in build/update/draw |
| Audio SFX | 5 sounds | named free functions reaching a global AudioContext |
| Movement path | 3 (down / sin / formation) | `expandPath` switch (already data-driven) |

Two subsystems (enemy-bullet patterns, movement paths) are *already*
data-driven and serve as the model to generalize from.

Additional coupling problems:
- `ctx` and `canvas` are module-singleton imports pulled into ~12 files. Every
  entity depends on concrete browser globals (violates Dependency Inversion and
  forces the `dom-setup` `ctx` proxy hack in tests).
- Audio reaches a global `AudioContext` directly, with
  `if (!g.soundOn) return; try{}catch{}` boilerplate repeated in every SFX fn.
- `g` (the `Game` instance) is an untyped god-object passed everywhere; test
  stubs are hand-built plain objects with no compiler check that they match
  what the code reads.

## Why the extension axes demand composition, not inheritance

The requested customization axes — shape, motion, effect, sound, type — vary
**independently**. A fast red bullet with a trail and a spread bullet with a
chime share a shape but not a sound; homing is orthogonal to both. Deep
inheritance (`HomingTrailBullet extends TrailBullet extends Bullet`) explodes
combinatorially across independent axes. Composition (thin entity class +
pluggable definition objects for the varying parts) scales linearly with each
axis and is what the wishlist actually needs.

## SOLID mapping

- **Single Responsibility** — a renderer draws, a motion fn moves, an sfx fn
  makes sound; the family class only orchestrates the shared per-frame loop.
- **Open/Closed** — new variants are added by new files + one register call;
  existing files are not modified. No `switch` to edit.
- **Liskov** — every family class is a proper `Entity` (`update`/`draw`);
  substitutable in the engine's collections.
- **Interface Segregation** — a minimal `Entity` base plus small typed
  definition interfaces (`BossType`, `EnemyType`, `BulletKind`, …); a variant
  implements only the members its family needs.
- **Dependency Inversion** — entities depend on `RenderContext`, `AudioBus`,
  and `GameContext` abstractions, never on the concrete `canvas.js` /
  `AudioContext` / `Game` concretions.

## Chosen architecture

Composition + registries. **Rejected alternatives:**
- *Deep subclass per variant* — SOLID-violating for independent axes (forces
  fat base classes and combinatorial subclasses; adding a cross-cutting axis
  modifies the tree).
- *Full ECS* — purest decoupling but a disproportionate rewrite for a small
  canvas game, unfamiliar, and heavier to test. YAGNI.

### Entity base and family classes

```ts
abstract class Entity {
  x: number; y: number; r: number;
  alive = true;
  abstract update(dt: number, ctx: GameContext): void;
  abstract draw(rc: RenderContext): void;
}
```

One class per **family**: `Player`, `Enemy`, `Boss`, `Bullet`, `EnemyBullet`,
`Powerup`, `Particle`, plus `BackgroundFeature`. Families are classes because
their per-frame *update logic* genuinely differs. `Game` still owns the
collections (`enemies: Enemy[]`, etc.).

### Variation = registered typed definition

Variation *within* a family is a definition object implementing that family's
interface, registered by key. Example (Boss):

```ts
interface BossType {
  readonly key: string;
  readonly tint: string | null;
  render(rc: RenderContext, boss: Boss, angle: number, timer: number): void;
  patterns: PhasePattern[];
  spawnMinions?: boolean;
  onUpdate?(boss: Boss, dt: number, ctx: GameContext): void; // phantom-alpha, pulse
}

class Boss extends Entity {
  constructor(readonly def: BossType, stage: number, ctx: GameContext) { /* … */ }
  update(dt: number, ctx: GameContext): void { /* shared move/phase/fire; calls def.onUpdate?, iterates def.patterns */ }
  draw(rc: RenderContext): void { rc.withTint(this.def.tint, () => this.def.render(rc, this, /*…*/)); }
}
```

A **registry** is a typed `Map<string, XType>` with `register(def)` and
`get(key)`. One per family: `BOSS_TYPES`, `ENEMY_TYPES`, `BULLET_KINDS`,
`POWERUP_TYPES`, `PARTICLE_KINDS`, `BG_FEATURES`. The definition interfaces are
the compiler-enforced "what do I implement to add a variant" contract.

The existing enemy-bullet fire patterns (`firePattern` by name) and movement
paths (`expandPath`) become typed pattern/motion registries — generalizing the
shape the code already had.

### Dependency-Inversion seams

- **`RenderContext`** — thin interface wrapping the drawing surface. Entity
  `draw(rc)` methods receive it instead of importing `ctx`. `CanvasRenderer`
  wraps a real `CanvasRenderingContext2D`. The Boss offscreen-tint trick becomes
  `rc.withTint(...)`. Tests can pass a no-op/recording renderer.
- **`AudioBus`** — interface `{ play(sfxKey, opts?) }` backed by an `SFX`
  registry. `WebAudioBus` is the real impl; `SilentBus` for tests /
  `soundOn:false`. Removes the per-fn guard/try-catch boilerplate; "add a
  sound" becomes a registry entry.
- These are interfaces over what already exists — **not** a new rendering/audio
  engine. `main.ts` constructs the concrete impls and injects them into `Game`.

### GameContext

The `g` god-object shape is preserved (rewriting it away is out of scope) but
**typed** as an interface so entities depend on a contract, not on `Game`:

```ts
interface GameContext {
  player: Player | null;
  enemies: Enemy[]; boss: Boss | null;
  playerBullets: Bullet[]; enemyBullets: EnemyBullet[];
  powerups: Powerup[]; particles: Particle[];
  currentStage: number; diffMult: number; loopMult: number;
  bossPhase: number; bossAngle: number; bossTimer: number; bossMaxHp: number;
  audio: AudioBus;
  spawnParticles(kind: string, x: number, y: number, opts?: unknown): void;
  saveHS(): void; startStage(n: number): void;
  // …exactly the fields the current code reads
}
class Game implements GameContext { /* … */ }
```

`Game implements GameContext` makes the compiler guarantee the engine provides
everything entities expect, and test stubs are checked against the same
interface (no more silently-incomplete plain-object `g`).

## Directory structure

```
src/
  core/
    Game.ts            engine loop, owns entity collections + game state
    GameContext.ts     typed game object entities receive
    Entity.ts          abstract base: x, y, r, alive, update, draw
    Renderer.ts        RenderContext interface + CanvasRenderer impl
    audio.ts           AudioBus interface + WebAudioBus + SilentBus + SFX registry
    collision.ts  difficulty.ts  input.ts
  entities/
    Boss.ts  Enemy.ts  Bullet.ts  Player.ts  Powerup.ts  Particle.ts
  registries/
    bosses/     one file per boss type + index that registers them
    enemies/    one file per enemy type
    bullets/    one file per bullet kind (player + enemy) + fire patterns
    powerups/   weaponOrb.ts  bomb.ts
    particles/  explosion.ts  bombFlash.ts
    background/ rocks, clouds, bubbles, streaks, hulls, wisps, walls, stars
  stages/
    stageData.ts   waveGen.ts   (stage descriptors reference type *keys*, not numbers)
  render/  hud.ts  screens.ts
  config.ts  canvas.ts  main.ts
```

Adding a variant = add one file under `registries/<family>/` + one line in that
family's `index.ts`. No existing file changes — Open/Closed made concrete.

## Per-family migration

Each family keeps its **exact current behavior**; only dispatch changes from
`switch(type)` to registry lookup.

- **Boss** — `BOSS_TYPES` keyed by name (`'inferno'`, `'solar'`, `'phantom'`,
  …). Each def: `render`, `patterns`, `spawnMinions`, optional `onUpdate`
  (phantom-alpha flicker, boss8 pulse). The 8 `drawBossN` fns become 8 `render`
  fns, one file each. `firePattern` name-dispatch → `BULLET_PATTERNS` registry.
  `stageData` boss `archetype: 5` → `type: 'solar'`.
- **Enemy** — `ENEMY_TYPES` (`'fighter'`, `'gunship'`, `'bomber'`, `'turret'`).
  Each def bundles the three things currently in three separate switches:
  `render`, `fire`, `movement` (+ `hp/r/spd/score/dropChance/color`). Turret's
  "track player / in-range only" logic stays in its def.
- **Bullet** — `BULLET_KINDS` (`'vulcan'`, `'spread'`, `'missile'`, enemy
  bullet). Each def: `render`, optional `onUpdate` (missile homing, vulcan
  trail), `sfxKey`. `firePlayer`/`fireSuper` remain weapon-fire logic that push
  `Bullet` instances built from kinds.
- **Powerup** — `POWERUP_TYPES` (`'weapon'`, `'bomb'`). Def: `render` (icon) +
  `apply(player, ctx)` (pickup effect).
- **Particle** — `PARTICLE_KINDS` (`'explosion'`, `'bombFlash'`). Def: `spawn`,
  `update`, `render`. Replaces the `bomb` boolean branch.
- **Background** — `BG_FEATURES` (`rocks`, `clouds`, `bubbles`, `streaks`,
  `hulls`, `wisps`, `walls`, `stars`). Each def: `build`, `update`, `render`.
  Collapses the seven parallel if-chains into one loop over the stage's active
  features.

## Tooling / TypeScript setup

- Add `typescript` + `@types/node` devDeps; `tsconfig.json` with `strict: true`,
  `target: es2018` (matches current Vite build target), `module: esnext`,
  `moduleResolution: bundler`, `noEmit: true` (Vite/esbuild transpiles; tsc only
  type-checks).
- All `src/**/*.js` → `.ts`; all `tests/**/*.test.js` → `.test.ts`. Vitest and
  Vite handle `.ts` via esbuild. `vite.config` `include` glob widened to `.test.ts`.
- New `npm run typecheck` (`tsc --noEmit`), wired into the GitHub Pages workflow
  ahead of the build, beside the existing test step.
- `import.meta.env.VITE_GIT_SHA` typed via `vite-env.d.ts`.
- `dom-setup.ts` retained; its stub typed loosely via cast so tests compile.
  Where a family class no longer imports the canvas singleton, its tests can use
  a recording `RenderContext` and `SilentBus` instead of the proxy hack.

## Test migration

Each `.test.js` → `.test.ts`, call-sites updated to the new API, **every
behavioral assertion preserved verbatim**:

- **boss.test.ts** — builds `new Boss(BOSS_TYPES.get(key)!, stage, ctx)`, calls
  `boss.fire(ctx)`; the REQUIRED-options pattern check iterates `BOSS_TYPES` +
  `BULLET_PATTERNS` instead of raw `STAGES[].boss.patterns`. Bullet-count and
  HP/phase assertions unchanged.
- **enemy.test.ts** — `new Enemy(ENEMY_TYPES.get('fighter')!, …)`,
  `enemy.fire(ctx)`. HP-scale / extra-stream / fire-interval assertions unchanged.
- **wavegen.test.ts**, **difficulty.test.ts** — pure functions; typed, otherwise
  unchanged (entry counts, sort order, boss trigger, elite HP, difficulty curve).
- **smoke.test.ts** — drives real `Game` end-to-end; constructs `Game` with
  injected `SilentBus` + recording renderer; typed stubs satisfy `GameContext`.
  TITLE→boss→stage-clear, victory, and loop-restart assertions unchanged.

## Definition of done

1. `tsc --noEmit` clean under `strict: true`.
2. All migrated tests green, with original assertions intact.
3. `vite build` produces the single-file bundle (unchanged output shape).
4. CI runs `typecheck` + tests before build.
5. **Extensibility proof:** adding a demo 9th boss (or a new bullet kind)
   requires only a new file + one `register` line — verified by an actual test
   that registers a variant and exercises it, touching no existing family file.

## Out of scope

- Gameplay/balance changes.
- Replacing the `Game`-owns-everything model (kept; only typed).
- Replacing the `ctx`/`canvas` singleton at the boot layer (kept; entities are
  decoupled from it via `RenderContext`, but `main.ts`/`canvas.ts` still create it).
- A full ECS.
```

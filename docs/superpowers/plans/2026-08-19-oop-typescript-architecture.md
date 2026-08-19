# Raiden — TypeScript + SOLID Entity Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Raiden codebase to strict TypeScript and restructure it from a procedural style (factory functions + free functions taking the `g` game object) into a composition-first, SOLID-aligned entity architecture where every in-game variation (boss shape, enemy motion, bullet effect, powerup effect, particle visual, background feature) is added by **extension** (one definition file + one `register` line) instead of editing `switch`/`if`-chains. Every behavioral assertion in the existing 27-test suite must still hold.

**Architecture:** Family classes (`Player`, `Enemy`, `Boss`, `Bullet`, `Powerup`, `Particle`, `BackgroundFeature`) replace factory-returned data-bags. Variation within a family is a registered, typed definition object implementing that family's interface (`BossType`, `EnemyType`, `BulletKind`, `PowerupType`, `ParticleKind`, `BgFeature`) in `src/registries/<family>/`. Entities depend on three DI seams — `RenderContext` (drawing), `AudioBus` (sound), and `GameContext` (the typed `g`) — never on the concrete `canvas.js` / `AudioContext` / `Game`. `Game implements GameContext` so the compiler guarantees the engine provides what entities expect. This is explicitly **not** a gameplay change.

**Tech Stack:** TypeScript ^5.9 (`strict: true`, `noEmit`, `moduleResolution: bundler`), Vite ^6 (esbuild transpiles; `.js`-extension imports resolve to `.ts` files — verified), Vitest ^3, `vite-plugin-singlefile`. No runtime framework.

**Behavior-preservation contract:** the `npm test` suite is the hard gate after **every** task. `tsc --noEmit` is expected to be **red** during Tasks 3–14 (the codebase is mid-migration) and only turns green in Task 15. Typecheck is wired into CI only in Task 15, when it passes.

---

## Verified tooling facts (do not re-derive)

1. **Vite 6 and Vitest 3 resolve `import './x.js'` to a physical `./x.ts` file** when only the `.ts` exists (verified experimentally). Therefore the rename step (Task 2) can rename every `.js` → `.ts` **without touching any import specifier**.
2. Node 24 + npm 11 are present. TypeScript `^5.9.3` is the latest 5.x line.
3. Current baseline: 27 tests green (`npm test`), CI workflow runs `npm ci → npm test → npm run build` on `main`.

---

## File Structure

New files:

```
tsconfig.json
src/vite-env.d.ts
src/core/registry.ts
src/core/Entity.ts
src/core/Renderer.ts
src/core/GameContext.ts
src/entities/Particle.ts
src/registries/bosses/{blaze,hexa,dreadnaught,viper,solar,carrier,phantom,tyrant,index}.ts
src/registries/enemies/{fighter,gunship,bomber,turret,index}.ts
src/registries/bullets/{vulcan,spread,missile,enemy,patterns,index}.ts
src/registries/powerups/{weaponOrb,bomb,index}.ts
src/registries/particles/{explosion,bombFlash,index}.ts
src/registries/background/{rocks,clouds,bubbles,streaks,hulls,wisps,walls,stars,index}.ts
tests/context-stub.ts
tests/extensibility.test.ts
tests/renderer.test.ts
tests/audio.test.ts
```

Renamed (extension only, contents unchanged, imports untouched): every `src/**/*.js` → `.ts` and every `tests/*.js` → `.ts`.

Rewritten in place: `src/core/audio.ts`, `src/core/Game.ts`, `src/entities/*.ts`, `src/stages/background.ts`, `src/stages/waveGen.ts`, `src/stages/stageData.ts`, `src/main.ts`, `vite.config.js`, `.github/workflows/pages.yml`, and the test files.

Deleted: `src/core/particles.js` (superseded by `entities/Particle.ts` + `registries/particles/`).

### Registry pattern (all families share it)

```ts
// src/core/registry.ts
export interface RegistryEntry {
  readonly key: string;
}
export function makeRegistry<T extends RegistryEntry>() {
  const map = new Map<string, T>();
  return {
    register(def: T): void { map.set(def.key, def); },
    get(key: string): T | undefined { return map.get(key); },
    has(key: string): boolean { return map.has(key); },
    all(): T[] { return [...map.values()]; },
  };
}
```

A family's `index.ts` imports every def object and calls `registerX(def)` on each (the index is the single place that registers). Importing the family's class module transitively imports its registry, so registration is guaranteed anywhere `Game` (or a test) runs. Def files **never** call `register*` themselves (see the registry pattern note in Task 5 — calling it there would crash on the TDZ binding under circular ESM evaluation).

### DI seams (final shapes)

```ts
// src/core/Entity.ts
import type { GameContext } from './GameContext.js';
import type { RenderContext } from './Renderer.js';

export abstract class Entity {
  x: number;
  y: number;
  r: number;
  alive = true;
  constructor(x = 0, y = 0, r = 0) { this.x = x; this.y = y; this.r = r; }
  abstract update(dt: number, ctx: GameContext): void;
  abstract draw(rc: RenderContext, ctx: GameContext): void;
}
```

```ts
// src/core/GameContext.ts
import type { Player } from '../entities/Player.js';
import type { Enemy } from '../entities/Enemy.js';
import type { Boss } from '../entities/Boss.js';
import type { Bullet, EnemyBullet } from '../entities/Bullet.js';
import type { Powerup } from '../entities/Powerup.js';
import type { Particle } from '../entities/Particle.js';
import type { AudioBus } from './audio.js';

// The typed `g`: exactly the fields the current code reads, declared as a
// contract so Game implements it and test stubs are compiler-checked.
export interface GameContext {
  state: number;
  keys: Record<string, boolean>;
  moveVec: { x: number; y: number };
  player: Player | null;
  enemies: Enemy[];
  boss: Boss | null;
  playerBullets: Bullet[];
  enemyBullets: EnemyBullet[];
  powerups: Powerup[];
  particles: Particle[];
  currentStage: number;
  diffMult: number;
  loopMult: number;
  bossMaxHp: number;
  bossPhase: number;
  bossAngle: number;
  bossTimer: number;
  stageTimer: number;
  stageClearTimer: number;
  victoryTimer: number;
  score: number;
  audio: AudioBus;
  spawnParticles(kind: string, x: number, y: number, opts?: Record<string, unknown>): void;
  saveHS(): void;
  startStage(n: number): void;
}

> `stageClearTimer`/`victoryTimer` are read/written by `Boss.onBossDeath` (Task 10) and `Player.update`, so they are part of the entity-facing contract.
```

> Note: `Entity.draw` takes both `rc` **and** `ctx` (the design sketch showed only `rc`). `Boss.draw` needs `ctx.bossAngle`/`bossTimer`/`bossMaxHp` for the HP bar and the boss render call, so the base signature carries both. This is the single deliberate deviation from the spec snippet; all families are substitutable under it (Liskov holds).

```ts
// src/core/Renderer.ts
export interface RenderContext {
  // Boss tint: draws drawLocal() onto an offscreen canvas sized to radius,
  // source-atop tints it, blits at (bx-R, by-R). When tint is null it just
  // translates to (bx,by), runs drawLocal(), and restores.
  withTint(tint: string | null, radius: number, bx: number, by: number,
          drawLocal: (c: CanvasRenderingContext2D) => void): void;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number,
          startAngle: number, endAngle: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  fill(): void;
  stroke(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  drawImage(img: CanvasImageSource, dx: number, dy: number): void;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradient;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient;
  fillText(text: string, x: number, y: number): void;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  globalAlpha: number;
  shadowColor: string;
  shadowBlur: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
}
```

```ts
// src/core/Renderer.ts (implementation)
export class CanvasRenderer implements RenderContext {
  private offCanvas: HTMLCanvasElement | null = null;
  private offSize = 0;
  constructor(private readonly c: CanvasRenderingContext2D) {}
  withTint(tint, radius, bx, by, drawLocal) {
    if (!tint) {
      this.c.save(); this.c.translate(bx, by); drawLocal(this.c); this.c.restore();
      return;
    }
    const R = Math.ceil(radius * 2.0) + 8;
    const size = R * 2;
    if (!this.offCanvas) this.offCanvas = document.createElement('canvas');
    if (this.offSize !== size) { this.offCanvas.width = this.offCanvas.height = size; this.offSize = size; }
    const oc = this.offCanvas.getContext('2d')!;
    oc.setTransform(1, 0, 0, 1, 0, 0);
    oc.clearRect(0, 0, size, size);
    oc.save(); oc.translate(R, R); drawLocal(oc); oc.restore();
    oc.globalCompositeOperation = 'source-atop';
    oc.fillStyle = tint;
    oc.fillRect(0, 0, size, size);
    oc.globalCompositeOperation = 'source-over';
    this.c.drawImage(this.offCanvas, bx - R, by - R);
  }
  save() { this.c.save(); }
  restore() { this.c.restore(); }
  translate(x, y) { this.c.translate(x, y); }
  rotate(a) { this.c.rotate(a); }
  beginPath() { this.c.beginPath(); }
  moveTo(x, y) { this.c.moveTo(x, y); }
  lineTo(x, y) { this.c.lineTo(x, y); }
  closePath() { this.c.closePath(); }
  arc(x, y, r, s, e) { this.c.arc(x, y, r, s, e); }
  ellipse(x, y, rx, ry, rot, s, e) { this.c.ellipse(x, y, rx, ry, rot, s, e); }
  bezierCurveTo(a, b, c2, d, e, f) { this.c.bezierCurveTo(a, b, c2, d, e, f); }
  fill() { this.c.fill(); }
  stroke() { this.c.stroke(); }
  fillRect(x, y, w, h) { this.c.fillRect(x, y, w, h); }
  strokeRect(x, y, w, h) { this.c.strokeRect(x, y, w, h); }
  drawImage(img, dx, dy) { this.c.drawImage(img, dx, dy); }
  createRadialGradient(x0, y0, r0, x1, y1, r1) { return this.c.createRadialGradient(x0, y0, r0, x1, y1, r1); }
  createLinearGradient(x0, y0, x1, y1) { return this.c.createLinearGradient(x0, y0, x1, y1); }
  fillText(t, x, y) { this.c.fillText(t, x, y); }
  get fillStyle() { return this.c.fillStyle; }
  set fillStyle(v) { this.c.fillStyle = v; }
  get strokeStyle() { return this.c.strokeStyle; }
  set strokeStyle(v) { this.c.strokeStyle = v; }
  get lineWidth() { return this.c.lineWidth; }
  set lineWidth(v) { this.c.lineWidth = v; }
  get globalAlpha() { return this.c.globalAlpha; }
  set globalAlpha(v) { this.c.globalAlpha = v; }
  get shadowColor() { return this.c.shadowColor; }
  set shadowColor(v) { this.c.shadowColor = v; }
  get shadowBlur() { return this.c.shadowBlur; }
  set shadowBlur(v) { this.c.shadowBlur = v; }
  get font() { return this.c.font; }
  set font(v) { this.c.font = v; }
  get textAlign() { return this.c.textAlign; }
  set textAlign(v) { this.c.textAlign = v; }
  get textBaseline() { return this.c.textBaseline; }
  set textBaseline(v) { this.c.textBaseline = v; }
}
```

```ts
// src/core/audio.ts (final)
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
  play(): void {}
  setEnabled(): void {}
}
```

---

## Task 1: TypeScript tooling

**Files:**
- Modify: `package.json` (devDeps + `typecheck` script)
- Create: `tsconfig.json`, `src/vite-env.d.ts`

- [ ] **Step 1: Install TypeScript tooling**

```bash
npm install -D typescript@^5.9.3 @types/node
```

- [ ] **Step 2: Add the typecheck script**

Edit `package.json` scripts:

```json
"scripts": {
  "dev": "vite",
  "build": "vite build",
  "preview": "vite preview",
  "test": "vitest run",
  "typecheck": "tsc --noEmit"
},
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2018",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2018", "DOM"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["node"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 4: Create `src/vite-env.d.ts`**

```ts
/// <reference types="vite/client" />
```

- [ ] **Step 5: Verify typecheck passes trivially and tests stay green**

Run: `npm run typecheck` — Expected: PASS (no `.ts` files beyond the d.ts are checked; `allowJs` is off, so `.js` files are ignored).
Run: `npm test` — Expected: PASS, 27 tests.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json src/vite-env.d.ts
git commit -m "chore: add TypeScript tooling and typecheck script"
```

## Task 2: Rename every `.js` to `.ts` (behavior unchanged)

**Files:**
- Rename: all `src/**/*.js` → `.ts`, all `tests/*.js` → `.ts` (import specifiers unchanged — verified that Vite/Vitest resolve `.js` → `.ts`)
- Modify: `vite.config.js` (test glob + setupFiles), `.gitignore` check

- [ ] **Step 1: Rename all source files**

```bash
for f in $(git ls-files 'src/*.js' 'tests/*.js'); do git mv "$f" "${f%.js}.ts"; done
git mv tests/dom-setup.js tests/dom-setup.ts
```

- [ ] **Step 2: Update `vite.config.js`**

```js
import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
  build: { target: 'es2018' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/dom-setup.ts'],
  },
});
```

- [ ] **Step 3: Make `dom-setup.ts` compile under strict** (export the stub ctx for later tasks)

Replace the body of `tests/dom-setup.ts` with (adds the `noopCtx` export used by every later test that draws):

```ts
// Minimal browser-DOM stub so module-graph imports (which pull in canvas.js)
// can evaluate in vitest's node environment. Runs before every test file.
const gradient = { addColorStop() {} };
const ctxStub = new Proxy({}, {
  get(t, prop) {
    if (prop in t) return t[prop];
    if (prop === 'createRadialGradient' || prop === 'createLinearGradient')
      return () => gradient;
    if (prop === 'canvas') return {};
    return typeof prop === 'string' ? (() => {}) : undefined;
  },
  set() { return true; },
});

export const noopCtx = ctxStub as unknown as CanvasRenderingContext2D;

const canvasEl = {
  width: 0, height: 0,
  style: {},
  getContext: () => ctxStub,
  addEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 640 }),
};

(globalThis as unknown as { document: unknown }).document = {
  getElementById: (id: string) => (id === 'c' ? canvasEl : null),
  createElement: () => canvasEl,
  addEventListener() {},
};
(globalThis as unknown as { window: unknown }).window = {
  innerWidth: 1024, innerHeight: 768,
  addEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  AudioContext: undefined,
};
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
(globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
let rafCb: ((ts: number) => void) | null = null;
globalThis.requestAnimationFrame = (cb: (ts: number) => void) => { rafCb = cb; return 1; };
globalThis.cancelAnimationFrame = () => {};
```

- [ ] **Step 4: Verify tests and build are still green**

Run: `npm test` — Expected: PASS, 27 tests.
Run: `npm run build` — Expected: PASS, single-file bundle emitted to `dist/`.

- [ ] **Step 5: Record expected typecheck status (informational, not a gate)**

Run: `npm run typecheck` — Expected: **RED** with implicit-any and untyped-`g` errors. This is expected; typecheck is only required green at Task 17.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: rename all source and test files to TypeScript"
```

## Task 3: Core seams — registry, Entity, RenderContext, GameContext

**Files:**
- Create: `src/core/registry.ts`, `src/core/Entity.ts`, `src/core/Renderer.ts`, `src/core/GameContext.ts`
- Test: `tests/renderer.test.ts`

- [ ] **Step 1: Write the failing renderer test**

Create `tests/renderer.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { CanvasRenderer, type RenderContext } from '../src/core/Renderer.js';
import { noopCtx } from './dom-setup.js';

function makeSpyContext() {
  const calls: string[] = [];
  const c = new Proxy({}, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient')
        return () => ({ addColorStop() {} });
      return (..._args: unknown[]) => { calls.push(String(prop)); return undefined; };
    },
    set(t, prop, value) { calls.push('set:' + String(prop)); return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { calls, c };
}

describe('CanvasRenderer', () => {
  it('forwards drawing calls to the underlying context', () => {
    const { calls, c } = makeSpyContext();
    const rc: RenderContext = new CanvasRenderer(c);
    rc.fillStyle = '#fff';
    rc.fillRect(1, 2, 3, 4);
    rc.beginPath();
    expect(calls).toContain('set:fillStyle');
    expect(calls).toContain('fillRect');
    expect(calls).toContain('beginPath');
  });

  it('withTint on an untinted def translates, draws, and restores', () => {
    const { calls, c } = makeSpyContext();
    const rc: RenderContext = new CanvasRenderer(c);
    let drew = false;
    rc.withTint(null, 50, 100, 200, () => { drew = true; });
    expect(drew).toBe(true);
    expect(calls).toEqual(['save', 'translate', 'restore']);
  });

  it('withTint on a tinted def blits through drawImage without throwing', () => {
    const rc: RenderContext = new CanvasRenderer(noopCtx);
    expect(() => rc.withTint('#ff0000', 50, 100, 200, () => {})).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/renderer.test.ts`
Expected: FAIL — `Cannot find module '../src/core/Renderer.js'`.

- [ ] **Step 3: Create `src/core/registry.ts`** (exactly as in File Structure above)

- [ ] **Step 4: Create `src/core/Entity.ts`** (exactly as in File Structure above)

- [ ] **Step 5: Create `src/core/Renderer.ts`** with the `RenderContext` interface and `CanvasRenderer` class (exactly as in File Structure above)

- [ ] **Step 6: Create `src/core/GameContext.ts`** (exactly as in File Structure above)

> Note: `GameContext.ts` imports the family classes **type-only**. TypeScript will report "Cannot find name 'Player'" etc. until the class tasks land — this is expected red until Tasks 8–10 land the family classes. At runtime the imports are erased, so nothing breaks.

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run tests/renderer.test.ts`
Expected: PASS (3 tests).
Run: `npm test` — Expected: PASS, 30 tests (27 + 3 new).

- [ ] **Step 8: Commit**

```bash
git add src/core/registry.ts src/core/Entity.ts src/core/Renderer.ts src/core/GameContext.ts tests/renderer.test.ts
git commit -m "feat: add DI seams (Entity, RenderContext, GameContext, registry)"
```

## Task 4: AudioBus + SFX registry

**Files:**
- Rewrite: `src/core/audio.ts`
- Test: `tests/audio.test.ts`

- [ ] **Step 1: Write the failing audio test**

Create `tests/audio.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { SilentBus, WebAudioBus, getAudio } from '../src/core/audio.js';
import { SFX_REGISTRY_KEYS } from '../src/core/audio.js';

describe('audio bus', () => {
  it('registers the four engine sound effects', () => {
    expect(SFX_REGISTRY_KEYS().sort()).toEqual(['shoot', 'explosion', 'powerup', 'bomb'].sort());
  });

  it('SilentBus never throws and ignores everything', () => {
    const bus = new SilentBus();
    expect(() => { bus.play('shoot', { weapon: 0 }); bus.setEnabled(false); }).not.toThrow();
  });

  it('WebAudioBus is a silent no-op when no AudioContext exists', () => {
    const bus = new WebAudioBus();
    expect(() => bus.play('explosion', { size: 3 })).not.toThrow();
    expect(getAudio()).toBeNull();   // dom-setup defines window.AudioContext = undefined
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/audio.test.ts`
Expected: FAIL — `SFX_REGISTRY_KEYS` is not exported.

- [ ] **Step 3: Rewrite `src/core/audio.ts`**

Replace the entire file (the current `sfxShoot/sfxExplosion/sfxPowerup/sfxBomb` functions are deleted; their bodies become registry defs). The `AudioBus`, `SfxDef`, `getAudio`, `WebAudioBus`, `SilentBus` parts are exactly as in the File Structure section. The four defs are ported verbatim from the old function bodies with `g` guards/try-catch removed (the bus handles both), and an exported key list helper:

```ts
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
```

- [ ] **Step 4: Keep deprecated `sfx*` wrappers so unmigrated callers keep working**

`input.ts` still calls `getAudio()` (kept). The **old `Player.ts`, `Powerup.ts`, and `core/particles.js` still import `sfxShoot`/`sfxBomb`/`sfxPowerup`/`sfxExplosion`** — those modules are not migrated until Tasks 5–8, and `npm test` (smoke) drives them. So this task **keeps the four old exports as thin delegates** honoring `g.soundOn`:

```ts
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
```

> These wrappers are **deleted in Task 8** once `Player` is a class and no longer imports them. `npm test` stays green throughout because the registry (Task 4) and the wrappers coexist.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/audio.test.ts`
Expected: PASS (3 tests).
Run: `npm test` — Expected: PASS (33 tests).

- [ ] **Step 6: Commit**

```bash
git add src/core/audio.ts tests/audio.test.ts
git commit -m "refactor: audio behind AudioBus interface with SFX registry"
```

## Task 5: Particle family

**Files:**
- Create: `src/entities/Particle.ts`, `src/registries/particles/explosion.ts`, `src/registries/particles/bombFlash.ts`, `src/registries/particles/index.ts`
- Delete: `src/core/particles.js`

- [ ] **Step 1: Design the failing particle test (created in Task 8)**

The particle unit test below is the TDD red-first spec, but **it must NOT be created in this task**. It imports `stubContext` from `tests/context-stub.ts`, which imports the `Player` class — which does not exist until Task 8. Vitest auto-collects every `tests/**/*.test.ts`, so creating `particle.test.ts` now would break `npm test`. The file is created in Task 8 (Step 3) with exactly this content. The source files in this task are verified by `npm test` (smoke drives particle spawn/update/render end-to-end):

```ts
import { describe, it, expect } from 'vitest';
import { PARTICLE_KINDS, registerParticleKind } from '../src/registries/particles/index.js';
import { spawnParticleKind } from '../src/entities/Particle.js';
import { stubContext } from './context-stub.js';
import { CanvasRenderer } from '../src/core/Renderer.js';
import { noopCtx } from './dom-setup.js';

describe('particle kinds', () => {
  it('registers explosion and bombFlash', () => {
    expect(PARTICLE_KINDS.all().map(k => k.key).sort()).toEqual(['bombFlash', 'explosion']);
  });

  it('spawnExplosion pushes the declared particle count and never throws', () => {
    const g = stubContext();
    const x = 10, y = 20, size = 2;
    spawnParticleKind('explosion', x, y, { size, color: '#ff8800' }, g);
    expect(g.particles.length).toBe(6 + size * 4);
    for (const p of g.particles) {
      expect(p.x).toBe(x); expect(p.y).toBe(y);
      expect(p.r).toBeGreaterThanOrEqual(2); expect(p.r).toBeLessThanOrEqual(2 + size * 3);
    }
  });

  it('spawnBombFlash pushes exactly one full-screen flash particle', () => {
    const g = stubContext();
    spawnParticleKind('bombFlash', 0, 0, {}, g);
    expect(g.particles.length).toBe(1);
    const rc = new CanvasRenderer(noopCtx);
    expect(() => g.particles[0].update(1 / 60, g)).not.toThrow();
    expect(() => g.particles[0].draw(rc, g)).not.toThrow();
  });

  it('an unknown kind is a silent no-op', () => {
    const g = stubContext();
    expect(() => spawnParticleKind('doesNotExist', 0, 0, {}, g)).not.toThrow();
    expect(g.particles.length).toBe(0);
  });
});
```

- [ ] **Step 2: Create the shared context stub (also used by every later task)**

Create `tests/context-stub.ts`:

```ts
import type { GameContext } from '../src/core/GameContext.js';
import { SilentBus } from '../src/core/audio.js';
import { Player } from '../src/entities/Player.js';
import { spawnParticleKind } from '../src/entities/Particle.js';

export function stubContext(overrides: Partial<GameContext> = {}): GameContext {
  const ctx: GameContext = {
    state: 1,
    keys: {},
    moveVec: { x: 0, y: 0 },
    player: new Player(),
    enemies: [],
    boss: null,
    playerBullets: [],
    enemyBullets: [],
    powerups: [],
    particles: [],
    currentStage: 1,
    diffMult: 1.0,
    loopMult: 1,
    bossMaxHp: 0,
    bossPhase: 0,
    bossAngle: 0,
    bossTimer: 0,
    stageTimer: 0,
    score: 0,
    audio: new SilentBus(),
    spawnParticles(kind, x, y, opts) { spawnParticleKind(kind, x, y, opts ?? {}, ctx); },
    saveHS() {},
    startStage() {},
    ...overrides,
  };
  return ctx;
}
```

> `tests/context-stub.ts` is created now but nothing imports it until Task 8 (it imports the not-yet-existing `Player` class — vitest only auto-collects `*.test.ts`, so the dead file is harmless; tsc flags it, expected red). `tests/particle.test.ts` is created in Task 8.

- [ ] **Step 3: Create `src/entities/Particle.ts`**

```ts
import type { GameContext } from '../core/GameContext.js';
import type { RenderContext } from '../core/Renderer.js';
import { Entity } from '../core/Entity.js';
import { PARTICLE_KINDS } from '../registries/particles/index.js';

export interface ParticleKind {
  readonly key: string;
  spawn(ctx: GameContext, x: number, y: number, opts: Record<string, unknown>): void;
  update(p: Particle, dt: number, ctx: GameContext): void;
  render(rc: RenderContext, p: Particle): void;
}

export class Particle extends Entity {
  vx = 0;
  vy = 0;
  life = 1.0;
  decay = 1.0;
  color = '#ff8800';
  constructor(public readonly def: ParticleKind, x: number, y: number) {
    super(x, y, 0);
  }
  update(dt: number, ctx: GameContext): void {
    this.life -= this.decay * dt;
    if (this.life <= 0) { this.alive = false; return; }
    this.def.update(this, dt, ctx);
  }
  draw(rc: RenderContext, _ctx: GameContext): void {
    this.def.render(rc, this);
  }
}

export function spawnParticleKind(kind: string, x: number, y: number,
                                  opts: Record<string, unknown>, ctx: GameContext): void {
  const def = PARTICLE_KINDS.get(kind);
  if (!def) return;
  def.spawn(ctx, x, y, opts);
}

// Backward-compat wrappers used by the still-unmigrated Player.ts, Boss.ts and
// collision.ts callers (signature matches the old particles.js exactly).
// Deleted in Task 10 once every caller uses ctx.spawnParticles.
export function spawnExplosion(x: number, y: number, size: number, color: string, ctx: GameContext): void {
  spawnParticleKind('explosion', x, y, { size, color }, ctx);
}
export function spawnBombFlash(ctx: GameContext): void {
  spawnParticleKind('bombFlash', 0, 0, {}, ctx);
}

export function updateParticles(dt: number, ctx: GameContext): void {
  for (let i = ctx.particles.length - 1; i >= 0; i--) {
    const p = ctx.particles[i];
    p.update(dt, ctx);
    if (!p.alive) ctx.particles.splice(i, 1);
  }
}

export function drawParticles(rc: RenderContext, ctx: GameContext): void {
  ctx.particles.forEach(p => p.draw(rc, ctx));
}
```

- [ ] **Step 4: Create the two particle definitions**

`src/registries/particles/explosion.ts`:

```ts
import { Particle, type ParticleKind } from '../../entities/Particle.js';

export const explosion: ParticleKind = {
  key: 'explosion',
  spawn(ctx, x, y, opts) {
    const size = typeof opts.size === 'number' ? opts.size : 1;
    const color = typeof opts.color === 'string' ? opts.color : '#ff8800';
    const count = 6 + size * 4;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 80 * size;
      const p = new Particle(explosion, x, y);
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.life = 1.0;
      p.decay = 0.7 + Math.random() * 0.8;
      p.r = 2 + Math.random() * size * 3;
      p.color = color;
      ctx.particles.push(p);
    }
    ctx.audio.play('explosion', { size });
  },
  update(p, dt) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.94;
    p.vy *= 0.94;
  },
  render(rc, p) {
    rc.globalAlpha = Math.max(0, p.life);
    rc.fillStyle = p.color;
    rc.beginPath();
    rc.arc(p.x, p.y, Math.max(0.5, p.r * p.life), 0, Math.PI * 2);
    rc.fill();
    rc.globalAlpha = 1;
  },
};
```

`src/registries/particles/bombFlash.ts`:

```ts
import { W, H } from '../../config.js';
import { Particle, type ParticleKind } from '../../entities/Particle.js';

export const bombFlash: ParticleKind = {
  key: 'bombFlash',
  spawn(ctx, x, y) {
    const p = new Particle(bombFlash, x, y);
    p.life = 1.0;
    p.decay = 2.5;
    ctx.particles.push(p);
  },
  update() {},
  render(rc, p) {
    rc.fillStyle = 'rgba(255,255,200,' + (p.life * 0.75) + ')';
    rc.fillRect(0, 0, W, H);
  },
};
```

`src/registries/particles/index.ts`:

```ts
import { makeRegistry } from '../../core/registry.js';
import type { ParticleKind } from '../../entities/Particle.js';
import { explosion } from './explosion.js';
import { bombFlash } from './bombFlash.js';

export const PARTICLE_KINDS = makeRegistry<ParticleKind>();
export const registerParticleKind = PARTICLE_KINDS.register;
registerParticleKind(explosion);
registerParticleKind(bombFlash);
```

> **Registry import pattern (applies to every family):** def files (e.g. `explosion.ts`) only `export const def: XType = {…}` and **never call `register*` themselves** — calling it there would import the index from the def, and ESM evaluates the def before the index's body, crashing on the TDZ `register*` binding. The index file imports the def objects and calls `register*` itself. Adding a variant = one new def file + one `registerX(def)` line in the index. (`registerX` stays exported so runtime/test code — e.g. the Task 14 extensibility proof — can register programmatically.)

- [ ] **Step 5: Update the consumer `Game.ts`** so smoke stays green. The renamed `src/core/Game.ts` still imports `updateParticles, drawParticles` from `../core/particles.js`; change the import to `../entities/Particle.js` and update the two call sites. Add the injected deps to `Game` now (this is the seed of the Task 11 rewrite):

In `src/core/Game.ts`, change the import:

```ts
import { updateParticles, drawParticles } from '../entities/Particle.js';
```

Add to the top of the file (after the existing imports):

```ts
import { CanvasRenderer, type RenderContext } from './Renderer.js';
import { WebAudioBus, type AudioBus } from './audio.js';
import { ctx } from '../canvas.js';
import { spawnParticleKind } from '../entities/Particle.js';
```

Add these fields, the constructor initialization, and the `spawnParticles` method to the `Game` class (keep every existing field initializer and the existing `this.loop = this.loop.bind(this);` line):

```ts
  readonly renderer: RenderContext;
  readonly audio: AudioBus;

  constructor() {
    this.renderer = new CanvasRenderer(ctx);
    this.audio = new WebAudioBus();
    // ...existing field initializers unchanged...
  }

  spawnParticles(kind: string, x: number, y: number, opts?: Record<string, unknown>): void {
    spawnParticleKind(kind, x, y, opts ?? {}, this);
  }
```

> `Game.spawnParticles` must exist **now** because collision.ts (Task 7) and the old Player/Boss callers (via the wrappers) rely on it before the Task 11 rewrite.

In `loop()`:
- keep `if (this.state === STATE.PLAYING || this.state === STATE.STAGECLEAR) updateParticles(dt, this);`
- change `drawParticles(this);` → `drawParticles(this.renderer, this);`

**Repoint the other three importers of the deleted `core/particles.ts` module** to the wrapper exports in `entities/Particle.ts` (same names, same signatures):
- `src/entities/Player.ts:4` → `import { spawnExplosion, spawnBombFlash } from '../entities/Particle.js';`
- `src/entities/Boss.ts:3` → `import { spawnExplosion } from '../entities/Particle.js';`
- `src/core/collision.ts:1` → `import { spawnExplosion } from '../entities/Particle.js';`

> Without these, deleting `core/particles.ts` leaves dangling imports and the smoke test (which drives Player/Boss/collision) crashes.

> `Game.ts` still uses the old function-call structure at this point; only the particle calls change. `npm test` (specifically smoke) is the gate.

- [ ] **Step 6: Verify existing suite green**

Run: `npm test` — Expected: PASS (33 tests). The `drawParticles` signature change is covered by smoke's render-every-screen test.

- [ ] **Step 7: Commit**

```bash
git add src/entities/Particle.ts src/registries/particles src/core/Game.ts
git rm src/core/particles.js
git add -A
git commit -m "refactor: particles behind PARTICLE_KINDS registry"
```

> `tests/particle.test.ts` is NOT created in this task (see Step 1) — it lands in Task 8. TDD discipline for this foundational task is satisfied by the smoke test exercising particle spawn/update/render end-to-end.

## Task 6: Powerup family

**Files:**
- Create: `src/registries/powerups/weaponOrb.ts`, `src/registries/powerups/bomb.ts`, `src/registries/powerups/index.ts`
- Rewrite: `src/entities/Powerup.ts`
- Modify: `src/core/Game.ts` (powerup calls), `src/core/collision.ts` (checkPlayerVsPowerups call)

- [ ] **Step 1: Port `Powerup` to a class**

Replace `src/entities/Powerup.ts`:

```ts
import { W, H } from '../config.js';
import type { GameContext } from '../core/GameContext.js';
import type { RenderContext } from '../core/Renderer.js';
import { Entity } from '../core/Entity.js';
import { circleHit } from '../core/collision.js';
import { WEAPON_NAMES, WEAPON_COLORS } from './Bullet.js';
import type { Enemy } from './Enemy.js';
import { POWERUP_TYPES } from '../registries/powerups/index.js';

export interface PowerupType {
  readonly key: string;   // 'weapon' | 'bomb'
  render(rc: RenderContext, pw: Powerup): void;
  apply(pw: Powerup, ctx: GameContext): void;
}

export class Powerup extends Entity {
  vy = 55;
  life = 9.0;
  wType = 0;
  constructor(public readonly def: PowerupType, x: number, y: number, wType?: number) {
    super(x, y, 10);
    this.wType = wType ?? 0;
  }
  update(dt: number, _ctx: GameContext): void {
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.y > H + 20 || this.life <= 0) this.alive = false;
  }
  draw(rc: RenderContext, _ctx: GameContext): void {
    rc.save();
    rc.translate(this.x, this.y);
    this.def.render(rc, this);
    rc.restore();
  }
  apply(ctx: GameContext): void {
    this.def.apply(this, ctx);
  }
}

export function tryDropPowerup(e: Enemy, ctx: GameContext): void {
  if (Math.random() >= e.dropChance) return;
  const isBomb = Math.random() < 0.15;
  const wType = Math.floor(Math.random() * 3);
  const def = POWERUP_TYPES.get(isBomb ? 'bomb' : 'weapon')!;
  ctx.powerups.push(new Powerup(def, e.x, e.y, isBomb ? undefined : wType));
}

export function updatePowerups(dt: number, ctx: GameContext): void {
  for (let i = ctx.powerups.length - 1; i >= 0; i--) {
    const pw = ctx.powerups[i];
    pw.update(dt, ctx);
    if (!pw.alive) ctx.powerups.splice(i, 1);
  }
}

export function checkPlayerVsPowerups(ctx: GameContext): void {
  if (!ctx.player || ctx.player.dead) return;
  for (let i = ctx.powerups.length - 1; i >= 0; i--) {
    const pw = ctx.powerups[i];
    if (!circleHit(pw.x, pw.y, pw.r, ctx.player.x, ctx.player.y, ctx.player.r + 10)) continue;
    pw.apply(ctx);
    ctx.audio.play('powerup');
    ctx.powerups.splice(i, 1);
  }
}

export function drawPowerups(rc: RenderContext, ctx: GameContext): void {
  ctx.powerups.forEach(pw => pw.draw(rc, ctx));
}
```

> The original draw loop body (icon letters) moves into the two defs. `checkPlayerVsPowerups` keeps its original splice semantics (removed on hit, same frame).

- [ ] **Step 2: Create the two powerup defs**

`src/registries/powerups/weaponOrb.ts`:

```ts
import { WEAPON_NAMES, WEAPON_COLORS } from '../../entities/Bullet.js';
import type { PowerupType } from '../../entities/Powerup.js';

export const weaponOrb: PowerupType = {
  key: 'weapon',
  render(rc, pw) {
    rc.fillStyle = WEAPON_COLORS[pw.wType];
    rc.beginPath(); rc.arc(0, 0, pw.r, 0, Math.PI * 2); rc.fill();
    rc.fillStyle = '#fff';
    rc.font = 'bold 7px monospace'; rc.textAlign = 'center'; rc.textBaseline = 'middle';
    rc.fillText(WEAPON_NAMES[pw.wType][0], 0, 1);
  },
  apply(pw, ctx) {
    const slots = ctx.player!.weapons;
    const existing = slots.findIndex(s => s.type === pw.wType);
    if (existing !== -1) {
      slots[existing].lv = Math.min(5, slots[existing].lv + 1);
    } else {
      if (slots.length >= 2) slots.shift();
      slots.push({ type: pw.wType, lv: 1 });
    }
  },
};
```

`src/registries/powerups/bomb.ts`:

```ts
import type { PowerupType } from '../../entities/Powerup.js';

export const bomb: PowerupType = {
  key: 'bomb',
  render(rc, pw) {
    rc.fillStyle = '#ff88ff';
    rc.beginPath(); rc.arc(0, 0, pw.r, 0, Math.PI * 2); rc.fill();
    rc.fillStyle = '#fff';
    rc.font = 'bold 8px monospace'; rc.textAlign = 'center'; rc.textBaseline = 'middle';
    rc.fillText('B', 0, 1);
  },
  apply(_pw, ctx) {
    ctx.player!.bombs = Math.min(3, ctx.player!.bombs + 1);
  },
};
```

`src/registries/powerups/index.ts`:

```ts
import { makeRegistry } from '../../core/registry.js';
import type { PowerupType } from '../../entities/Powerup.js';
import { weaponOrb } from './weaponOrb.js';
import { bomb } from './bomb.js';

export const POWERUP_TYPES = makeRegistry<PowerupType>();
export const registerPowerupType = POWERUP_TYPES.register;
registerPowerupType(weaponOrb);
registerPowerupType(bomb);
```

- [ ] **Step 3: Update `Game.ts` powerup calls**

In `src/core/Game.ts`, change `drawPowerups(this)` → `drawPowerups(this.renderer, this)`.

- [ ] **Step 4: Update `collision.ts` import** (the `tryDropPowerup` import path is unchanged; it already imports from `../entities/Powerup.js` which now exports the new functions — no edit needed unless the name changed; verify nothing else imports the old exports).

- [ ] **Step 5: Verify suite green**

Run: `npm test` — Expected: PASS (33 tests). Smoke exercises drops/collects via collision + rendering.

- [ ] **Step 6: Commit**

```bash
git add src/entities/Powerup.ts src/registries/powerups src/core/Game.ts
git commit -m "refactor: powerups behind POWERUP_TYPES registry"
```

## Task 7: Bullet family — Bullet class, BULLET_KINDS, BULLET_PATTERNS

**Files:**
- Rewrite: `src/entities/Bullet.ts`
- Create: `src/registries/bullets/vulcan.ts`, `src/registries/bullets/spread.ts`, `src/registries/bullets/missile.ts`, `src/registries/bullets/enemy.ts`, `src/registries/bullets/patterns.ts`, `src/registries/bullets/index.ts`
- Modify: `src/core/Game.ts` (bullet calls), `src/core/collision.ts` (bullet spawn-explosion), `src/entities/Player.ts` (fire calls — only if signature changes; `Player` stays a plain factory until Task 8, so `firePlayer(p, g)` must keep accepting the old player object)

- [ ] **Step 1: Rewrite `src/entities/Bullet.ts`**

```ts
import { W, H } from '../config.js';
import type { GameContext } from '../core/GameContext.js';
import type { RenderContext } from '../core/Renderer.js';
import { Entity } from '../core/Entity.js';
import { BULLET_KINDS } from '../registries/bullets/index.js';

// === BULLET KINDS ===

export interface BulletKind {
  readonly key: string;
  readonly r: number;
  render(rc: RenderContext, b: Bullet): void;
  onUpdate?(b: Bullet, dt: number, ctx: GameContext): void;
  sfxKey?: string;
}

export class Bullet extends Entity {
  vx = 0;
  vy = 0;
  dmg = 0;
  life = 0;
  lv = 1;
  angle = 0;
  pierce = false;
  trail: { x: number; y: number }[] = [];
  homingDelay = 0;
  clr = '#ff4444';
  delay = 0;
  isEnemy = false;
  constructor(public readonly def: BulletKind, x: number, y: number, vx: number, vy: number) {
    super(x, y, def.r);
    this.vx = vx;
    this.vy = vy;
  }
  update(dt: number, ctx: GameContext): void {
    if (this.isEnemy) {
      if (this.delay > 0) {
        this.delay -= dt;
        if (this.delay > 0) return;
        this.delay = 0;
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.y > H + 20 || this.y < -20 || this.x < -20 || this.x > W + 20) this.alive = false;
      return;
    }
    this.life -= dt;
    if (this.life <= 0 || this.y < -80 || this.x < -40 || this.x > W + 40) {
      this.alive = false;
      return;
    }
    this.def.onUpdate?.(this, dt, ctx);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
  draw(rc: RenderContext, _ctx: GameContext): void {
    this.def.render(rc, this);
  }
}

export type EnemyBullet = Bullet;

export function mkBullet(kindKey: 'vulcan' | 'spread' | 'missile', x: number, y: number, angle: number): Bullet {
  const kind = BULLET_KINDS.get(kindKey)!;
  const spd = kindKey === 'spread' ? 380 : 680;
  const b = new Bullet(kind, x, y, Math.cos(angle) * spd, Math.sin(angle) * spd);
  b.angle = angle;
  b.life = 2.0;
  b.dmg = kindKey === 'vulcan' ? 5 : kindKey === 'spread' ? 10 : 8;
  return b;
}

export function spawnEnemyBullet(ctx: GameContext, x: number, y: number,
                                 vx: number, vy: number, clr: string,
                                 r = 5, delay = 0): Bullet {
  const b = new Bullet(BULLET_KINDS.get('enemy')!, x, y, vx, vy);
  b.r = r;
  b.clr = clr;
  b.delay = delay;
  b.isEnemy = true;
  ctx.enemyBullets.push(b);
  return b;
}
```

`src/entities/Bullet.ts` (continued — fire logic ports the old `firePlayer`/`fireSuper`, with `sfxShoot(weapon, g)` → `ctx.audio.play('shoot', { weapon })` and `p` typed as `Player`):

```ts
import type { Player } from './Player.js';

export function getFireRate(weapon: number, lv: number): number {
  if (weapon === 1) return Math.max(0.18, 0.30 - lv * 0.025);
  return Math.max(0.05, 0.13 - lv * 0.015);
}

export function comboOffset(slotIndex: number, totalSlots: number): number {
  if (totalSlots === 1) return 0;
  return slotIndex === 0 ? -0.26 : 0.26;
}

export function firePlayer(p: Player, ctx: GameContext): void {
  const total = p.weapons.length;
  p.weapons.forEach((slot, idx) => {
    const lv = slot.lv;
    const off = comboOffset(idx, total);
    const UP = -Math.PI / 2;

    if (slot.type === 0) {
      const spread = lv >= 3 ? 0.18 : 0;
      const pushV = (x: number, y: number, a: number) => {
        const b = mkBullet('vulcan', x, y, a);
        b.lv = lv;
        ctx.playerBullets.push(b);
      };
      pushV(p.x - 8, p.y - 20, UP + off - spread);
      pushV(p.x + 8, p.y - 20, UP + off + spread);
      if (lv >= 4) {
        pushV(p.x - 18, p.y - 8, UP + off - 0.38);
        pushV(p.x + 18, p.y - 8, UP + off + 0.38);
      }
      if (lv >= 5) pushV(p.x, p.y - 22, UP + off);
      ctx.audio.play('shoot', { weapon: 0 });

    } else if (slot.type === 1) {
      if (lv === 1) {
        [UP + off - 0.30, UP + off, UP + off + 0.30].forEach(a =>
          ctx.playerBullets.push(mkSpreadBullet(p.x, p.y - 20, a, lv)));
      } else if (lv === 2) {
        const half = 0.35;
        for (let i = 0; i < 4; i++)
          ctx.playerBullets.push(mkSpreadBullet(p.x, p.y - 20, UP + off - half + (i / 3) * (half * 2), lv));
      } else if (lv === 3) {
        const half = 0.40;
        for (let i = 0; i < 5; i++)
          ctx.playerBullets.push(mkSpreadBullet(p.x, p.y - 20, UP + off - half + (i / 4) * (half * 2), lv));
      } else if (lv === 4) {
        const half = 0.40;
        for (let i = 0; i < 5; i++)
          ctx.playerBullets.push(mkSpreadBullet(p.x, p.y - 20, UP + off - half + (i / 4) * (half * 2), lv));
        ctx.playerBullets.push(mkSpreadBullet(p.x - 12, p.y - 14, UP + off - 0.70, lv));
        ctx.playerBullets.push(mkSpreadBullet(p.x + 12, p.y - 14, UP + off + 0.70, lv));
      } else {
        const half = 0.50;
        for (let i = 0; i < 7; i++)
          ctx.playerBullets.push(mkSpreadBullet(p.x, p.y - 20, UP + off - half + (i / 6) * (half * 2), lv));
      }
      ctx.audio.play('shoot', { weapon: 1 });

    } else if (slot.type === 2) {
      const missileSpread = total > 1 ? 1.6 : 1.0;
      const counts = [2, 2, 3, 4, 5];
      const count = counts[lv - 1];
      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * 16 * missileSpread;
        const b = mkBullet('missile', p.x + offset, p.y - 20, 0);
        b.vx = offset * 0.6 + Math.sin(off) * 80;
        b.vy = -320;
        b.dmg = 8;
        b.life = 2.2;
        b.homingDelay = 0.15 + i * 0.04;
        ctx.playerBullets.push(b);
      }
      ctx.audio.play('shoot', { weapon: 2 });
    }
  });
}

function mkSpreadBullet(x: number, y: number, angle: number, lv: number): Bullet {
  const b = mkBullet('spread', x, y, angle);
  b.lv = lv;
  b.r = 5 + lv;
  b.dmg = 10 + lv * 3;
  return b;
}

export function fireSuper(p: Player, ctx: GameContext): void {
  const total = p.weapons.length;
  p.weapons.forEach((slot, idx) => {
    const off = comboOffset(idx, total);
    const UP = -Math.PI / 2;

    if (slot.type === 0) {
      const halfArc = (Math.PI * 2) / 3;
      const count = 12;
      for (let i = 0; i < count; i++) {
        const a = UP + off - halfArc + (i / (count - 1)) * (halfArc * 2);
        const b = mkBullet('vulcan', p.x, p.y - 22, a);
        b.r = 6; b.dmg = 15; b.lv = slot.lv;
        ctx.playerBullets.push(b);
      }
      ctx.audio.play('shoot', { weapon: 0 });
    } else if (slot.type === 1) {
      const count = 16;
      for (let i = 0; i < count; i++) {
        const a = off + (i / count) * Math.PI * 2;
        const b = mkSpreadBullet(p.x, p.y, a, 5);
        b.r = 7; b.dmg = 18;
        ctx.playerBullets.push(b);
      }
      ctx.audio.play('shoot', { weapon: 1 });
    } else if (slot.type === 2) {
      const count = 8;
      const spreadMul = total > 1 ? 1.8 : 1.0;
      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * 20 * spreadMul;
        const b = mkBullet('missile', p.x + offset, p.y - 20, 0);
        b.vx = offset * 0.5 + Math.sin(off) * 80;
        b.vy = -320;
        b.r = 6;
        b.dmg = 20;
        b.life = 2.5;
        b.homingDelay = 0;
        ctx.playerBullets.push(b);
      }
      ctx.audio.play('shoot', { weapon: 2 });
    }
  });
}

export function updatePlayerBullets(dt: number, ctx: GameContext): void {
  for (let i = ctx.playerBullets.length - 1; i >= 0; i--) {
    const b = ctx.playerBullets[i];
    b.update(dt, ctx);
    if (!b.alive) ctx.playerBullets.splice(i, 1);
  }
}

// NOTE: kept as inline loops (old behavior) because the old Boss.ts firePattern
// and Enemy.ts fireEnemy still push plain-object enemy bullets until Tasks 9-10.
// Task 10 switches these to the instance-based `b.update`/`b.draw` form once every
// enemy bullet is a Bullet instance. The inline logic is identical to the enemy
// branch of Bullet.update / the 'enemy' kind render, so behavior is unchanged.
export function updateEnemyBullets(dt: number, ctx: GameContext): void {
  for (let i = ctx.enemyBullets.length - 1; i >= 0; i--) {
    const b = ctx.enemyBullets[i];
    if (b.delay) {
      b.delay -= dt;
      if (b.delay <= 0) b.delay = 0;
      else continue;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y > H + 20 || b.y < -20 || b.x < -20 || b.x > W + 20) {
      ctx.enemyBullets.splice(i, 1);
    }
  }
}

export function drawPlayerBullets(rc: RenderContext, ctx: GameContext): void {
  ctx.playerBullets.forEach(b => b.draw(rc, ctx));
}

export function drawEnemyBullets(rc: RenderContext, ctx: GameContext): void {
  ctx.enemyBullets.forEach(b => {
    rc.fillStyle = b.clr;
    rc.beginPath(); rc.arc(b.x, b.y, b.r, 0, Math.PI * 2); rc.fill();
    rc.fillStyle = 'rgba(255,255,255,0.5)';
    rc.beginPath(); rc.arc(b.x, b.y, b.r * 0.45, 0, Math.PI * 2); rc.fill();
  });
}

export const WEAPON_NAMES = ['VULCAN', 'SPREAD', 'MISSILE'];
export const WEAPON_COLORS = ['#ffaa00', '#ff8800', '#ff4488'];
```

> The old `drawLaserBeam` no-op and the old switch-based `drawPlayerBullets` body are deleted; the visual code lives in the kind defs (Step 2). `collision.ts` reads `b.type === 'bullet'` — see Step 4; `mkVulcanBullet`'s `type: 'bullet'` distinction becomes the `'vulcan'` kind.

- [ ] **Step 2: Create the bullet kind defs**

`src/registries/bullets/vulcan.ts`:

```ts
import type { Bullet, BulletKind } from '../../entities/Bullet.js';

export const vulcan: BulletKind = {
  key: 'vulcan',
  r: 4,
  sfxKey: 'shoot',
  onUpdate(b) {
    b.trail.unshift({ x: b.x, y: b.y });
    if (b.trail.length > 5) b.trail.length = 5;
  },
  render(rc, b) {
    if (b.trail.length > 0 && b.lv >= 3) {
      const trailLen = b.lv >= 4 ? 5 : 3;
      const pts = b.trail.slice(0, trailLen);
      for (let t = 0; t < pts.length; t++) {
        const alpha = (1 - (t + 1) / (trailLen + 1)) * 0.55;
        rc.strokeStyle = `rgba(200,240,255,${alpha})`;
        rc.lineWidth = Math.max(0.5, 2.5 - t * 0.4);
        rc.beginPath();
        if (t === 0) { rc.moveTo(b.x, b.y); rc.lineTo(pts[t].x, pts[t].y); }
        else { rc.moveTo(pts[t - 1].x, pts[t - 1].y); rc.lineTo(pts[t].x, pts[t].y); }
        rc.stroke();
      }
    }
    rc.save();
    rc.translate(b.x, b.y);
    rc.rotate(b.angle !== undefined ? b.angle + Math.PI / 2 : 0);
    rc.fillStyle = 'rgba(100,220,255,0.5)';
    rc.beginPath(); rc.ellipse(0, 0, 3, 8, 0, 0, Math.PI * 2); rc.fill();
    rc.fillStyle = '#ffffff';
    rc.beginPath(); rc.ellipse(0, 0, 1.5, 5, 0, 0, Math.PI * 2); rc.fill();
    rc.restore();
  },
};
```

`src/registries/bullets/spread.ts` (port the old `b.type === 'spread'` branch of `drawPlayerBullets` verbatim, `ctx` → `rc`):

```ts
import type { Bullet, BulletKind } from '../../entities/Bullet.js';

export const spread: BulletKind = {
  key: 'spread',
  r: 5,
  render(rc, b) {
    rc.save();
    rc.translate(b.x, b.y);
    rc.rotate(b.angle + Math.PI / 2);
    const lv = b.lv;
    if (lv <= 2) {
      const w = 4 + lv * 1, h = 8 + lv * 2;
      rc.fillStyle = '#ff8800';
      rc.beginPath(); rc.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); rc.fill();
      rc.fillStyle = '#ffcc44';
      rc.beginPath(); rc.ellipse(0, -h * 0.45, w * 0.5, h * 0.3, 0, 0, Math.PI * 2); rc.fill();
    } else if (lv === 3) {
      const w = 6, h = 11;
      rc.fillStyle = '#ff7700';
      rc.beginPath(); rc.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); rc.fill();
      rc.fillStyle = '#ffee00';
      rc.beginPath(); rc.ellipse(0, -h * 0.25, w * 0.55, h * 0.45, 0, 0, Math.PI * 2); rc.fill();
      rc.fillStyle = '#ffffff';
      rc.beginPath(); rc.arc(0, -h * 0.6, 2, 0, Math.PI * 2); rc.fill();
    } else if (lv === 4) {
      const w = 7, h = 12;
      rc.strokeStyle = 'rgba(255,140,0,0.4)';
      rc.lineWidth = 3;
      rc.beginPath(); rc.moveTo(0, h * 0.3); rc.lineTo(0, h * 1.1); rc.stroke();
      rc.lineWidth = 1.5;
      rc.beginPath(); rc.moveTo(-w * 0.5, h * 0.6); rc.lineTo(-w * 0.3, h * 1.2); rc.stroke();
      rc.beginPath(); rc.moveTo(w * 0.5, h * 0.6); rc.lineTo(w * 0.3, h * 1.2); rc.stroke();
      rc.fillStyle = '#ff7700';
      rc.beginPath(); rc.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); rc.fill();
      rc.fillStyle = '#ffcc00';
      rc.beginPath(); rc.ellipse(0, -h * 0.25, w * 0.6, h * 0.45, 0, 0, Math.PI * 2); rc.fill();
      rc.fillStyle = '#ffffff';
      rc.beginPath(); rc.arc(0, -h * 0.6, 2, 0, Math.PI * 2); rc.fill();
    } else {
      const w = 9, h = 15;
      rc.strokeStyle = 'rgba(255,100,0,0.35)';
      rc.lineWidth = 4;
      rc.beginPath(); rc.ellipse(0, 0, w + 5, h + 5, 0, 0, Math.PI * 2); rc.stroke();
      const grad = rc.createRadialGradient(0, -h * 0.2, 1, 0, 0, h);
      grad.addColorStop(0, '#ffff88');
      grad.addColorStop(0.3, '#ff8800');
      grad.addColorStop(1, '#cc2200');
      rc.fillStyle = grad;
      rc.beginPath(); rc.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); rc.fill();
      rc.fillStyle = '#ffffff';
      rc.beginPath(); rc.arc(0, -h * 0.45, 3, 0, Math.PI * 2); rc.fill();
    }
    rc.restore();
  },
};
```

`src/registries/bullets/missile.ts`:

```ts
import type { GameContext } from '../../core/GameContext.js';
import type { Bullet, BulletKind } from '../../entities/Bullet.js';

export const missile: BulletKind = {
  key: 'missile',
  r: 5,
  onUpdate(b, dt, ctx) {
    b.homingDelay -= dt;
    if (b.homingDelay > 0) return;
    let nearX: number | null = null, nearY: number | null = null, nearD = Infinity;
    ctx.enemies.forEach(e => {
      const d2 = (e.x - b.x) ** 2 + (e.y - b.y) ** 2;
      if (d2 < nearD) { nearD = d2; nearX = e.x; nearY = e.y; }
    });
    if (ctx.boss) {
      const d2 = (ctx.boss.x - b.x) ** 2 + (ctx.boss.y - b.y) ** 2;
      if (d2 < nearD) { nearX = ctx.boss.x; nearY = ctx.boss.y; }
    }
    if (nearX !== null && nearY !== null) {
      const dx = nearX - b.x, dy = nearY - b.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      b.vx += (dx / d * 340 - b.vx) * dt * 5;
      b.vy += (dy / d * 340 - b.vy) * dt * 5;
    }
  },
  render(rc, b) {
    rc.fillStyle = '#ff8800';
    rc.beginPath(); rc.arc(b.x, b.y, 3, 0, Math.PI * 2); rc.fill();
    rc.strokeStyle = 'rgba(255,160,0,0.4)';
    rc.lineWidth = 2;
    rc.beginPath();
    rc.moveTo(b.x, b.y);
    rc.lineTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
    rc.stroke();
  },
};
```

`src/registries/bullets/enemy.ts`:

```ts
import type { Bullet, BulletKind } from '../../entities/Bullet.js';

export const enemyBullet: BulletKind = {
  key: 'enemy',
  r: 4,
  render(rc, b) {
    rc.fillStyle = b.clr;
    rc.beginPath(); rc.arc(b.x, b.y, b.r, 0, Math.PI * 2); rc.fill();
    rc.fillStyle = 'rgba(255,255,255,0.5)';
    rc.beginPath(); rc.arc(b.x, b.y, b.r * 0.45, 0, Math.PI * 2); rc.fill();
  },
};
```

- [ ] **Step 3: Create the bullet patterns registry**

`src/registries/bullets/patterns.ts` — port each case of the old `firePattern` verbatim; `g` → `ctx`, `b` → `boss`, `mkEB(b, g, ...)` → `spawnEnemyBullet(ctx, boss.x + ox, boss.y, ...)`:

```ts
import type { GameContext } from '../../core/GameContext.js';
import type { Boss } from '../../entities/Boss.js';
import { spawnEnemyBullet } from '../../entities/Bullet.js';
import { makeRegistry } from '../../core/registry.js';

export interface PatternOpts {
  spdBase: number;
  spdPhase: number;
  count?: number;
  gap?: number;
  clr?: string;
  offsets?: number[];
  halfSpan?: number;
  spdF?: number;
}

export interface BulletPattern {
  readonly key: string;
  fire(boss: Boss, ctx: GameContext, opts: PatternOpts): void;
}

export const BULLET_PATTERNS = makeRegistry<BulletPattern>();
export const registerBulletPattern = BULLET_PATTERNS.register;

function speedFor(boss: Boss, ctx: GameContext, opts: PatternOpts): { dx: number; dy: number; d: number; spd: number } {
  const dx = ctx.player!.x - boss.x, dy = ctx.player!.y - boss.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  return { dx, dy, d, spd: (opts.spdBase + ctx.bossPhase * opts.spdPhase) * ctx.diffMult };
}

registerBulletPattern({
  key: 'aimSpread',
  fire(boss, ctx, opts) {
    const { dx, dy, d, spd } = speedFor(boss, ctx, opts);
    const { count = 0, gap = 0, clr = '#ff4444' } = opts;
    for (let i = -(count - 1) / 2; i <= (count - 1) / 2; i++) {
      const a = Math.atan2(dy, dx) + i * gap;
      spawnEnemyBullet(ctx, boss.x, boss.y, Math.cos(a) * spd, Math.sin(a) * spd, clr);
    }
  },
});

registerBulletPattern({
  key: 'ring',
  fire(boss, ctx, opts) {
    const { spd } = speedFor(boss, ctx, opts);
    const { count = 0, clr = '#ff4444', spdF = 1 } = opts;
    for (let i = 0; i < count; i++) {
      const a = ctx.bossAngle + (i / count) * Math.PI * 2;
      spawnEnemyBullet(ctx, boss.x, boss.y, Math.cos(a) * spd * spdF, Math.sin(a) * spd * spdF, clr);
    }
  },
});

registerBulletPattern({
  key: 'aimBurst',
  fire(boss, ctx, opts) {
    const { dx, dy, spd } = speedFor(boss, ctx, opts);
    (opts.offsets ?? []).forEach(off => {
      const a = Math.atan2(dy, dx) + off;
      spawnEnemyBullet(ctx, boss.x, boss.y, Math.cos(a) * spd, Math.sin(a) * spd, opts.clr ?? '#ff8800');
    });
  },
});

registerBulletPattern({
  key: 'sideAlternate',
  fire(boss, ctx, opts) {
    const { dx, dy, spd } = speedFor(boss, ctx, opts);
    const side = Math.floor(ctx.bossTimer * 2) % 2 === 0 ? -1 : 1;
    const ox = side * (boss.r + 14);
    const baseA = Math.atan2(dy, dx);
    for (let j = 0; j < 3; j++) {
      const a = baseA + (j - 1) * 0.08;
      spawnEnemyBullet(ctx, boss.x + ox, boss.y, Math.cos(a) * spd, Math.sin(a) * spd, opts.clr || '#ff8800', 5);
    }
  },
});

registerBulletPattern({
  key: 'laserSweep',
  fire(boss, ctx, opts) {
    const { dx, dy, d, spd } = speedFor(boss, ctx, opts);
    const { count = 0, halfSpan = 0, clr = '#ff8800', spdF = 1 } = opts;
    for (let i = 0; i < count; i++) {
      const a = ctx.bossAngle + (-halfSpan + (i / (count - 1)) * halfSpan * 2);
      spawnEnemyBullet(ctx, boss.x, boss.y, Math.cos(a) * spd * spdF, Math.sin(a) * spd * spdF, clr);
    }
    spawnEnemyBullet(ctx, boss.x, boss.y, (dx / d) * spd, (dy / d) * spd, '#ffff44');
  },
});

registerBulletPattern({
  key: 'scatter',
  fire(boss, ctx, opts) {
    const { spd } = speedFor(boss, ctx, opts);
    const { count = 0, clr = '#ff8800', spdF = 1 } = opts;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      spawnEnemyBullet(ctx, boss.x, boss.y, Math.cos(a) * spd * spdF, Math.sin(a) * spd * spdF, clr);
    }
  },
});

registerBulletPattern({
  key: 'jitter',
  fire(boss, ctx, opts) {
    spawnEnemyBullet(ctx, boss.x, boss.y, (Math.random() - 0.5) * 20, 12, opts.clr ?? '#ff4444', 7);
  },
});
```

> The `speedFor` helper returns `spd` computed identically to the original `firePattern` prologue (aim at the player). The `laserSweep` center shot and `jitter`'s radius 7 are preserved.

`src/registries/bullets/index.ts`:

```ts
import { makeRegistry } from '../../core/registry.js';
import type { BulletKind } from '../../entities/Bullet.js';
import { vulcan } from './vulcan.js';
import { spread } from './spread.js';
import { missile } from './missile.js';
import { enemyBullet } from './enemy.js';
import './patterns.js';

export const BULLET_KINDS = makeRegistry<BulletKind>();
export const registerBulletKind = BULLET_KINDS.register;
registerBulletKind(vulcan);
registerBulletKind(spread);
registerBulletKind(missile);
registerBulletKind(enemyBullet);
```

- [ ] **Step 4: Update `collision.ts` and `Game.ts`**

In `src/core/collision.ts`, the two hit checks reference `b.type === 'bullet' && b.lv === 5`. The `'bullet'` type no longer exists on the class (player bullets are `Bullet` instances with a `def`); replace both with `b.def.key === 'vulcan' && b.lv === 5`. The function parameter is still named `g` until Task 13 renames it to `ctx` — use `g.spawnParticles(...)`:

```ts
if (b.def.key === 'vulcan' && b.lv === 5) {
  g.spawnParticles('explosion', b.x, b.y, { size: 0.5, color: '#ffffff' });
}
```

and change `spawnExplosion(e.x, e.y, e.type + 1, e.color, g)` → `g.spawnParticles('explosion', e.x, e.y, { size: e.type + 1, color: e.color })` (the enemy `type` number still exists until Task 9). Also `spawnExplosion(g.boss.x, ...)` calls live in `Boss.ts` — those migrate in Task 10.

In `src/core/Game.ts`:
- remove `drawLaserBeam` from the Bullet import and delete the `drawLaserBeam(this.player)` call (the no-op is removed).
- `drawPlayerBullets(this)` → `drawPlayerBullets(this.renderer, this)`
- `drawEnemyBullets(this)` → `drawEnemyBullets(this.renderer, this)`

- [ ] **Step 5: Verify suite green**

Run: `npm test` — Expected: PASS (33 tests). Smoke drives player fire + enemy fire + homing + boss patterns end-to-end.

- [ ] **Step 6: Commit**

```bash
git add src/entities/Bullet.ts src/registries/bullets src/core/collision.ts src/core/Game.ts
git commit -m "refactor: bullets behind BULLET_KINDS and fire patterns behind BULLET_PATTERNS"
```

## Task 8: Player family

**Files:**
- Rewrite: `src/entities/Player.ts`
- Modify: `src/core/Game.ts` (player calls), `src/core/collision.ts` (killPlayer calls), `tests/context-stub.ts` (now valid), create `tests/particle.test.ts`

- [ ] **Step 1: Rewrite `src/entities/Player.ts`** — port `createPlayer`/`updatePlayer`/`killPlayer`/`respawnPlayer` into a class; `drawPlayer`'s `ctx` → `rc`:

```ts
import { W, H, CHARGE_DURATION, STATE } from '../config.js';
import type { GameContext } from '../core/GameContext.js';
import type { RenderContext } from '../core/Renderer.js';
import { Entity } from '../core/Entity.js';
import { WEAPON_COLORS, getFireRate, firePlayer, fireSuper } from './Bullet.js';

export interface WeaponSlot { type: number; lv: number; }

export class Player extends Entity {
  speed = 280;
  lives = 3;
  bombs = 3;
  invTimer = 0;
  weapons: WeaponSlot[] = [{ type: 0, lv: 1 }];
  shootTimer = 0;
  dead = false;
  respawnTimer = 0;
  gameOverTimer?: number;
  chargeTime = 0;
  charging = false;
  chargeFired = false;
  constructor() {
    super(W / 2, H - 100, 14);
  }
  update(dt: number, ctx: GameContext): void {
    const p = this;
    if (p.dead) {
      if (p.gameOverTimer !== undefined) {
        p.gameOverTimer -= dt;
        if (p.gameOverTimer <= 0) ctx.state = STATE.GAMEOVER;
      } else {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) respawnPlayer(p, ctx);
      }
      return;
    }
    if (p.invTimer > 0) p.invTimer -= dt;

    const spd = p.speed * dt;
    if (ctx.keys['ArrowLeft'])  p.x -= spd;
    if (ctx.keys['ArrowRight']) p.x += spd;
    if (ctx.keys['ArrowUp'])    p.y -= spd;
    if (ctx.keys['ArrowDown'])  p.y += spd;
    p.x += ctx.moveVec.x * spd;
    p.y += ctx.moveVec.y * spd;
    p.x = Math.max(p.r, Math.min(W - p.r, p.x));
    p.y = Math.max(p.r, Math.min(H - p.r, p.y));
    p.shootTimer -= dt;

    if (p.weapons[0].lv === 5) {
      if (ctx.keys['Space']) {
        p.charging = true;
        p.chargeTime = Math.min(CHARGE_DURATION, p.chargeTime + dt);
      } else if (p.charging) {
        if (p.chargeTime >= CHARGE_DURATION) {
          fireSuper(p, ctx);
          p.shootTimer = 0.3;
        } else if (p.shootTimer <= 0) {
          p.shootTimer = getFireRate(p.weapons[0].type, p.weapons[0].lv);
          firePlayer(p, ctx);
        }
        p.chargeTime = 0;
        p.charging = false;
      }
      p.chargeFired = false;
    } else {
      p.chargeTime = 0;
      p.charging = false;
      p.chargeFired = false;
      if (ctx.keys['Space'] && p.shootTimer <= 0) {
        p.shootTimer = getFireRate(p.weapons[0].type, p.weapons[0].lv);
        firePlayer(p, ctx);
      }
    }

    if (ctx.keys['KeyB'] && !ctx.keys['_bombUsed']) {
      ctx.keys['_bombUsed'] = true;
      if (p.bombs > 0) {
        p.bombs--;
        ctx.spawnParticles('bombFlash', 0, 0);
        ctx.audio.play('bomb');
        ctx.enemyBullets.length = 0;
        ctx.enemies.forEach(e => { e.hp -= 60; });
        if (ctx.boss) ctx.boss.hp -= 250;
      }
    }
    if (!ctx.keys['KeyB']) ctx.keys['_bombUsed'] = false;
  }
  draw(rc: RenderContext, _ctx: GameContext): void {
    const p = this;
    if (p.dead) return;
    if (p.invTimer > 0 && Math.floor(p.invTimer * 10) % 2 === 0) return;

    rc.save();
    rc.translate(p.x, p.y);

    const glow = rc.createRadialGradient(0, 10, 0, 0, 10, 18);
    glow.addColorStop(0, 'rgba(0,180,255,0.85)');
    glow.addColorStop(1, 'rgba(0,80,200,0)');
    rc.fillStyle = glow;
    rc.beginPath(); rc.arc(0, 10, 18, 0, Math.PI * 2); rc.fill();

    rc.fillStyle = '#4488cc';
    rc.beginPath();
    rc.moveTo(-22, 10); rc.lineTo(-8, -2); rc.lineTo(-6, 14); rc.closePath();
    rc.fill();
    rc.beginPath();
    rc.moveTo(22, 10); rc.lineTo(8, -2); rc.lineTo(6, 14); rc.closePath();
    rc.fill();

    rc.fillStyle = '#88bbee';
    rc.beginPath();
    rc.moveTo(0, -22);
    rc.lineTo(12, 10); rc.lineTo(8, 18);
    rc.lineTo(-8, 18); rc.lineTo(-12, 10);
    rc.closePath();
    rc.fill();

    rc.fillStyle = '#ccffff';
    rc.beginPath(); rc.ellipse(0, -8, 5, 8, 0, 0, Math.PI * 2); rc.fill();

    rc.strokeStyle = '#aaddff';
    rc.lineWidth = 1;
    rc.beginPath(); rc.moveTo(-20, 8); rc.lineTo(-8, 0); rc.stroke();
    rc.beginPath(); rc.moveTo(20, 8); rc.lineTo(8, 0); rc.stroke();

    rc.restore();

    if (p.weapons[0].lv === 5 && p.charging && p.chargeTime > 0) {
      const frac = Math.min(1, p.chargeTime / CHARGE_DURATION);
      const ringR = 28 + frac * 8;
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + frac * Math.PI * 2;
      rc.save();
      rc.translate(p.x, p.y);
      const primaryColor = WEAPON_COLORS[p.weapons[0].type];
      rc.shadowColor = primaryColor;
      rc.shadowBlur = 12 + frac * 16;
      rc.strokeStyle = primaryColor;
      rc.lineWidth = 3;
      rc.globalAlpha = 0.55 + frac * 0.45;
      rc.beginPath();
      rc.arc(0, 0, ringR, startAngle, endAngle);
      rc.stroke();
      rc.strokeStyle = '#ffffff';
      rc.lineWidth = 1.2;
      rc.globalAlpha = 0.7 * frac;
      rc.beginPath();
      rc.arc(0, 0, ringR - 3, startAngle, endAngle);
      rc.stroke();
      rc.restore();
      rc.globalAlpha = 1;
      rc.shadowBlur = 0;
      rc.shadowColor = 'transparent';
    }
  }
  kill(ctx: GameContext): void {
    const p = this;
    if (p.invTimer > 0 || p.dead) return;
    p.lives--;
    ctx.spawnParticles('explosion', p.x, p.y, { size: 3, color: '#88ccff' });
    ctx.playerBullets.length = 0;
    p.weapons = [{ type: 0, lv: 1 }];
    p.chargeTime = 0;
    p.charging = false;
    p.chargeFired = false;
    if (p.lives <= 0) {
      p.dead = true;
      ctx.saveHS();
      p.gameOverTimer = 1.8;
    } else {
      p.dead = true;
      p.respawnTimer = 2.0;
    }
  }
}

export function createPlayer(): Player { return new Player(); }
export function drawPlayer(p: Player, rc: RenderContext, ctx: GameContext): void { p.draw(rc, ctx); }
export function updatePlayer(dt: number, ctx: GameContext): void { if (ctx.player) ctx.player.update(dt, ctx); }
export function killPlayer(ctx: GameContext): void { if (ctx.player) ctx.player.kill(ctx); }
export function respawnPlayer(p: Player, _ctx: GameContext): void {
  p.dead = false;
  p.x = W / 2; p.y = H - 100;
  p.invTimer = 3.0;
}
```

> The thin wrappers `createPlayer`/`drawPlayer`/`updatePlayer`/`killPlayer` are kept — `Game.ts` continues to call them in Tasks 11+ (they are the stable call surface), and `collision.ts` calls `killPlayer(ctx)`.

- [ ] **Step 2: Update `Game.ts`, `collision.ts`, and delete the deprecated sfx wrappers**

`src/core/Game.ts`:
- `drawPlayer(this.player)` → `drawPlayer(this.player, this.renderer, this)` — but `this.player` is `Player | null`; guard it:

```ts
if (this.player) drawPlayer(this.player, this.renderer, this);
```

- `updatePlayer(dt, this)` unchanged (wrapper still works).

`src/core/collision.ts`: `killPlayer(g)` → `killPlayer(ctx)` (same export, arg name) — no code change beyond the rename of `g` → `ctx` in that function's body for clarity (behavior identical).

Delete the four deprecated `sfx*` wrappers from `src/core/audio.ts` (added in Task 4). `grep -n "sfxShoot\|sfxBomb\|sfxPowerup\|sfxExplosion" src/` must now show **zero** hits.

- [ ] **Step 3: Create the particle test and run the full suite**

Create `tests/particle.test.ts` with exactly the content shown in Task 5 Step 1 (the file is created now that `Player` is a class, so `context-stub.ts` compiles).

Run: `npm test` — Expected: PASS (37 tests: 33 + 4 particle tests).

- [ ] **Step 4: Commit**

```bash
git add src/entities/Player.ts src/core/Game.ts src/core/collision.ts tests/context-stub.ts tests/particle.test.ts
git commit -m "refactor: player as an Entity class"
```

## Task 9: Enemy family + stageData enemy type keys + motion registry

**Files:**
- Rewrite: `src/entities/Enemy.ts`
- Create: `src/registries/enemies/{fighter,gunship,bomber,turret,index}.ts`
- Modify: `src/stages/stageData.ts` (enemy `type: N` → string keys), `src/stages/waveGen.ts` (use `Enemy` + `ENEMY_TYPES` + motion registry), `src/core/Game.ts` (enemy calls), `tests/enemy.test.ts` (new API), `tests/wavegen.test.ts` (selector)

- [ ] **Step 1: Rewrite `src/entities/Enemy.ts`**

```ts
import { W, H } from '../config.js';
import type { GameContext } from '../core/GameContext.js';
import type { RenderContext } from '../core/Renderer.js';
import { Entity } from '../core/Entity.js';
import { enemyHpScale, fireIntervalScale, extraBulletStreams } from '../core/difficulty.js';
import { spawnEnemyBullet } from './Bullet.js';
import { ENEMY_TYPES } from '../registries/enemies/index.js';

export type PathFn = (t: number) => { x: number; y: number };

export interface EnemyType {
  readonly key: string;
  hp: number;
  r: number;
  spd: number;
  score: number;
  dropChance: number;
  color: string;
  fireInterval?: number;
  extraStreams?: boolean;
  render(rc: RenderContext, e: Enemy): void;
  fire(e: Enemy, ctx: GameContext): void;
  movement(e: Enemy, dt: number, ctx: GameContext): void;
  inRange?(e: Enemy, ctx: GameContext): boolean;
}

export class Enemy extends Entity {
  hp: number;
  spd: number;
  score: number;
  dropChance: number;
  color: string;
  path: PathFn | null;
  pathT = 0;
  fireTimer: number;
  angle = 0;
  constructor(public readonly def: EnemyType, x: number, y: number, path: PathFn | null,
              ctx?: Pick<GameContext, 'currentStage'>) {
    super(x, y, def.r);
    this.path = path;
    this.hp = ctx ? Math.ceil(def.hp * enemyHpScale(ctx.currentStage)) : def.hp;
    this.spd = def.spd;
    this.score = def.score;
    this.dropChance = def.dropChance;
    this.color = def.color;
    this.fireTimer = 1.2 + Math.random();
  }
  update(dt: number, ctx: GameContext): void {
    this.def.movement(this, dt, ctx);
    if (this.y > H + 60 || this.x < -60 || this.x > W + 60) { this.alive = false; return; }
    const interval = (this.def.fireInterval ?? 2.2) * fireIntervalScale(ctx.currentStage) / ctx.diffMult;
    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      if (this.def.inRange === undefined || this.def.inRange(this, ctx)) this.fire(ctx);
      this.fireTimer = interval + Math.random() * 0.5;
    }
  }
  fire(ctx: GameContext): void {
    if (!ctx.player || ctx.player.dead) return;
    this.def.fire(this, ctx);
    const extra = extraBulletStreams(ctx.currentStage);
    if (extra && this.def.extraStreams) {
      const dx = ctx.player.x - this.x, dy = ctx.player.y - this.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const spd = 190 * ctx.diffMult;
      for (let k = 1; k <= extra; k++) {
        const side = k % 2 === 0 ? -1 : 1;
        const off = side * 0.4 * Math.ceil(k / 2);
        const a = Math.atan2(dy, dx) + off;
        spawnEnemyBullet(ctx, this.x, this.y, Math.cos(a) * spd, Math.sin(a) * spd, '#ff4444', 4);
      }
    }
  }
  draw(rc: RenderContext, _ctx: GameContext): void {
    rc.save();
    rc.translate(this.x, this.y);
    this.def.render(rc, this);
    rc.restore();
  }
}

export function updateEnemies(dt: number, ctx: GameContext): void {
  for (let i = ctx.enemies.length - 1; i >= 0; i--) {
    const e = ctx.enemies[i];
    e.update(dt, ctx);
    if (!e.alive) ctx.enemies.splice(i, 1);
  }
}

// Temporary alias used by the still-unmigrated Boss.spawnMinion; deleted in Task 10.
export function mkEnemy(type: string, x: number, y: number, path: PathFn | null,
                        ctx?: Pick<GameContext, 'currentStage'>): Enemy {
  return new Enemy(ENEMY_TYPES.get(type)!, x, y, path, ctx);
}
```

> `ENEMY_TYPES` import is a **runtime** import (used by `mkEnemy`). It does not create a cycle: the registry's def files import `Enemy` **type-only** (erased) and runtime-depend only on `./shared.js` + `entities/Bullet.js`, never on `entities/Enemy.js`. The shared movement helper lives in a sibling file (below) so no def evaluates before `Enemy` finishes loading.

- [ ] **Step 2: Create the shared movement helper**

`src/registries/enemies/shared.ts` (no runtime dependency on `entities/Enemy.ts`, avoiding any circular-eval order problem):

```ts
import type { Enemy } from '../../entities/Enemy.js';
import type { GameContext } from '../../core/GameContext.js';

// Follow the path function, or scroll straight down.
export function movePathOrDown(e: Enemy, dt: number, ctx: GameContext): void {
  if (e.path) {
    e.pathT += dt;
    const pos = e.path(e.pathT);
    e.x = pos.x; e.y = pos.y;
  } else {
    e.y += e.spd * ctx.diffMult * dt;
  }
}
```

- [ ] **Step 3: Create the enemy defs** (each def imports `movePathOrDown` from `./shared.js`, `spawnEnemyBullet` from `../../entities/Bullet.js`, and `Enemy`/`EnemyType` **type-only** from `../../entities/Enemy.js`)

`src/registries/enemies/fighter.ts`:

```ts
import { type Enemy, type EnemyType } from '../../entities/Enemy.js';
import { spawnEnemyBullet } from '../../entities/Bullet.js';
import { movePathOrDown } from './shared.js';

export const fighter: EnemyType = {
  key: 'fighter',
  hp: 3, r: 10, spd: 110, score: 100, dropChance: 0.15, color: '#66aaff',
  extraStreams: true,
  render(rc, e) {
    rc.fillStyle = e.color;
    rc.beginPath();
    rc.moveTo(0, -12); rc.lineTo(10, 8);
    rc.lineTo(0, 4);   rc.lineTo(-10, 8);
    rc.closePath(); rc.fill();
    rc.fillStyle = '#ff4444';
    rc.beginPath(); rc.arc(0, -1, 3, 0, Math.PI * 2); rc.fill();
  },
  fire(e, ctx) {
    const dx = ctx.player!.x - e.x, dy = ctx.player!.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const spd = 190 * ctx.diffMult;
    spawnEnemyBullet(ctx, e.x, e.y, (dx / d) * spd, (dy / d) * spd, '#ff4444', 4);
  },
  movement: movePathOrDown,
};
```

`src/registries/enemies/gunship.ts`:

```ts
import { type Enemy, type EnemyType } from '../../entities/Enemy.js';
import { spawnEnemyBullet } from '../../entities/Bullet.js';
import { movePathOrDown } from './shared.js';

export const gunship: EnemyType = {
  key: 'gunship',
  hp: 8, r: 14, spd: 65, score: 200, dropChance: 0.25, color: '#aacc44',
  extraStreams: true,
  render(rc, e) {
    rc.fillStyle = e.color;
    rc.beginPath();
    rc.moveTo(0, -14); rc.lineTo(14, 4);
    rc.lineTo(8, 14);  rc.lineTo(-8, 14); rc.lineTo(-14, 4);
    rc.closePath(); rc.fill();
    rc.fillStyle = '#ffff44';
    rc.beginPath(); rc.arc(0, 2, 5, 0, Math.PI * 2); rc.fill();
  },
  fire(e, ctx) {
    const dx = ctx.player!.x - e.x, dy = ctx.player!.y - e.y;
    const spd = 190 * ctx.diffMult;
    [-0.28, 0, 0.28].forEach(a => {
      const ang = Math.atan2(dy, dx) + a;
      spawnEnemyBullet(ctx, e.x, e.y, Math.cos(ang) * spd, Math.sin(ang) * spd, '#ff8800', 4);
    });
  },
  movement: movePathOrDown,
};
```

`src/registries/enemies/bomber.ts`:

```ts
import { type Enemy, type EnemyType } from '../../entities/Enemy.js';
import { spawnEnemyBullet } from '../../entities/Bullet.js';
import { movePathOrDown } from './shared.js';

export const bomber: EnemyType = {
  key: 'bomber',
  hp: 20, r: 18, spd: 48, score: 400, dropChance: 0.50, color: '#cc6622',
  render(rc, e) {
    rc.fillStyle = e.color;
    rc.beginPath();
    rc.moveTo(0, -18); rc.lineTo(18, 0);
    rc.lineTo(16, 16); rc.lineTo(-16, 16); rc.lineTo(-18, 0);
    rc.closePath(); rc.fill();
    rc.fillStyle = '#ff8800';
    rc.beginPath(); rc.arc(-9, 0, 5, 0, Math.PI * 2); rc.fill();
    rc.beginPath(); rc.arc(9, 0, 5, 0, Math.PI * 2); rc.fill();
  },
  fire(e, ctx) {
    const spd = 190 * ctx.diffMult;
    for (let i = -2; i <= 2; i++) {
      const ang = Math.PI / 2 + i * 0.24;
      spawnEnemyBullet(ctx, e.x, e.y, Math.cos(ang) * spd * 0.75, Math.sin(ang) * spd * 0.75, '#ffcc00', 4);
    }
  },
  movement: movePathOrDown,
};
```

`src/registries/enemies/turret.ts`:

```ts
import { type Enemy, type EnemyType } from '../../entities/Enemy.js';
import { spawnEnemyBullet } from '../../entities/Bullet.js';

export const turret: EnemyType = {
  key: 'turret',
  hp: 12, r: 12, spd: 0, score: 150, dropChance: 0.50, color: '#cc4466',
  fireInterval: 1.6,
  render(rc, e) {
    rc.fillStyle = '#884422';
    rc.beginPath(); rc.arc(0, 0, 10, 0, Math.PI * 2); rc.fill();
    rc.fillStyle = '#cc6644';
    rc.save(); rc.rotate(e.angle);
    rc.fillRect(-3, -14, 6, 14);
    rc.restore();
  },
  fire(e, ctx) {
    const dx = ctx.player!.x - e.x, dy = ctx.player!.y - e.y;
    const spd = 190 * ctx.diffMult;
    for (let j = 0; j < 3; j++) {
      const ang = Math.atan2(dy, dx);
      const bspd = spd * (0.85 + j * 0.1);
      spawnEnemyBullet(ctx, e.x, e.y, Math.cos(ang) * bspd, Math.sin(ang) * bspd, '#ff66ff', 4, j * 0.08);
    }
  },
  movement(e, _dt, ctx) {
    if (ctx.player && !ctx.player.dead) {
      const dx = ctx.player.x - e.x, dy = ctx.player.y - e.y;
      e.angle = Math.atan2(dx, -dy);
    }
  },
  inRange(e, ctx) {
    if (!ctx.player || ctx.player.dead) return false;
    const dx = ctx.player.x - e.x, dy = ctx.player.y - e.y;
    return dx * dx + dy * dy < 260 * 260;
  },
};
```

`src/registries/enemies/index.ts`:

```ts
import { makeRegistry } from '../../core/registry.js';
import type { EnemyType } from '../../entities/Enemy.js';
import { fighter } from './fighter.js';
import { gunship } from './gunship.js';
import { bomber } from './bomber.js';
import { turret } from './turret.js';

export const ENEMY_TYPES = makeRegistry<EnemyType>();
export const registerEnemyType = ENEMY_TYPES.register;
registerEnemyType(fighter);
registerEnemyType(gunship);
registerEnemyType(bomber);
registerEnemyType(turret);
```

- [ ] **Step 3: Rewrite `src/stages/waveGen.ts`** — motion registry + `Enemy` construction:

 ```ts
import { Enemy, type PathFn } from '../entities/Enemy.js';
import { createBoss } from '../entities/Boss.js';
import { ENEMY_TYPES } from '../registries/enemies/index.js';
import type { GameContext } from '../core/GameContext.js';

export function pathDown(sx: number, sy: number, spd: number): PathFn {
  return t => ({ x: sx, y: sy + t * spd });
}

export function pathSin(sx: number, sy: number, spd: number, amp: number, freq: number): PathFn {
  return t => ({ x: sx + Math.sin(t * freq) * amp, y: sy + t * spd });
}

export function pathFormation(cx: number, sy: number, spd: number, idx: number, total: number): PathFn {
  const offset = (idx - (total - 1) / 2) * 36;
  return t => ({ x: cx + offset, y: sy + t * spd });
}

// Motion registry: descriptor -> path builder (generalizes the old expandPath switch).
export const MOTION = new Map<string, (desc: number[], diffMult: number) => PathFn>();
export function registerMotion(kind: string, builder: (desc: number[], diffMult: number) => PathFn): void {
  MOTION.set(kind, builder);
}
registerMotion('down', (desc, diffMult) => pathDown(desc[1], desc[2], desc[3] * diffMult));
registerMotion('sin',  (desc, diffMult) => pathSin(desc[1], desc[2], desc[3] * diffMult, desc[4], desc[5]));
registerMotion('form', (desc, diffMult) => pathFormation(desc[1], desc[2], desc[3] * diffMult, desc[4], desc[5]));

interface WaveDescriptor {
  t: number;
  boss?: number;
  type?: string;
  x?: number;
  y?: number;
  path?: number[];
  elite?: boolean;
}

function expandPath(desc: number[], diffMult: number): PathFn {
  if (!Array.isArray(desc) || desc.length < 4) throw new Error('bad path descriptor: ' + JSON.stringify(desc));
  const builder = MOTION.get(desc[0]);
  if (!builder) throw new Error('unknown path kind: ' + desc[0]);
  return builder(desc, diffMult);
}

export interface WaveEntry {
  t: number;
  boss?: number;
  type?: string;
  x?: number;
  y?: number;
  path?: PathFn | null;
  eliteHp?: boolean;
}

export function buildWaveTable(stageDef: { waves: WaveDescriptor[] }, diffMult: number): WaveEntry[] {
  const entries: WaveEntry[] = [];
  for (const d of stageDef.waves) {
    if (d.boss) {
      entries.push({ t: d.t, boss: d.boss });
    } else if (d.type === 'turret') {
      entries.push({ t: d.t, type: d.type, x: d.x, y: d.y, ...(d.elite ? { eliteHp: true } : {}) });
    } else {
      entries.push({ t: d.t, type: d.type, path: expandPath(d.path!, diffMult), ...(d.elite ? { eliteHp: true } : {}) });
    }
  }
  return entries.sort((a, b) => a.t - b.t);
}

export function updateWaves(dt: number, ctx: GameContext): void {
  if (ctx.boss) return;
  ctx.stageTimer += dt;

  const waveTable = (ctx as GameContext & { waveTable: WaveEntry[] }).waveTable;
  while (ctx.waveIndex < waveTable.length) {
    const entry = waveTable[ctx.waveIndex];
    if (ctx.stageTimer < entry.t) break;
    ctx.waveIndex++;

    if (entry.boss) {
      ctx.enemies.length = 0;
      ctx.enemyBullets.length = 0;
      ctx.boss = createBoss(ctx);
      ctx.bossSpawned = true;
    } else if (entry.type === 'turret') {
      const e = new Enemy(ENEMY_TYPES.get('turret')!, entry.x ?? 0, entry.y ?? 0, null, ctx);
      if (entry.eliteHp) e.hp = Math.ceil(e.hp * 1.5);
      ctx.enemies.push(e);
    } else {
      const e = new Enemy(ENEMY_TYPES.get(entry.type!)!, 0, 0, entry.path ?? null, ctx);
      if (entry.path) { const p0 = entry.path(0); e.x = p0.x; e.y = p0.y; }
      if (entry.eliteHp) e.hp = Math.ceil(e.hp * 1.5);
      ctx.enemies.push(e);
    }
  }
}
```

> `Game` keeps `waveTable`/`waveIndex`/`bossSpawned` as public fields; `updateWaves` reaches them through an intersection cast until `Game` becomes fully typed in Task 11, after which the cast is removed (Task 13). `createBoss` still refers to the old function-based `Boss.ts` until Task 10 — the export name is unchanged.

- [ ] **Step 4: Rewrite stageData enemy type numbers to string keys**

In `src/stages/stageData.ts`, replace **every** `type: 0` → `type: 'fighter'`, `type: 1` → `type: 'gunship'`, `type: 2` → `type: 'bomber'`, `type: 3` → `type: 'turret'` in the `waves` arrays (not in comments — the header comment grammar also updates). This is a mechanical global replacement; use a script:

```bash
node -e "
const fs = require('fs');
const p = 'src/stages/stageData.ts';
let s = fs.readFileSync(p, 'utf8');
s = s.replaceAll(/\btype: 0/g, \"type: 'fighter'\")
     .replaceAll(/\btype: 1/g, \"type: 'gunship'\")
     .replaceAll(/\btype: 2/g, \"type: 'bomber'\")
     .replaceAll(/\btype: 3/g, \"type: 'turret'\");
fs.writeFileSync(p, s);
"
```

> Verify no `type: 0` remains that is not a wave entry (the `boss` object has no `type` field). Also update the file's header comment lines 10-11 ("enemy type: 0=small fighter…" → "enemy type keys: 'fighter' | 'gunship' | 'bomber' | 'turret'").

- [ ] **Step 5: Update `Game.ts`, `collision.ts`, and the two tests**

`src/core/Game.ts`:
- `drawEnemy` per-enemy forEach → `this.enemies.forEach(e => e.draw(this.renderer, this));`
- `updateEnemies(dt, this)` unchanged (wrapper still exists).

**Keep the still-unmigrated `Boss.ts` working.** The old `Boss.spawnMinion` calls `mkEnemy(0, …)` and reads `ENEMY_CFG[0].spd` — both of which the new `Enemy.ts` no longer provides. Two small compatibility edits:

1. In `src/entities/Enemy.ts`, add a compat constant (only `[0].spd` is ever read, by the old `spawnMinion`):

```ts
// Compatibility for the pre-migration Boss.spawnMinion; deleted in Task 10.
export const ENEMY_CFG: { spd: number }[] = [{ spd: ENEMY_TYPES.get('fighter')!.spd }];
```

2. In `src/entities/Boss.ts` (still old code), change `spawnMinion` to pass the new string key:

```ts
const e = mkEnemy('fighter', b.x + (Math.random() - 0.5) * 40, b.y + 20, null, g);
```

`src/core/collision.ts`: the `spawnExplosion(e.x, e.y, e.type + 1, e.color, g)` call now reads `e.type`, which no longer exists on the `Enemy` class. Preserve the exact explosion size the old code produced (fighter→1, gunship→2, bomber→3, turret→4) with a lookup on the def key. The function parameter is still named `g` until Task 13 renames it to `ctx`:

```ts
const SIZE_BY_KEY: Record<string, number> = { fighter: 1, gunship: 2, bomber: 3, turret: 4 };
g.spawnParticles('explosion', e.x, e.y, { size: SIZE_BY_KEY[e.def.key] ?? 1, color: e.color });
```

`tests/enemy.test.ts` — migrate to the new API (assertions preserved verbatim):

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { Enemy, updateEnemies } from '../src/entities/Enemy.js';
import { ENEMY_TYPES } from '../src/registries/enemies/index.js';
import { enemyHpScale, fireIntervalScale, extraBulletStreams } from '../src/core/difficulty.js';
import { stubContext } from './context-stub.js';

afterEach(() => vi.restoreAllMocks());

describe('enemy difficulty levers', () => {
  it('Enemy scales hp with the stage when ctx is passed', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const e = new Enemy(ENEMY_TYPES.get('fighter')!, 0, 0, null, { currentStage: 18 });
    expect(e.hp).toBe(Math.ceil(3 * enemyHpScale(18)));
    const eBase = new Enemy(ENEMY_TYPES.get('fighter')!, 0, 0, null);
    expect(eBase.hp).toBe(3);
  });

  it('fire fires base shots plus extra streams at milestone stages', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const g = stubContext({ currentStage: 18, diffMult: 1 });
    const e = new Enemy(ENEMY_TYPES.get('fighter')!, 240, 130, null);
    e.fire(g);
    expect(g.enemyBullets.length).toBe(1 + extraBulletStreams(18));
  });

  it('updateEnemies applies the fire-interval scale for turrets', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const g = stubContext({ currentStage: 18, diffMult: 1 });
    g.player.x = 240; g.player.y = 200;
    const e = new Enemy(ENEMY_TYPES.get('turret')!, 240, 220, null);
    e.fireTimer = 0;
    g.enemies.push(e);
    updateEnemies(1 / 60, g);
    const baseInterval = 1.6;
    const scaled = (baseInterval * fireIntervalScale(18)) / 1;
    expect(e.fireTimer).toBeCloseTo(scaled + 0.25, 5);
  });
});
```

`tests/wavegen.test.ts` — one selector changes, assertions preserved:

```ts
const form = table.find(e => e.type === 'fighter');   // was: e.type === 0
```

- [ ] **Step 6: Verify suite green**

Run: `npm test` — Expected: PASS (54 tests). Smoke exercises enemies + wave spawning + turret in-range firing end-to-end.

- [ ] **Step 7: Commit**

```bash
git add src/entities/Enemy.ts src/registries/enemies src/stages/waveGen.ts src/stages/stageData.ts src/core/Game.ts src/core/collision.ts tests/enemy.test.ts tests/wavegen.test.ts
git commit -m "refactor: enemies behind ENEMY_TYPES; stageData references type keys"
```

## Task 10: Boss family — Boss class + BOSS_TYPES + stageData boss type keys

**Files:**
- Rewrite: `src/entities/Boss.ts`
- Create: `src/registries/bosses/{blaze,hexa,dreadnaught,viper,solar,carrier,phantom,tyrant,index}.ts`
- Modify: `src/stages/stageData.ts` (boss `archetype: N` → `type: 'name'`), `src/core/Game.ts` (boss calls), `src/core/collision.ts` (onBossDeath unchanged), `tests/boss.test.ts` (new API), remove `mkEnemy` from `Enemy.ts`

- [ ] **Step 1: Rewrite `src/entities/Boss.ts`**

```ts
import { W, H, STATE, STAGE_COUNT } from '../config.js';
import type { GameContext } from '../core/GameContext.js';
import type { RenderContext } from '../core/Renderer.js';
import { Entity } from '../core/Entity.js';
import { bossHpForStage, phaseCountForStage } from '../core/difficulty.js';
import { STAGES } from '../stages/stageData.js';
import { BULLET_PATTERNS } from '../registries/bullets/patterns.js';
import { BOSS_TYPES, type BossType } from '../registries/bosses/index.js';
import { ENEMY_TYPES } from '../registries/enemies/index.js';
import { Enemy } from './Enemy.js';
import type { PhaseEntry } from '../registries/bosses/index.js';

export class Boss extends Entity {
  stageNum: number;
  hp: number;
  maxHp: number;
  targetX: number;
  targetY: number;
  spd: number;
  fireTimer: number;
  phaseCount: number;
  minionTimer: number;
  phantomAlpha = 1.0;
  constructor(public readonly def: BossType, stage: number, ctx: GameContext) {
    super(W / 2, 130, def.r ?? 50);
    this.stageNum = stage;
    this.maxHp = bossHpForStage(stage);
    this.hp = this.maxHp;
    this.targetX = W / 2;
    this.targetY = 130;
    this.spd = def.speed ?? 58;
    this.fireTimer = 1.8;
    this.phaseCount = phaseCountForStage(stage);
    this.minionTimer = 3.0;
    ctx.bossMaxHp = this.maxHp;
    ctx.bossPhase = 0;
    ctx.bossTimer = 0;
    ctx.bossAngle = 0;
  }
  update(dt: number, ctx: GameContext): void {
    ctx.bossTimer += dt;
    ctx.bossAngle += dt * 0.85;

    const dx = this.targetX - this.x, dy = this.targetY - this.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (d > 5) {
      this.x += (dx / d) * this.spd * dt;
      this.y += (dy / d) * this.spd * dt;
    } else {
      this.targetX = 80 + Math.random() * (W - 160);
      this.targetY = 60 + Math.random() * 140;
    }

    const hpPct = this.hp / this.maxHp;
    ctx.bossPhase = this.phaseCount - 1 - Math.floor(hpPct * this.phaseCount);
    ctx.bossPhase = Math.max(0, Math.min(this.phaseCount - 1, ctx.bossPhase));

    this.def.onUpdate?.(this, dt, ctx);

    if (this.def.spawnMinions) {
      this.minionTimer -= dt;
      if (this.minionTimer <= 0) {
        spawnMinion(this, ctx);
        this.minionTimer = 3.0 / ctx.diffMult;
      }
    }

    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fire(ctx);
      const rate = [1.2, 0.85, 0.55, 0.38, 0.28][Math.min(ctx.bossPhase, 4)];
      this.fireTimer = rate / ctx.diffMult + Math.random() * 0.25;
    }
  }
  draw(rc: RenderContext, ctx: GameContext): void {
    rc.withTint(this.def.tint, this.r, this.x, this.y, (c) => {
      this.def.render(c, this, ctx.bossAngle, ctx.bossTimer);
    });
    drawBossHpBar(rc, this);
  }
  fire(ctx: GameContext): void {
    if (!ctx.player || ctx.player.dead) return;
    const patterns: PhaseEntry[] = this.def.patterns;
    if (!patterns.length) return;
    const phasePatterns = patterns[ctx.bossPhase % patterns.length];
    const list = Array.isArray(phasePatterns) ? phasePatterns : [phasePatterns];
    list.forEach(p => BULLET_PATTERNS.get(p.name)!.fire(this, ctx, p));
  }
}

function spawnMinion(boss: Boss, ctx: GameContext): void {
  const e = new Enemy(ENEMY_TYPES.get('fighter')!, boss.x + (Math.random() - 0.5) * 40, boss.y + 20, null, ctx);
  e.spd = ENEMY_TYPES.get('fighter')!.spd * ctx.diffMult * 1.2;
  ctx.enemies.push(e);
}

function drawBossHpBar(rc: RenderContext, b: Boss): void {
  const bw = 200, bh = 10;
  const bx = (W - bw) / 2, by = H - 28;
  rc.fillStyle = '#222';
  rc.fillRect(bx, by, bw, bh);
  const frac = Math.max(0, b.hp / b.maxHp);
  const hpColor = frac > 0.5 ? '#00ee44' : frac > 0.25 ? '#ffaa00' : '#ff2200';
  rc.fillStyle = hpColor;
  rc.fillRect(bx, by, bw * frac, bh);
  rc.strokeStyle = '#fff'; rc.lineWidth = 1;
  rc.strokeRect(bx, by, bw, bh);
  rc.fillStyle = '#fff';
  rc.font = '8px monospace'; rc.textAlign = 'center'; rc.textBaseline = 'alphabetic';
  rc.fillText('BOSS', W / 2, by - 3);
}

export function createBoss(ctx: GameContext): Boss {
  const stageDef = STAGES[ctx.currentStage - 1].boss;
  const base = BOSS_TYPES.get(stageDef.type)!;
  const def: BossType = {
    key: base.key,
    tint: stageDef.tint ?? base.tint,
    speed: stageDef.speed ?? base.speed,
    spawnMinions: stageDef.spawnMinions ?? base.spawnMinions,
    patterns: stageDef.patterns ?? base.patterns,
    render: base.render,
    onUpdate: base.onUpdate,
    r: stageDef.r,
  };
  return new Boss(def, ctx.currentStage, ctx);
}

export function onBossDeath(ctx: GameContext): void {
  const boss = ctx.boss!;
  const bossStage = boss.stageNum || 1;
  const explosionCount = 2 + Math.floor(bossStage * 0.5);
  ctx.spawnParticles('explosion', boss.x, boss.y, { size: 6, color: '#ffaa00' });
  ctx.spawnParticles('explosion', boss.x + 35, boss.y - 25, { size: 4, color: '#ff4400' });
  ctx.spawnParticles('explosion', boss.x - 35, boss.y + 15, { size: 4, color: '#ffcc00' });
  for (let i = 0; i < explosionCount - 3; i++) {
    const ox = (Math.random() - 0.5) * boss.r * 2;
    const oy = (Math.random() - 0.5) * boss.r * 2;
    ctx.spawnParticles('explosion', boss.x + ox, boss.y + oy, { size: 3, color: '#ff8800' });
  }
  const bossScore = 5000 + bossStage * 2000;
  ctx.score += bossScore * ctx.loopMult;
  ctx.saveHS();
  ctx.boss = null;

  if (ctx.currentStage < STAGE_COUNT) {
    ctx.state = STATE.STAGECLEAR;
    ctx.stageClearTimer = 3.0;
  } else {
    if (ctx.loopMult === 1) {
      ctx.state = STATE.VICTORY;
      ctx.victoryTimer = 0;
    } else {
      ctx.loopMult++;
      ctx.startStage(1);
      ctx.state = STATE.PLAYING;
    }
  }
}
```

> `createBoss` merges the stage def over the type def (tint/speed/spawnMinions/patterns from the stage, render from the type). `stageDef.type` becomes the string key in Step 3. The old `drawBossArchetype`/`drawBossN`/`firePattern`/`updateBoss` functions are deleted.

- [ ] **Step 2: Define `BossType` and create the eight boss defs**

Add to `src/registries/bosses/index.ts` (which also exports `PhaseEntry`):

```ts
import { makeRegistry } from '../../core/registry.js';
import type { GameContext } from '../../core/GameContext.js';
import type { Boss } from '../../entities/Boss.js';
import type { PatternOpts } from '../bullets/patterns.js';

export interface PhasePattern extends PatternOpts { name: string; }
export type PhaseEntry = PhasePattern | PhasePattern[];
export interface BossType {
  readonly key: string;
  tint: string | null;
  r?: number;
  speed?: number;
  spawnMinions?: boolean;
  patterns: PhaseEntry[];
  render(c: CanvasRenderingContext2D, boss: Boss, angle: number, timer: number): void;
  onUpdate?(boss: Boss, dt: number, ctx: GameContext): void;
}

export const BOSS_TYPES = makeRegistry<BossType>();
export const registerBossType = BOSS_TYPES.register;

import { blaze } from './blaze.js';
import { hexa } from './hexa.js';
import { dreadnaught } from './dreadnaught.js';
import { viper } from './viper.js';
import { solar } from './solar.js';
import { carrier } from './carrier.js';
import { phantom } from './phantom.js';
import { tyrant } from './tyrant.js';

registerBossType(blaze);
registerBossType(hexa);
registerBossType(dreadnaught);
registerBossType(viper);
registerBossType(solar);
registerBossType(carrier);
registerBossType(phantom);
registerBossType(tyrant);
```

Each def file follows the same recipe. The render function is the **verbatim** body of the matching `drawBossN` from the pre-migration `src/entities/Boss.ts` with the leading `c.save(); c.translate(b.x, b.y);` pair and the matching trailing `c.restore();` removed — the render draws in **local coordinates** (origin at the boss center) because `Boss.draw` goes through `rc.withTint`, which translates. Default `patterns` are the stage where that archetype first appears.

`src/registries/bosses/blaze.ts` (archetype 1, stage 1; patterns = stage 1's; `tint: null`):

```ts
import type { BossType } from './index.js';

export const blaze: BossType = {
  key: 'blaze',
  tint: null,
  spawnMinions: false,
  patterns: [
    { name: 'aimSpread', spdBase: 175, spdPhase: 35, count: 7, gap: 0.14, clr: '#ff2200' },
    { name: 'aimBurst',  spdBase: 175, spdPhase: 35, offsets: [-0.08, 0.08], clr: '#ff8800' },
    { name: 'ring',      spdBase: 175, spdPhase: 35, count: 8, spdF: 0.7, clr: '#cc00ff' },
  ],
  render(c, b, angle) {
    const grad = c.createRadialGradient(0, 0, 8, 0, 0, b.r);
    grad.addColorStop(0, '#ff6622'); grad.addColorStop(0.5, '#882211'); grad.addColorStop(1, '#330800');
    c.fillStyle = grad;
    c.beginPath(); c.arc(0, 0, b.r, 0, Math.PI * 2); c.fill();
    c.save(); c.rotate(angle);
    for (let i = 0; i < 4; i++) {
      c.save(); c.rotate(i * Math.PI / 2);
      c.fillStyle = '#bb3300';
      c.fillRect(-4, 0, 8, b.r * 0.88);
      c.fillStyle = '#ff7700';
      c.beginPath(); c.arc(0, b.r * 0.82, 9, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    c.restore();
    c.fillStyle = '#ffff00'; c.beginPath(); c.arc(0, 0, 13, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff0000'; c.beginPath(); c.arc(0, 0, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#000';    c.beginPath(); c.arc(0, 0, 3, 0, Math.PI * 2); c.fill();
  },
};
```

The other seven defs are identical in structure. For each, copy the `drawBossN` body from the pre-migration file and **strip the outer `save()/translate(...)` and matching `restore()`** (both the inner `save/restore` pairs for rotating sub-parts are kept), set the `key`, `tint: null`, `spawnMinions`, and `patterns` from the table below, then call `registerBossType`:

| def file | source fn | key | stage for default `patterns` | default `spawnMinions` |
|---|---|---|---|---|
| `hexa.ts` | `drawBoss2` (lines 115–141, strip 116–117 & 141) | `'hexa'` | 2 | `false` |
| `dreadnaught.ts` | `drawBoss3` (lines 143–166, strip 144–145 & 166) | `'dreadnaught'` | 3 | `false` |
| `viper.ts` | `drawBoss4` (lines 168–190, strip 169–170 & 190) | `'viper'` | 4 | `false` |
| `solar.ts` | `drawBoss5` (lines 192–218, strip 193–194 & 218) | `'solar'` | 5 | `false` |
| `carrier.ts` | `drawBoss6` (lines 220–249, strip 221–222 & 249) | `'carrier'` | 6 | `true` |
| `phantom.ts` | `drawBoss7` (lines 251–280, strip 252–253 & 278; **keep** line 279 `c.globalAlpha = 1;`) | `'phantom'` | 7 | `false` |
| `tyrant.ts` | `drawBoss8` (lines 282–320, strip 285–286 & 319; keep line 283 `const pulse = …`) | `'tyrant'` | 8 | `true` |

Each def file ends with `};` and has **no `registerBossType(...)` call** — the index registers them (registry pattern note in Task 5).

`phantom.ts` also registers the `onUpdate` phantom-alpha flicker (the old `if (g.boss.archetype === 7)` block in `updateBoss`):

```ts
onUpdate(boss, _dt, ctx) {
  boss.phantomAlpha = 0.65 + Math.sin(ctx.bossTimer * 1.5) * 0.35;
},
```

`tyrant.ts` keeps the pulse logic that reads the `timer` parameter (already inside its render body).

- [ ] **Step 3: Rewrite stageData boss `archetype: N` → `type: 'name'`**

In `src/stages/stageData.ts`, in **every** `boss:` object, replace the `archetype` field with `type` per this mapping (stages 1–8 and the stage-9+ reuse):

| archetype | type |
|---|---|
| 1 | `'blaze'` |
| 2 | `'hexa'` |
| 3 | `'dreadnaught'` |
| 4 | `'viper'` |
| 5 | `'solar'` |
| 6 | `'carrier'` |
| 7 | `'phantom'` |
| 8 | `'tyrant'` |

Example: stage 1's `boss: { archetype: 1, tint: null, r: 50, … }` becomes `boss: { type: 'blaze', tint: null, r: 50, … }`. Stages 9–18 keep their existing `tint`/`r`/`speed`/`spawnMinions`/`patterns` fields unchanged.

- [ ] **Step 4: Update `Game.ts`, remove `mkEnemy`, migrate `boss.test.ts`**

`src/core/Game.ts`:
- `drawBoss(this)` → `this.boss?.draw(this.renderer, this);`
- `updateBoss(dt, this)` → `this.boss?.update(dt, this);`

In `src/entities/Enemy.ts`, **delete** the `mkEnemy` wrapper and the `ENEMY_CFG` compat constant added in Task 9 (no longer referenced; the new `spawnMinion` uses `new Enemy` directly).

Rewrite `tests/boss.test.ts` (all assertions preserved; call-sites migrate to the class API):

```ts
import { describe, it, expect } from 'vitest';
import { STAGES } from '../src/stages/stageData.js';
import { Boss, createBoss } from '../src/entities/Boss.js';
import { BOSS_TYPES, type PhaseEntry } from '../src/registries/bosses/index.js';
import { BULLET_PATTERNS } from '../src/registries/bullets/patterns.js';
import { bossHpForStage, phaseCountForStage } from '../src/core/difficulty.js';
import { CanvasRenderer } from '../src/core/Renderer.js';
import { noopCtx } from './dom-setup.js';
import { stubContext } from './context-stub.js';

const REQUIRED: Record<string, string[]> = {
  aimSpread: ['count', 'gap', 'clr'],
  ring: ['count', 'clr'],
  aimBurst: ['offsets', 'clr'],
  sideAlternate: [],
  laserSweep: ['count', 'halfSpan', 'clr'],
  scatter: ['count', 'clr'],
  jitter: ['clr'],
};
const NEEDS_1 = ['aimSpread', 'ring', 'laserSweep', 'scatter'];
const NEEDS_2 = ['aimBurst'];

describe('boss pattern data', () => {
  it('every registered pattern name has a REQUIRED entry', () => {
    for (const p of BULLET_PATTERNS.all()) {
      expect(REQUIRED[p.key], `unknown pattern ${p.key}`).toBeDefined();
    }
  });

  it('every stage has a boss whose patterns cover all phases and are registered', () => {
    for (let s = 1; s <= STAGES.length; s++) {
      const boss = STAGES[s - 1].boss;
      expect(boss.patterns.length).toBe(phaseCountForStage(s));
      for (const entry of boss.patterns) {
        const list: PhaseEntry[] = Array.isArray(entry) ? entry : [entry];
        for (const p of list) {
          expect(p.name, `stage ${s} pattern name`).toBeDefined();
          expect(REQUIRED[p.name], `stage ${s} unknown pattern ${p.name}`).toBeDefined();
          expect(BULLET_PATTERNS.has(p.name), `stage ${s} unregistered pattern ${p.name}`).toBe(true);
          for (const k of REQUIRED[p.name]) {
            expect(p[k as keyof typeof p], `stage ${s} ${p.name} missing ${k}`).toBeDefined();
          }
          if (p.name === 'laserSweep') {
            expect(p.count, `stage ${s} laserSweep count`).toBeGreaterThan(1);
          }
        }
      }
    }
  });

  it('every stage has spdBase and non-negative spdPhase', () => {
    for (let s = 1; s <= STAGES.length; s++) {
      for (const entry of STAGES[s - 1].boss.patterns) {
        const list = Array.isArray(entry) ? entry : [entry];
        for (const p of list) {
          if (NEEDS_1.includes(p.name) || NEEDS_2.includes(p.name)) {
            expect(p.spdBase, `stage ${s} ${p.name}`).toBeGreaterThan(0);
          }
          expect(p.spdPhase, `stage ${s} ${p.name}`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

describe('Boss.fire dispatch', () => {
  function bossAt(stage: number, phase: number): { boss: Boss; g: ReturnType<typeof stubContext> } {
    const g = stubContext({ currentStage: stage });
    const boss = createBoss(g);
    boss.x = 240; boss.y = 130;
    g.bossPhase = phase;
    return { boss, g };
  }

  it('fires the bullet counts the stage data declares (one phase per stage)', () => {
    const samples = [
      [1, 0], [2, 1], [3, 2], [4, 1], [5, 0], [6, 2], [7, 3], [8, 4],
    ];
    for (const [s, phase] of samples) {
      const { boss, g } = bossAt(s as number, phase as number);
      boss.fire(g);
      const expectCount = (() => {
        const entry = boss.def.patterns[phase % boss.def.patterns.length];
        const list = Array.isArray(entry) ? entry : [entry];
        return list.reduce((n, p) => {
          if (p.name === 'aimSpread') return n + (p.count ?? 0);
          if (p.name === 'ring') return n + (p.count ?? 0);
          if (p.name === 'aimBurst') return n + (p.offsets?.length ?? 0);
          if (p.name === 'sideAlternate') return n + 3;
          if (p.name === 'laserSweep') return n + (p.count ?? 0) + 1;
          if (p.name === 'scatter') return n + (p.count ?? 0);
          if (p.name === 'jitter') return n + 1;
          return n;
        }, 0);
      })();
      expect(g.enemyBullets.length, `stage ${s} phase ${phase}`).toBe(expectCount);
    }
  });

  it('wraps bossPhase beyond patterns.length without throwing', () => {
    const { boss, g } = bossAt(1, 0);
    g.bossPhase = boss.def.patterns.length;
    expect(() => boss.fire(g)).not.toThrow();
  });

  it('returns early when player is dead or missing', () => {
    const { boss, g } = bossAt(1, 0);
    g.player!.dead = true;
    expect(() => boss.fire(g)).not.toThrow();
    expect(g.enemyBullets.length).toBe(0);
    g.player = null;
    expect(() => boss.fire(g)).not.toThrow();
  });
});

describe('boss draw paths', () => {
  it('every stage 1-8 boss has tint null, so the direct-render fast path is used (pixel identity)', () => {
    for (let s = 1; s <= 8; s++) {
      expect(STAGES[s - 1].boss.tint, `stage ${s} tint`).toBeNull();
    }
  });

  it('Boss.draw renders every archetype without throwing (fast path and tint path)', () => {
    const rc = new CanvasRenderer(noopCtx);
    for (let s = 1; s <= 8; s++) {
      const g = stubContext({ currentStage: s });
      const boss = createBoss(g);
      boss.x = 240; boss.y = 130; boss.hp = 100;
      expect(() => boss.draw(rc, g), `stage ${s} fast path`).not.toThrow();
    }
    const g = stubContext({ currentStage: 1 });
    const tinted = new Boss({ ...BOSS_TYPES.get('blaze')!, tint: '#ff0000' }, 1, g);
    expect(() => tinted.draw(rc, g)).not.toThrow();
  });
});

describe('createBoss difficulty integration', () => {
  it('boss hp matches bossMaxHp and phaseCount matches the formula', () => {
    for (let s = 1; s <= STAGES.length; s++) {
      const g = stubContext({ currentStage: s });
      const boss = createBoss(g);
      expect(boss.hp).toBe(g.bossMaxHp);
      expect(g.bossMaxHp).toBe(bossHpForStage(s));
      expect(boss.phaseCount).toBe(phaseCountForStage(s));
    }
  });
});
```

- [ ] **Step 5: Switch enemy-bullet loops to the instance form and remove the particle wrappers**

Every enemy bullet is now a `Bullet` instance (`BULLET_PATTERNS` + `Enemy.fire` both use `spawnEnemyBullet`), so the inline loops from Task 7 can become instance-based. In `src/entities/Bullet.ts`, replace the inline `updateEnemyBullets` and `drawEnemyBullets` bodies with:

```ts
export function updateEnemyBullets(dt: number, ctx: GameContext): void {
  for (let i = ctx.enemyBullets.length - 1; i >= 0; i--) {
    const b = ctx.enemyBullets[i];
    b.update(dt, ctx);
    if (!b.alive) ctx.enemyBullets.splice(i, 1);
  }
}

export function drawEnemyBullets(rc: RenderContext, ctx: GameContext): void {
  ctx.enemyBullets.forEach(b => b.draw(rc, ctx));
}
```

Delete the `spawnExplosion`/`spawnBombFlash` backward-compat wrappers from `src/entities/Particle.ts` (every caller now uses `ctx.spawnParticles`). `grep -n "spawnExplosion\|spawnBombFlash" src/` must show **zero** hits.

- [ ] **Step 6: Verify suite green**

Run: `npm test` — Expected: PASS (54 tests). Smoke plays TITLE→boss→STAGECLEAR→next stage and VICTORY/loop with the class-based boss.

- [ ] **Step 7: Commit**

```bash
git add src/entities/Boss.ts src/registries/bosses src/stages/stageData.ts src/core/Game.ts src/entities/Enemy.ts src/entities/Bullet.ts src/entities/Particle.ts tests/boss.test.ts
git commit -m "refactor: bosses behind BOSS_TYPES; stageData references boss type names"
```

## Task 11: Game.ts full migration

**Files:**
- Rewrite: `src/core/Game.ts` (implements `GameContext`, injects renderer/audio, class-method loop)
- Modify: `tests/smoke.test.ts` (inject `CanvasRenderer` + `SilentBus`)

- [ ] **Step 1: Rewrite `src/core/Game.ts`**

```ts
import { W, H, STATE, STAGE_COUNT } from '../config.js';
import { ctx } from '../canvas.js';
import type { GameContext } from './GameContext.js';
import { CanvasRenderer, type RenderContext } from './Renderer.js';
import { WebAudioBus, type AudioBus } from './audio.js';
import { diffMultFor } from './difficulty.js';
import { initBackground, updateStars, drawStars, updateBackground, drawBackground } from '../stages/background.js';
import { updateParticles, drawParticles } from '../entities/Particle.js';
import { createPlayer, updatePlayer, drawPlayer } from '../entities/Player.js';
import { updatePlayerBullets, drawPlayerBullets, updateEnemyBullets, drawEnemyBullets } from '../entities/Bullet.js';
import { updateEnemies } from '../entities/Enemy.js';
import { updatePowerups, drawPowerups } from '../entities/Powerup.js';
import type { Player } from '../entities/Player.js';
import type { Enemy } from '../entities/Enemy.js';
import type { Boss } from '../entities/Boss.js';
import type { Bullet, EnemyBullet } from '../entities/Bullet.js';
import type { Powerup } from '../entities/Powerup.js';
import type { Particle } from '../entities/Particle.js';
import { runCollision } from './collision.js';
import { STAGES } from '../stages/stageData.js';
import { buildWaveTable, updateWaves, type WaveEntry } from '../stages/waveGen.js';
import { drawHUD } from '../render/hud.js';
import { drawTitle, drawPause, drawSettings, drawGameOver, drawStageClear, drawVictory } from '../render/screens.js';
import { drawTouchControls } from './input.js';

export interface GameDeps {
  renderer?: RenderContext;
  audio?: AudioBus;
}

export class Game implements GameContext {
  state = STATE.TITLE;
  settingsOpen = false;
  soundOn = true;
  gameSpeed = 1.0;
  score = 0;
  highScore = parseInt(localStorage.getItem('raidenHS') || '0');
  keys: Record<string, boolean> = {};
  moveVec = { x: 0, y: 0 };
  player: Player | null = null;
  enemies: Enemy[] = [];
  boss: Boss | null = null;
  playerBullets: Bullet[] = [];
  enemyBullets: EnemyBullet[] = [];
  powerups: Powerup[] = [];
  particles: Particle[] = [];
  diffMult = 1.0;
  loopMult = 1;
  waveTable: WaveEntry[] = [];
  waveIndex = 0;
  stageTimer = 0;
  currentStage = 1;
  bossSpawned = false;
  bossMaxHp = 0;
  bossPhase = 0;
  bossTimer = 0;
  bossAngle = 0;
  stageClearTimer = 0;
  victoryTimer = 0;
  lastTime = 0;
  readonly renderer: RenderContext;
  readonly audio: AudioBus;
  private loopFn: (ts: number) => void;

  constructor(deps: GameDeps = {}) {
    this.renderer = deps.renderer ?? new CanvasRenderer(ctx);
    this.audio = deps.audio ?? new WebAudioBus();
    this.audio.setEnabled(this.soundOn);
    this.loopFn = (ts) => this.loop(ts);
  }

  toggleSound(): void {
    this.soundOn = !this.soundOn;
    this.audio.setEnabled(this.soundOn);
  }

  saveHS(): void {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('raidenHS', String(this.highScore));
    }
  }

  startGame(): void {
    this.score = 0;
    this.player = createPlayer();
    this.particles.length = 0;
    this.powerups.length = 0;
    this.startStage(1);
    this.state = STATE.PLAYING;
  }

  startStage(stage: number): void {
    this.currentStage = stage;
    this.diffMult = diffMultFor(stage, this.loopMult);
    initBackground(stage);   // old one-argument signature until Task 12
    this.waveTable = buildWaveTable(STAGES[stage - 1], this.diffMult);
    this.waveIndex = 0;
    this.stageTimer = 0;
    this.bossSpawned = false;
    this.boss = null;
    this.enemies.length = 0;
    this.enemyBullets.length = 0;
    this.playerBullets.length = 0;
    this.powerups.length = 0;
  }

  spawnParticles(kind: string, x: number, y: number, opts?: Record<string, unknown>): void {
    spawnParticleKind(kind, x, y, opts ?? {}, this);
  }

  updateStageClear(dt: number): void {
    this.stageClearTimer -= dt;
    if (this.stageClearTimer <= 0) {
      this.startStage(this.currentStage + 1);
      this.state = STATE.PLAYING;
    }
  }

  updateVictory(_dt: number): void { /* victory stays until Enter */ }

  loop(ts: number): void {
    requestAnimationFrame(this.loopFn);
    const rawDt = Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;
    const dt = rawDt * this.gameSpeed;

    // NOTE: background.ts is still the old ctx-singleton module until Task 12,
    // so these are the OLD one-argument signatures. Task 12 switches them.
    if (this.state !== STATE.PAUSED) updateStars(dt);
    if (this.state === STATE.PLAYING || this.state === STATE.STAGECLEAR) updateBackground(dt);
    if (this.state === STATE.PLAYING || this.state === STATE.STAGECLEAR) updateParticles(dt, this);
    if (this.state === STATE.STAGECLEAR) this.updateStageClear(dt);
    if (this.state === STATE.VICTORY) this.updateVictory(dt);
    if (this.state === STATE.PLAYING) {
      updatePlayer(dt, this);
      updatePlayerBullets(dt, this);
      updateEnemies(dt, this);
      updateEnemyBullets(dt, this);
      runCollision(this);
      updatePowerups(dt, this);
      this.boss?.update(dt, this);
      updateWaves(dt, this);
    }

    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    if (this.state === STATE.PLAYING || this.state === STATE.STAGECLEAR || this.state === STATE.PAUSED) {
      drawBackground(this);
    } else {
      ctx.fillStyle = '#020208';
      ctx.fillRect(0, 0, W, H);
      drawStars();
    }

    if (this.state === STATE.TITLE)         drawTitle(this);
    else if (this.state === STATE.GAMEOVER) drawGameOver(this);
    else if (this.state === STATE.VICTORY)  drawVictory(this);
    else {
      this.enemies.forEach(e => e.draw(this.renderer, this));
      this.boss?.draw(this.renderer, this);
      drawEnemyBullets(this.renderer, this);
      drawPowerups(this.renderer, this);
      drawPlayerBullets(this.renderer, this);
      if (this.player) drawPlayer(this.player, this.renderer, this);
      drawParticles(this.renderer, this);
      drawHUD(this);
      if (this.state === STATE.PAUSED)     drawPause(this);
      if (this.state === STATE.STAGECLEAR) drawStageClear(this);
    }
    if (this.settingsOpen) drawSettings(this);
    drawTouchControls(this);
  }
}
```

> `spawnParticles` uses a plain top-level import. Add it to the import block at the top of the file:

```ts
import { spawnParticleKind } from '../entities/Particle.js';
```

> No cycle exists: `Particle.ts` never imports `Game.ts`.

- [ ] **Step 2: Rewrite `tests/smoke.test.ts`** — inject renderer + SilentBus, keep every assertion:

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { Game } from '../src/core/Game.js';
import { CanvasRenderer } from '../src/core/Renderer.js';
import { SilentBus } from '../src/core/audio.js';
import { noopCtx } from './dom-setup.js';

function newGame() {
  return new Game({ renderer: new CanvasRenderer(noopCtx), audio: new SilentBus() });
}

describe('game smoke test (real module graph, stubbed DOM)', () => {
  beforeAll(async () => {
    // Exercises the real boot module (canvas singleton, input wiring) once.
    await import('../src/main.js');
  });

  it('boots to TITLE and starts stage 1 on Enter', () => {
    const game = newGame();
    expect(game.state).toBe(0);
    game.loopMult = 1;
    game.startGame();
    expect(game.player).not.toBeNull();
    expect(game.enemies.length).toBe(0);
    expect(game.currentStage).toBe(1);
    expect(game.waveTable.length).toBeGreaterThan(0);
  });

  it('plays through stage 1 to boss spawn, kill, and stage clear', () => {
    const game = newGame();
    game.loopMult = 1;
    game.startGame();
    game.keys['Space'] = true;
    let ts = 1000;
    game.lastTime = ts;
    let bossFrame = -1;
    for (let i = 0; i < 3000; i++) {
      ts += 1000 / 60;
      if (game.player && !game.player.dead) game.player.invTimer = 9999;
      game.loop(ts);
      if (game.boss) { bossFrame = i; break; }
    }
    expect(bossFrame).toBeGreaterThan(-1);
    expect(game.boss).not.toBeNull();
    game.boss!.hp = 0;
    game.loop(ts += 1000 / 60);
    expect(game.state).toBe(4);
    game.stageClearTimer = 0.001;
    game.loop(ts += 1000 / 60);
    expect(game.state).toBe(1);
    expect(game.currentStage).toBe(2);
  });

  it('reaches VICTORY after stage 18 on loop 1, and restarts the loop on Enter', () => {
    const g2 = newGame();
    g2.loopMult = 1; g2.startGame();
    g2.currentStage = 18; g2.waveTable = [{ t: 0, boss: 18 }]; g2.waveIndex = 0; g2.stageTimer = 99;
    let ts = 1000; g2.lastTime = ts; g2.loop(ts);
    expect(g2.boss).not.toBeNull();
    g2.boss!.hp = 0;
    g2.loop(ts += 1000 / 60);
    expect(g2.state).toBe(5);

    const g3 = newGame();
    g3.loopMult = 2; g3.startGame();
    g3.currentStage = 18; g3.waveTable = [{ t: 0, boss: 18 }]; g3.waveIndex = 0; g3.stageTimer = 99;
    ts += 1000 / 60; g3.lastTime = ts; g3.loop(ts);
    g3.boss!.hp = 0;
    g3.loop(ts += 1000 / 60);
    expect(g3.state).toBe(1);
    expect(g3.loopMult).toBe(3);
    expect(g3.currentStage).toBe(1);
  });

  it('renders every screen state without unbound references', () => {
    const g4 = newGame();
    let ts = 1000; g4.lastTime = ts;
    const scenes = [
      () => { g4.state = 0; g4.settingsOpen = false; },
      () => { g4.state = 3; g4.settingsOpen = false; },
      () => { g4.state = 5; g4.settingsOpen = false; },
      () => { g4.state = 2; g4.settingsOpen = true; g4.startGame(); },
    ];
    for (const scene of scenes) {
      scene();
      expect(() => g4.loop(ts += 1000 / 60)).not.toThrow();
    }
  });
});
```

> The `beforeAll` import of `../src/main.js` runs the real boot module (canvas singleton, input wiring, version log) so the smoke test still exercises the full module graph. The static `import { Game }` gives full typing; `main.ts` only needs its side effects (it constructs its own `Game` with real deps, which is harmless in the stubbed-DOM test environment).

- [ ] **Step 3: Verify suite green**

Run: `npm test` — Expected: PASS (54 tests).

- [ ] **Step 4: Commit**

```bash
git add src/core/Game.ts tests/smoke.test.ts
git commit -m "refactor: Game implements GameContext with injected renderer and audio"
```

## Task 12: Background features — BG_FEATURES registry + orchestrator + stars

**Files:**
- Create: `src/registries/background/{rocks,clouds,bubbles,streaks,hulls,wisps,walls,stars,index}.ts`
- Rewrite: `src/stages/background.ts`
- Modify: `src/main.ts` (nothing — `Game` unchanged), `src/core/Game.ts` (already calls the new signatures from Task 11)

- [ ] **Step 1: Define `BgFeature` and the orchestrator**

`src/stages/background.ts`:

```ts
import { W, H } from '../config.js';
import type { GameContext } from '../core/GameContext.js';
import type { RenderContext } from '../core/Renderer.js';
import { STAGES } from './stageData.js';
import { BG_FEATURES } from '../registries/background/index.js';

export interface BgFeature {
  readonly key: string;
  build(): unknown;
  update(state: unknown, dt: number, ctx: GameContext): void;
  render(rc: RenderContext, state: unknown, ctx: GameContext): void;
}

export class BackgroundFeature {
  state: unknown;
  constructor(public readonly def: BgFeature, _stage: number) {
    this.state = def.build();
  }
  update(dt: number, ctx: GameContext): void { this.def.update(this.state, dt, ctx); }
  draw(rc: RenderContext, ctx: GameContext): void { this.def.render(rc, this.state, ctx); }
}

// Stars are a singleton feature: always present, tinted per-stage in drawBackground.
const starsDef = () => BG_FEATURES.get('stars')!;
const starsState = starsDef().build();

export function updateStars(dt: number, ctx: GameContext): void {
  starsDef().update(starsState, dt, ctx);
}

export function drawStars(rc: RenderContext, ctx: GameContext): void {
  starsDef().render(rc, starsState, ctx);
}

let activeFeatures: BackgroundFeature[] = [];

export function initBackground(stage: number, _ctx: GameContext): void {
  const stageDef = STAGES[Math.max(0, Math.min(STAGES.length - 1, stage - 1))];
  const featKeys = stageDef.bg.features || [];
  activeFeatures = featKeys.map(k => new BackgroundFeature(BG_FEATURES.get(k)!, stage));
}

export function updateBackground(dt: number, ctx: GameContext): void {
  activeFeatures.forEach(f => f.update(dt, ctx));
}

export function drawBackground(rc: RenderContext, ctx: GameContext): void {
  const cfg = STAGES[Math.max(0, Math.min(STAGES.length - 1, ctx.currentStage - 1))].bg;
  rc.fillStyle = cfg.baseFill;
  rc.fillRect(0, 0, W, H);

  if (cfg.starColor) {
    (starsState as { tint: unknown }).tint = cfg.starColor;
    starsDef().render(rc, starsState, ctx);
    (starsState as { tint: unknown }).tint = null;
  }

  activeFeatures.forEach(f => f.draw(rc, ctx));
}
```

- [ ] **Step 2: Create the eight feature defs**

Each feature file ports `build*/update*/draw*` bodies verbatim from the pre-migration `src/stages/background.ts`, with `ctx` → `rc`, module-level arrays becoming the state object returned by `build()`.

`src/registries/background/rocks.ts`:

```ts
import { W, H } from '../../config.js';
import type { BgFeature } from '../../stages/background.js';

interface Rock { x: number; y: number; r: number; spd: number; rot: number; rotSpd: number; layer: number; }

export const rocks: BgFeature = {
  key: 'rocks',
  build(): Rock[] {
    const out: Rock[] = [];
    for (let i = 0; i < 14; i++) {
      out.push({ x: Math.random() * W, y: Math.random() * H, r: 8 + Math.random() * 12,
        spd: 60 + Math.random() * 40, rot: Math.random() * Math.PI * 2,
        rotSpd: (Math.random() - 0.5) * 0.8, layer: 0 });
    }
    for (let i = 0; i < 8; i++) {
      out.push({ x: Math.random() * W, y: Math.random() * H, r: 5 + Math.random() * 8,
        spd: 100 + Math.random() * 40, rot: Math.random() * Math.PI * 2,
        rotSpd: (Math.random() - 0.5) * 1.2, layer: 1 });
    }
    return out;
  },
  update(state, dt) {
    const rocks = state as Rock[];
    rocks.forEach(r => {
      r.y += r.spd * dt; r.rot += r.rotSpd * dt;
      if (r.y > H + r.r * 2) { r.y = -r.r * 2; r.x = Math.random() * W; }
    });
  },
  render(rc, state) {
    const rocks = state as Rock[];
    rocks.forEach(r => {
      rc.save(); rc.translate(r.x, r.y); rc.rotate(r.rot);
      rc.fillStyle = r.layer === 0 ? 'rgba(130,120,110,0.5)' : 'rgba(100,95,85,0.45)';
      rc.beginPath(); rc.ellipse(0, 0, r.r * 1.4, r.r, 0, 0, Math.PI * 2); rc.fill();
      rc.strokeStyle = 'rgba(180,170,155,0.2)'; rc.lineWidth = 1; rc.stroke();
      rc.restore();
    });
  },
};
```

The remaining six stage features use the same three-function shape. Port each from the pre-migration file (source line ranges refer to that file):

| file | build (lines) | update (lines) | render (lines) | state shape |
|---|---|---|---|---|
| `clouds.ts` | `buildClouds` 58–65 | clouds block 159–164 | clouds block 222–229 | `Cloud[]` |
| `bubbles.ts` | `buildBubbles` 67–76 | bubbles block 165–171 | bubbles block 231–240 | `Bubble[]` |
| `streaks.ts` | `buildStreaks` 78–85 | streaks block 172–177 | streaks block 242–252 | `Streak[]` |
| `hulls.ts` | `buildHulls` 87–98 | hulls block 178–183 | hulls block 254–268 | `Hull[]` |
| `wisps.ts` | `buildWisps` 100–111 | wisps block (none — static) | wisps block 270–278 | `Wisp[]` |
| `walls.ts` | `buildWalls` 113–128 | walls block 184–189 (moves the ember `bgParticles`) | walls block 280–301 | `{ walls: Wall[]; embers: Ember[] }` |

> `wisps` has no update block (they are static); its `update` is a no-op `() => {}`. `walls` holds **two** arrays in its state (`walls` = `bgWalls`, `embers` = `bgParticles`) because both scroll together; its render reads `(ctx as GameContext).stageTimer` for the sine offset exactly as the original read `g.stageTimer`. These six def files follow the registry import pattern: `export const <key>: BgFeature = {…};` with **no** `registerBgFeature` import/call (the index registers them).

`src/registries/background/stars.ts` — port the `STAR_LAYERS` machinery: `build()` returns `{ layers: [{stars:[], speed, size, color}, ×3], tint: null }`, `update` scrolls each layer's stars, `render` draws them using `state.tint` when set (else the default colors):

```ts
import { W, H } from '../../config.js';
import type { BgFeature } from '../../stages/background.js';

interface Star { x: number; y: number; }
interface StarLayer { stars: Star[]; speed: number; size: number; color: string; }
interface StarState { layers: StarLayer[]; tint: [string, string, string] | null; }

export const stars: BgFeature = {
  key: 'stars',
  build(): StarState {
    const layers: StarLayer[] = [
      { stars: [], speed: 60,  size: 1.0, color: 'rgba(255,255,255,0.4)' },
      { stars: [], speed: 120, size: 1.5, color: 'rgba(255,255,255,0.7)' },
      { stars: [], speed: 200, size: 2.0, color: 'rgba(200,220,255,1.0)' },
    ];
    layers.forEach(layer => {
      for (let i = 0; i < 60; i++) layer.stars.push({ x: Math.random() * W, y: Math.random() * H });
    });
    return { layers, tint: null };
  },
  update(state, dt) {
    const s = state as StarState;
    s.layers.forEach(layer => {
      layer.stars.forEach(star => {
        star.y += layer.speed * dt;
        if (star.y > H) { star.y = 0; star.x = Math.random() * W; }
      });
    });
  },
  render(rc, state) {
    const s = state as StarState;
    s.layers.forEach((layer, i) => {
      rc.fillStyle = s.tint ? s.tint[i] : layer.color;
      layer.stars.forEach(star => rc.fillRect(star.x, star.y, layer.size, layer.size));
    });
  },
};
```

`src/registries/background/index.ts`:

```ts
import { makeRegistry } from '../../core/registry.js';
import type { BgFeature } from '../../stages/background.js';
import { rocks } from './rocks.js';
import { clouds } from './clouds.js';
import { bubbles } from './bubbles.js';
import { streaks } from './streaks.js';
import { hulls } from './hulls.js';
import { wisps } from './wisps.js';
import { walls } from './walls.js';
import { stars } from './stars.js';

export const BG_FEATURES = makeRegistry<BgFeature>();
export const registerBgFeature = BG_FEATURES.register;
registerBgFeature(rocks);
registerBgFeature(clouds);
registerBgFeature(bubbles);
registerBgFeature(streaks);
registerBgFeature(hulls);
registerBgFeature(wisps);
registerBgFeature(walls);
registerBgFeature(stars);
```

> `BgFeature` is declared in `stages/background.ts`; feature def files import it **type-only** (erased), and the orchestrator imports `BG_FEATURES` at runtime. No cycle.

- [ ] **Step 3: Point `Game.ts` at the new background signatures**

In `src/core/Game.ts`, switch the Task 11 placeholder calls to the new two-argument forms:

```ts
if (this.state !== STATE.PAUSED) updateStars(dt, this);
if (this.state === STATE.PLAYING || this.state === STATE.STAGECLEAR) updateBackground(dt, this);
// ...
drawBackground(this.renderer, this);   // in the playing/stageclear/paused branch
drawStars(this.renderer, this);        // in the else branch
// ...
initBackground(stage, this);           // in startStage
```

- [ ] **Step 4: Verify suite green**

Run: `npm test` — Expected: PASS (54 tests). Smoke renders every screen state, which drives `drawBackground`/`updateStars`/`drawStars` with the feature registry.

- [ ] **Step 5: Commit**

```bash
git add src/stages/background.ts src/registries/background
git commit -m "refactor: backgrounds behind BG_FEATURES registry"
```

## Task 13: Typing pass over remaining modules

**Files:**
- Modify: `src/core/collision.ts`, `src/core/input.ts`, `src/core/difficulty.ts`, `src/render/hud.ts`, `src/render/screens.ts`, `src/canvas.ts`, `src/main.ts`, `src/stages/waveGen.ts` (drop the intersection cast)

- [ ] **Step 1: Type `difficulty.ts`, `collision.ts`, `canvas.ts`**

`difficulty.ts` already typechecks (pure arithmetic) — add explicit parameter types only where tsc complains. `collision.ts`: `g` → `ctx: GameContext` in every function, `spawnExplosion(...)` calls → `ctx.spawnParticles(...)` (enemy size map from Task 9 and bullet hit from Task 7 already done), `killPlayer(ctx)` already in place. `canvas.ts` is unchanged JS semantics; it only needs the `canvas` element non-null assertion:

```ts
export const canvas = document.getElementById('c') as HTMLCanvasElement;
export const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
```

- [ ] **Step 2: Type `input.ts`**

`initInput(g: Game)`, `handleKeyPress(g: Game, code: string)`, `cycleSpeed(g: Game, dir: number)`, `touchDiscrete(p: {x: number; y: number}, g: Game)`, `drawTouchControls(g: Game)`; the `'KeyM'` toggle becomes `g.toggleSound()` (added in Task 11); `isTouch` guard with `typeof window`:

```ts
export const isTouch = typeof window !== 'undefined' &&
  (('ontouchstart' in window) ||
   (window.matchMedia && window.matchMedia('(pointer: coarse)').matches));
```

- [ ] **Step 3: Type `hud.ts` and `screens.ts`**

Both take `g: Game`; all drawing stays on the `ctx` singleton (out of scope to migrate screens). Fix any implicit-any on `wSlots.forEach` etc.

- [ ] **Step 4: Type `main.ts` and inject deps**

```ts
import './canvas.js';
import { VERSION } from './config.js';
import { Game } from './core/Game.js';
import { initInput } from './core/input.js';
import { CanvasRenderer } from './core/Renderer.js';
import { WebAudioBus } from './core/audio.js';
import { ctx } from './canvas.js';

const sha = import.meta.env.VITE_GIT_SHA;
console.log(`[RAIDEN] v${VERSION}${sha ? ` — commit ${sha}` : ' (dev)'}`);

const game = new Game({ renderer: new CanvasRenderer(ctx), audio: new WebAudioBus() });
initInput(game);
requestAnimationFrame(ts => { game.lastTime = ts; requestAnimationFrame(t => game.loop(t)); });
```

> `game.loop` must be invoked with `this` bound: the initial rAF uses an arrow `t => game.loop(t)`, and `loop` re-requests via its bound `this.loopFn`.

- [ ] **Step 5: Drop the `waveGen.ts` cast** — `Game` is now fully typed, so `updateWaves(dt, ctx: GameContext)` can read `ctx.waveTable`/`ctx.waveIndex` directly **only if** those fields are on `GameContext`. They are not (they are Game-only). Add them to `GameContext`:

```ts
waveTable: WaveEntry[];
waveIndex: number;
bossSpawned: boolean;
```

> `WaveEntry` is imported type-only into `GameContext.ts` from `../stages/waveGen.js`. Then `updateWaves` uses `ctx.waveTable`/`ctx.waveIndex` directly and the cast is removed.

Also add the same three fields to `tests/context-stub.ts` (they are now required by `GameContext`):

```ts
    waveTable: [],
    waveIndex: 0,
    bossSpawned: false,
```

and add `import type { WaveEntry } from '../src/stages/waveGen.js';` for the `waveTable` field type.

- [ ] **Step 6: Verify suite green**

Run: `npm test` — Expected: PASS (54 tests).

- [ ] **Step 7: Commit**

```bash
git add src/core/collision.ts src/core/input.ts src/core/difficulty.ts src/render/hud.ts src/render/screens.ts src/canvas.ts src/main.ts src/stages/waveGen.ts src/core/GameContext.ts
git commit -m "refactor: type remaining modules; inject deps in main"
```

## Task 14: Extensibility proof — a 9th boss with no existing-family edits

**Files:**
- Test: `tests/extensibility.test.ts`

- [ ] **Step 1: Write the failing extensibility test**

Create `tests/extensibility.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { Boss, createBoss } from '../src/entities/Boss.js';
import { BOSS_TYPES, registerBossType, type BossType } from '../src/registries/bosses/index.js';
import { CanvasRenderer } from '../src/core/Renderer.js';
import { noopCtx } from './dom-setup.js';
import { stubContext } from './context-stub.js';

const demo: BossType = {
  key: 'demo',
  tint: null,
  r: 40,
  patterns: [
    { name: 'aimSpread', spdBase: 100, spdPhase: 0, count: 3, gap: 0.2, clr: '#00ff00' },
  ],
  render(c, boss) {
    c.fillStyle = '#00ff00';
    c.beginPath(); c.arc(0, 0, boss.r, 0, Math.PI * 2); c.fill();
  },
};

describe('extensibility: adding a variant touches no existing family file', () => {
  it('a demo 9th boss registers and plays via the same machinery as the built-ins', () => {
    expect(BOSS_TYPES.has('demo')).toBe(false);
    registerBossType(demo);
    expect(BOSS_TYPES.has('demo')).toBe(true);

    const g = stubContext({ currentStage: 1 });
    const boss = new Boss(demo, 1, g);
    expect(boss.def).toBe(demo);
    boss.fire(g);
    expect(g.enemyBullets.length).toBe(3);        // aimSpread count 3
    expect(() => boss.draw(new CanvasRenderer(noopCtx), g)).not.toThrow();
  });

  it('createBoss still resolves built-in stages after the addition', () => {
    const g = stubContext({ currentStage: 1 });
    const boss = createBoss(g);
    expect(boss.def.key).toBe('blaze');
    expect(boss.hp).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/extensibility.test.ts`
Expected: PASS (2 tests). This is the definition-of-done proof: one file + one `register` line, no `switch`/`if` in any family class.

- [ ] **Step 3: Commit**

```bash
git add tests/extensibility.test.ts
git commit -m "test: extensibility proof — demo 9th boss via registry"
```

## Task 15: Typecheck green + CI wiring + final verification

**Files:**
- Modify: `.github/workflows/pages.yml`, any leftover strict-typing errors in `src/` and `tests/`

- [ ] **Step 1: Run typecheck and fix remaining errors**

Run: `npm run typecheck`
Expected: the plan's typing is complete, so this should be near-green. Fix each remaining error (the big-ticket items, if any, are listed):
- `tests/smoke.test.ts` — if the static `import { Game }` still trips on `game.boss.hp` narrowing, use `game.boss!.hp = 0` (already the form in the plan).
- `src/core/input.ts` unused `SPEED_STEPS`-related narrowing, `navigator.clipboard` optional chaining typing.
- `src/render/*.ts` `ctx` property writes on the `CanvasRenderingContext2D` — already typed.
- Any `noUnusedLocals`-style issues — `noUnusedLocals` is **not** enabled in the tsconfig, so the thin `Player.ts` wrappers (`createPlayer`/`drawPlayer`/`updatePlayer`) that `Game.ts` still calls do not error; keep them (they are part of the stable call surface).

Run `npm run typecheck` until it exits 0 with `tsc --noEmit` under `strict: true`.

- [ ] **Step 2: Wire typecheck into CI**

Edit `.github/workflows/pages.yml` so the build job runs typecheck before the test step:

```yaml
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
        env:
          VITE_GIT_SHA: ${{ github.sha }}
```

- [ ] **Step 3: Full verification (definition of done)**

Run:
```bash
npm run typecheck    # must exit 0
npm test             # must be green (54 tests; 51 after the extensibility test)
npm run build        # must emit the single-file bundle
```

Manually confirm `dist/index.html` is still a single self-contained file (the `vite-plugin-singlefile` output shape is unchanged) and that the game boots in the browser via `npm run dev`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "ci: run typecheck before tests; strict-clean TypeScript build"
```

---

## Self-review checklist (run against the spec before execution)

**Spec coverage:**
- Tooling/setup (spec §Tooling): Tasks 1, 2, 15. ✔
- DI seams `RenderContext`/`AudioBus`/`GameContext` + `Game implements GameContext` (spec §Dependency-Inversion, §GameContext): Tasks 3, 4, 11, 13. ✔
- Per-family registries: Boss Task 10, Enemy Task 9, Bullet Task 7, Powerup Task 6, Particle Task 5, Background Task 12. ✔
- `firePattern` → `BULLET_PATTERNS`, `expandPath` → `MOTION`: Tasks 7, 9. ✔
- stageData references type keys: enemy Task 9, boss Task 10. ✔
- Test migration with assertions preserved: Tasks 8 (particle), 9 (enemy/wavegen), 10 (boss), 11 (smoke), 14 (extensibility). ✔
- DoD #1 tsc strict clean: Task 15. DoD #2 tests green: every task. DoD #3 build unchanged: Tasks 2, 15. DoD #4 CI typecheck: Task 15. DoD #5 extensibility proof: Task 14. ✔
- Out-of-scope respected: `ctx`/`canvas` singleton kept at boot layer (HUD/screens/input/Game.loop still use it); `Game` still owns collections; no ECS; no gameplay change. ✔

**Placeholder scan:** every task contains concrete code or line-precise, source-referenced port instructions; no TBD/TODO. The eight boss renders and seven background features are specified as exact mechanical ports from the pre-migration files with their source line ranges (the code already exists in the repo and is transformed by a fully-specified rule).

**Type consistency (spot-checks):**
- `withTint(tint, radius, bx, by, drawLocal)` — used identically in `Renderer.ts`, `Boss.draw`, and the renderer test. ✔
- `BossType.patterns: PhaseEntry[]`, `PhasePattern extends PatternOpts` — consistent between `registries/bosses/index.ts` and `registries/bullets/patterns.ts`; both tests consume them. ✔
- `Enemy.update`/`fire`/`inRange`/`movement` field names match between `Enemy.ts` and the four defs. ✔
- `GameContext` fields (`spawnParticles`, `stageTimer`, `waveTable`/`waveIndex`/`bossSpawned` added in Task 13) are all provided by `Game`. ✔
- `Bullet` fields (`def`, `isEnemy`, `clr`, `delay`, `trail`, `homingDelay`) referenced by kind defs all exist on the class. ✔
- Registry API `register/get/has/all` used uniformly; `context-stub.ts` uses `stubContext` everywhere tests need a `GameContext`. ✔

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-19-oop-typescript-architecture.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?

# Raiden — Modularization, Build Step, and Stage Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the single-file Raiden shooter into ES modules behind a Vite build, then expand it from 8 to 18 data-driven stages with a steeper difficulty curve — without breaking the current game.

**Architecture:** `src/` holds ES modules (Vite dev/build; `vite-plugin-singlefile` emits one self-contained `dist/index.html` for GitHub Pages). A `Game` class in `src/core/Game.js` owns all shared mutable state; systems are modules of functions that receive the game as their last argument. Stages become data objects (`src/stages/stageData.js`) expanded by `src/stages/waveGen.js`; bosses reuse the 8 existing visual archetypes via `archetype` + `tint`, firing named reusable behaviors from a `patterns` array. The refactor is sequenced **behavior-preserving first, new content second**, with a manual playtest checkpoint at each boundary.

**Tech Stack:** Vite ^6, `vite-plugin-singlefile` ^2, Vitest ^3 (unit tests for the pure logic), GitHub Actions Pages deployment, vanilla JS (ES modules, no framework). Requires Node 18+ (Node 24 present locally).

---

## File Structure

New files created by this plan:

```
package.json
vite.config.js
.gitignore
index.html                      # rewritten at Phase A cutover to load /src/main.js
.github/workflows/pages.yml     # Phase F
src/
  main.js                       # entry: canvas side-effect, Game, initInput, rAF loop
  config.js                     # W, H, FPS, STEP, CHARGE_DURATION, STAGE_COUNT, SPEED_STEPS, STATE
  canvas.js                     # canvas element, ctx, resize()
  core/
    Game.js                     # class Game — owns shared mutable state + main loop
    input.js                    # keyboard + touch (stick, buttons) -> keys/moveVec/firePressed
    audio.js                    # AudioContext, sfxShoot/Explosion/Powerup/Bomb
    particles.js                # explosion + bomb flash particles
    collision.js                # circleHit, runCollision + helpers
    difficulty.js               # pure difficulty math (diffMultFor, Phase E: full curve)
  entities/
    Player.js                   # createPlayer, drawPlayer, updatePlayer, killPlayer, respawnPlayer
    Bullet.js                   # player/enemy bullets + firePlayer/fireSuper
    Enemy.js                    # ENEMY_CFG, mkEnemy, drawEnemy, updateEnemies, fireEnemy
    Powerup.js                  # powerups, drops, checkPlayerVsPowerups
    Boss.js                     # createBoss, drawBoss(archetypes), fireBoss(patterns), updateBoss
  stages/
    background.js               # starfield + per-feature backgrounds (feature-driven)
    waveGen.js                  # path helpers, buildWaveTable (descriptor -> runtime), updateWaves
    stageData.js                # STAGES[] — 8 in Phase B, 18 in Phase D
  render/
    hud.js                      # drawHUD
    screens.js                  # title/pause/settings/gameover/stageclear/victory
tests/
  difficulty.test.js
  wavegen.test.js
  boss.test.js
```

Modified file: `index.html` (script removed at Phase A cutover; CSS preserved).

Existing source line ranges in `index.html` referenced by the relocation tasks (verified against the current file):

| Section | Lines | Becomes |
|---|---|---|
| CONFIG | 25–44 | `config.js` + `canvas.js` |
| STATE_MACHINE | 46–61 | `Game` constructor |
| INPUT | 63–112 | `core/input.js` |
| TOUCH | 114–314 | `core/input.js` |
| AUDIO | 317–416 | `core/audio.js` |
| STARFIELD + STAGE BACKGROUNDS | 418–719 | `stages/background.js` |
| PARTICLES | 721–778 | `core/particles.js` |
| PLAYER | 780–983 | `entities/Player.js` |
| PLAYER BULLETS | 985–1185 | `entities/Bullet.js` |
| ENEMIES | 1282–1431 | `entities/Enemy.js` |
| ENEMY BULLETS | 1433–1460 | `entities/Bullet.js` |
| POWERUPS | 1462–1530 | `entities/Powerup.js` |
| COLLISION | 1532–1614 | `core/collision.js` |
| WAVE TABLES | 1616–1924 | `stages/waveGen.js` |
| BOSS | 1926–2446 | `entities/Boss.js` |
| HUD & SCREENS | 2448–2625 | `render/hud.js` + `render/screens.js` |
| startGame | 2627–2634 | `Game.startGame` |
| MAIN LOOP | 2636–2696 | `Game.loop` + `src/main.js` |

### Shared-state convention (applies to every Phase A task)

The **`Game` instance `g` owns every mutable binding** currently declared at file scope in `index.html` (from the STATE_MACHINE, PLAYER, PLAYER BULLETS, ENEMIES, ENEMY BULLETS, POWERUPS, WAVES, BOSS, MAIN_LOOP sections): `state, settingsOpen, soundOn, gameSpeed, score, highScore, keys, moveVec, player, enemies, boss, playerBullets, enemyBullets, powerups, particles, diffMult, loopMult, waveTable, waveIndex, stageTimer, currentStage, bossSpawned, bossMaxHp, bossPhase, bossTimer, bossAngle, stageClearTimer, victoryTimer, lastTime`.

Immutable constants stay imported as bare bindings (so moved bodies reference them unchanged): `W, H, FPS, STEP, CHARGE_DURATION, STAGE_COUNT, SPEED_STEPS, STATE` (from `config.js`), `ctx, canvas` (from `canvas.js`).

**Conversion rule for every relocated function:** give it a `g` parameter (last position), convert each *global binding* reference to `g.<name>`, and **leave object keys and property accesses untouched** (`e.score`, `entry.eliteHp`, `STAR_LAYERS[i].color`). When in doubt, a converted-but-unused `g.x` is safe; an unconverted binding throws a loud `ReferenceError` at the first frame — the playtest checkpoint catches it.

System-internal state that **no other module touches** stays module-local (this is not "a module keeping a copy of shared game state", it is the system's private state): `audioCtx` (audio), `isTouch, TC, STICK_R, STICK_DEAD, STICK_HOME, stick, roles, firePressed, bombPressed` (input), `STAR_LAYERS` + the `bg*` arrays + `bgStage` (background), `laserActive, laserPulse` (Bullet, unused legacy), `ENEMY_CFG, WEAPON_NAMES, WEAPON_COLORS` (their owning entity module).

Per-task conversion tables below list only the **real** global references in each section (property accesses and comment matches already excluded).

---

## Phase A — Scaffold + Behavior-Preserving Modularization

The goal of Phase A: the game running from `src/` must be **pixel- and behavior-identical** to today's `index.html`. The monolith stays untouched and runnable until the cutover task; the modules are built as faithful copies in parallel. `STAGE_COUNT` stays 8, `STAGE_DIFF` behavior is preserved exactly.

### Task 1: Scaffold the Vite project

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "raiden",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "devDependencies": {
    "vite": "^6.0.7",
    "vite-plugin-singlefile": "^2.0.3",
    "vitest": "^3.0.5"
  }
}
```

- [ ] **Step 2: Create `vite.config.js`**

```js
import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
  build: { target: 'es2018' },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
dist/
.DS_Store
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`
Expected: `added N packages` with no errors; `node_modules/vite`, `node_modules/vitest`, `node_modules/vite-plugin-singlefile` present.

- [ ] **Step 5: Verify the current game still runs (baseline)**

Run: `open index.html`
Expected: the game's title screen renders. This is the baseline the whole refactor is measured against.

- [ ] **Step 6: Commit**

```bash
git add package.json vite.config.js .gitignore
git commit -m "build: scaffold Vite + vitest + singlefile tooling"
```

### Task 2: Create `src/config.js` and `src/canvas.js`

**Files:**
- Create: `src/config.js`
- Create: `src/canvas.js`

These own the immutable top of the monolith (index.html:25–44). `STAGE_DIFF` is intentionally **not** moved here — it becomes the `DIFF_CURVE` inside `difficulty.js` (Task 3), preserving the same values.

- [ ] **Step 1: Create `src/config.js`**

```js
export const W = 480, H = 640;
export const FPS = 60;
export const STEP = 1 / FPS;
export const CHARGE_DURATION = 1.0;
export const STAGE_COUNT = 8;                 // becomes 18 in Phase D
export const SPEED_STEPS = [0.75, 1.0, 1.25];
export const STATE = { TITLE: 0, PLAYING: 1, PAUSED: 2, GAMEOVER: 3, STAGECLEAR: 4, VICTORY: 5 };
```

- [ ] **Step 2: Create `src/canvas.js`**

```js
import { W, H } from './config.js';

export const canvas = document.getElementById('c');
export const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

export function resize() {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width  = (W * scale) + 'px';
  canvas.style.height = (H * scale) + 'px';
}
window.addEventListener('resize', resize);
resize();
```

- [ ] **Step 3: Sanity-check the modules parse**

Run: `node -e "import('./src/config.js').then(m => console.log(m.W, m.H, m.STATE.PLAYING))"`
Expected: `480 640 1`

- [ ] **Step 4: Commit**

```bash
git add src/config.js src/canvas.js
git commit -m "refactor: extract immutable config and canvas into src modules"
```

### Task 3: Difficulty module + Vitest setup + first unit tests

**Files:**
- Create: `src/core/difficulty.js`
- Create: `tests/difficulty.test.js`

`difficulty.js` is introduced now (behavior-preserving: identical to `STAGE_DIFF` + the loop-stack formula from `startStage` at index.html:1905) so `Game.startStage` (Task 16) and the Phase E rebalance share one tested surface.

- [ ] **Step 1: Write the failing test `tests/difficulty.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { diffMultFor } from '../src/core/difficulty.js';

describe('diffMultFor', () => {
  it('matches the original STAGE_DIFF table for stages 1-8', () => {
    const expected = [1.0, 1.15, 1.30, 1.45, 1.60, 1.80, 2.00, 2.25];
    for (let s = 1; s <= 8; s++) {
      expect(diffMultFor(s, 1)).toBeCloseTo(expected[s - 1]);
    }
  });
  it('applies the loop-stack multiplier exactly like startStage', () => {
    expect(diffMultFor(1, 2)).toBeCloseTo(1.0 * 1.2);
    expect(diffMultFor(8, 3)).toBeCloseTo(2.25 * 1.4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/core/difficulty.js'` (or import error). The test file also needs the `tests/` dir to exist, created by the write.

- [ ] **Step 3: Implement `src/core/difficulty.js`**

```js
import { STAGE_COUNT } from '../config.js';

// Stage 1-8 speed multipliers — identical to the original STAGE_DIFF table.
// Phase E replaces this array with the steeper 18-entry curve.
export const DIFF_CURVE = [1.0, 1.15, 1.30, 1.45, 1.60, 1.80, 2.00, 2.25];
export const LOOP_STACK = 0.2;

export function diffMultFor(stage, loopMult) {
  const i = Math.max(0, Math.min(stage - 1, DIFF_CURVE.length - 1));
  return DIFF_CURVE[i] * (1 + (loopMult - 1) * LOOP_STACK);
}
```

(Note: `STAGE_COUNT` is imported but unused in Phase A — it will be used by the Phase E curve functions; remove the import if your linter objects, Phase E re-adds it.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/difficulty.js tests/difficulty.test.js
git commit -m "feat: add tested difficulty module preserving STAGE_DIFF behavior"
```

### Task 4: `src/core/particles.js`

**Files:**
- Create: `src/core/particles.js`

Source: index.html:721–778 (move `let particles` binding to `Game`).

- [ ] **Step 1: Create `src/core/particles.js`**

```js
import { W, H } from '../config.js';
import { ctx } from '../canvas.js';
import { sfxExplosion } from './audio.js';

export function spawnExplosion(x, y, size, color, g) {
  const count = 6 + size * 4;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd   = 40 + Math.random() * 80 * size;
    g.particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 1.0,
      decay: 0.7 + Math.random() * 0.8,
      r: 2 + Math.random() * size * 3,
      color: color || '#ff8800',
      bomb: false,
    });
  }
  sfxExplosion(size, g);
}

export function spawnBombFlash(g) {
  g.particles.push({ bomb: true, life: 1.0, decay: 2.5,
    x: 0, y: 0, vx: 0, vy: 0, r: 0, color: '' });
}

export function updateParticles(dt, g) {
  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i];
    p.life -= p.decay * dt;
    if (p.life <= 0) { g.particles.splice(i, 1); continue; }
    if (!p.bomb) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
  }
}

export function drawParticles(g) {
  g.particles.forEach(p => {
    if (p.bomb) {
      ctx.fillStyle = 'rgba(255,255,200,' + (p.life * 0.75) + ')';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, p.r * p.life), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}
```

- [ ] **Step 2: Verify it parses**

Run: `node --check src/core/particles.js`
Expected: no output (valid syntax). Note: this module is imported only by the cutover, so `node --check` (not `node -e`) is the right check — importing would pull in the DOM.

- [ ] **Step 3: Commit**

```bash
git add src/core/particles.js
git commit -m "refactor: extract particle system into src/core/particles.js"
```

### Task 5: `src/core/audio.js`

**Files:**
- Create: `src/core/audio.js`

Source: index.html:317–416. `audioCtx` stays module-local; `soundOn` is `Game` state (read by `handleKeyPress` and `drawSettings`).

- [ ] **Step 1: Create `src/core/audio.js`**

```js
let audioCtx = null;

function getAudio() {
  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export { getAudio };

export function sfxShoot(weapon, g) {
  if (!g.soundOn) return;
  try {
    const ac = getAudio();
    const osc  = ac.createOscillator();
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
      osc.type = weapon === 2 ? 'square' : 'square';
      const base = [880, 440, 660][weapon];
      osc.frequency.setValueAtTime(base + Math.random() * 40, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(base * 0.5, ac.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.1);
      osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.1);
    }
  } catch(e) {}
}

export function sfxExplosion(size, g) {
  if (!g.soundOn) return;
  try {
    const ac  = getAudio();
    const len = ac.sampleRate * 0.4;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * (1 - i/len);
    const src    = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    const gain   = ac.createGain();
    src.buffer = buf;
    filter.type = 'lowpass';
    filter.frequency.value = 300 + size * 200;
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
    gain.gain.setValueAtTime(Math.min(1, 0.15 + size * 0.1), ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
    src.start(ac.currentTime);
  } catch(e) {}
}

export function sfxPowerup(g) {
  if (!g.soundOn) return;
  try {
    const ac = getAudio();
    [523, 659, 784].forEach((freq, i) => {
      const osc  = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ac.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.start(t); osc.stop(t + 0.16);
    });
  } catch(e) {}
}

export function sfxBomb(g) {
  if (!g.soundOn) return;
  try {
    const ac  = getAudio();
    const len = ac.sampleRate * 1.0;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * (1 - i/len);
    const src    = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    const gain   = ac.createGain();
    src.buffer = buf;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(80, ac.currentTime);
    filter.frequency.linearRampToValueAtTime(900, ac.currentTime + 0.3);
    filter.frequency.exponentialRampToValueAtTime(50, ac.currentTime + 1.0);
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
    gain.gain.setValueAtTime(0.6, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 1.0);
    src.start(ac.currentTime);
  } catch(e) {}
}
```

- [ ] **Step 2: Verify it parses**

Run: `node --check src/core/audio.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/core/audio.js
git commit -m "refactor: extract audio system into src/core/audio.js"
```

### Task 6: `src/core/input.js`

**Files:**
- Create: `src/core/input.js`

Source: index.html:63–112 (INPUT) + 114–314 (TOUCH). Module-local (input-private): `isTouch, TC, STICK_R, STICK_DEAD, STICK_HOME, stick, roles, firePressed, bombPressed`. Game-owned (shared): `keys, moveVec, state, settingsOpen, soundOn, gameSpeed, loopMult, score, highScore`.

- [ ] **Step 1: Create `src/core/input.js`**

```js
import { W, H, STATE, SPEED_STEPS } from '../config.js';
import { canvas, ctx } from '../canvas.js';
import { getAudio } from './audio.js';

export const isTouch = ('ontouchstart' in window) ||
                       (window.matchMedia && matchMedia('(pointer: coarse)').matches);

const TC = {
  fire:  { x: W - 66, y: H - 86, r: 48 },
  bomb:  { x: W - 66, y: H - 176, r: 34 },
  pause: { x: W - 26, y: 52, r: 16 },
  gear:  { x: W - 68, y: 52, r: 16 },
};
const STICK_R    = 56;
const STICK_DEAD = 0.14;
const STICK_HOME = { x: 96, y: H - 108 };
const stick = { id: null, bx: 0, by: 0, kx: 0, ky: 0 };
const roles = {};
let firePressed = false;
let bombPressed = false;

function toCanvas(t) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (t.clientX - rect.left) / rect.width  * W,
    y: (t.clientY - rect.top)  / rect.height * H,
  };
}

function within(p, c) {
  const dx = p.x - c.x, dy = p.y - c.y;
  return dx*dx + dy*dy <= c.r*c.r;
}

function touchDiscrete(p, g) {
  if (within(p, TC.pause)) {
    if (g.state === STATE.PLAYING) g.state = STATE.PAUSED;
    else if (g.state === STATE.PAUSED) g.state = STATE.PLAYING;
    return true;
  }
  if (within(p, TC.gear)) {
    handleKeyPress(g, 'KeyS');
    return true;
  }
  if (within(p, TC.fire)) { roles[p.id] = 'fire'; return false; }
  if (within(p, TC.bomb)) {
    if (g.keys.Space) return true;   // ignore tap when already firing
    roles[p.id] = 'bomb';
    return false;
  }
  return false;
}

function recomputeMoveVec(g) {
  if (stick.id === null) { g.moveVec.x = 0; g.moveVec.y = 0; return; }
  let dx = stick.kx - stick.bx, dy = stick.ky - stick.by;
  const dist = Math.sqrt(dx*dx + dy*dy);
  const max  = STICK_R * (1 - STICK_DEAD);
  const k = Math.min(1, Math.max(0, dist - STICK_R * STICK_DEAD) / max);
  if (dist > 0) { dx /= dist; dy /= dist; }
  g.moveVec.x = dx * k;
  g.moveVec.y = dy * k;
}

function recomputeButtons() {
  let f = false, b = false;
  for (const id in roles) {
    if (roles[id] === 'fire') f = true;
    if (roles[id] === 'bomb') b = true;
  }
  firePressed = f;
  bombPressed = b;
}

export function initInput(g) {
  document.addEventListener('keydown', e => {
    if (!g.keys[e.code]) {
      g.keys[e.code] = true;
      handleKeyPress(g, e.code);
    }
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('keyup', e => { g.keys[e.code] = false; e.preventDefault(); }, { passive: false });

  if (isTouch) {
    document.addEventListener('touchstart', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const p = toCanvas(t);
        const consumed = touchDiscrete(p, g);
        if (consumed) continue;
        if (stick.id === null) {
          stick.id = t.identifier;
          stick.bx = p.x; stick.by = p.y;
          stick.kx = p.x; stick.ky = p.y;
        }
      }
      recomputeMoveVec(g);
      recomputeButtons();
    }, { passive: false });

    document.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === stick.id) {
          const p = toCanvas(t);
          stick.kx = p.x; stick.ky = p.y;
        }
      }
      recomputeMoveVec(g);
    }, { passive: false });

    document.addEventListener('touchend', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === stick.id) stick.id = null;
        delete roles[t.identifier];
      }
      recomputeMoveVec(g);
      recomputeButtons();
    }, { passive: false });
  }
}

export function handleKeyPress(g, code) {
  if (g.settingsOpen) {
    if (code === 'KeyM')        g.soundOn = !g.soundOn;
    if (code === 'BracketLeft') cycleSpeed(g, -1);
    if (code === 'BracketRight') cycleSpeed(g, 1);
    if (code === 'KeyS')        g.settingsOpen = false;
    return;
  }
  if (code === 'KeyP') {
    if (g.state === STATE.PLAYING) g.state = STATE.PAUSED;
    else if (g.state === STATE.PAUSED) g.state = STATE.PLAYING;
  }
  if (code === 'KeyS') {
    if (g.settingsOpen) {
      g.settingsOpen = false;
    } else if (g.state === STATE.TITLE || g.state === STATE.PAUSED) {
      g.settingsOpen = true;
    } else if (g.state === STATE.PLAYING) {
      g.state = STATE.PAUSED;
      g.settingsOpen = true;
    }
  }
  if (code === 'Enter') {
    if (g.state === STATE.TITLE)    { g.loopMult = 1; g.startGame(); }
    if (g.state === STATE.GAMEOVER) g.state = STATE.TITLE;
    if (g.state === STATE.VICTORY)  { g.loopMult++; g.startGame(); }
  }
  if (code === 'KeyC' && g.state === STATE.GAMEOVER) {
    navigator.clipboard && navigator.clipboard.writeText(
      'RAIDEN — Score: ' + g.score + ' | Hi: ' + g.highScore);
  }
}

export function cycleSpeed(g, dir) {
  let i = SPEED_STEPS.indexOf(g.gameSpeed);
  i = Math.max(0, Math.min(SPEED_STEPS.length - 1, i + dir));
  g.gameSpeed = SPEED_STEPS[i];
}

function drawTcBtn(c, stroke, label, fontPx) {
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = '#0a0a22';
  ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI*2); ctx.stroke();
  ctx.fillStyle = stroke;
  ctx.font = 'bold ' + fontPx + 'px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, c.x, c.y);
}

export function drawTouchControls(g) {
  if (!isTouch) return;

  // Movement stick
  const active = stick.id !== null;
  const baseX = active ? stick.bx : STICK_HOME.x;
  const baseY = active ? stick.by : STICK_HOME.y;
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = '#4488ff';
  ctx.beginPath(); ctx.arc(baseX, baseY, STICK_R, 0, Math.PI*2); ctx.fill();
  ctx.globalAlpha = 1;
  if (active) {
    ctx.strokeStyle = '#88bbff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(baseX, baseY, STICK_R, 0, Math.PI*2); ctx.stroke();
    let dx = stick.kx - stick.bx, dy = stick.ky - stick.by;
    const dist = Math.sqrt(dx*dx + dy*dy) || 1;
    if (dist > STICK_R) { dx = dx/dist*STICK_R; dy = dy/dist*STICK_R; }
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#66bbff';
    ctx.beginPath(); ctx.arc(baseX + dx, baseY + dy, 22, 0, Math.PI*2); ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#88bbff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(baseX, baseY, 22, 0, Math.PI*2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawTcBtn(TC.fire,  firePressed ? '#66ff88' : '#44cc66', 'FIRE', 16);
  drawTcBtn(TC.bomb,  bombPressed ? '#ff88ff' : '#cc44cc', '★', 20);
  drawTcBtn(TC.pause, g.state === STATE.PAUSED ? '#ffaa44' : '#88ccff', 'II', 12);
  drawTcBtn(TC.gear,  g.settingsOpen ? '#ffaa44' : '#88ccff', '⚙', 12);
}
```

> **Verify against source:** `recomputeMoveVec`, `recomputeButtons`, and the touch listeners above are faithful ports of index.html:178–241 (the deadzone math, `roles` bookkeeping, and `touchDiscrete` behavior are preserved; the `stick`/`TC`/`STICK_*` constants moved verbatim from lines 117–137). `drawTouchControls` and `drawTcBtn` are verbatim moves of index.html:243–314 with `state` → `g.state`, `settingsOpen` → `g.settingsOpen`. Compare your file to the source before committing.

- [ ] **Step 2: Verify it parses**

Run: `node --check src/core/input.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/core/input.js
git commit -m "refactor: extract input (keyboard + touch) into src/core/input.js"
```

### Task 7: `src/stages/background.js`

**Files:**
- Create: `src/stages/background.js`

Source: index.html:418–445 (STARFIELD) + 447–719 (STAGE BACKGROUNDS). Background state (`STAR_LAYERS`, `bgRocks..bgWalls`, `bgStage`) is module-private. `stageTimer` and `currentStage` come from `g`. **The `STAGE_BG` table is removed in this task** — its 8 entries are moved into `stageData.js` (Task 18); in the meantime `drawBackground` reads a temporary local copy so the module is complete and runnable on its own. `initBackground`/`updateBackground` keep their per-stage-number switches exactly (unchanged behavior).

- [ ] **Step 1: Create `src/stages/background.js`**

```js
import { W, H, STEP } from '../config.js';
import { ctx } from '../canvas.js';

// --- STARFIELD (verbatim from index.html:418-445) ---
const STAR_LAYERS = [
  { color: 'rgba(255,255,255,0.4)', size: 1, stars: [] },
  { color: 'rgba(255,255,255,0.7)', size: 2, stars: [] },
  { color: 'rgba(200,220,255,1.0)', size: 3, stars: [] },
];
(function initStars() {
  for (const layer of STAR_LAYERS) {
    for (let i = 0; i < 42; i++) {
      layer.stars.push({ x: Math.random()*W, y: Math.random()*H });
    }
  }
})();

export function updateStars(dt) {
  const speeds = [12, 30, 55];
  for (let li = 0; li < STAR_LAYERS.length; li++) {
    const layer = STAR_LAYERS[li];
    for (const s of layer.stars) {
      s.y += speeds[li] * dt;
      if (s.y > H) { s.y = -2; s.x = Math.random()*W; }
    }
  }
}

export function drawStars() {
  for (const layer of STAR_LAYERS) {
    ctx.fillStyle = layer.color;
    for (const s of layer.stars) ctx.fillRect(s.x, s.y, layer.size, layer.size);
  }
}
```

> **Verify against source:** the starfield blocks above are verbatim from index.html:418–445. If the actual `speeds` array or star counts differ in the source, copy the exact values from lines 419–445 instead.

- [ ] **Step 2: Append the background system (verbatim move of index.html:447–719) with the state indirection**

Add to `src/stages/background.js`:

```js
// --- STAGE BACKGROUNDS ---
// Temporary local copy of STAGE_BG; replaced by stageData.bg in Task 18.
const STAGE_BG = [
  { baseFill: '#020208', starColor: ['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.7)', 'rgba(200,220,255,1.0)'] },
  { baseFill: '#0f0c08', starColor: ['rgba(200,190,170,0.3)', 'rgba(210,200,180,0.5)', 'rgba(220,210,190,0.8)'] },
  { baseFill: '#1a0005', starColor: ['rgba(255,160,160,0.35)', 'rgba(255,120,120,0.6)', 'rgba(255,200,200,0.9)'] },
  { baseFill: '#051005', starColor: null },
  { baseFill: '#1a0800', starColor: null },
  { baseFill: '#080810', starColor: ['rgba(180,180,200,0.25)', 'rgba(190,190,210,0.45)', 'rgba(210,210,230,0.7)'] },
  { baseFill: '#000000', starColor: ['rgba(160,80,255,0.3)', 'rgba(180,100,255,0.5)', 'rgba(200,140,255,0.8)'] },
  { baseFill: '#100005', starColor: null },
];

let bgRocks = [], bgClouds = [], bgBubbles = [], bgStreaks = [];
let bgHulls = [], bgWisps = [], bgParticles = [], bgWalls = [];
let bgStage = 1;

export function initBackground(stage) {
  bgStage = stage;
  bgRocks.length = 0; bgClouds.length = 0; bgBubbles.length = 0;
  bgStreaks.length = 0; bgHulls.length = 0; bgWisps.length = 0;
  bgParticles.length = 0; bgWalls.length = 0;

  if (stage === 1) return; // stars only

  if (stage === 2) {
    for (let i = 0; i < 14; i++) {
      bgRocks.push({ x: Math.random()*W, y: Math.random()*H, r: 8+Math.random()*12,
        spd: 60+Math.random()*40, rot: Math.random()*Math.PI*2,
        rotSpd: (Math.random()-0.5)*0.8, layer: 0 });
    }
    for (let i = 0; i < 8; i++) {
      bgRocks.push({ x: Math.random()*W, y: Math.random()*H, r: 5+Math.random()*8,
        spd: 100+Math.random()*40, rot: Math.random()*Math.PI*2,
        rotSpd: (Math.random()-0.5)*1.2, layer: 1 });
    }
    return;
  }

  if (stage === 3) {
    for (let i = 0; i < 12; i++) {
      bgClouds.push({ x: Math.random()*W, y: Math.random()*H,
        w: 80+Math.random()*80, h: 40+Math.random()*40,
        alpha: 0.06+Math.random()*0.06, spd: 20+Math.random()*20,
        hue: Math.random()<0.5 ? '#cc2244' : '#aa1133' });
    }
    return;
  }

  if (stage === 4) {
    for (let i = 0; i < 40; i++) {
      bgBubbles.push({ x: Math.random()*W, y: Math.random()*H,
        r: 4+Math.random()*8, alpha: 0.08+Math.random()*0.12,
        spd: 18+Math.random()*22, wobbleAmp: 8+Math.random()*14,
        wobbleFreq: 0.6+Math.random()*0.8, wobbleOff: Math.random()*Math.PI*2,
        color: Math.random()<0.6 ? '#44ee44' : '#aaee00',
        t: Math.random()*100 });
    }
    return;
  }

  if (stage === 5) {
    for (let i = 0; i < 30; i++) {
      bgStreaks.push({ x: Math.random()*W, y: Math.random()*H,
        w: 40+Math.random()*80, h: 1+Math.floor(Math.random()*2),
        spd: 300+Math.random()*200, alpha: 0.18+Math.random()*0.25,
        color: Math.random()<0.7 ? '#ff8800' : '#ffcc44' });
    }
    return;
  }

  if (stage === 6) {
    for (let i = 0; i < 10; i++) {
      bgHulls.push({
        x: Math.random() * (W - 120),
        y: Math.random() * H,
        w: 60 + Math.random() * 60,
        h: 12 + Math.random() * 14,
        spd: 25 + Math.random() * 15,
        alpha: 0.18 + Math.random() * 0.12,
      });
    }
    return;
  }

  if (stage === 7) {
    for (let i = 0; i < 8; i++) {
      const x1 = Math.random()*W, y1 = Math.random()*H;
      bgWisps.push({ x1, y1,
        x2: x1+(Math.random()-0.5)*160, y2: y1+(Math.random()-0.5)*100,
        cx1: x1+(Math.random()-0.5)*80, cy1: y1+(Math.random()-0.5)*80,
        cx2: x1+(Math.random()-0.5)*80, cy2: y1+(Math.random()-0.5)*80,
        alpha: 0.04+Math.random()*0.06,
        color: Math.random()<0.5 ? '#9944ff' : '#cc88ff',
        width: 1+Math.random()*2 });
    }
    return;
  }

  if (stage === 8) {
    for (let i = 0; i < 8; i++) {
      bgWalls.push({ side:'left', y: i*(H/8), baseX: 30+Math.random()*20,
        h: H/8+4, sineAmp: 14+Math.random()*10,
        sineFreq: 0.4+Math.random()*0.4, sineOff: Math.random()*Math.PI*2, color:'#550011' });
      bgWalls.push({ side:'right', y: i*(H/8), baseX: W-30-Math.random()*20,
        h: H/8+4, sineAmp: 14+Math.random()*10,
        sineFreq: 0.4+Math.random()*0.4, sineOff: Math.random()*Math.PI*2, color:'#550011' });
    }
    for (let i = 0; i < 50; i++) {
      bgParticles.push({ x: Math.random()*W, y: Math.random()*H,
        r: 1+Math.random()*2, spd: 30+Math.random()*50,
        alpha: 0.3+Math.random()*0.4,
        color: Math.random()<0.7 ? '#ff2200' : '#ff6600' });
    }
    return;
  }
}

export function updateBackground(dt) {
  const stage = bgStage;
  if (stage === 2) {
    bgRocks.forEach(r => {
      r.y += r.spd * dt; r.rot += r.rotSpd * dt;
      if (r.y > H + r.r*2) { r.y = -r.r*2; r.x = Math.random()*W; }
    });
  }
  if (stage === 3) {
    bgClouds.forEach(c => {
      c.y += c.spd * dt;
      if (c.y > H + c.h) { c.y = -c.h; c.x = Math.random()*W; }
    });
  }
  if (stage === 4) {
    bgBubbles.forEach(b => {
      b.t += dt; b.y -= b.spd * dt;
      b.x += Math.sin(b.t * b.wobbleFreq + b.wobbleOff) * b.wobbleAmp * dt;
      if (b.y < -b.r*2) { b.y = H+b.r*2; b.x = Math.random()*W; }
    });
  }
  if (stage === 5) {
    bgStreaks.forEach(s => {
      s.y += s.spd * dt;
      if (s.y > H+4) { s.y = -4; s.x = Math.random()*(W-s.w); }
    });
  }
  if (stage === 6) {
    bgHulls.forEach(h => {
      h.y += h.spd * dt;
      if (h.y > H+h.h) { h.y = -h.h; h.x = Math.random()*(W-h.w); }
    });
  }
  if (stage === 8) {
    bgParticles.forEach(p => {
      p.y -= p.spd * dt;
      if (p.y < -p.r*2) { p.y = H+p.r*2; p.x = Math.random()*W; }
    });
  }
}

export function drawBackground(g) {
  const stage = g.currentStage;
  const cfg = STAGE_BG[Math.max(0, Math.min(7, stage-1))];
  ctx.fillStyle = cfg.baseFill;
  ctx.fillRect(0, 0, W, H);

  if (cfg.starColor) {
    const savedColors = STAR_LAYERS.map(l => l.color);
    STAR_LAYERS[0].color = cfg.starColor[0];
    STAR_LAYERS[1].color = cfg.starColor[1];
    STAR_LAYERS[2].color = cfg.starColor[2];
    STAR_LAYERS.forEach(layer => {
      ctx.fillStyle = layer.color;
      layer.stars.forEach(s => ctx.fillRect(s.x, s.y, layer.size, layer.size));
    });
    STAR_LAYERS.forEach((l, i) => { l.color = savedColors[i]; });
  }

  if (stage === 2) {
    bgRocks.forEach(r => {
      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
      ctx.fillStyle = r.layer===0 ? 'rgba(130,120,110,0.5)' : 'rgba(100,95,85,0.45)';
      ctx.beginPath(); ctx.ellipse(0, 0, r.r*1.4, r.r, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(180,170,155,0.2)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    });
  }

  if (stage === 3) {
    bgClouds.forEach(c => {
      ctx.save(); ctx.globalAlpha = c.alpha; ctx.fillStyle = c.hue;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, c.w/2, c.h/2, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  if (stage === 4) {
    bgBubbles.forEach(b => {
      ctx.save(); ctx.globalAlpha = b.alpha; ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = b.alpha * 0.5; ctx.fillStyle = '#ccffcc';
      ctx.beginPath(); ctx.arc(b.x-b.r*0.3, b.y-b.r*0.3, b.r*0.4, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  if (stage === 5) {
    bgStreaks.forEach(s => {
      ctx.save(); ctx.globalAlpha = s.alpha; ctx.fillStyle = s.color;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      const grad = ctx.createLinearGradient(s.x, s.y, s.x+s.w*0.3, s.y);
      grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, s.color);
      ctx.fillStyle = grad; ctx.fillRect(s.x, s.y, s.w*0.3, s.h);
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  if (stage === 6) {
    bgHulls.forEach(h => {
      ctx.save(); ctx.globalAlpha = h.alpha;
      ctx.fillStyle = '#1a1a28'; ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.fillStyle = 'rgba(100,100,140,0.6)';
      const rivets = Math.floor(h.w/14);
      for (let i = 0; i < rivets; i++) {
        ctx.beginPath(); ctx.arc(h.x+8+i*14, h.y+h.h/2, 1.5, 0, Math.PI*2); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(80,80,120,0.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(h.x, h.y+3); ctx.lineTo(h.x+h.w, h.y+3); ctx.stroke();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  if (stage === 7) {
    bgWisps.forEach(w => {
      ctx.save(); ctx.globalAlpha = w.alpha; ctx.strokeStyle = w.color; ctx.lineWidth = w.width;
      ctx.beginPath(); ctx.moveTo(w.x1, w.y1);
      ctx.bezierCurveTo(w.cx1, w.cy1, w.cx2, w.cy2, w.x2, w.y2);
      ctx.stroke(); ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  if (stage === 8) {
    const t = g.stageTimer;
    bgWalls.forEach(w => {
      const xOff = Math.sin(t * w.sineFreq + w.sineOff) * w.sineAmp;
      const drawX = w.side === 'left' ? w.baseX + xOff : w.baseX - xOff;
      ctx.save(); ctx.fillStyle = w.color;
      if (w.side === 'left') {
        ctx.fillRect(0, w.y, drawX, w.h);
      } else {
        ctx.fillRect(drawX, w.y, W - drawX, w.h);
      }
      ctx.strokeStyle = '#aa0022'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(drawX, w.y); ctx.lineTo(drawX, w.y + w.h); ctx.stroke();
      ctx.restore();
    });
    bgParticles.forEach(p => {
      ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }
}
```

> **Verify against source:** this is index.html:447–719 moved with two changes only: `drawBackground(stage)` → `drawBackground(g)` with `const stage = g.currentStage;` at the top, and `const t = stageTimer;` → `const t = g.stageTimer;`. Everything else is verbatim.

- [ ] **Step 3: Verify it parses**

Run: `node --check src/stages/background.js`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/stages/background.js
git commit -m "refactor: extract starfield + backgrounds into src/stages/background.js"
```

### Task 8: `src/entities/Player.js`

**Files:**
- Create: `src/entities/Player.js`

Source: index.html:780–983. `player` binding → `Game`. `laserActive`/`laserPulse` (index.html:1033–1035) are read by `updatePlayer` but declared in the Bullet section; declare them here in Player.js (their values are unused legacy).

Conversion table for this section (real global refs):
- `keys` → `g.keys` (11), `moveVec` → `g.moveVec` (2), `boss` → `g.boss` (5), `enemies` → `g.enemies` (4), `state` → `g.state` (2), `enemyBullets` → `g.enemyBullets` (1), `playerBullets` → `g.playerBullets` (1)
- Imports: `W, H, CHARGE_DURATION, STATE` from `config.js`; `ctx` from `canvas.js`; `WEAPON_COLORS` from `Bullet.js`; `getFireRate, firePlayer, fireSuper` from `Bullet.js`; `spawnExplosion, spawnBombFlash` from `core/particles.js`; `sfxBomb` from `core/audio.js`
- Calls converted: `saveHS()` → `g.saveHS()`, `getFireRate(...)` → `getFireRate(...)`, `firePlayer(p)` → `firePlayer(p, g)`, `fireSuper(p)` → `fireSuper(p, g)`, `spawnBombFlash()` → `spawnBombFlash(g)`, `sfxBomb()` → `sfxBomb(g)`
- Signatures: `createPlayer()`; `drawPlayer(p)` (reads only `p` + `ctx`); `updatePlayer(dt, g)`; `killPlayer(g)`; `respawnPlayer(g)`

- [ ] **Step 1: Create `src/entities/Player.js`** — move index.html:780–983 applying the table above.

Exports (verbatim bodies with conversions applied, plus the two changed signatures):

```js
import { W, H, CHARGE_DURATION, STATE } from '../config.js';
import { ctx } from '../canvas.js';
import { getFireRate, firePlayer, fireSuper, WEAPON_COLORS } from './Bullet.js';
import { spawnExplosion, spawnBombFlash } from '../core/particles.js';
import { sfxBomb } from '../core/audio.js';

let laserActive = false;   // unused legacy, kept for reference parity
let laserPulse = 0;

export function createPlayer() {
  // verbatim body from index.html:783-799
}

export function drawPlayer(p) {
  // verbatim body from index.html:802-878 (uses only ctx + p)
}

export function updatePlayer(dt, g) {
  // body from index.html:880-953 with the conversion table applied
}

export function killPlayer(g) {
  // body from index.html:955-976 with the conversion table applied
}

export function respawnPlayer(g) {
  // body from index.html:978-983 with the conversion table applied
}
```

> **Rule of thumb for this task:** paste each original function body, then apply ONLY the identifier substitutions in the conversion table (plus the call rewrites listed above). Do not convert `player` to `g.player` inside `drawPlayer(p)`/`updatePlayer(dt, g)` — those read the passed `p`. `updatePlayer` uses the module-level `laserActive`/`laserPulse` (declared above) exactly as the source does.

- [ ] **Step 2: Verify it parses**

Run: `node --check src/entities/Player.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/entities/Player.js
git commit -m "refactor: extract player entity into src/entities/Player.js"
```

### Task 9: `src/entities/Bullet.js`

**Files:**
- Create: `src/entities/Bullet.js`

Source: index.html:985–1185 (PLAYER BULLETS) + 1433–1460 (ENEMY BULLETS). `playerBullets`/`enemyBullets` → `Game`. `boss`/`enemies` reads → `g.*`.

Conversion table (real global refs):
- PLAYER BULLETS: `boss` → `g.boss` (7), `enemies` → `g.enemies` (2), `state` → `g.state` (1), `player` → `g.player` (in `fireSuper`, via `p` param where passed)
- ENEMY BULLETS: no shared-state refs
- Imports: `W, H` from `config.js`; `ctx` from `canvas.js`; `sfxShoot` from `core/audio.js`
- Signatures: `getFireRate(weapon, lv)`; `mkVulcanBullet(x, y, angle)`; `comboOffset(slotIndex, totalSlots)`; `mkSpreadBullet(x, y, angle, lv)`; `firePlayer(p, g)`; `fireSuper(p, g)`; `updatePlayerBullets(dt, g)`; `drawLaserBeam(p)` (legacy no-op, kept); `drawPlayerBullets(g)`; `updateEnemyBullets(dt, g)`; `drawEnemyBullets(g)`

- [ ] **Step 1: Create `src/entities/Bullet.js`** — move index.html:985–1185 and 1433–1460 applying the table above.

Sketch (exact bodies come from the source ranges; `WEAPON_NAMES`/`WEAPON_COLORS` live here too — index.html:1465–1466):

```js
import { W, H } from '../config.js';
import { ctx } from '../canvas.js';
import { sfxShoot } from '../core/audio.js';

export const WEAPON_NAMES  = ['VULCAN', 'SPREAD', 'MISSILE'];
export const WEAPON_COLORS = ['#ffaa00', '#ff8800', '#ff4488'];

export function getFireRate(weapon, lv) { /* verbatim index.html:989-992 */ }
export function mkVulcanBullet(x, y, angle) { /* verbatim index.html:995-1009 */ }
export function comboOffset(slotIndex, totalSlots) { /* verbatim index.html:1012-1015 */ }
export function mkSpreadBullet(x, y, angle, lv) { /* verbatim index.html:1017-1031 */ }

export function firePlayer(p, g) { /* index.html:1038-1105, boss/enemies/state -> g.*, sfxShoot(...) -> sfxShoot(..., g), pushes to g.playerBullets */ }
export function fireSuper(p, g) { /* index.html:1107-1146, pushes to g.playerBullets, sfxShoot(..., g) */ }
export function updatePlayerBullets(dt, g) { /* index.html:1148-1185, g.playerBullets, g.boss, g.enemies, g.state */ }
export function drawLaserBeam(p) { /* index.html:1187 — kept no-op */ }
export function drawPlayerBullets(g) { /* index.html:1189-1280, g.playerBullets + ctx */ }

export function updateEnemyBullets(dt, g) { /* index.html:1436-1451, g.enemyBullets */ }
export function drawEnemyBullets(g) { /* index.html:1453-1460, g.enemyBullets */ }
```

> **Note on `fireSuper`:** check index.html:1107–1146 — it reads the player via its parameter (`p`) for position and writes `score`/`saveHS` in the missile branch. If it references `player` bare, convert to `g.player`; if it references `score`/`saveHS`, convert to `g.score`/`g.saveHS()`.

- [ ] **Step 2: Verify it parses**

Run: `node --check src/entities/Bullet.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/entities/Bullet.js
git commit -m "refactor: extract bullet system into src/entities/Bullet.js"
```

### Task 10: `src/entities/Enemy.js`

**Files:**
- Create: `src/entities/Enemy.js`

Source: index.html:1282–1431. Declarations `enemies`, `boss`, `diffMult`, `loopMult` move to `Game`; `ENEMY_CFG` stays here (module const).

Conversion table (real global refs — property accesses like `e.score`, `e.color` are **not** converted):
- `enemies` → `g.enemies` (in `updateEnemies`), `player` → `g.player` (12), `diffMult` → `g.diffMult` (in `updateEnemyMovement` and `fireEnemy`), `enemyBullets` → `g.enemyBullets` (in `fireEnemy`)
- Imports: `W, H` from `config.js`; `ctx` from `canvas.js`
- Signatures: `mkEnemy(type, x, y, path)`; `drawEnemy(e)` (reads only `ctx` + `e`); `updateEnemyMovement(e, dt, g)`; `fireEnemy(e, g)`; `updateEnemies(dt, g)`

- [ ] **Step 1: Create `src/entities/Enemy.js`** — move index.html:1282–1431 applying the table above.

```js
import { W, H } from '../config.js';
import { ctx } from '../canvas.js';

export const ENEMY_CFG = [
  // type 0: small fighter
  { hp: 3,  r: 10, spd: 110, score: 100, dropChance: 0.15, color: '#66aaff' },
  // type 1: gunship
  { hp: 8,  r: 14, spd: 65,  score: 200, dropChance: 0.25, color: '#aacc44' },
  // type 2: bomber
  { hp: 20, r: 18, spd: 48,  score: 400, dropChance: 0.50, color: '#cc6622' },
  // type 3: turret (stationary)
  { hp: 12, r: 12, spd: 0,   score: 150, dropChance: 0.50, color: '#cc4466' },
];

export function mkEnemy(type, x, y, path) {
  return Object.assign(
    { type, x, y, path, pathT: 0, alive: true, fireTimer: 1.2 + Math.random(), angle: 0 },
    ENEMY_CFG[type]
  );
}

export function drawEnemy(e) {
  // verbatim index.html:1309-1351 — uses only ctx + e
}

export function updateEnemyMovement(e, dt, g) {
  // index.html:1353-1367 with diffMult -> g.diffMult, player -> g.player
}

export function fireEnemy(e, g) {
  // index.html:1369-1405 with player -> g.player, diffMult -> g.diffMult, enemyBullets -> g.enemyBullets
}

export function updateEnemies(dt, g) {
  // index.html:1407-1431 with enemies -> g.enemies, player -> g.player, diffMult -> g.diffMult,
  // calls updateEnemyMovement(e, dt, g) and fireEnemy(e, g)
}
```

- [ ] **Step 2: Verify it parses**

Run: `node --check src/entities/Enemy.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/entities/Enemy.js
git commit -m "refactor: extract enemy system into src/entities/Enemy.js"
```

### Task 11: `src/entities/Powerup.js`

**Files:**
- Create: `src/entities/Powerup.js`

Source: index.html:1462–1530. `powerups` → `Game`. `WEAPON_NAMES`/`WEAPON_COLORS` imported from `Bullet.js` (moved there in Task 9).

Conversion table: `player` → `g.player` (8), `powerups` → `g.powerups`; import `circleHit` from `core/collision.js`, `sfxPowerup` from `core/audio.js`, `W, H` from `config.js`, `ctx` from `canvas.js`.
Signatures: `tryDropPowerup(e, g)`; `updatePowerups(dt, g)`; `checkPlayerVsPowerups(g)`; `drawPowerups(g)`.

- [ ] **Step 1: Create `src/entities/Powerup.js`** — move index.html:1462–1530 applying the table above.

```js
import { W, H } from '../config.js';
import { ctx } from '../canvas.js';
import { WEAPON_NAMES, WEAPON_COLORS } from './Bullet.js';
import { circleHit } from '../core/collision.js';
import { sfxPowerup } from '../core/audio.js';

export function tryDropPowerup(e, g) { /* index.html:1468-1474, pushes to g.powerups */ }
export function updatePowerups(dt, g) { /* index.html:1476-1483, g.powerups */ }
export function checkPlayerVsPowerups(g) { /* index.html:1485-1509, g.powerups + g.player + circleHit + sfxPowerup(g) + WEAPON_* */ }
export function drawPowerups(g) { /* index.html:1511-1530, g.powerups + ctx */ }
```

- [ ] **Step 2: Verify it parses**

Run: `node --check src/entities/Powerup.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/entities/Powerup.js
git commit -m "refactor: extract powerup system into src/entities/Powerup.js"
```

### Task 12: `src/core/collision.js`

**Files:**
- Create: `src/core/collision.js`

Source: index.html:1532–1614.

Conversion table (real global refs): `player` → `g.player` (18), `boss` → `g.boss` (12), `playerBullets` → `g.playerBullets` (6), `enemies` → `g.enemies` (4), `enemyBullets` → `g.enemyBullets` (3), `score` → `g.score` (1), `loopMult` → `g.loopMult` (1).
Calls: `spawnExplosion(...)` → `spawnExplosion(..., g)` (3), `killPlayer()` → `killPlayer(g)` (3), `tryDropPowerup(...)` → `tryDropPowerup(..., g)`, `onBossDeath()` → `onBossDeath(g)`, `checkPlayerVsPowerups()` → `checkPlayerVsPowerups(g)`, `saveHS()` → `g.saveHS()`.
Signatures: `circleHit(ax, ay, ar, bx, by, br)` (pure); `checkPlayerBulletsVsEnemies(g)`; `checkEnemyBulletsVsPlayer(g)`; `checkEnemyBodiesVsPlayer(g)`; `checkPlayerBulletsVsBoss(g)`; `checkBossBodyVsPlayer(g)`; `runCollision(g)`.

- [ ] **Step 1: Create `src/core/collision.js`** — move index.html:1532–1614 applying the table above.

```js
import { ctx } from '../canvas.js';
import { spawnExplosion } from './particles.js';
import { killPlayer } from '../entities/Player.js';
import { tryDropPowerup, checkPlayerVsPowerups } from '../entities/Powerup.js';
import { onBossDeath } from '../entities/Boss.js';

export function circleHit(ax, ay, ar, bx, by, br) {
  const dx = ax - bx, dy = ay - by;
  const rr = ar + br;
  return dx*dx + dy*dy < rr*rr;
}

export function checkPlayerBulletsVsEnemies(g) { /* index.html:1538-1560, g.* + spawnExplosion(..., g) + tryDropPowerup(e, g) + score */ }
export function checkEnemyBulletsVsPlayer(g) { /* index.html:1562-1572 */ }
export function checkEnemyBodiesVsPlayer(g) { /* index.html:1574-1581 */ }
export function checkPlayerBulletsVsBoss(g) { /* index.html:1583-1598 */ }
export function checkBossBodyVsPlayer(g) { /* index.html:1600-1605 */ }
export function runCollision(g) {
  // index.html:1607-1614 — calls the five checks above with g, plus onBossDeath(g), killPlayer(g)
}
```

> **Circular-import note:** `collision.js` imports from `Player.js`, `Powerup.js`, and `Boss.js`. None of those import `collision.js` **except** `Powerup.js` imports `circleHit` from `collision.js`. ES module circular imports are legal here because `circleHit` is a function declaration (hoisted) and `Powerup.js` only calls it at runtime, not at module-eval time. Keep `circleHit` defined at the top of `collision.js`.

- [ ] **Step 2: Verify it parses**

Run: `node --check src/core/collision.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/core/collision.js
git commit -m "refactor: extract collision system into src/core/collision.js"
```

### Task 13: `src/stages/waveGen.js`

**Files:**
- Create: `src/stages/waveGen.js`

Source: index.html:1616–1866 (`pathDown`, `pathSin`, `pathFormation`, `buildWaveTable`) + 1874–1901 (`updateWaves`). Keep the switch-based `buildWaveTable` **verbatim** in Phase A (converted for `diffMult`); Phase B replaces it with the descriptor generator.

Phase A signature: `buildWaveTable(stage, diffMult)` — the `diffMult` global (index.html:1287) is now a parameter; `startStage` computes it via `diffMultFor` and passes it in. The `W` references inside the switch import from config.

Conversion table: `diffMult` → parameter (all 41 uses inside the switch become the passed `diffMult`), `W` → import. `updateWaves(dt, g)` converts `boss` → `g.boss`, `enemies` → `g.enemies`, `enemyBullets` → `g.enemyBullets`, `stageTimer` → `g.stageTimer`, `waveIndex` → `g.waveIndex`, `waveTable` → `g.waveTable`, `createBoss(...)` → `createBoss(entry.boss, g)` (imported from `entities/Boss.js`), `mkEnemy(...)` → `mkEnemy(...)` (imported from `entities/Enemy.js`).

- [ ] **Step 1: Create `src/stages/waveGen.js`** — move index.html:1616–1866 and 1874–1901 applying the table above.

```js
import { W } from '../config.js';
import { mkEnemy } from '../entities/Enemy.js';
import { createBoss } from '../entities/Boss.js';

export function pathDown(sx, sy, spd) {
  return t => ({ x: sx, y: sy + t * spd });
}

export function pathSin(sx, sy, spd, amp, freq) {
  return t => ({ x: sx + Math.sin(t * freq) * amp, y: sy + t * spd });
}

export function pathFormation(cx, sy, spd, idx, total) {
  const offset = (idx - (total - 1) / 2) * 36;
  return t => ({ x: cx + offset, y: sy + t * spd });
}

// Phase A: verbatim move of index.html:1634-1866, with every `diffMult` global
// replaced by the `diffMult` parameter. Behavior identical.
export function buildWaveTable(stage, diffMult) {
  const entries = [];
  const add = obj => entries.push(obj);
  switch (stage) {
    case 1: { /* verbatim index.html:1639-1664 with diffMult -> parameter */ }
    case 2: { /* verbatim index.html:1665-1690 */ }
    case 3: { /* verbatim index.html:1691-1712 */ }
    case 4: { /* verbatim index.html:1713-1739 */ }
    case 5: { /* verbatim index.html:1740-1764 */ }
    case 6: { /* verbatim index.html:1765-1789 */ }
    case 7: { /* verbatim index.html:1790-1824 */ }
    case 8: { /* verbatim index.html:1825-1861 */ }
    default: break;
  }
  return entries.sort((a, b) => a.t - b.t);
}

export function updateWaves(dt, g) {
  // index.html:1874-1901 with the conversion table applied:
  //   if (g.boss) return;
  //   g.stageTimer += dt;
  //   while (g.waveIndex < g.waveTable.length) {
  //     const entry = g.waveTable[g.waveIndex];
  //     if (g.stageTimer < entry.t) break;
  //     g.waveIndex++;
  //     if (entry.boss) {
  //       g.enemies.length = 0;
  //       g.enemyBullets.length = 0;
  //       g.boss = createBoss(entry.boss, g);
  //       g.bossSpawned = true;
  //     } else if (entry.type === 3) {
  //       const e = mkEnemy(3, entry.x, entry.y, null);
  //       if (entry.eliteHp) e.hp = Math.ceil(e.hp * 1.5);
  //       g.enemies.push(e);
  //     } else {
  //       const e = mkEnemy(entry.type, 0, 0, entry.path);
  //       if (entry.path) { const p0 = entry.path(0); e.x = p0.x; e.y = p0.y; }
  //       if (entry.eliteHp) e.hp = Math.ceil(e.hp * 1.5);
  //       g.enemies.push(e);
  //     }
  //   }
}
```

- [ ] **Step 2: Verify it parses**

Run: `node --check src/stages/waveGen.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/stages/waveGen.js
git commit -m "refactor: extract wave table builder + updater into src/stages/waveGen.js"
```

### Task 14: `src/entities/Boss.js`

**Files:**
- Create: `src/entities/Boss.js`

Source: index.html:1926–2446. All boss globals (`bossMaxHp, bossPhase, bossTimer, bossAngle, stageClearTimer, victoryTimer`) → `Game`; `boss` → `g.boss` everywhere in bodies.

Conversion table (real global refs): `boss` → `g.boss` (162), `player` → `g.player` (16), `diffMult` → `g.diffMult` (11), `enemyBullets` → `g.enemyBullets` (8), `loopMult` → `g.loopMult` (3), `state` → `g.state` (3), `score` → `g.score` (1), `currentStage` → `g.currentStage` (1), `bossMaxHp` → `g.bossMaxHp`, `bossPhase` → `g.bossPhase`, `bossTimer` → `g.bossTimer`, `bossAngle` → `g.bossAngle`, `stageClearTimer` → `g.stageClearTimer`, `victoryTimer` → `g.victoryTimer`.
Imports: `W, H, STATE, STAGE_COUNT` from `config.js`; `ctx` from `canvas.js`; `spawnExplosion` from `core/particles.js`; `mkEnemy, ENEMY_CFG` from `entities/Enemy.js`.
Calls: `spawnExplosion(...)` → `spawnExplosion(..., g)` (4); `mkEnemy(0, ...)` → `mkEnemy(0, ..., null)` (unchanged call, but `enemies` → `g.enemies`); `startStage(...)` → `g.startStage(...)` (in `onBossDeath`); `saveHS()` → `g.saveHS()`; `initBackground`? (not in BOSS refs).
Signatures (Phase A): `createBoss(stageNum, g)` — reads the existing stats table, sets `g.bossMaxHp/bossPhase/bossTimer/bossAngle`, returns the boss object; `drawBoss(g)`; `drawBossHpBar(g)`; `drawBoss1()..drawBoss8()` (unchanged bodies, referencing `g.boss`/`g.bossAngle`/`g.bossTimer` via a module-level alias — see below); `fireBoss(g)`; `fireBoss1()..fireBoss8()` (unchanged bodies); `updateBoss(dt, g)`; `spawnMinion(g)`; `onBossDeath(g)`.

> **Draw-function indirection (Phase A only):** the 8 `drawBossN` functions and the 8 `fireBossN` functions reference the bare identifiers `boss`, `bossAngle`, `bossTimer`, `bossMaxHp`, `bossPhase`, `player`, `enemyBullets`, `diffMult`. Rather than rewriting every one of the ~460 reference sites now (Phase C rewrites them properly anyway), declare module-level aliases at the top of `Boss.js` and set them at the top of `drawBoss(g)`/`fireBoss(g)`/`updateBoss(dt, g)`:

```js
// Module-level render/update aliases (private to this module; set by drawBoss/fireBoss/updateBoss).
let boss = null, bossAngle = 0, bossTimer = 0, bossPhase = 0, bossMaxHp = 0;
let player = null, enemyBullets = null, diffMult = 1.0;
```

Then in the entry points:
```js
export function drawBoss(g) {
  if (!g.boss) return;
  boss = g.boss; bossAngle = g.bossAngle; bossTimer = g.bossTimer;
  switch (boss.stageNum) {
    case 1: drawBoss1(); break;
    /* ... cases 2-8 ... */
  }
  drawBossHpBar(g);
}
```
`drawBoss1..8`, `fireBoss1..8`, `createBoss`, `updateBoss`, `spawnMinion`, `onBossDeath`, `drawBossHpBar` keep their verbatim bodies (they read the aliases / write `g.*` where they already did). `updateBoss(dt, g)` and `fireBoss(g)` set the aliases before dispatching, exactly as above. **This is Phase A scaffolding only — Task 23 (Phase C) removes these aliases and makes the draw/fire code take explicit parameters.**

- [ ] **Step 1: Create `src/entities/Boss.js`** — move index.html:1926–2446 applying the alias strategy above.

Exports:
```js
import { W, H, STATE, STAGE_COUNT } from '../config.js';
import { ctx } from '../canvas.js';
import { spawnExplosion } from '../core/particles.js';
import { mkEnemy, ENEMY_CFG } from './Enemy.js';

let boss = null, bossAngle = 0, bossTimer = 0, bossPhase = 0, bossMaxHp = 0;
let player = null, enemyBullets = null, diffMult = 1.0;

export function createBoss(stageNum, g) {
  const stats = [
    { r: 50, hp:  800, phaseCount: 3, spawnMinions: false },
    { r: 60, hp: 1000, phaseCount: 3, spawnMinions: false },
    { r: 50, hp: 1100, phaseCount: 3, spawnMinions: false },
    { r: 55, hp: 1200, phaseCount: 3, spawnMinions: false },
    { r: 52, hp: 1300, phaseCount: 3, spawnMinions: false },
    { r: 65, hp: 1500, phaseCount: 4, spawnMinions: true  },
    { r: 50, hp: 1400, phaseCount: 4, spawnMinions: false },
    { r: 75, hp: 2000, phaseCount: 5, spawnMinions: true  },
  ];
  const s = stats[stageNum - 1];
  g.bossMaxHp = s.hp;
  g.bossPhase = 0;
  g.bossTimer = 0;
  g.bossAngle = 0;
  return {
    stageNum,
    x: W/2, y: 130,
    r: s.r,
    hp: s.hp,
    targetX: W/2, targetY: 130,
    spd: 58,
    fireTimer: 1.8,
    phaseCount:   s.phaseCount,
    spawnMinions: s.spawnMinions,
    minionTimer:  3.0,
    phantomAlpha: 1.0,
  };
}

export function drawBoss(g) {
  if (!g.boss) return;
  boss = g.boss; bossAngle = g.bossAngle; bossTimer = g.bossTimer;
  switch (boss.stageNum) {
    case 1: drawBoss1(); break;
    case 2: drawBoss2(); break;
    case 3: drawBoss3(); break;
    case 4: drawBoss4(); break;
    case 5: drawBoss5(); break;
    case 6: drawBoss6(); break;
    case 7: drawBoss7(); break;
    case 8: drawBoss8(); break;
  }
  drawBossHpBar(g);
}

export function drawBossHpBar(g) {
  // verbatim index.html:1980-1994 with boss -> g.boss, bossMaxHp -> g.bossMaxHp, W/H imported
}

/* drawBoss1..drawBoss8 — verbatim index.html:1996-2224 (read the aliases) */

export function fireBoss(g) {
  if (!g.player || g.player.dead || !g.boss) return;
  player = g.player; enemyBullets = g.enemyBullets; diffMult = g.diffMult;
  switch (g.boss.stageNum) {
    case 1: fireBoss1(); break;
    /* ... cases 2-8 ... */
  }
}

/* fireBoss1..fireBoss8 — verbatim index.html:2240-2369 (read the aliases) */

export function updateBoss(dt, g) {
  if (!g.boss) return;
  boss = g.boss; player = g.player; enemyBullets = g.enemyBullets; diffMult = g.diffMult;
  // verbatim index.html:2371-2408 body; g.bossPhase/bossMaxHp/bossTimer/bossAngle assignments
  // written back to g as the source does; phantomAlpha special case uses boss.stageNum === 7
}

export function spawnMinion(g) {
  // index.html:2410-2415 with enemyBullets/mkEnemy/ENEMY_CFG via aliases/import, enemies -> g.enemies
}

export function onBossDeath(g) {
  // index.html:2417-2446 with conversions: g.boss, g.currentStage, g.score, g.loopMult, g.state,
  // g.stageClearTimer, g.victoryTimer, g.startStage(...), spawnExplosion(..., g), g.saveHS()
}
```

> **Alias-writeback rule:** functions that **assign** to a shared binding (`g.bossPhase = ...` in `updateBoss`, `g.boss = null` in `onBossDeath`) must write to `g.*` directly, not the alias. Functions that only **read** shared state (the `drawBossN`/`fireBossN` bodies) use the aliases. If a `fireBossN` mutates `enemyBullets` (it does — pushes bullets), the alias `enemyBullets` points at the same array as `g.enemyBullets`, so `.push` through the alias is correct.

- [ ] **Step 2: Verify it parses**

Run: `node --check src/entities/Boss.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/entities/Boss.js
git commit -m "refactor: extract boss entity into src/entities/Boss.js (alias dispatch)"
```

### Task 15: `src/render/hud.js` and `src/render/screens.js`

**Files:**
- Create: `src/render/hud.js`
- Create: `src/render/screens.js`

Source: index.html:2448–2625. Split: `drawHUD` → `hud.js`; `drawTitle, drawPause, drawSettings, drawGameOver, drawStageClear, drawVictory` → `screens.js`. (`updateVictory` is the no-op `/* victory stays until Enter */` stub → becomes a `Game` method in Task 16.)

Conversion table (real global refs): `score` → `g.score` (5), `highScore` → `g.highScore` (4), `player` → `g.player` (3), `loopMult` → `g.loopMult` (2), `currentStage` → `g.currentStage` (2), `soundOn` → `g.soundOn` (1), `gameSpeed` → `g.gameSpeed` (1), `state` → `g.state` (1, in `drawPause`/`drawSettings` if checked).
Imports: `W, H, STATE` from `config.js`; `ctx` from `canvas.js`; `WEAPON_NAMES, WEAPON_COLORS` from `entities/Bullet.js`; `isTouch` from `core/input.js` (used by `drawTitle`, index.html:2525).
Signatures: `drawHUD(g)`; `drawTitle(g)`; `drawPause(g)`; `drawSettings(g)`; `drawGameOver(g)`; `drawStageClear(g)`; `drawVictory(g)`.

- [ ] **Step 1: Create `src/render/hud.js`**

```js
import { W, H } from '../config.js';
import { ctx } from '../canvas.js';
import { WEAPON_NAMES, WEAPON_COLORS } from '../entities/Bullet.js';

export function drawHUD(g) {
  // verbatim index.html:2449-2494 with the conversion table applied
  // (score -> g.score, highScore -> g.highScore, loopMult -> g.loopMult,
  //  currentStage -> g.currentStage, player -> g.player)
}
```

- [ ] **Step 2: Create `src/render/screens.js`**

```js
import { W, H, STATE } from '../config.js';
import { ctx } from '../canvas.js';
import { isTouch } from '../core/input.js';

export function drawTitle(g) { /* index.html:2497-2532 with conversions + isTouch import */ }
export function drawPause(g) { /* index.html:2534-2544 */ }
export function drawSettings(g) { /* index.html:2546-2568 with soundOn -> g.soundOn, gameSpeed -> g.gameSpeed */ }
export function drawGameOver(g) { /* index.html:2570-2584 */ }
export function drawStageClear(g) { /* index.html:2586-2600 */ }
export function drawVictory(g) { /* index.html:2605-2625 with loopMult -> g.loopMult */ }
```

> **Check `drawVictory`** (index.html:2605–2625): it may reference `loopMult` for the "LOOP N" text. `startGame` is NOT called from screens — the `startGame×1` reference is the section header comment (`=== STATE MACHINE — startGame stub ===`), so no `g.startGame` call is needed here.

- [ ] **Step 3: Verify both parse**

Run: `node --check src/render/hud.js && node --check src/render/screens.js`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/render/hud.js src/render/screens.js
git commit -m "refactor: extract HUD + screens into src/render/"
```

### Task 16: `src/core/Game.js` + `src/main.js` + cutover

**Files:**
- Create: `src/core/Game.js`
- Create: `src/main.js`
- Modify: `index.html` (delete the `<script>` block, add module entry)

The cutover: `index.html`'s monolithic `<script>` (lines 22–2697) is deleted and replaced with `<script type="module" src="/src/main.js"></script>`. `Game` owns all shared state; the main loop is `Game.loop`.

- [ ] **Step 1: Create `src/core/Game.js`**

```js
import { W, H, STATE, STAGE_COUNT } from '../config.js';
import { ctx } from '../canvas.js';
import { diffMultFor } from './difficulty.js';
import { initBackground, updateStars, drawStars, updateBackground, drawBackground } from '../stages/background.js';
import { updateParticles, drawParticles } from './particles.js';
import { createPlayer, drawPlayer, updatePlayer } from '../entities/Player.js';
import { updatePlayerBullets, drawPlayerBullets, drawLaserBeam,
         updateEnemyBullets, drawEnemyBullets } from '../entities/Bullet.js';
import { drawEnemy, updateEnemies } from '../entities/Enemy.js';
import { updatePowerups, drawPowerups } from '../entities/Powerup.js';
import { drawBoss, updateBoss } from '../entities/Boss.js';
import { runCollision } from './collision.js';
import { buildWaveTable, updateWaves } from '../stages/waveGen.js';
import { drawHUD } from '../render/hud.js';
import { drawTitle, drawPause, drawSettings, drawGameOver, drawStageClear, drawVictory } from '../render/screens.js';
import { drawTouchControls } from './input.js';

export class Game {
  constructor() {
    this.state = STATE.TITLE;
    this.settingsOpen = false;
    this.soundOn = true;
    this.gameSpeed = 1.0;
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('raidenHS') || '0');
    this.keys = {};
    this.moveVec = { x: 0, y: 0 };
    this.player = null;
    this.enemies = [];
    this.boss = null;
    this.playerBullets = [];
    this.enemyBullets = [];
    this.powerups = [];
    this.particles = [];
    this.diffMult = 1.0;
    this.loopMult = 1;
    this.waveTable = [];
    this.waveIndex = 0;
    this.stageTimer = 0;
    this.currentStage = 1;
    this.bossSpawned = false;
    this.bossMaxHp = 0;
    this.bossPhase = 0;
    this.bossTimer = 0;
    this.bossAngle = 0;
    this.stageClearTimer = 0;
    this.victoryTimer = 0;
    this.lastTime = 0;
    this.loop = this.loop.bind(this);
  }

  saveHS() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('raidenHS', this.highScore);
    }
  }

  startGame() {
    this.score = 0;
    this.player = createPlayer();
    this.particles.length = 0;
    this.powerups.length = 0;
    this.startStage(1);
    this.state = STATE.PLAYING;
  }

  startStage(stage) {
    this.currentStage = stage;
    this.diffMult = diffMultFor(stage, this.loopMult);
    initBackground(stage);
    this.waveTable = buildWaveTable(stage, this.diffMult);
    this.waveIndex = 0;
    this.stageTimer = 0;
    this.bossSpawned = false;
    this.boss = null;
    this.enemies.length = 0;
    this.enemyBullets.length = 0;
    this.playerBullets.length = 0;
    this.powerups.length = 0;
  }

  updateStageClear(dt) {
    this.stageClearTimer -= dt;
    if (this.stageClearTimer <= 0) {
      this.startStage(this.currentStage + 1);
      this.state = STATE.PLAYING;
    }
  }

  updateVictory(dt) { /* victory stays until Enter */ }

  loop(ts) {
    requestAnimationFrame(this.loop);
    const rawDt = Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;
    const dt = rawDt * this.gameSpeed;

    // Update
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
      updateBoss(dt, this);
      updateWaves(dt, this);
    }

    // Render
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
      this.enemies.forEach(drawEnemy);
      drawBoss(this);
      drawEnemyBullets(this);
      drawPowerups(this);
      drawPlayerBullets(this);
      drawPlayer(this.player);
      drawLaserBeam(this.player);
      drawParticles(this);
      drawHUD(this);
      if (this.state === STATE.PAUSED)     drawPause(this);
      if (this.state === STATE.STAGECLEAR) drawStageClear(this);
    }
    if (this.settingsOpen) drawSettings(this);
    drawTouchControls(this);
  }
}
```

> `drawBackground` now takes `g` (Task 7) and reads `g.currentStage`/`g.stageTimer` internally. `updateStars`, `updateBackground`, `drawStars` take no game arg (background-internal state). Everything else receives `this` per its signature.

- [ ] **Step 2: Create `src/main.js`**

```js
import './canvas.js';
import { Game } from './core/Game.js';
import { initInput } from './core/input.js';

const game = new Game();
initInput(game);
requestAnimationFrame(ts => { game.lastTime = ts; requestAnimationFrame(game.loop); });
```

- [ ] **Step 3: Rewrite `index.html`** — keep the `<head>`/`<style>`/`<body>` exactly, replace the `<script>` block (lines 22–2697) with:

```html
<script type="module" src="/src/main.js"></script>
```

The file becomes:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>RAIDEN</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #000;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    overflow: hidden;
  }
  canvas { display: block; image-rendering: pixelated; touch-action: none; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<script type="module" src="/src/main.js"></script>
</body>
</html>
```

- [ ] **Step 4: Run the unit tests**

Run: `npm test`
Expected: PASS (2 difficulty tests). Confirms the pure modules survived the cutover.

- [ ] **Step 5: Dev-server smoke test**

Run: `npm run dev` (leave running), then open the printed localhost URL.
Expected: title screen renders; pressing Enter starts stage 1.

- [ ] **Step 6: Build and preview the single file**

Run: `npm run build`
Expected: `dist/index.html` emitted, containing the entire app inline (single file, no `dist/assets/`).

Run: `npm run preview`, open the printed URL.
Expected: title screen renders and the game plays.

- [ ] **Step 7: Commit**

```bash
git add src/core/Game.js src/main.js index.html
git commit -m "refactor: cut over to module entry (Game class + main.js), delete monolith script"
```

### Task 17: Checkpoint 1 — verify the refactor is behavior-identical

- [ ] **Step 1: Play through the full game**

Run: `npm run dev`, open the URL. Play stages 1–8 to the boss on each; beat a boss to see STAGECLEAR; die on purpose to see GAMEOVER/continue; press P to pause, S to open settings (M toggle sound, [ / ] speed, S close), Enter on VICTORY to loop.

- [ ] **Step 2: Confirm every behavior below is unchanged vs. the pre-refactor game**

- [ ] Title screen: starfield + title text + controls hint (touch hint shows on touch devices)
- [ ] Movement: arrow keys / WASD; analog touch stick proportional speed
- [ ] Weapons: vulcan/spread/missile firing, charge shot, bomb (clear + flash), powerup drops and weapon upgrades
- [ ] Enemy behaviors: all 4 types, formations, turret range-firing, elite hp on stage 8
- [ ] Bosses 1–8: same visuals, same fire patterns per phase, same minions (6/8), same phantom alpha (7), same HP bar
- [ ] Scoring/high score persistence, loop mode (Victory → Enter → Loop 2)
- [ ] Backgrounds per stage identical (starfield, rocks, clouds, bubbles, streaks, hulls, wisps, walls)
- [ ] SFX identical; sound toggle works
- [ ] `npm run build` + `npm run preview` plays identically
- [ ] No console errors (open DevTools console)

- [ ] **Step 3: If anything differs**

Use `git stash` on the module files is not an option (they're the working copy) — instead fix the discrepancy in the module file (usually a missed `g.` conversion or a wrong signature), restart the dev server, re-run Step 1–2. Repeat until identical. Then commit any fixes with `git commit -am "fix: restore behavior parity after cutover"`.

- [ ] **Step 4: Commit the checkpoint**

Nothing to commit if clean (Phase A is verified).

---

## Phase B — Data-Driven Stages (behavior-preserving)

Goal: stages become data. `STAGES[]` in `stageData.js` replaces the `buildWaveTable` switch; `drawBackground` reads `stageDef.bg`. The 8 existing stages are ported 1:1 into descriptor form so behavior is unchanged. Verification checkpoint: stages 1–8 still play identically.

### Task 18: Create `src/stages/stageData.js` with stages 1–8

**Files:**
- Create: `src/stages/stageData.js`

The descriptor format (see spec):

- Wave entries:
  - `{ t, type, path: ['down', sx, sy, spd] | ['sin', sx, sy, spd, amp, freq] | ['form', cx, sy, spd, idx, total] }` — `spd` is the **raw speed factor**; `waveGen` multiplies by `diffMult`. The factor equals the old `X * diffMult` constant, e.g. `105` for stage 1 formations, `120.75` for `fS*1.15`, `44` for `44*diffMult`.
  - `{ t, type: 3, x, y, elite? }` — turret.
  - `{ t, boss: N }` — boss trigger.
  - `elite: true` → runtime `eliteHp: true` (1.5× hp, stage 8).
- `bg`: `{ baseFill, starColor, features }` — `features` is `[]` for stage 1 (stars only) and one of `rocks|clouds|bubbles|streaks|hulls|wisps|walls` for stages 2–8, matching each stage's current background.
- `boss`: `{ archetype, tint, r, hp, speed, phaseCount, spawnMinions }` transcribed from `createBoss`'s stats table (index.html:1935–1944) with `archetype = stage`, `tint = null`, `speed = 58`. `patterns` is added in Phase C.

- [ ] **Step 1: Create `src/stages/stageData.js`** — the full file, transcribing the switch cases from index.html:1634–1866 into descriptor arrays (speed factors computed exactly as shown; this is a 1:1 port).

```js
import { W } from '../config.js';

export const STAGES = [
  // Stage 1
  {
    id: 1,
    bg: { baseFill: '#020208', starColor: ['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.7)', 'rgba(200,220,255,1.0)'], features: [] },
    waves: [
      ...[0,1,2,3,4].map(i => ({ t: 0.5 + i*0.28, type: 0, path: ['form', W/2, -20, 105, i, 5] })),
      { t: 3.5, type: 1, path: ['down', W*0.25, -30, 62] },
      { t: 3.5, type: 1, path: ['down', W*0.75, -30, 62] },
      ...[0,1,2,3].map(i => ({ t: 5.5 + i*0.35, type: 0, path: ['sin', W*0.18 + i*90, -20, 94.5, 45, 1.6] })),
      { t: 8, type: 3, x: 80,  y: 290 },
      { t: 8, type: 3, x: 240, y: 240 },
      { t: 8, type: 3, x: 400, y: 290 },
      { t: 10, type: 2, path: ['down', W/2, -40, 44] },
      ...[0,1,2,3,4,5].map(i => ({ t: 12 + i*0.22, type: 0, path: ['form', W/2, -20, 120.75, i, 6] })),
      { t: 14, type: 1, path: ['sin', W*0.5, -30, 62, 65, 1.9] },
      ...[0,1,2].map(i => ({ t: 17 + i*1.4, type: 1, path: ['down', 80 + i*160, -30, 62] })),
      { t: 20, type: 3, x: 150, y: 200 },
      { t: 20, type: 3, x: 330, y: 215 },
      { t: 22, type: 2, path: ['down', W*0.33, -40, 40] },
      { t: 22, type: 2, path: ['down', W*0.67, -40, 40] },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 26 + i*0.18, type: 0, path: ['form', W/2, -20, 136.5, i, 8] })),
      { t: 30, boss: 1 },
    ],
    boss: { archetype: 1, tint: null, r: 50, hp: 800, speed: 58, phaseCount: 3, spawnMinions: false },
  },

  // Stage 2
  {
    id: 2,
    bg: { baseFill: '#0f0c08', starColor: ['rgba(200,190,170,0.3)', 'rgba(210,200,180,0.5)', 'rgba(220,210,190,0.8)'], features: ['rocks'] },
    waves: [
      ...[0,1,2,3,4].map(i => ({ t: 0.5 + i*0.28, type: 0, path: ['form', W/2, -20, 145, i, 5] })),
      { t: 3.5, type: 1, path: ['down', W*0.25, -30, 88] },
      { t: 3.5, type: 1, path: ['down', W*0.75, -30, 88] },
      ...[0,1,2,3].map(i => ({ t: 5.5 + i*0.35, type: 0, path: ['sin', W*0.18 + i*90, -20, 130.5, 45, 1.6] })),
      { t: 8, type: 3, x: 80,  y: 290 },
      { t: 8, type: 3, x: 240, y: 240 },
      { t: 8, type: 3, x: 400, y: 290 },
      { t: 10, type: 2, path: ['down', W/2, -40, 44] },
      ...[0,1,2,3,4,5].map(i => ({ t: 12 + i*0.22, type: 0, path: ['form', W/2, -20, 166.75, i, 6] })),
      { t: 14, type: 1, path: ['sin', W*0.5, -30, 88, 65, 1.9] },
      ...[0,1,2].map(i => ({ t: 17 + i*1.4, type: 1, path: ['down', 80 + i*160, -30, 88] })),
      { t: 20, type: 3, x: 150, y: 200 },
      { t: 20, type: 3, x: 330, y: 215 },
      { t: 22, type: 2, path: ['down', W*0.33, -40, 40] },
      { t: 22, type: 2, path: ['down', W*0.67, -40, 40] },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 26 + i*0.18, type: 0, path: ['form', W/2, -20, 188.5, i, 8] })),
      { t: 30, boss: 2 },
    ],
    boss: { archetype: 2, tint: null, r: 60, hp: 1000, speed: 58, phaseCount: 3, spawnMinions: false },
  },

  // Stage 3
  {
    id: 3,
    bg: { baseFill: '#1a0005', starColor: ['rgba(255,160,160,0.35)', 'rgba(255,120,120,0.6)', 'rgba(255,200,200,0.9)'], features: ['clouds'] },
    waves: [
      ...[0,1,2,3,4,5].map(i => ({ t: 0.5 + i*0.20, type: 0, path: ['form', W/2, -20, 160, i, 6] })),
      { t: 2.5, type: 1, path: ['down', W*0.20, -30, 95] },
      { t: 2.5, type: 1, path: ['down', W*0.80, -30, 95] },
      ...[0,1,2,3,4,5].map(i => ({ t: 3.0 + i*0.18, type: 0, path: ['sin', W*0.15 + i*60, -20, 136, 38, 2.0] })),
      { t: 4.0, type: 1, path: ['down', W*0.35, -30, 95] },
      { t: 4.0, type: 1, path: ['down', W*0.65, -30, 95] },
      ...[0,1,2,3,4,5].map(i => ({ t: 6.0 + i*0.18, type: 0, path: ['form', W/2, -20, 176, i, 6] })),
      { t: 7.0, type: 1, path: ['sin', W*0.3, -30, 95, 55, 1.6] },
      { t: 7.0, type: 1, path: ['sin', W*0.7, -30, 95, 55, 1.6] },
      { t: 10, type: 3, x: 120, y: 260 },
      { t: 10, type: 3, x: 240, y: 220 },
      { t: 10, type: 3, x: 360, y: 260 },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 17 + i*0.15, type: 0, path: ['form', W/2, -20, 192, i, 8] })),
      { t: 25, boss: 3 },
    ],
    boss: { archetype: 3, tint: null, r: 50, hp: 1100, speed: 58, phaseCount: 3, spawnMinions: false },
  },

  // Stage 4
  {
    id: 4,
    bg: { baseFill: '#051005', starColor: null, features: ['bubbles'] },
    waves: [
      { t: 2, type: 3, x: 100, y: 280 },
      { t: 2, type: 3, x: 240, y: 250 },
      { t: 2, type: 3, x: 380, y: 280 },
      { t: 2.5, type: 3, x: 170, y: 310 },
      { t: 5, type: 2, path: ['down', W*0.5, -40, 40] },
      ...[0,1,2,3,4].map(i => ({ t: 7 + i*0.25, type: 0, path: ['form', W/2, -20, 130, i, 5] })),
      { t: 8, type: 3, x: 80,  y: 240 },
      { t: 8, type: 3, x: 200, y: 210 },
      { t: 8, type: 3, x: 320, y: 210 },
      { t: 8, type: 3, x: 440, y: 240 },
      { t: 11, type: 2, path: ['down', W*0.3, -40, 36] },
      { t: 11.5, type: 2, path: ['down', W*0.7, -40, 36] },
      ...[0,1,2,3,4,5].map(i => ({ t: 13 + i*0.22, type: 0, path: ['sin', W*0.15 + i*60, -20, 117, 40, 1.8] })),
      { t: 15, type: 3, x: 140, y: 270 },
      { t: 15, type: 3, x: 240, y: 230 },
      { t: 15, type: 3, x: 340, y: 270 },
      { t: 15.5, type: 3, x: 80, y: 310 },
      { t: 18, type: 2, path: ['down', W*0.5, -40, 38] },
      ...[0,1,2,3,4,5,6].map(i => ({ t: 23 + i*0.18, type: 0, path: ['form', W/2, -20, 156, i, 7] })),
      { t: 28, boss: 4 },
    ],
    boss: { archetype: 4, tint: null, r: 55, hp: 1200, speed: 58, phaseCount: 3, spawnMinions: false },
  },

  // Stage 5
  {
    id: 5,
    bg: { baseFill: '#1a0800', starColor: null, features: ['streaks'] },
    waves: [
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 0.5 + i*0.15, type: 0, path: ['form', W/2, -20, 175, i, 8] })),
      { t: 3.0, type: 1, path: ['down', W*0.25, -30, 105] },
      { t: 3.0, type: 1, path: ['down', W*0.75, -30, 105] },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 4.0 + i*0.14, type: 0, path: ['sin', W*0.1 + i*55, -20, 157.5, 35, 2.2] })),
      { t: 7.0, type: 1, path: ['down', W*0.3, -30, 115.5] },
      { t: 7.0, type: 1, path: ['down', W*0.7, -30, 115.5] },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 8.0 + i*0.14, type: 0, path: ['form', W/2, -20, 192.5, i, 8] })),
      { t: 11, type: 1, path: ['sin', W*0.4, -30, 105, 50, 1.7] },
      { t: 11, type: 1, path: ['sin', W*0.6, -30, 105, 50, 1.7] },
      { t: 11.0, type: 1, path: ['down', W*0.2, -30, 126] },
      { t: 11.0, type: 1, path: ['down', W*0.8, -30, 126] },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 12.0 + i*0.14, type: 0, path: ['sin', W*0.1 + i*55, -20, 192.5, 40, 2.0] })),
      { t: 14, type: 2, path: ['down', W*0.35, -40, 45] },
      { t: 14, type: 2, path: ['down', W*0.65, -40, 45] },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 21 + i*0.12, type: 0, path: ['form', W/2, -20, 227.5, i, 8] })),
      { t: 26, boss: 5 },
    ],
    boss: { archetype: 5, tint: null, r: 52, hp: 1300, speed: 58, phaseCount: 3, spawnMinions: false },
  },

  // Stage 6
  {
    id: 6,
    bg: { baseFill: '#080810', starColor: ['rgba(180,180,200,0.25)', 'rgba(190,190,210,0.45)', 'rgba(210,210,230,0.7)'], features: ['hulls'] },
    waves: [
      ...[0,1,2].map(i => ({ t: 1 + i*0.7, type: 1, path: ['down', W*0.25, -30, 90] })),
      ...[0,1,2].map(i => ({ t: 2 + i*0.7, type: 1, path: ['down', W*0.75, -30, 90] })),
      { t: 7, type: 2, path: ['down', W*0.5, -40, 42] },
      ...[0,1,2].map(i => ({ t: 5 + i*0.6, type: 1, path: ['down', W*0.40, -30, 99] })),
      ...[0,1,2].map(i => ({ t: 6 + i*0.6, type: 1, path: ['down', W*0.60, -30, 99] })),
      { t: 10, type: 3, x: 160, y: 230 },
      { t: 10, type: 3, x: 320, y: 230 },
      { t: 12, type: 2, path: ['down', W*0.3, -40, 40] },
      { t: 12.5, type: 2, path: ['down', W*0.7, -40, 40] },
      ...[0,1,2,3,4].map(i => ({ t: 9 + i*0.25, type: 0, path: ['form', W/2, -20, 130, i, 5] })),
      ...[0,1,2].map(i => ({ t: 13 + i*0.5, type: 1, path: ['sin', W*0.35, -30, 90, 45, 1.5] })),
      { t: 17, type: 2, path: ['down', W*0.5, -40, 38] },
      ...[0,1,2,3].map(i => ({ t: 22 + i*0.5, type: 1, path: ['form', W/2, -30, 108, i, 4] })),
      { t: 28, boss: 6 },
    ],
    boss: { archetype: 6, tint: null, r: 65, hp: 1500, speed: 58, phaseCount: 4, spawnMinions: true },
  },

  // Stage 7
  {
    id: 7,
    bg: { baseFill: '#000000', starColor: ['rgba(160,80,255,0.3)', 'rgba(180,100,255,0.5)', 'rgba(200,140,255,0.8)'], features: ['wisps'] },
    waves: [
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 0.5 + i*0.13, type: 0, path: ['form', W/2, -20, 190, i, 8] })),
      { t: 2.0, type: 1, path: ['down', W*0.2, -30, 110] },
      { t: 2.0, type: 1, path: ['down', W*0.8, -30, 110] },
      { t: 3, type: 3, x: 100, y: 250 },
      { t: 3, type: 3, x: 240, y: 210 },
      { t: 3, type: 3, x: 380, y: 250 },
      ...[0,1,2,3,4,5].map(i => ({ t: 4.0 + i*0.16, type: 0, path: ['sin', W*0.1 + i*65, -20, 171, 38, 2.0] })),
      { t: 5.0, type: 1, path: ['sin', W*0.5, -30, 110, 60, 1.8] },
      { t: 6, type: 2, path: ['down', W*0.4, -40, 50] },
      { t: 6, type: 2, path: ['down', W*0.6, -40, 50] },
      { t: 8, type: 3, x: 80,  y: 270 },
      { t: 8, type: 3, x: 200, y: 240 },
      { t: 8, type: 3, x: 320, y: 240 },
      { t: 8, type: 3, x: 440, y: 270 },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 10 + i*0.12, type: 0, path: ['form', W/2, -20, 218.5, i, 8] })),
      ...[0,1,2].map(i => ({ t: 12 + i*0.6, type: 1, path: ['down', W*0.3, -30, 121] })),
      ...[0,1,2].map(i => ({ t: 12 + i*0.6, type: 1, path: ['down', W*0.7, -30, 121] })),
      { t: 14, type: 2, path: ['down', W*0.5, -40, 48] },
      { t: 16, type: 3, x: 120, y: 260 },
      { t: 16, type: 3, x: 240, y: 225 },
      { t: 16, type: 3, x: 360, y: 260 },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 22 + i*0.12, type: 0, path: ['form', W/2, -20, 228, i, 8] })),
      ...[0,1,2].map(i => ({ t: 23 + i*0.5, type: 1, path: ['down', 80 + i*160, -30, 132] })),
      { t: 30, boss: 7 },
    ],
    boss: { archetype: 7, tint: null, r: 50, hp: 1400, speed: 58, phaseCount: 4, spawnMinions: false },
  },

  // Stage 8
  {
    id: 8,
    bg: { baseFill: '#100005', starColor: null, features: ['walls'] },
    waves: [
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 0.5 + i*0.12, type: 0, path: ['form', W/2, -20, 200, i, 8], elite: true })),
      ...[0,1,2,3].map(i => ({ t: 2 + i*0.5, type: 1, path: ['down', W*0.25, -30, 115], elite: true })),
      ...[0,1,2,3].map(i => ({ t: 2 + i*0.5, type: 1, path: ['down', W*0.75, -30, 115], elite: true })),
      { t: 4, type: 3, x: 80,  y: 280, elite: true },
      { t: 4, type: 3, x: 200, y: 240, elite: true },
      { t: 4, type: 3, x: 320, y: 240, elite: true },
      { t: 4, type: 3, x: 440, y: 280, elite: true },
      { t: 6, type: 2, path: ['down', W*0.33, -40, 52], elite: true },
      { t: 6.5, type: 2, path: ['down', W*0.67, -40, 52], elite: true },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 8 + i*0.12, type: 0, path: ['sin', W*0.1 + i*55, -20, 190, 35, 2.2], elite: true })),
      { t: 11, type: 3, x: 120, y: 260, elite: true },
      { t: 11, type: 3, x: 240, y: 220, elite: true },
      { t: 11, type: 3, x: 360, y: 260, elite: true },
      ...[0,1,2,3].map(i => ({ t: 12 + i*0.4, type: 1, path: ['down', W*0.4, -30, 126.5], elite: true })),
      ...[0,1,2,3].map(i => ({ t: 12 + i*0.4, type: 1, path: ['down', W*0.6, -30, 126.5], elite: true })),
      { t: 16, type: 2, path: ['down', W*0.2, -40, 48], elite: true },
      { t: 16, type: 2, path: ['down', W*0.5, -40, 48], elite: true },
      { t: 16, type: 2, path: ['down', W*0.8, -40, 48], elite: true },
      { t: 19, type: 3, x: 100, y: 270, elite: true },
      { t: 19, type: 3, x: 240, y: 235, elite: true },
      { t: 19, type: 3, x: 380, y: 270, elite: true },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 25 + i*0.11, type: 0, path: ['form', W/2, -20, 240, i, 8], elite: true })),
      ...[0,1,2,3].map(i => ({ t: 26 + i*0.4, type: 1, path: ['form', W/2, -30, 138, i, 4], elite: true })),
      { t: 32, boss: 8 },
    ],
    boss: { archetype: 8, tint: null, r: 75, hp: 2000, speed: 58, phaseCount: 5, spawnMinions: true },
  },
];
```

- [ ] **Step 2: Verify the port**

Run: `node --check src/stages/stageData.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/stages/stageData.js
git commit -m "refactor: add stageData.js with stages 1-8 ported to descriptors"
```

### Task 19: Rewrite `buildWaveTable` as a descriptor generator

**Files:**
- Modify: `src/stages/waveGen.js`

Replace the switch-based `buildWaveTable(stage, diffMult)` with a descriptor generator `buildWaveTable(stageDef, diffMult)`, keeping the path helpers and `updateWaves`. Update `Game.startStage` to pass `STAGES[stage - 1]`.

- [ ] **Step 1: Replace `buildWaveTable` in `src/stages/waveGen.js`**

Delete the switch-based body (the ported index.html:1634–1866). Add `expandPath` and the generator:

```js
import { W } from '../config.js';
import { STAGES } from './stageData.js';
import { mkEnemy } from '../entities/Enemy.js';
import { createBoss } from '../entities/Boss.js';

export function pathDown(sx, sy, spd) {
  return t => ({ x: sx, y: sy + t * spd });
}

export function pathSin(sx, sy, spd, amp, freq) {
  return t => ({ x: sx + Math.sin(t * freq) * amp, y: sy + t * spd });
}

export function pathFormation(cx, sy, spd, idx, total) {
  const offset = (idx - (total - 1) / 2) * 36;
  return t => ({ x: cx + offset, y: sy + t * spd });
}

// Descriptor path: ['down', sx, sy, spd] | ['sin', sx, sy, spd, amp, freq] | ['form', cx, sy, spd, idx, total]
// spd is the raw factor; waveGen multiplies by diffMult (matches the old X*diffMult constants).
function expandPath(desc, diffMult) {
  const kind = desc[0];
  const spd = desc[3] * diffMult;
  switch (kind) {
    case 'down': return pathDown(desc[1], desc[2], spd);
    case 'sin':  return pathSin(desc[1], desc[2], spd, desc[4], desc[5]);
    case 'form': return pathFormation(desc[1], desc[2], spd, desc[4], desc[5]);
    default: throw new Error('unknown path kind: ' + kind);
  }
}

export function buildWaveTable(stageDef, diffMult) {
  const entries = [];
  for (const d of stageDef.waves) {
    if (d.boss) {
      entries.push({ t: d.t, boss: d.boss });
    } else if (d.type === 3) {
      entries.push({ t: d.t, type: 3, x: d.x, y: d.y, ...(d.elite ? { eliteHp: true } : {}) });
    } else {
      entries.push({ t: d.t, type: d.type, path: expandPath(d.path, diffMult), ...(d.elite ? { eliteHp: true } : {}) });
    }
  }
  return entries.sort((a, b) => a.t - b.t);
}

export function updateWaves(dt, g) {
  // unchanged from Phase A (Task 13)
}
```

- [ ] **Step 2: Update `Game.startStage`**

In `src/core/Game.js`, replace:

```js
this.waveTable = buildWaveTable(stage, this.diffMult);
```

with:

```js
this.waveTable = buildWaveTable(STAGES[stage - 1], this.diffMult);
```

and add `import { STAGES } from '../stages/stageData.js';` to the imports in `Game.js`.

- [ ] **Step 3: Verify it parses + tests still pass**

Run: `node --check src/stages/waveGen.js && npm test`
Expected: no output, then PASS (2 difficulty tests).

- [ ] **Step 4: Commit**

```bash
git add src/stages/waveGen.js src/core/Game.js
git commit -m "refactor: buildWaveTable now expands STAGES descriptors"
```

### Task 20: Make the background feature-driven from `stageDef.bg`

**Files:**
- Modify: `src/stages/background.js`

Replace the per-stage-number switches in `initBackground`/`updateBackground`/`drawBackground` with feature-driven dispatch over `STAGES[stage-1].bg.features`; `drawBackground` reads `baseFill`/`starColor` from `stageDef.bg`. Behavior for stages 1–8 is identical because each stage's `features` array matches its current background.

- [ ] **Step 1: Rewrite `initBackground`, `updateBackground`, `drawBackground` in `src/stages/background.js`**

Add `import { STAGES } from './stageData.js';`, delete the local `STAGE_BG` const, and replace the three functions:

```js
function buildRocks() {
  for (let i = 0; i < 14; i++) {
    bgRocks.push({ x: Math.random()*W, y: Math.random()*H, r: 8+Math.random()*12,
      spd: 60+Math.random()*40, rot: Math.random()*Math.PI*2,
      rotSpd: (Math.random()-0.5)*0.8, layer: 0 });
  }
  for (let i = 0; i < 8; i++) {
    bgRocks.push({ x: Math.random()*W, y: Math.random()*H, r: 5+Math.random()*8,
      spd: 100+Math.random()*40, rot: Math.random()*Math.PI*2,
      rotSpd: (Math.random()-0.5)*1.2, layer: 1 });
  }
}

function buildClouds() {
  for (let i = 0; i < 12; i++) {
    bgClouds.push({ x: Math.random()*W, y: Math.random()*H,
      w: 80+Math.random()*80, h: 40+Math.random()*40,
      alpha: 0.06+Math.random()*0.06, spd: 20+Math.random()*20,
      hue: Math.random()<0.5 ? '#cc2244' : '#aa1133' });
  }
}

function buildBubbles() {
  for (let i = 0; i < 40; i++) {
    bgBubbles.push({ x: Math.random()*W, y: Math.random()*H,
      r: 4+Math.random()*8, alpha: 0.08+Math.random()*0.12,
      spd: 18+Math.random()*22, wobbleAmp: 8+Math.random()*14,
      wobbleFreq: 0.6+Math.random()*0.8, wobbleOff: Math.random()*Math.PI*2,
      color: Math.random()<0.6 ? '#44ee44' : '#aaee00',
      t: Math.random()*100 });
  }
}

function buildStreaks() {
  for (let i = 0; i < 30; i++) {
    bgStreaks.push({ x: Math.random()*W, y: Math.random()*H,
      w: 40+Math.random()*80, h: 1+Math.floor(Math.random()*2),
      spd: 300+Math.random()*200, alpha: 0.18+Math.random()*0.25,
      color: Math.random()<0.7 ? '#ff8800' : '#ffcc44' });
  }
}

function buildHulls() {
  for (let i = 0; i < 10; i++) {
    bgHulls.push({
      x: Math.random() * (W - 120),
      y: Math.random() * H,
      w: 60 + Math.random() * 60,
      h: 12 + Math.random() * 14,
      spd: 25 + Math.random() * 15,
      alpha: 0.18 + Math.random() * 0.12,
    });
  }
}

function buildWisps() {
  for (let i = 0; i < 8; i++) {
    const x1 = Math.random()*W, y1 = Math.random()*H;
    bgWisps.push({ x1, y1,
      x2: x1+(Math.random()-0.5)*160, y2: y1+(Math.random()-0.5)*100,
      cx1: x1+(Math.random()-0.5)*80, cy1: y1+(Math.random()-0.5)*80,
      cx2: x1+(Math.random()-0.5)*80, cy2: y1+(Math.random()-0.5)*80,
      alpha: 0.04+Math.random()*0.06,
      color: Math.random()<0.5 ? '#9944ff' : '#cc88ff',
      width: 1+Math.random()*2 });
  }
}

function buildWalls() {
  for (let i = 0; i < 8; i++) {
    bgWalls.push({ side:'left', y: i*(H/8), baseX: 30+Math.random()*20,
      h: H/8+4, sineAmp: 14+Math.random()*10,
      sineFreq: 0.4+Math.random()*0.4, sineOff: Math.random()*Math.PI*2, color:'#550011' });
    bgWalls.push({ side:'right', y: i*(H/8), baseX: W-30-Math.random()*20,
      h: H/8+4, sineAmp: 14+Math.random()*10,
      sineFreq: 0.4+Math.random()*0.4, sineOff: Math.random()*Math.PI*2, color:'#550011' });
  }
  for (let i = 0; i < 50; i++) {
    bgParticles.push({ x: Math.random()*W, y: Math.random()*H,
      r: 1+Math.random()*2, spd: 30+Math.random()*50,
      alpha: 0.3+Math.random()*0.4,
      color: Math.random()<0.7 ? '#ff2200' : '#ff6600' });
  }
}

function stageFeatures(stage) {
  return STAGES[Math.max(0, Math.min(STAGES.length - 1, stage - 1))].bg.features || [];
}

export function initBackground(stage) {
  bgStage = stage;
  bgRocks.length = 0; bgClouds.length = 0; bgBubbles.length = 0;
  bgStreaks.length = 0; bgHulls.length = 0; bgWisps.length = 0;
  bgParticles.length = 0; bgWalls.length = 0;

  const feat = stageFeatures(stage);
  if (feat.includes('rocks'))   buildRocks();
  if (feat.includes('clouds'))  buildClouds();
  if (feat.includes('bubbles')) buildBubbles();
  if (feat.includes('streaks')) buildStreaks();
  if (feat.includes('hulls'))   buildHulls();
  if (feat.includes('wisps'))   buildWisps();
  if (feat.includes('walls'))   buildWalls();
}

export function updateBackground(dt) {
  const stage = bgStage;
  const feat = stageFeatures(stage);
  if (feat.includes('rocks')) {
    bgRocks.forEach(r => {
      r.y += r.spd * dt; r.rot += r.rotSpd * dt;
      if (r.y > H + r.r*2) { r.y = -r.r*2; r.x = Math.random()*W; }
    });
  }
  if (feat.includes('clouds')) {
    bgClouds.forEach(c => {
      c.y += c.spd * dt;
      if (c.y > H + c.h) { c.y = -c.h; c.x = Math.random()*W; }
    });
  }
  if (feat.includes('bubbles')) {
    bgBubbles.forEach(b => {
      b.t += dt; b.y -= b.spd * dt;
      b.x += Math.sin(b.t * b.wobbleFreq + b.wobbleOff) * b.wobbleAmp * dt;
      if (b.y < -b.r*2) { b.y = H+b.r*2; b.x = Math.random()*W; }
    });
  }
  if (feat.includes('streaks')) {
    bgStreaks.forEach(s => {
      s.y += s.spd * dt;
      if (s.y > H+4) { s.y = -4; s.x = Math.random()*(W-s.w); }
    });
  }
  if (feat.includes('hulls')) {
    bgHulls.forEach(h => {
      h.y += h.spd * dt;
      if (h.y > H+h.h) { h.y = -h.h; h.x = Math.random()*(W-h.w); }
    });
  }
  if (feat.includes('walls')) {
    bgParticles.forEach(p => {
      p.y -= p.spd * dt;
      if (p.y < -p.r*2) { p.y = H+p.r*2; p.x = Math.random()*W; }
    });
  }
}

export function drawBackground(g) {
  const stage = g.currentStage;
  const cfg = STAGES[Math.max(0, Math.min(STAGES.length - 1, stage - 1))].bg;
  const feat = stageFeatures(stage);
  ctx.fillStyle = cfg.baseFill;
  ctx.fillRect(0, 0, W, H);

  if (cfg.starColor) {
    const savedColors = STAR_LAYERS.map(l => l.color);
    STAR_LAYERS[0].color = cfg.starColor[0];
    STAR_LAYERS[1].color = cfg.starColor[1];
    STAR_LAYERS[2].color = cfg.starColor[2];
    STAR_LAYERS.forEach(layer => {
      ctx.fillStyle = layer.color;
      layer.stars.forEach(s => ctx.fillRect(s.x, s.y, layer.size, layer.size));
    });
    STAR_LAYERS.forEach((l, i) => { l.color = savedColors[i]; });
  }

  if (feat.includes('rocks')) {
    bgRocks.forEach(r => {
      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
      ctx.fillStyle = r.layer===0 ? 'rgba(130,120,110,0.5)' : 'rgba(100,95,85,0.45)';
      ctx.beginPath(); ctx.ellipse(0, 0, r.r*1.4, r.r, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(180,170,155,0.2)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    });
  }

  if (feat.includes('clouds')) {
    bgClouds.forEach(c => {
      ctx.save(); ctx.globalAlpha = c.alpha; ctx.fillStyle = c.hue;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, c.w/2, c.h/2, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  if (feat.includes('bubbles')) {
    bgBubbles.forEach(b => {
      ctx.save(); ctx.globalAlpha = b.alpha; ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = b.alpha * 0.5; ctx.fillStyle = '#ccffcc';
      ctx.beginPath(); ctx.arc(b.x-b.r*0.3, b.y-b.r*0.3, b.r*0.4, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  if (feat.includes('streaks')) {
    bgStreaks.forEach(s => {
      ctx.save(); ctx.globalAlpha = s.alpha; ctx.fillStyle = s.color;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      const grad = ctx.createLinearGradient(s.x, s.y, s.x+s.w*0.3, s.y);
      grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, s.color);
      ctx.fillStyle = grad; ctx.fillRect(s.x, s.y, s.w*0.3, s.h);
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  if (feat.includes('hulls')) {
    bgHulls.forEach(h => {
      ctx.save(); ctx.globalAlpha = h.alpha;
      ctx.fillStyle = '#1a1a28'; ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.fillStyle = 'rgba(100,100,140,0.6)';
      const rivets = Math.floor(h.w/14);
      for (let i = 0; i < rivets; i++) {
        ctx.beginPath(); ctx.arc(h.x+8+i*14, h.y+h.h/2, 1.5, 0, Math.PI*2); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(80,80,120,0.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(h.x, h.y+3); ctx.lineTo(h.x+h.w, h.y+3); ctx.stroke();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  if (feat.includes('wisps')) {
    bgWisps.forEach(w => {
      ctx.save(); ctx.globalAlpha = w.alpha; ctx.strokeStyle = w.color; ctx.lineWidth = w.width;
      ctx.beginPath(); ctx.moveTo(w.x1, w.y1);
      ctx.bezierCurveTo(w.cx1, w.cy1, w.cx2, w.cy2, w.x2, w.y2);
      ctx.stroke(); ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  if (feat.includes('walls')) {
    const t = g.stageTimer;
    bgWalls.forEach(w => {
      const xOff = Math.sin(t * w.sineFreq + w.sineOff) * w.sineAmp;
      const drawX = w.side === 'left' ? w.baseX + xOff : w.baseX - xOff;
      ctx.save(); ctx.fillStyle = w.color;
      if (w.side === 'left') {
        ctx.fillRect(0, w.y, drawX, w.h);
      } else {
        ctx.fillRect(drawX, w.y, W - drawX, w.h);
      }
      ctx.strokeStyle = '#aa0022'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(drawX, w.y); ctx.lineTo(drawX, w.y + w.h); ctx.stroke();
      ctx.restore();
    });
    bgParticles.forEach(p => {
      ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }
}
```

> **Behavior parity check:** for stages 1–8 the `features` arrays in `stageData.js` (Task 18) exactly reproduce the old `if (stage === N)` dispatch: stage 1 has `[]` (returned before, now no-op loop), stage 2 `['rocks']`, 3 `['clouds']`, 4 `['bubbles']`, 5 `['streaks']`, 6 `['hulls']`, 7 `['wisps']`, 8 `['walls']`. `drawBackground`'s `STAGE_BG[idx]` lookup is replaced by `STAGES[idx].bg`, whose `baseFill`/`starColor` equal the old table entries verbatim.

- [ ] **Step 2: Verify it parses**

Run: `node --check src/stages/background.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/stages/background.js
git commit -m "refactor: drive backgrounds from stageData.bg features"
```

### Task 21: Unit tests for the descriptor generator

**Files:**
- Create: `tests/wavegen.test.js`

Locks the 1:1 port: every stage produces a sorted table whose last entry is its boss, stage 1's entry count is exactly 38, and path speeds scale with `diffMult`.

- [ ] **Step 1: Write the failing test `tests/wavegen.test.js`**

```js
import { describe, it, expect } from 'vitest';
import { buildWaveTable } from '../src/stages/waveGen.js';
import { STAGES } from '../src/stages/stageData.js';

describe('buildWaveTable', () => {
  it('produces a t-sorted table ending with the stage boss for every stage 1-8', () => {
    for (let s = 1; s <= 8; s++) {
      const table = buildWaveTable(STAGES[s - 1], 1.0);
      const ts = table.map(e => e.t);
      expect(ts).toEqual([...ts].sort((a, b) => a - b));
      expect(table[table.length - 1].boss).toBe(s);
    }
  });

  it('stage 1 has exactly 38 entries (5+2+4+3+1+6+1+3+2+2+8+boss)', () => {
    const table = buildWaveTable(STAGES[0], 1.0);
    expect(table.length).toBe(38);
  });

  it('stage 8 has exactly 57 entries with all regular enemies elite', () => {
    const table = buildWaveTable(STAGES[7], 1.0);
    expect(table.length).toBe(57);
    const regulars = table.filter(e => !e.boss);
    expect(regulars.length).toBeGreaterThan(0);
    expect(regulars.every(e => e.eliteHp === true)).toBe(true);
  });

  it('scales path speed by diffMult', () => {
    const table = buildWaveTable(STAGES[0], 2.0);
    const form = table.find(e => e.type === 0);
    const p0 = form.path(0);
    const p1 = form.path(1);
    expect(p1.y - p0.y).toBeCloseTo(105 * 2.0);   // stage 1 formation factor 105
  });
});
```

- [ ] **Step 2: Run test to verify it fails/passes**

Run: `npm test`
Expected: PASS (all 4 tests) — if the generator was implemented correctly in Task 19/20. If a stage count differs, the port has a transcription error: fix `stageData.js` (compare against index.html:1634–1866) until green.

- [ ] **Step 3: Commit**

```bash
git add tests/wavegen.test.js
git commit -m "test: lock descriptor generator output for stages 1-8"
```

### Task 22: Checkpoint 2 — verify stages 1–8 still play identically

- [ ] **Step 1: Playtest stages 1–8**

Run: `npm run dev`, play all 8 stages. Confirm: identical enemy waves (timing, formations, turret positions), identical backgrounds, identical boss fights, identical difficulty (speeds/HP).

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS (6 tests).

- [ ] **Step 3: Fix any drift**

If a wave differs, diff `stageData.js` against the original switch cases (index.html git history has the original — `git show HEAD~N:index.html` or the copy in the monolith's git history before Task 16 cutover). Correct the descriptor, re-run tests, replay.

---

## Phase C — Boss Parameterization

Goal: bosses become data-driven — `createBoss` reads `STAGES[stage].boss` (archetype + tint + patterns), the 8 draw archetypes take explicit `(ctx, boss, angle, timer)` parameters, and the 8 `fireBossN` functions are replaced by 7 named reusable behaviors dispatched from `boss.patterns`. Boss behavior for stages 1–8 is preserved exactly (each stage's `patterns` transcribe its original `fireBossN`). The Phase A module aliases (`let boss, bossAngle, ...`) are removed.

### Task 23: Named fire behaviors + `fireBoss` dispatch

**Files:**
- Modify: `src/entities/Boss.js`

Replace `fireBoss` + `fireBoss1..8` with the reusable behaviors below. Each pattern object carries `spdBase`/`spdPhase` (matching the original `(base + bossPhase * phase) * diffMult`), plus per-pattern params. `boss.patterns` is an array indexed by phase: `patterns[g.bossPhase % patterns.length]`, where each element is either one pattern object or an array of them (fired together, for bosses like 7/8 that combine behaviors in one phase).

- [ ] **Step 1: Add `firePattern` and rewrite `fireBoss`**

```js
function mkEB(b, g, vx, vy, clr, r = 5, ox = 0) {
  g.enemyBullets.push({ x: b.x + ox, y: b.y, vx, vy, r, clr });
}

export function firePattern(name, b, g, opts) {
  const dx = g.player.x - b.x, dy = g.player.y - b.y;
  const d  = Math.sqrt(dx*dx + dy*dy) || 1;
  const spd = (opts.spdBase + g.bossPhase * opts.spdPhase) * g.diffMult;
  switch (name) {
    case 'aimSpread': {
      const { count, gap, clr } = opts;
      for (let i = -(count - 1) / 2; i <= (count - 1) / 2; i++) {
        const a = Math.atan2(dy, dx) + i * gap;
        mkEB(b, g, Math.cos(a) * spd, Math.sin(a) * spd, clr);
      }
      break;
    }
    case 'ring': {
      const { count, clr, spdF = 1 } = opts;
      for (let i = 0; i < count; i++) {
        const a = g.bossAngle + (i / count) * Math.PI * 2;
        mkEB(b, g, Math.cos(a) * spd * spdF, Math.sin(a) * spd * spdF, clr);
      }
      break;
    }
    case 'aimBurst': {
      opts.offsets.forEach(off => {
        const a = Math.atan2(dy, dx) + off;
        mkEB(b, g, Math.cos(a) * spd, Math.sin(a) * spd, opts.clr);
      });
      break;
    }
    case 'sideAlternate': {
      const side = Math.floor(g.bossTimer * 2) % 2 === 0 ? -1 : 1;
      const ox = side * (b.r + 14);
      const baseA = Math.atan2(dy, dx);
      for (let j = 0; j < 3; j++) {
        const a = baseA + (j - 1) * 0.08;
        mkEB(b, g, Math.cos(a) * spd, Math.sin(a) * spd, '#ff8800', 5, ox);
      }
      break;
    }
    case 'laserSweep': {
      const { count, halfSpan, clr, spdF = 1 } = opts;
      for (let i = 0; i < count; i++) {
        const a = g.bossAngle + (-halfSpan + (i / (count - 1)) * halfSpan * 2);
        mkEB(b, g, Math.cos(a) * spd * spdF, Math.sin(a) * spd * spdF, clr);
      }
      mkEB(b, g, dx / d * spd, dy / d * spd, '#ffff44');
      break;
    }
    case 'scatter': {
      const { count, clr, spdF = 1 } = opts;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        mkEB(b, g, Math.cos(a) * spd * spdF, Math.sin(a) * spd * spdF, clr);
      }
      break;
    }
    case 'jitter': {
      mkEB(b, g, (Math.random() - 0.5) * 20, 12, opts.clr, 7);
      break;
    }
  }
}

export function fireBoss(g) {
  const b = g.boss;
  if (!g.player || g.player.dead || !b) return;
  const phasePatterns = b.patterns[g.bossPhase % b.patterns.length];
  const list = Array.isArray(phasePatterns) ? phasePatterns : [phasePatterns];
  list.forEach(p => firePattern(p.name, b, g, p));
}
```

Delete `fireBoss1()..fireBoss8()` and the old `fireBoss` switch.

- [ ] **Step 2: Verify the 7 behaviors reproduce `fireBoss1..8`**

Map check (each original function → the pattern objects that reproduce it):

| Original | Replaced by |
|---|---|
| `fireBoss1` p0/p1/p2 | `aimSpread{7,0.14,'#ff2200'}` / `aimBurst{[-0.08,0.08],'#ff8800'}` / `ring{8,0.7,'#cc00ff'}` (spd 175/35) |
| `fireBoss2` | `ring{8}` / `ring{12}` / `ring{16}` (spd 120/20, `'#4466ff'`) |
| `fireBoss3` | `sideAlternate` ×3 (spd 165/30) |
| `fireBoss4` | `[aimBurst{[-0.22,0,0.22],'#88cc00'}, jitter{'#44ee44'}]` ×3 (spd 140/25) |
| `fireBoss5` | `laserSweep{count:5,0.4,0.85,'#ffaa00'}` / `{7,…}` / `{9,…}` (spd 155/30) |
| `fireBoss6` | `aimSpread{5,0.175}` / `{6,0.14}` / `{7,0.1167}` / `{8,0.1}` (spd 160/28, `'#00ccff'`) |
| `fireBoss7` | `[aimBurst{[-0.06,0.06],'#aa44ff'}, scatter{2,0.7,'#cc88ff'}]` / `[...,scatter{3}]` / `[...,scatter{4}]` / `[...,scatter{5}]` (spd 200/35) |
| `fireBoss8` | `ring{8,0.65,'#ff2200'}` / `[ring{10,0.65,'#ff2200'}, aimBurst{[-0.10,0,0.10],'#ff8800'}]` / `[ring{12},aimBurst,scatter{4,0.75,'#ffaa00'}]` / `[ring{14},aimBurst,scatter{4}]` / `[ring{16},aimBurst,scatter{4}]` (spd 175/28) |

- [ ] **Step 3: Verify it parses**

Run: `node --check src/entities/Boss.js`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/entities/Boss.js
git commit -m "refactor: replace fireBoss1-8 with named reusable fire behaviors"
```

### Task 24: Draw archetypes take explicit parameters + tint

**Files:**
- Modify: `src/entities/Boss.js`

Refactor the 8 `drawBossN` functions to `drawBossN(c, b, angle, timer)` (ctx, boss object, `bossAngle`, `bossTimer`), render the archetype into an offscreen canvas sized to the boss, apply the `tint` via `source-atop` when set, and blit to the main canvas. This is what makes archetype reuse + recolor work for stages 9–18.

- [ ] **Step 1: Rewrite the draw dispatch**

```js
const offCanvas = document.createElement('canvas');

function drawBossArchetype(c, b, angle, timer) {
  switch (b.archetype) {
    case 1: drawBoss1(c, b, angle, timer); break;
    case 2: drawBoss2(c, b, angle, timer); break;
    case 3: drawBoss3(c, b, angle, timer); break;
    case 4: drawBoss4(c, b, angle, timer); break;
    case 5: drawBoss5(c, b, angle, timer); break;
    case 6: drawBoss6(c, b, angle, timer); break;
    case 7: drawBoss7(c, b, angle, timer); break;
    case 8: drawBoss8(c, b, angle, timer); break;
  }
}

export function drawBoss(g) {
  const b = g.boss;
  if (!b) return;
  const R = Math.ceil(b.r * 2.0) + 8;          // fits boss5's r*1.8 glow and boss8's pulsing outer
  offCanvas.width = offCanvas.height = R * 2;
  const oc = offCanvas.getContext('2d');
  oc.setTransform(1, 0, 0, 1, 0, 0);
  oc.clearRect(0, 0, R * 2, R * 2);
  drawBossArchetype(oc, { ...b, x: R, y: R }, g.bossAngle, g.bossTimer);
  if (b.tint) {
    oc.globalCompositeOperation = 'source-atop';
    oc.fillStyle = b.tint;
    oc.fillRect(0, 0, R * 2, R * 2);
    oc.globalCompositeOperation = 'source-over';
  }
  ctx.drawImage(offCanvas, b.x - R, b.y - R);
  drawBossHpBar(g);
}
```

- [ ] **Step 2: Rewrite the 8 archetype functions**

For each `drawBossN` (source index.html:1996–2224), apply this exact mechanical transform to the function header and body:

1. Signature: `drawBossN()` → `drawBossN(c, b, angle, timer)`.
2. `ctx` → `c` (all occurrences).
3. `boss` → `b` (all occurrences — these are already `.`-accessed, e.g. `boss.x`, `boss.r`, `boss.phantomAlpha`).
4. `bossAngle` → `angle`.
5. `bossTimer` → `timer`.

Worked example — `drawBoss1`:

```js
function drawBoss1(c, b, angle, timer) {
  c.save();
  c.translate(b.x, b.y);
  const grad = c.createRadialGradient(0, 0, 8, 0, 0, b.r);
  grad.addColorStop(0, '#ff6622'); grad.addColorStop(0.5, '#882211'); grad.addColorStop(1, '#330800');
  c.fillStyle = grad;
  c.beginPath(); c.arc(0, 0, b.r, 0, Math.PI*2); c.fill();
  c.save(); c.rotate(angle);
  for (let i = 0; i < 4; i++) {
    c.save(); c.rotate(i * Math.PI/2);
    c.fillStyle = '#bb3300';
    c.fillRect(-4, 0, 8, b.r * 0.88);
    c.fillStyle = '#ff7700';
    c.beginPath(); c.arc(0, b.r * 0.82, 9, 0, Math.PI*2); c.fill();
    c.restore();
  }
  c.restore();
  c.fillStyle = '#ffff00'; c.beginPath(); c.arc(0, 0, 13, 0, Math.PI*2); c.fill();
  c.fillStyle = '#ff0000'; c.beginPath(); c.arc(0, 0,  8, 0, Math.PI*2); c.fill();
  c.fillStyle = '#000';    c.beginPath(); c.arc(0, 0,  3, 0, Math.PI*2); c.fill();
  c.restore();
}
```

Apply the same substitution to `drawBoss2`–`drawBoss8` (index.html:2019–2224). Note `drawBoss7` uses `b.phantomAlpha` and `-angle * 1.2`; `drawBoss8` uses `timer * 2.2` for its pulse and `-angle * 0.5`.

- [ ] **Step 3: Remove the Phase A aliases**

Delete the module-level `let boss, bossAngle, bossTimer, bossPhase, bossMaxHp, player, enemyBullets, diffMult = 1.0;` line and the alias-set lines at the top of `updateBoss` (it now reads/writes `g.boss`, `g.bossPhase`, etc. directly). `drawBossHpBar(g)` stays as-is (reads `g.boss`/`g.bossMaxHp`).

- [ ] **Step 4: Verify it parses + tests still pass**

Run: `node --check src/entities/Boss.js && npm test`
Expected: no output, then PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/entities/Boss.js
git commit -m "refactor: parameterize boss draw archetypes (ctx, boss, angle, timer) + tint pass"
```

### Task 25: `createBoss` reads stage defs; boss `patterns` data for stages 1–8

**Files:**
- Modify: `src/entities/Boss.js`
- Modify: `src/stages/stageData.js`

`createBoss` now builds the boss from `STAGES[stage - 1].boss`. Add `patterns` arrays (and keep `archetype`, `tint`) to the 8 stage defs in `stageData.js` so stages 1–8 reproduce their original fire behavior exactly (per the Task 23 mapping table).

- [ ] **Step 1: Rewrite `createBoss` in `src/entities/Boss.js`**

```js
import { W, H, STATE, STAGE_COUNT } from '../config.js';
import { ctx } from '../canvas.js';
import { STAGES } from '../stages/stageData.js';
import { spawnExplosion } from '../core/particles.js';
import { mkEnemy, ENEMY_CFG } from './Enemy.js';

export function createBoss(g) {
  const def = STAGES[g.currentStage - 1].boss;
  g.bossMaxHp = def.hp;
  g.bossPhase = 0;
  g.bossTimer = 0;
  g.bossAngle = 0;
  return {
    stageNum: g.currentStage,
    archetype: def.archetype,
    tint: def.tint || null,
    x: W/2, y: 130,
    r: def.r,
    hp: def.hp,
    targetX: W/2, targetY: 130,
    spd: def.speed || 58,
    fireTimer: 1.8,
    phaseCount: def.phaseCount,
    spawnMinions: def.spawnMinions || false,
    patterns: def.patterns,
    minionTimer: 3.0,
    phantomAlpha: 1.0,
  };
}
```

Update `updateWaves` in `src/stages/waveGen.js`: `g.boss = createBoss(entry.boss, g);` → `g.boss = createBoss(g);`.

- [ ] **Step 2: Add `patterns` to the boss defs in `src/stages/stageData.js`**

For each of stages 1–8, replace `boss: { archetype: N, tint: null, r: ..., hp: ..., speed: 58, phaseCount: ..., spawnMinions: ... },` with the same object **plus** `patterns: [...]` per the Task 23 mapping table. The stage 1 boss becomes:

```js
boss: {
  archetype: 1, tint: null, r: 50, hp: 800, speed: 58, phaseCount: 3, spawnMinions: false,
  patterns: [
    { name: 'aimSpread', spdBase: 175, spdPhase: 35, count: 7, gap: 0.14, clr: '#ff2200' },
    { name: 'aimBurst',  spdBase: 175, spdPhase: 35, offsets: [-0.08, 0.08], clr: '#ff8800' },
    { name: 'ring',      spdBase: 175, spdPhase: 35, count: 8, spdF: 0.7, clr: '#cc00ff' },
  ],
},
```

And stages 2–8 respectively (full `patterns`):

```js
// stage 2
patterns: [
  { name: 'ring', spdBase: 120, spdPhase: 20, count: 8,  clr: '#4466ff' },
  { name: 'ring', spdBase: 120, spdPhase: 20, count: 12, clr: '#4466ff' },
  { name: 'ring', spdBase: 120, spdPhase: 20, count: 16, clr: '#4466ff' },
],
// stage 3
patterns: [
  { name: 'sideAlternate', spdBase: 165, spdPhase: 30 },
  { name: 'sideAlternate', spdBase: 165, spdPhase: 30 },
  { name: 'sideAlternate', spdBase: 165, spdPhase: 30 },
],
// stage 4
patterns: [
  [{ name: 'aimBurst', spdBase: 140, spdPhase: 25, offsets: [-0.22, 0, 0.22], clr: '#88cc00' },
   { name: 'jitter',   spdBase: 140, spdPhase: 25, clr: '#44ee44' }],
  [{ name: 'aimBurst', spdBase: 140, spdPhase: 25, offsets: [-0.22, 0, 0.22], clr: '#88cc00' },
   { name: 'jitter',   spdBase: 140, spdPhase: 25, clr: '#44ee44' }],
  [{ name: 'aimBurst', spdBase: 140, spdPhase: 25, offsets: [-0.22, 0, 0.22], clr: '#88cc00' },
   { name: 'jitter',   spdBase: 140, spdPhase: 25, clr: '#44ee44' }],
],
// stage 5
patterns: [
  { name: 'laserSweep', spdBase: 155, spdPhase: 30, count: 5, halfSpan: 0.40, spdF: 0.85, clr: '#ffaa00' },
  { name: 'laserSweep', spdBase: 155, spdPhase: 30, count: 7, halfSpan: 0.40, spdF: 0.85, clr: '#ffaa00' },
  { name: 'laserSweep', spdBase: 155, spdPhase: 30, count: 9, halfSpan: 0.40, spdF: 0.85, clr: '#ffaa00' },
],
// stage 6
patterns: [
  { name: 'aimSpread', spdBase: 160, spdPhase: 28, count: 5, gap: 0.175, clr: '#00ccff' },
  { name: 'aimSpread', spdBase: 160, spdPhase: 28, count: 6, gap: 0.14,  clr: '#00ccff' },
  { name: 'aimSpread', spdBase: 160, spdPhase: 28, count: 7, gap: 0.1167, clr: '#00ccff' },
  { name: 'aimSpread', spdBase: 160, spdPhase: 28, count: 8, gap: 0.1,   clr: '#00ccff' },
],
// stage 7
patterns: [
  [{ name: 'aimBurst', spdBase: 200, spdPhase: 35, offsets: [-0.06, 0.06], clr: '#aa44ff' },
   { name: 'scatter',  spdBase: 200, spdPhase: 35, count: 2, spdF: 0.7, clr: '#cc88ff' }],
  [{ name: 'aimBurst', spdBase: 200, spdPhase: 35, offsets: [-0.06, 0.06], clr: '#aa44ff' },
   { name: 'scatter',  spdBase: 200, spdPhase: 35, count: 3, spdF: 0.7, clr: '#cc88ff' }],
  [{ name: 'aimBurst', spdBase: 200, spdPhase: 35, offsets: [-0.06, 0.06], clr: '#aa44ff' },
   { name: 'scatter',  spdBase: 200, spdPhase: 35, count: 4, spdF: 0.7, clr: '#cc88ff' }],
  [{ name: 'aimBurst', spdBase: 200, spdPhase: 35, offsets: [-0.06, 0.06], clr: '#aa44ff' },
   { name: 'scatter',  spdBase: 200, spdPhase: 35, count: 5, spdF: 0.7, clr: '#cc88ff' }],
],
// stage 8
patterns: [
  { name: 'ring', spdBase: 175, spdPhase: 28, count: 8,  spdF: 0.65, clr: '#ff2200' },
  [{ name: 'ring',     spdBase: 175, spdPhase: 28, count: 10, spdF: 0.65, clr: '#ff2200' },
   { name: 'aimBurst', spdBase: 175, spdPhase: 28, offsets: [-0.10, 0, 0.10], clr: '#ff8800' }],
  [{ name: 'ring',     spdBase: 175, spdPhase: 28, count: 12, spdF: 0.65, clr: '#ff2200' },
   { name: 'aimBurst', spdBase: 175, spdPhase: 28, offsets: [-0.10, 0, 0.10], clr: '#ff8800' },
   { name: 'scatter',  spdBase: 175, spdPhase: 28, count: 4, spdF: 0.75, clr: '#ffaa00' }],
  [{ name: 'ring',     spdBase: 175, spdPhase: 28, count: 14, spdF: 0.65, clr: '#ff2200' },
   { name: 'aimBurst', spdBase: 175, spdPhase: 28, offsets: [-0.10, 0, 0.10], clr: '#ff8800' },
   { name: 'scatter',  spdBase: 175, spdPhase: 28, count: 4, spdF: 0.75, clr: '#ffaa00' }],
  [{ name: 'ring',     spdBase: 175, spdPhase: 28, count: 16, spdF: 0.65, clr: '#ff2200' },
   { name: 'aimBurst', spdBase: 175, spdPhase: 28, offsets: [-0.10, 0, 0.10], clr: '#ff8800' },
   { name: 'scatter',  spdBase: 175, spdPhase: 28, count: 4, spdF: 0.75, clr: '#ffaa00' }],
],
```

- [ ] **Step 3: Update `updateBoss` special cases**

In `src/entities/Boss.js`, `updateBoss(dt, g)` (ported in Task 14) must reference `g.boss`/`g.bossPhase`/`g.bossMaxHp`/`g.bossTimer`/`g.bossAngle` directly (aliases removed) and the phantom-alpha line `if (boss.stageNum === 7)` becomes `if (g.boss.archetype === 7)`.

- [ ] **Step 4: Verify it parses + tests pass**

Run: `node --check src/entities/Boss.js && node --check src/stages/stageData.js && node --check src/stages/waveGen.js && npm test`
Expected: no output, then PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/entities/Boss.js src/stages/stageData.js src/stages/waveGen.js
git commit -m "refactor: createBoss reads stage defs; stages 1-8 boss patterns added"
```

### Task 26: Checkpoint 3 — verify boss fights are unchanged

- [ ] **Step 1: Playtest boss fights 1–8**

Run: `npm run dev`. Fight each boss to the kill: same visuals (archetype + no tint ⇒ same pixels), same bullets per phase, same minions, same HP bar, same phantom alpha on stage 7, same death sequence and STAGECLEAR/VICTORY flow.

- [ ] **Step 2: Fix any drift**

Boss bullets differ? Diff the stage's `patterns` against `fireBossN` from the pre-cutover monolith (`git show <pre-cutover-commit>:index.html`). Fix the pattern params. Replay.

- [ ] **Step 3: Commit any fixes**

`git commit -am "fix: boss behavior parity after parameterization"`

---

## Phase D — Stages 9–18

### Task 27: Author `STAGES[9..18]` + `STAGE_COUNT = 18`

**Files:**
- Modify: `src/config.js` (`STAGE_COUNT` → 18)
- Modify: `src/stages/stageData.js` (append 10 stage defs)

Each new stage: distinct `bg` (`baseFill`, `starColor` or `null`, `features` from the existing set), a denser wave script authored from the descriptor vocabulary, and a boss that reuses an existing archetype with a `tint` and a pattern mix from the 7 behaviors. Boss `hp`/`phaseCount` here are starting values; Phase E's formulas supersede them.

- [ ] **Step 1: Update `STAGE_COUNT` in `src/config.js`**

`export const STAGE_COUNT = 8;` → `export const STAGE_COUNT = 18;`

- [ ] **Step 2: Append stages 9–18 to `src/stages/stageData.js`** (before the closing `];`)

```js
  // Stage 9 — deep sea
  {
    id: 9,
    bg: { baseFill: '#001a1a', starColor: ['rgba(100,220,220,0.3)', 'rgba(130,240,240,0.5)', 'rgba(180,255,255,0.8)'], features: ['bubbles'] },
    waves: [
      ...[0,1,2,3,4,5,6].map(i => ({ t: 0.5 + i*0.15, type: 0, path: ['form', W/2, -20, 200, i, 7] })),
      { t: 3, type: 3, x: 120, y: 260 },
      { t: 3, type: 3, x: 360, y: 260 },
      ...[0,1,2].map(i => ({ t: 4 + i*0.5, type: 1, path: ['down', W*0.25, -30, 110] })),
      ...[0,1,2].map(i => ({ t: 4 + i*0.5, type: 1, path: ['down', W*0.75, -30, 110] })),
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 8 + i*0.12, type: 0, path: ['sin', W*0.1 + i*52, -20, 190, 35, 2.2] })),
      { t: 10, type: 2, path: ['down', W*0.5, -40, 52] },
      ...[0,1,2,3,4].map(i => ({ t: 13 + i*0.3, type: 0, path: ['form', W/2, -20, 215, i, 5] })),
      { t: 16, type: 3, x: 80,  y: 240 },
      { t: 16, type: 3, x: 240, y: 200 },
      { t: 16, type: 3, x: 400, y: 240 },
      { t: 19, type: 2, path: ['down', W*0.33, -40, 48] },
      { t: 19, type: 2, path: ['down', W*0.67, -40, 48] },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 23 + i*0.12, type: 0, path: ['form', W/2, -20, 240, i, 8] })),
      { t: 28, boss: 9 },
    ],
    boss: {
      archetype: 2, tint: '#44ddff', r: 65, hp: 2500, speed: 62, phaseCount: 4, spawnMinions: false,
      patterns: [
        { name: 'ring',       spdBase: 190, spdPhase: 30, count: 8,  clr: '#44ddff' },
        { name: 'aimSpread',  spdBase: 190, spdPhase: 30, count: 5,  gap: 0.16, clr: '#44ddff' },
        { name: 'ring',       spdBase: 190, spdPhase: 30, count: 12, clr: '#44ddff' },
        { name: 'aimBurst',   spdBase: 190, spdPhase: 30, offsets: [-0.10, 0, 0.10], clr: '#88eeff' },
      ],
    },
  },

  // Stage 10 — lava
  {
    id: 10,
    bg: { baseFill: '#1a0a00', starColor: null, features: ['streaks'] },
    waves: [
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 0.5 + i*0.13, type: 0, path: ['form', W/2, -20, 205, i, 8] })),
      { t: 2, type: 3, x: 100, y: 250 },
      { t: 2, type: 3, x: 380, y: 250 },
      ...[0,1,2].map(i => ({ t: 3 + i*0.4, type: 1, path: ['down', W*0.3, -30, 115] })),
      ...[0,1,2].map(i => ({ t: 3 + i*0.4, type: 1, path: ['down', W*0.7, -30, 115] })),
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 6 + i*0.12, type: 0, path: ['sin', W*0.1 + i*55, -20, 195, 38, 2.0] })),
      { t: 9, type: 2, path: ['down', W*0.5, -40, 54] },
      ...[0,1,2,3,4,5].map(i => ({ t: 12 + i*0.25, type: 0, path: ['form', W/2, -20, 220, i, 6] })),
      { t: 15, type: 3, x: 120, y: 220 },
      { t: 15, type: 3, x: 240, y: 180 },
      { t: 15, type: 3, x: 360, y: 220 },
      { t: 17, type: 2, path: ['down', W*0.33, -40, 50] },
      { t: 17, type: 2, path: ['down', W*0.67, -40, 50] },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 21 + i*0.12, type: 0, path: ['form', W/2, -20, 245, i, 8] })),
      { t: 27, boss: 10 },
    ],
    boss: {
      archetype: 4, tint: '#ff8844', r: 58, hp: 2700, speed: 62, phaseCount: 4, spawnMinions: false,
      patterns: [
        [{ name: 'aimBurst',  spdBase: 185, spdPhase: 30, offsets: [-0.22, 0, 0.22], clr: '#ff8844' },
         { name: 'jitter',    spdBase: 185, spdPhase: 30, clr: '#ffcc44' }],
        { name: 'laserSweep', spdBase: 185, spdPhase: 30, count: 7, halfSpan: 0.40, spdF: 0.85, clr: '#ffcc44' },
        { name: 'aimSpread',  spdBase: 185, spdPhase: 30, count: 7, gap: 0.14, clr: '#ff5500' },
        { name: 'scatter',    spdBase: 185, spdPhase: 30, count: 4, clr: '#ff8844' },
      ],
    },
  },

  // Stage 11 — storm
  {
    id: 11,
    bg: { baseFill: '#05051a', starColor: ['rgba(180,180,255,0.3)', 'rgba(200,200,255,0.5)', 'rgba(240,240,255,0.9)'], features: ['clouds'] },
    waves: [
      ...[0,1,2,3,4,5].map(i => ({ t: 0.5 + i*0.16, type: 0, path: ['form', W/2, -20, 210, i, 6] })),
      ...[0,1,2].map(i => ({ t: 2 + i*0.5, type: 1, path: ['down', W*0.2, -30, 118] })),
      ...[0,1,2].map(i => ({ t: 2 + i*0.5, type: 1, path: ['down', W*0.8, -30, 118] })),
      { t: 4, type: 3, x: 100, y: 240 },
      { t: 4, type: 3, x: 380, y: 240 },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 7 + i*0.11, type: 0, path: ['sin', W*0.1 + i*55, -20, 200, 40, 2.2] })),
      { t: 9, type: 2, path: ['down', W*0.3, -40, 56] },
      { t: 9, type: 2, path: ['down', W*0.7, -40, 56] },
      ...[0,1,2,3,4].map(i => ({ t: 12 + i*0.2, type: 0, path: ['form', W/2, -20, 225, i, 5] })),
      { t: 15, type: 3, x: 80,  y: 260 },
      { t: 15, type: 3, x: 240, y: 220 },
      { t: 15, type: 3, x: 400, y: 260 },
      ...[0,1,2,3].map(i => ({ t: 18 + i*0.5, type: 1, path: ['sin', W*0.35, -30, 118, 45, 1.6] })),
      { t: 21, type: 2, path: ['down', W*0.5, -40, 54] },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 24 + i*0.11, type: 0, path: ['form', W/2, -20, 250, i, 8] })),
      { t: 30, boss: 11 },
    ],
    boss: {
      archetype: 6, tint: '#33ff99', r: 68, hp: 2900, speed: 60, phaseCount: 5, spawnMinions: true,
      patterns: [
        { name: 'aimSpread', spdBase: 175, spdPhase: 30, count: 5, gap: 0.16, clr: '#33ff99' },
        { name: 'aimSpread', spdBase: 175, spdPhase: 30, count: 6, gap: 0.14, clr: '#33ff99' },
        [{ name: 'ring',      spdBase: 175, spdPhase: 30, count: 10, clr: '#33ff99' },
         { name: 'aimBurst',  spdBase: 175, spdPhase: 30, offsets: [-0.08, 0.08], clr: '#66ffbb' }],
        [{ name: 'aimSpread', spdBase: 175, spdPhase: 30, count: 7, gap: 0.14, clr: '#33ff99' },
         { name: 'scatter',   spdBase: 175, spdPhase: 30, count: 2, clr: '#99ffcc' }],
        { name: 'laserSweep', spdBase: 175, spdPhase: 30, count: 9, halfSpan: 0.40, spdF: 0.85, clr: '#33ff99' },
      ],
    },
  },

  // Stage 12 — void
  {
    id: 12,
    bg: { baseFill: '#000000', starColor: null, features: ['wisps'] },
    waves: [
      { t: 1, type: 3, x: 120, y: 260 },
      { t: 1, type: 3, x: 360, y: 260 },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 2 + i*0.12, type: 0, path: ['form', W/2, -20, 215, i, 8] })),
      ...[0,1,2,3].map(i => ({ t: 4 + i*0.4, type: 1, path: ['down', W*0.25, -30, 120] })),
      ...[0,1,2,3].map(i => ({ t: 4 + i*0.4, type: 1, path: ['down', W*0.75, -30, 120] })),
      { t: 8, type: 2, path: ['down', W*0.5, -40, 58] },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 10 + i*0.11, type: 0, path: ['sin', W*0.1 + i*55, -20, 205, 42, 2.0] })),
      { t: 13, type: 3, x: 100, y: 240 },
      { t: 13, type: 3, x: 240, y: 200 },
      { t: 13, type: 3, x: 380, y: 240 },
      ...[0,1,2,3,4,5].map(i => ({ t: 16 + i*0.22, type: 0, path: ['form', W/2, -20, 230, i, 6] })),
      { t: 19, type: 2, path: ['down', W*0.33, -40, 56 ] },
      { t: 19, type: 2, path: ['down', W*0.67, -40, 56 ] },
      ...[0,1,2].map(i => ({ t: 22 + i*0.6, type: 1, path: ['sin', W*0.5, -30, 120, 50, 1.7] })),
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 26 + i*0.11, type: 0, path: ['form', W/2, -20, 260, i, 8] })),
      { t: 31, boss: 12 },
    ],
    boss: {
      archetype: 1, tint: '#ff66aa', r: 55, hp: 3100, speed: 62, phaseCount: 5, spawnMinions: false,
      patterns: [
        { name: 'aimSpread', spdBase: 190, spdPhase: 32, count: 7, gap: 0.14, clr: '#ff66aa' },
        { name: 'aimBurst',  spdBase: 190, spdPhase: 32, offsets: [-0.08, 0.08], clr: '#ff88bb' },
        [{ name: 'ring',     spdBase: 190, spdPhase: 32, count: 8,  clr: '#ff66aa' },
         { name: 'scatter',  spdBase: 190, spdPhase: 32, count: 2,  clr: '#ff88bb' }],
        { name: 'laserSweep', spdBase: 190, spdPhase: 32, count: 7, halfSpan: 0.40, spdF: 0.85, clr: '#ff66aa' },
        [{ name: 'aimSpread', spdBase: 190, spdPhase: 32, count: 9, gap: 0.12, clr: '#ff66aa' },
         { name: 'aimBurst',  spdBase: 190, spdPhase: 32, offsets: [-0.08, 0.08], clr: '#ff88bb' }],
      ],
    },
  },

  // Stage 13 — burning sector
  {
    id: 13,
    bg: { baseFill: '#1a0000', starColor: ['rgba(255,120,60,0.3)', 'rgba(255,150,80,0.5)', 'rgba(255,200,120,0.9)'], features: ['rocks'] },
    waves: [
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 0.5 + i*0.12, type: 0, path: ['form', W/2, -20, 220, i, 8] })),
      { t: 2, type: 3, x: 80,  y: 250 },
      { t: 2, type: 3, x: 240, y: 210 },
      { t: 2, type: 3, x: 400, y: 250 },
      ...[0,1,2,3].map(i => ({ t: 4 + i*0.4, type: 1, path: ['down', W*0.2, -30, 122] })),
      ...[0,1,2,3].map(i => ({ t: 4 + i*0.4, type: 1, path: ['down', W*0.8, -30, 122] })),
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 8 + i*0.11, type: 0, path: ['sin', W*0.1 + i*55, -20, 210, 40, 2.2] })),
      { t: 11, type: 2, path: ['down', W*0.5, -40, 60] },
      ...[0,1,2,3,4,5].map(i => ({ t: 14 + i*0.2, type: 0, path: ['form', W/2, -20, 235, i, 6] })),
      { t: 17, type: 3, x: 120, y: 230 },
      { t: 17, type: 3, x: 360, y: 230 },
      { t: 19, type: 2, path: ['down', W*0.3, -40, 58] },
      { t: 19, type: 2, path: ['down', W*0.7, -40, 58] },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 22 + i*0.11, type: 0, path: ['form', W/2, -20, 265, i, 8] })),
      { t: 28, boss: 13 },
    ],
    boss: {
      archetype: 7, tint: '#ffcc00', r: 55, hp: 3300, speed: 60, phaseCount: 5, spawnMinions: false,
      patterns: [
        [{ name: 'aimBurst', spdBase: 200, spdPhase: 35, offsets: [-0.06, 0.06], clr: '#ffcc00' },
         { name: 'scatter',  spdBase: 200, spdPhase: 35, count: 2, spdF: 0.7, clr: '#ffee66' }],
        [{ name: 'aimBurst', spdBase: 200, spdPhase: 35, offsets: [-0.06, 0.06], clr: '#ffcc00' },
         { name: 'scatter',  spdBase: 200, spdPhase: 35, count: 3, spdF: 0.7, clr: '#ffee66' }],
        { name: 'sideAlternate', spdBase: 200, spdPhase: 35 },
        [{ name: 'aimSpread', spdBase: 200, spdPhase: 35, count: 9, gap: 0.12, clr: '#ffcc00' },
         { name: 'aimBurst',  spdBase: 200, spdPhase: 35, offsets: [-0.06, 0.06], clr: '#ffee66' }],
        { name: 'scatter', spdBase: 200, spdPhase: 35, count: 6, spdF: 0.7, clr: '#ffcc00' },
      ],
    },
  },

  // Stage 14 — reactor core
  {
    id: 14,
    bg: { baseFill: '#051008', starColor: null, features: ['hulls'] },
    waves: [
      { t: 1, type: 3, x: 160, y: 250 },
      { t: 1, type: 3, x: 320, y: 250 },
      ...[0,1,2,3,4,5].map(i => ({ t: 2 + i*0.18, type: 0, path: ['form', W/2, -20, 225, i, 6] })),
      ...[0,1,2,3].map(i => ({ t: 4 + i*0.4, type: 1, path: ['down', W*0.25, -30, 125] })),
      ...[0,1,2,3].map(i => ({ t: 4 + i*0.4, type: 1, path: ['down', W*0.75, -30, 125] })),
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 8 + i*0.11, type: 0, path: ['sin', W*0.1 + i*55, -20, 215, 42, 2.0] })),
      { t: 11, type: 2, path: ['down', W*0.5, -40, 62] },
      ...[0,1,2,3,4].map(i => ({ t: 14 + i*0.22, type: 0, path: ['form', W/2, -20, 240, i, 5] })),
      { t: 17, type: 3, x: 80,  y: 240 },
      { t: 17, type: 3, x: 240, y: 200 },
      { t: 17, type: 3, x: 400, y: 240 },
      { t: 20, type: 2, path: ['down', W*0.33, -40, 60] },
      { t: 20, type: 2, path: ['down', W*0.67, -40, 60] },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 24 + i*0.11, type: 0, path: ['form', W/2, -20, 270, i, 8] })),
      { t: 30, boss: 14 },
    ],
    boss: {
      archetype: 5, tint: '#ff3355', r: 55, hp: 3500, speed: 58, phaseCount: 5, spawnMinions: false,
      patterns: [
        { name: 'laserSweep', spdBase: 165, spdPhase: 30, count: 7, halfSpan: 0.40, spdF: 0.85, clr: '#ff3355' },
        [{ name: 'ring',      spdBase: 165, spdPhase: 30, count: 10, clr: '#ff3355' },
         { name: 'aimBurst',  spdBase: 165, spdPhase: 30, offsets: [-0.08, 0.08], clr: '#ff5577' }],
        [{ name: 'laserSweep', spdBase: 165, spdPhase: 30, count: 9, halfSpan: 0.40, spdF: 0.85, clr: '#ff3355' },
         { name: 'scatter',    spdBase: 165, spdPhase: 30, count: 2, clr: '#ff5577' }],
        { name: 'aimSpread', spdBase: 165, spdPhase: 30, count: 9, gap: 0.12, clr: '#ff3355' },
        [{ name: 'ring',       spdBase: 165, spdPhase: 30, count: 14, clr: '#ff3355' },
         { name: 'laserSweep', spdBase: 165, spdPhase: 30, count: 7, halfSpan: 0.40, spdF: 0.85, clr: '#ff5577' }],
      ],
    },
  },

  // Stage 15 — fortress wall
  {
    id: 15,
    bg: { baseFill: '#0a0008', starColor: ['rgba(255,100,180,0.3)', 'rgba(255,120,200,0.5)', 'rgba(255,160,220,0.9)'], features: ['walls'] },
    waves: [
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 0.5 + i*0.11, type: 0, path: ['form', W/2, -20, 230, i, 8], elite: true })),
      { t: 2, type: 3, x: 120, y: 250, elite: true },
      { t: 2, type: 3, x: 360, y: 250, elite: true },
      ...[0,1,2,3].map(i => ({ t: 4 + i*0.35, type: 1, path: ['down', W*0.2, -30, 128] })),
      ...[0,1,2,3].map(i => ({ t: 4 + i*0.35, type: 1, path: ['down', W*0.8, -30, 128] })),
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 7 + i*0.10, type: 0, path: ['sin', W*0.1 + i*55, -20, 220, 42, 2.2] })),
      { t: 10, type: 2, path: ['down', W*0.5, -40, 64] },
      ...[0,1,2,3,4,5].map(i => ({ t: 13 + i*0.18, type: 0, path: ['form', W/2, -20, 245, i, 6] })),
      { t: 16, type: 3, x: 80,  y: 230, elite: true },
      { t: 16, type: 3, x: 240, y: 190, elite: true },
      { t: 16, type: 3, x: 400, y: 230, elite: true },
      { t: 19, type: 2, path: ['down', W*0.33, -40, 62] },
      { t: 19, type: 2, path: ['down', W*0.67, -40, 62] },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 23 + i*0.10, type: 0, path: ['form', W/2, -20, 275, i, 8], elite: true })),
      { t: 29, boss: 15 },
    ],
    boss: {
      archetype: 3, tint: '#dd44ff', r: 58, hp: 3700, speed: 60, phaseCount: 6, spawnMinions: false,
      patterns: [
        { name: 'aimSpread', spdBase: 195, spdPhase: 34, count: 5, gap: 0.16, clr: '#dd44ff' },
        { name: 'aimSpread', spdBase: 195, spdPhase: 34, count: 7, gap: 0.14, clr: '#dd44ff' },
        [{ name: 'ring',     spdBase: 195, spdPhase: 34, count: 10, clr: '#dd44ff' },
         { name: 'aimBurst', spdBase: 195, spdPhase: 34, offsets: [-0.08, 0.08], clr: '#ee66ff' }],
        [{ name: 'sideAlternate', spdBase: 195, spdPhase: 34 },
         { name: 'scatter',       spdBase: 195, spdPhase: 34, count: 2, clr: '#ee66ff' }],
        { name: 'laserSweep', spdBase: 195, spdPhase: 34, count: 9, halfSpan: 0.40, spdF: 0.85, clr: '#dd44ff' },
        [{ name: 'ring',     spdBase: 195, spdPhase: 34, count: 14, clr: '#dd44ff' },
         { name: 'scatter',  spdBase: 195, spdPhase: 34, count: 4, clr: '#ee66ff' }],
      ],
    },
  },

  // Stage 16 — crimson cavern
  {
    id: 16,
    bg: { baseFill: '#1a0005', starColor: null, features: ['bubbles'] },
    waves: [
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 0.5 + i*0.11, type: 0, path: ['form', W/2, -20, 235, i, 8], elite: true })),
      { t: 2, type: 3, x: 100, y: 240, elite: true },
      { t: 2, type: 3, x: 380, y: 240, elite: true },
      ...[0,1,2,3].map(i => ({ t: 3 + i*0.35, type: 1, path: ['down', W*0.25, -30, 130] })),
      ...[0,1,2,3].map(i => ({ t: 3 + i*0.35, type: 1, path: ['down', W*0.75, -30, 130] })),
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 6 + i*0.10, type: 0, path: ['sin', W*0.1 + i*55, -20, 225, 42, 2.2] })),
      { t: 9, type: 2, path: ['down', W*0.5, -40, 66] },
      ...[0,1,2,3,4,5].map(i => ({ t: 12 + i*0.18, type: 0, path: ['form', W/2, -20, 250, i, 6] })),
      { t: 15, type: 3, x: 120, y: 230, elite: true },
      { t: 15, type: 3, x: 360, y: 230, elite: true },
      { t: 18, type: 2, path: ['down', W*0.3, -40, 64] },
      { t: 18, type: 2, path: ['down', W*0.7, -40, 64] },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 22 + i*0.10, type: 0, path: ['form', W/2, -20, 280, i, 8], elite: true })),
      { t: 29, boss: 16 },
    ],
    boss: {
      archetype: 8, tint: '#00ccff', r: 78, hp: 3900, speed: 58, phaseCount: 6, spawnMinions: true,
      patterns: [
        { name: 'ring', spdBase: 190, spdPhase: 30, count: 8,  spdF: 0.65, clr: '#00ccff' },
        [{ name: 'ring',     spdBase: 190, spdPhase: 30, count: 10, spdF: 0.65, clr: '#00ccff' },
         { name: 'aimBurst', spdBase: 190, spdPhase: 30, offsets: [-0.10, 0, 0.10], clr: '#33ddff' }],
        [{ name: 'ring',     spdBase: 190, spdPhase: 30, count: 12, spdF: 0.65, clr: '#00ccff' },
         { name: 'aimBurst', spdBase: 190, spdPhase: 30, offsets: [-0.10, 0, 0.10], clr: '#33ddff' },
         { name: 'scatter',  spdBase: 190, spdPhase: 30, count: 2, spdF: 0.75, clr: '#66eeff' }],
        [{ name: 'laserSweep', spdBase: 190, spdPhase: 30, count: 9, halfSpan: 0.40, spdF: 0.85, clr: '#00ccff' },
         { name: 'scatter',    spdBase: 190, spdPhase: 30, count: 3, spdF: 0.75, clr: '#66eeff' }],
        [{ name: 'aimSpread', spdBase: 190, spdPhase: 30, count: 9, gap: 0.12, clr: '#00ccff' },
         { name: 'ring',      spdBase: 190, spdPhase: 30, count: 10, spdF: 0.65, clr: '#33ddff' }],
        [{ name: 'ring',     spdBase: 190, spdPhase: 30, count: 16, spdF: 0.65, clr: '#00ccff' },
         { name: 'aimBurst', spdBase: 190, spdPhase: 30, offsets: [-0.10, 0, 0.10], clr: '#33ddff' },
         { name: 'scatter',  spdBase: 190, spdPhase: 30, count: 4, spdF: 0.75, clr: '#66eeff' }],
      ],
    },
  },

  // Stage 17 — astral gate
  {
    id: 17,
    bg: { baseFill: '#05001a', starColor: ['rgba(180,140,255,0.3)', 'rgba(200,160,255,0.5)', 'rgba(240,200,255,0.9)'], features: ['wisps'] },
    waves: [
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 0.5 + i*0.10, type: 0, path: ['form', W/2, -20, 240, i, 8], elite: true })),
      { t: 2, type: 3, x: 120, y: 250, elite: true },
      { t: 2, type: 3, x: 240, y: 210, elite: true },
      { t: 2, type: 3, x: 360, y: 250, elite: true },
      ...[0,1,2,3].map(i => ({ t: 4 + i*0.3, type: 1, path: ['down', W*0.2, -30, 132] })),
      ...[0,1,2,3].map(i => ({ t: 4 + i*0.3, type: 1, path: ['down', W*0.8, -30, 132] })),
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 7 + i*0.10, type: 0, path: ['sin', W*0.1 + i*55, -20, 230, 44, 2.2] })),
      { t: 10, type: 2, path: ['down', W*0.5, -40, 68] },
      ...[0,1,2,3,4,5].map(i => ({ t: 13 + i*0.16, type: 0, path: ['form', W/2, -20, 255, i, 6] })),
      { t: 16, type: 3, x: 80,  y: 230, elite: true },
      { t: 16, type: 3, x: 240, y: 190, elite: true },
      { t: 16, type: 3, x: 400, y: 230, elite: true },
      { t: 19, type: 2, path: ['down', W*0.33, -40, 66] },
      { t: 19, type: 2, path: ['down', W*0.67, -40, 66] },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 23 + i*0.10, type: 0, path: ['form', W/2, -20, 285, i, 8], elite: true })),
      { t: 30, boss: 17 },
    ],
    boss: {
      archetype: 2, tint: '#ff4444', r: 70, hp: 4100, speed: 60, phaseCount: 6, spawnMinions: false,
      patterns: [
        [{ name: 'ring',     spdBase: 200, spdPhase: 36, count: 10, clr: '#ff4444' },
         { name: 'scatter',  spdBase: 200, spdPhase: 36, count: 2, clr: '#ff6666' }],
        [{ name: 'aimSpread', spdBase: 200, spdPhase: 36, count: 9, gap: 0.12, clr: '#ff4444' },
         { name: 'aimBurst',  spdBase: 200, spdPhase: 36, offsets: [-0.08, 0.08], clr: '#ff6666' }],
        [{ name: 'ring',     spdBase: 200, spdPhase: 36, count: 14, clr: '#ff4444' },
         { name: 'aimBurst', spdBase: 200, spdPhase: 36, offsets: [-0.08, 0.08], clr: '#ff6666' }],
        [{ name: 'laserSweep', spdBase: 200, spdPhase: 36, count: 9, halfSpan: 0.40, spdF: 0.85, clr: '#ff4444' },
         { name: 'scatter',    spdBase: 200, spdPhase: 36, count: 3, clr: '#ff6666' }],
        [{ name: 'aimSpread', spdBase: 200, spdPhase: 36, count: 11, gap: 0.10, clr: '#ff4444' },
         { name: 'ring',      spdBase: 200, spdPhase: 36, count: 12, clr: '#ff6666' }],
        [{ name: 'ring',     spdBase: 200, spdPhase: 36, count: 18, clr: '#ff4444' },
         { name: 'aimBurst', spdBase: 200, spdPhase: 36, offsets: [-0.08, 0.08], clr: '#ff6666' },
         { name: 'scatter',  spdBase: 200, spdPhase: 36, count: 5, clr: '#ff8888' }],
      ],
    },
  },

  // Stage 18 — final gate
  {
    id: 18,
    bg: { baseFill: '#100000', starColor: null, features: ['walls'] },
    waves: [
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 0.5 + i*0.10, type: 0, path: ['form', W/2, -20, 245, i, 8], elite: true })),
      { t: 2, type: 3, x: 80,  y: 250, elite: true },
      { t: 2, type: 3, x: 240, y: 210, elite: true },
      { t: 2, type: 3, x: 400, y: 250, elite: true },
      ...[0,1,2,3].map(i => ({ t: 4 + i*0.3, type: 1, path: ['down', W*0.2, -30, 135] })),
      ...[0,1,2,3].map(i => ({ t: 4 + i*0.3, type: 1, path: ['down', W*0.8, -30, 135] })),
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 7 + i*0.10, type: 0, path: ['sin', W*0.1 + i*55, -20, 235, 44, 2.2] })),
      { t: 10, type: 2, path: ['down', W*0.5, -40, 70] },
      ...[0,1,2,3,4,5].map(i => ({ t: 13 + i*0.16, type: 0, path: ['form', W/2, -20, 260, i, 6] })),
      { t: 16, type: 3, x: 120, y: 230, elite: true },
      { t: 16, type: 3, x: 360, y: 230, elite: true },
      { t: 19, type: 2, path: ['down', W*0.3, -40, 68] },
      { t: 19, type: 2, path: ['down', W*0.7, -40, 68] },
      ...[0,1,2,3,4,5,6,7].map(i => ({ t: 23 + i*0.10, type: 0, path: ['form', W/2, -20, 290, i, 8], elite: true })),
      { t: 30, boss: 18 },
    ],
    boss: {
      archetype: 8, tint: '#ff2222', r: 80, hp: 4500, speed: 58, phaseCount: 6, spawnMinions: true,
      patterns: [
        [{ name: 'laserSweep', spdBase: 210, spdPhase: 38, count: 9, halfSpan: 0.40, spdF: 0.85, clr: '#ff2222' },
         { name: 'ring',       spdBase: 210, spdPhase: 38, count: 8,  clr: '#ff4444' }],
        [{ name: 'aimSpread', spdBase: 210, spdPhase: 38, count: 11, gap: 0.10, clr: '#ff2222' },
         { name: 'scatter',   spdBase: 210, spdPhase: 38, count: 2, spdF: 0.75, clr: '#ff6644' }],
        [{ name: 'ring',     spdBase: 210, spdPhase: 38, count: 14, clr: '#ff2222' },
         { name: 'aimBurst', spdBase: 210, spdPhase: 38, offsets: [-0.10, 0, 0.10], clr: '#ff4444' }],
        [{ name: 'aimSpread', spdBase: 210, spdPhase: 38, count: 13, gap: 0.09, clr: '#ff2222' },
         { name: 'ring',      spdBase: 210, spdPhase: 38, count: 14, clr: '#ff4444' }],
        [{ name: 'laserSweep', spdBase: 210, spdPhase: 38, count: 11, halfSpan: 0.40, spdF: 0.85, clr: '#ff2222' },
         { name: 'scatter',    spdBase: 210, spdPhase: 38, count: 4, spdF: 0.75, clr: '#ff6644' }],
        [{ name: 'ring',     spdBase: 210, spdPhase: 38, count: 20, clr: '#ff2222' },
         { name: 'aimSpread', spdBase: 210, spdPhase: 38, count: 11, gap: 0.10, clr: '#ff4444' },
         { name: 'scatter',  spdBase: 210, spdPhase: 38, count: 5, spdF: 0.75, clr: '#ff6644' }],
      ],
    },
  },
];
```

- [ ] **Step 3: Verify it parses + tests pass**

Run: `node --check src/stages/stageData.js && npm test`
Expected: no output, then PASS (6 tests — the wavegen tests only assert stages 1–8, so they still pass).

- [ ] **Step 4: Playtest stage progression**

Run: `npm run dev`. Use the dev console to force-start mid stages if desired (`game.startStage(9)` from DevTools — `game` is not exposed globally; instead temporarily add `window.game = game;` in `src/main.js`, playtest, then remove). Confirm stages 9–18 all run: waves spawn, bosses appear with correct archetype/tint/patterns, STAGECLEAR advances to the next stage, and VICTORY appears after stage 18.

- [ ] **Step 5: Commit**

```bash
git add src/config.js src/stages/stageData.js
git commit -m "feat: add stages 9-18 (data + boss configs), STAGE_COUNT=18"
```

---

## Phase E — Difficulty Curve

### Task 28: Steeper multi-lever difficulty via `difficulty.js`

**Files:**
- Modify: `src/core/difficulty.js` (replace constants + add levers)
- Modify: `src/entities/Enemy.js` (`mkEnemy`, `fireEnemy`)
- Modify: `src/entities/Boss.js` (`createBoss`)
- Modify: `src/stages/waveGen.js` (`updateWaves` boss call + enemy hp scaling)
- Modify: `tests/difficulty.test.js`

Targets (from spec): `diffMult` 1.0→~3.6 with steepening past stage 8; enemy HP scaling per stage; enemy fire interval shrinking; +1 bullet stream at milestone stages; boss HP 800→~4500; boss phases up to 6 for 15–18. Early stages (1–4) get only a modest bump.

- [ ] **Step 1: Replace the contents of `src/core/difficulty.js`**

```js
import { STAGE_COUNT } from '../config.js';

// Per-stage speed multiplier (stage 1 -> 18). Steeper past stage 8.
export const DIFF_CURVE = [
  1.00, 1.10, 1.20, 1.30, 1.45, 1.65, 1.85, 2.10,
  2.35, 2.60, 2.80, 3.00, 3.15, 3.30, 3.40, 3.48, 3.55, 3.60,
];
export const LOOP_STACK = 0.2;

// Enemy HP: +12% per stage past 1
export const HP_PER_STAGE = 0.12;
// Enemy fire interval: *0.97 per stage past 1
export const FIRERATE_DECAY = 0.97;
// Extra enemy bullet streams granted when stage >= each milestone
export const STREAM_MILESTONES = [4, 8, 12, 16];
// Boss HP: 800 * (1 + (stage-1) * 0.27)  -> stage 18 = 4472
export const BOSS_BASE_HP = 800;
export const BOSS_HP_STEP = 0.27;

export function diffMultFor(stage, loopMult) {
  const i = Math.max(0, Math.min(stage - 1, DIFF_CURVE.length - 1));
  return DIFF_CURVE[i] * (1 + (loopMult - 1) * LOOP_STACK);
}

export function enemyHpScale(stage) {
  return 1 + (stage - 1) * HP_PER_STAGE;
}

export function fireIntervalScale(stage) {
  return Math.pow(FIRERATE_DECAY, stage - 1);
}

export function extraBulletStreams(stage) {
  return STREAM_MILESTONES.filter(s => stage >= s).length;
}

export function bossHpForStage(stage) {
  return Math.round(BOSS_BASE_HP * (1 + (stage - 1) * BOSS_HP_STEP));
}

export function phaseCountForStage(stage) {
  if (stage >= 15) return 6;
  if (stage >= 10) return 5;
  if (stage >= 6) return 4;
  return 3;
}
```

- [ ] **Step 2: Apply the levers**

In `src/entities/Enemy.js`:
- Import `{ enemyHpScale, extraBulletStreams, fireIntervalScale }` from `../core/difficulty.js`.
- `mkEnemy(type, x, y, path)` → `mkEnemy(type, x, y, path, g)`; after building `e`, apply the HP scale:

```js
export function mkEnemy(type, x, y, path, g) {
  const e = Object.assign(
    { type, x, y, path, pathT: 0, alive: true, fireTimer: 1.2 + Math.random(), angle: 0 },
    ENEMY_CFG[type]
  );
  if (g) e.hp = Math.ceil(e.hp * enemyHpScale(g.currentStage));
  return e;
}
```

- `fireEnemy(e, g)`: at the end of the function (after the switch), add the extra streams:

```js
  const extra = extraBulletStreams(g.currentStage);
  if (extra && (e.type === 0 || e.type === 1)) {
    for (let k = 1; k <= extra; k++) {
      const side = k % 2 === 0 ? -1 : 1;
      const off  = side * 0.4 * Math.ceil(k / 2);
      const a = Math.atan2(dy, dx) + off;
      mkEB(Math.cos(a) * spd, Math.sin(a) * spd, '#ff4444');
    }
  }
```

- `updateEnemies(dt, g)`: multiply the base interval by the per-stage scale:

```js
    const fireInterval = (e.type === 3 ? 1.6 : 2.2) * fireIntervalScale(g.currentStage) / g.diffMult;
```

In `src/stages/waveGen.js` `updateWaves(dt, g)`:
- `g.boss = createBoss(g);` (already updated in Task 25)
- Pass `g` into `mkEnemy` calls so HP scaling applies: `const e = mkEnemy(3, entry.x, entry.y, null, g);` and `const e = mkEnemy(entry.type, 0, 0, entry.path, g);`

In `src/entities/Boss.js`:
- Import `{ bossHpForStage, phaseCountForStage }` from `../core/difficulty.js`.
- In `createBoss(g)`, override hp and phaseCount from the formulas (the `def.hp`/`def.phaseCount` authoring values remain as reference):

```js
    hp: bossHpForStage(g.currentStage),
    phaseCount: phaseCountForStage(g.currentStage),
```

- `spawnMinion(g)` passes `g` to `mkEnemy`: `const e = mkEnemy(0, boss.x + (Math.random()-0.5)*40, boss.y + 20, null, g);`

- [ ] **Step 3: Update `tests/difficulty.test.js`**

Replace the two existing tests' expectations and add lever tests:

```js
import { describe, it, expect } from 'vitest';
import {
  diffMultFor, enemyHpScale, fireIntervalScale, extraBulletStreams,
  bossHpForStage, phaseCountForStage,
} from '../src/core/difficulty.js';

describe('difficulty', () => {
  it('ramps diffMult from 1.0 toward ~3.6, steepening past stage 8', () => {
    expect(diffMultFor(1, 1)).toBeCloseTo(1.00);
    expect(diffMultFor(8, 1)).toBeCloseTo(2.10);
    expect(diffMultFor(12, 1)).toBeCloseTo(3.00);
    expect(diffMultFor(18, 1)).toBeCloseTo(3.60);
    // steepening past stage 8: 12->18 (+1.5) is steeper than 6->8 (+0.45)
    const steep8 = diffMultFor(8, 1) - diffMultFor(6, 1);
    const steep18 = diffMultFor(18, 1) - diffMultFor(12, 1);
    expect(steep18).toBeGreaterThan(steep8);
  });

  it('applies the loop-stack multiplier', () => {
    expect(diffMultFor(1, 2)).toBeCloseTo(1.00 * 1.2);
    expect(diffMultFor(8, 3)).toBeCloseTo(2.10 * 1.4);
  });

  it('keeps early stages modest', () => {
    expect(diffMultFor(4, 1)).toBeCloseTo(1.30);
    expect(enemyHpScale(4)).toBeCloseTo(1.36);
  });

  it('scales enemy HP per stage', () => {
    expect(enemyHpScale(1)).toBeCloseTo(1.0);
    expect(enemyHpScale(18)).toBeCloseTo(1 + 17 * 0.12);
  });

  it('shrinks the enemy fire interval per stage', () => {
    expect(fireIntervalScale(1)).toBeCloseTo(1.0);
    expect(fireIntervalScale(18)).toBeCloseTo(Math.pow(0.97, 17));
  });

  it('adds one bullet stream per milestone reached', () => {
    expect(extraBulletStreams(3)).toBe(0);
    expect(extraBulletStreams(4)).toBe(1);
    expect(extraBulletStreams(12)).toBe(3);
    expect(extraBulletStreams(18)).toBe(4);
  });

  it('ramps boss HP 800 -> ~4500 and phases to 6', () => {
    expect(bossHpForStage(1)).toBe(800);
    expect(bossHpForStage(18)).toBe(4472);
    expect(phaseCountForStage(5)).toBe(3);
    expect(phaseCountForStage(6)).toBe(4);
    expect(phaseCountForStage(10)).toBe(5);
    expect(phaseCountForStage(15)).toBe(6);
    expect(phaseCountForStage(18)).toBe(6);
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: PASS (all tests in difficulty + wavegen).

- [ ] **Step 5: Verify it parses everywhere**

Run: `node --check src/core/difficulty.js && node --check src/entities/Enemy.js && node --check src/entities/Boss.js && node --check src/stages/waveGen.js`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/core/difficulty.js src/entities/Enemy.js src/entities/Boss.js src/stages/waveGen.js tests/difficulty.test.js
git commit -m "feat: steeper multi-lever difficulty curve (speed, HP, fire rate, streams, boss HP/phases)"
```

### Task 29: Checkpoint 4 — playtest the new difficulty

- [ ] **Step 1: Playtest**

Run: `npm run dev`. Play stages 1–4 (should feel close to before, modest bump), stages 6+ (noticeably harder), and a stage 15–18 boss (6 phases, ~3700–4500 HP). Confirm nothing is unfair/broken (e.g. streams don't overlap turrets in a way that makes them unkillable).

- [ ] **Step 2: Retune if needed**

"Harder" is subjective — adjust the named constants in `src/core/difficulty.js` (`DIFF_CURVE`, `HP_PER_STAGE`, `FIRERATE_DECAY`, `STREAM_MILESTONES`, `BOSS_HP_STEP`) and re-run `npm test` + replay. Keep the tests' numbers in sync with the constants you land on. Commit tuning changes with `git commit -am "tune: adjust difficulty constants after playtest"`.

---

## Phase F — Deployment

### Task 30: GitHub Actions Pages workflow

**Files:**
- Create: `.github/workflows/pages.yml`

- [ ] **Step 1: Create `.github/workflows/pages.yml`**

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Verify the local build is deployable**

Run: `npm run build && npm run preview`, open the URL.
Expected: the game plays from `dist/index.html` (single file, no asset paths).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/pages.yml
git commit -m "ci: add GitHub Actions Pages deployment"
```

- [ ] **Step 4: Enable Pages in the repo settings (one-time, user action)**

In GitHub → repo → Settings → Pages → Source: **GitHub Actions**. Push to `main` (or run the workflow manually via Actions) to trigger the first deploy. Confirm the game is served at the Pages URL.

---

## Phase G — Final Playtest

### Task 31: Full playtest + tune

- [ ] **Step 1: Play the full 18-stage run**

Run: `npm run dev`. Play stages 1–18 back-to-back (or via `window.game = game` + `game.startStage(n)` to jump). Verify:
- [ ] Every stage's waves spawn correctly; no entry `t` ordering bugs (generator sorts)
- [ ] Each boss 9–18 shows the right archetype, tint, phases, patterns; no rendering artifacts from the offscreen blit (check boss 5/8 glows aren't clipped)
- [ ] VICTORY triggers after stage 18; Enter starts Loop 2; `loopMult` stacking works
- [ ] Enemy HP scaling / fire-rate scaling / extra streams feel right; powerup economy still sustains you
- [ ] Touch controls still work; pause/settings/mute/speed still work
- [ ] `npm run build` + `npm run preview` behaves identically
- [ ] `npm test` PASS

- [ ] **Step 2: Tune constants**

Adjust `DIFF_CURVE`, `HP_PER_STAGE`, `FIRERATE_DECAY`, `STREAM_MILESTONES`, `BOSS_HP_STEP` (and stage-specific wave `spd`/`t` values in `stageData.js` for stages 9–18 if a particular wave is too sparse/dense). Update `tests/difficulty.test.js` expectations to match. Re-run `npm test`, replay, commit with `git commit -am "tune: difficulty/content adjustments from playtest"`.

- [ ] **Step 3: Final commit + tag**

```bash
git add -A
git commit -am "feat: full 18-stage game with data-driven content and build pipeline" || true
git push origin main
```
Verify the GitHub Actions deploy succeeds and the live game is playable.

---

## Self-Review

**1. Spec coverage**
- Modularization (spec §Architecture, §Build & Deploy): Phase A tasks 1–16, all listed files created; index.html slimmed to module entry. ✓
- Data-driven stages + 18 stages (spec §Stage Model, §Migration step 4): Tasks 18–20, 27. ✓
- Boss parameterization (spec §Bosses): Tasks 23–25. ✓
- Difficulty curve (spec §Difficulty): Task 28. ✓
- GitHub Actions deploy (spec §Build & Deploy): Task 30. ✓
- Sequencing: refactor → data-driven → boss params → new stages → difficulty → deploy → playtest, with checkpoints 17, 22, 26. ✓
- Non-goals respected: no new weapons/enemy art; bosses reuse archetypes via tint + patterns; loop mode, scoring, powerups, charge shot unchanged. ✓

**2. Placeholder scan**
- Every task gives full code for new modules (config, canvas, difficulty, particles, audio, input, background, Game, main, stageData stages 1–8 + 9–18, patterns, tests, workflow) or an exact line-range + conversion table + worked example for mechanical relocations (Player/Bullet/Enemy/Powerup/collision/Boss/screens internals, the switch→descriptor port). No "TBD"/"implement later" anywhere. ✓

**3. Type/signature consistency**
- `buildWaveTable(stageDef, diffMult)` (Task 19) — called with `STAGES[stage-1]` and `this.diffMult` in `Game.startStage` (Task 19 step 2). ✓
- `createBoss(g)` (Task 25) — `updateWaves` updated in Task 25 step 1 to `createBoss(g)`. ✓
- `mkEnemy(type, x, y, path, g)` (Task 28) — call sites updated in waveGen (Task 28 step 2) and `spawnMinion` (Task 28 step 2). ✓
- `spawnExplosion(x, y, size, color, g)` — call sites in collision (`spawnExplosion(..., g)`), Player, Boss `onBossDeath` (`spawnExplosion(..., g)`). ✓
- `firePlayer(p, g)`/`fireSuper(p, g)`/`getFireRate` — Player.js imports from Bullet.js; signatures match Task 9. ✓
- `drawBackground(g)` (Task 7) — loop calls `drawBackground(this)` (Task 16); Task 20 keeps the same `(g)` signature. ✓
- `sfxShoot(weapon, g)` etc. — audio.js exports match the `(…, g)` calls in Bullet/particles/Player. ✓
- `drawTouchControls(g)` — input.js exports; loop calls `drawTouchControls(this)`. ✓
- Boss draw archetypes `drawBossN(c, b, angle, timer)` (Task 24) — dispatched by `drawBossArchetype` and `drawBoss(g)`; `drawBoss7` uses `b.phantomAlpha` (set by `createBoss`), `drawBoss8` uses `timer`. ✓
- `patterns` shape `{ name, spdBase, spdPhase, ... }` (Task 23) — stage defs (Tasks 25, 27) and `firePattern`/`fireBoss` agree; combos are arrays. ✓

**Known tuning assumption:** boss HP/phases in stage defs 9–18 (Task 27) are superseded by `bossHpForStage`/`phaseCountForStage` at runtime (Task 28). The `def.hp`/`def.phaseCount` authoring values remain for reference; the plan's tests assert the formula outputs, so there is no inconsistency in behavior, only a benign redundancy in the data.

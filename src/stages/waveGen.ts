import { Enemy, type PathFn } from '../entities/Enemy.js';
import { Powerup } from '../entities/Powerup.js';
import { createBoss } from '../entities/Boss.js';
import { ENEMY_TYPES } from '../registries/enemies/index.js';
import { POWERUP_TYPES } from '../registries/powerups/index.js';
import type { GameContext } from '../core/GameContext.js';

// ===========================================================================
// waveGen — turns the declarative stage descriptors (stageData.ts) into a
// concrete, time-sorted spawn timeline (WaveEntry[]) that the game loop plays
// back via updateWaves(). Two responsibilities live here:
//   1. MOTION registry: maps a path descriptor like ['sin', ...] to a PathFn.
//   2. buildWaveTable: expands descriptors, applies the global enemy-density
//      multiplier, and sorts by spawn time.
// ===========================================================================

// --- Path builders: each returns a PathFn t -> {x, y}, where t is seconds
// since the enemy spawned. All vertical speeds are pre-multiplied by diffMult.
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
// Register a new movement kind here to make it usable from stageData waves.
export const MOTION = new Map<string, (desc: number[], diffMult: number) => PathFn>();
export function registerMotion(kind: string, builder: (desc: number[], diffMult: number) => PathFn): void {
  MOTION.set(kind, builder);
}
registerMotion('down', (desc, diffMult) => pathDown(desc[0], desc[1], desc[2] * diffMult));
registerMotion('sin',  (desc, diffMult) => pathSin(desc[0], desc[1], desc[2] * diffMult, desc[3], desc[4]));
registerMotion('form', (desc, diffMult) => pathFormation(desc[0], desc[1], desc[2] * diffMult, desc[3], desc[4]));

/**
 * A single spawn instruction as authored in stageData.ts (density 1.0 baseline).
 * Exactly one of `boss` / `type` / `powerup` is meaningful per entry.
 */
export interface WaveDescriptor {
  /** Spawn time in seconds from stage start. */
  t: number;
  /** If set, this entry triggers the boss for stage N (clears remaining enemies). */
  boss?: number;
  /** Enemy type key: 'fighter' | 'gunship' | 'bomber' | 'turret' | 'swarmer' | 'dropship' | 'seeker'. */
  type?: string;
  /** Turret X position (turret entries only). */
  x?: number;
  /** Turret Y position (turret entries only). */
  y?: number;
  /** Motion descriptor, e.g. ['sin', sx, sy, spd, amp, freq] (non-turret movers). */
  path?: (string | number)[];
  /** Grants +50% HP at runtime; used on stage 8 and 15-18 regulars. */
  elite?: boolean;
  /** Powerup type key ('life') for a directly-scripted pickup at (x, y); never an enemy. */
  powerup?: string;
}

function expandPath(desc: (string | number)[], diffMult: number): PathFn {
  if (!Array.isArray(desc) || desc.length < 4) throw new Error('bad path descriptor: ' + JSON.stringify(desc));
  const kind = desc[0];
  if (typeof kind !== 'string') throw new Error('bad path kind: ' + String(kind));
  const builder = MOTION.get(kind);
  if (!builder) throw new Error('unknown path kind: ' + kind);
  return builder(desc.slice(1) as number[], diffMult);
}

/**
 * A resolved spawn instruction with its PathFn built and ready to play back.
 * Produced from a WaveDescriptor by buildWaveTable.
 */
export interface WaveEntry {
  t: number;
  boss?: number;
  type?: string;
  x?: number;
  y?: number;
  path?: PathFn | null;
  eliteHp?: boolean;
  powerup?: string;
}

// Horizontal nudge (px) applied to a density clone so it reads as a separate
// reinforcement rather than sitting exactly on top of the original spawn.
const CLONE_X_SHIFT = 46;
// Time nudge (s) applied to a density clone so its shots/motion interleave with
// the original instead of firing on the same frame.
const CLONE_T_SHIFT = 0.5;

/**
 * Produce a time-shifted, horizontally-offset copy of a non-boss descriptor.
 * Used to thicken a stage when density > 1. The clone is clamped to spawn
 * strictly before `bossT` so it never lands after the boss trigger.
 */
function cloneDescriptor(d: WaveDescriptor, bossT: number): WaveDescriptor {
  // Keep the clone inside the pre-boss window; nudge earlier if adding the
  // forward shift would push it onto/after the boss.
  const t = d.t + CLONE_T_SHIFT < bossT ? d.t + CLONE_T_SHIFT : Math.max(0, d.t - CLONE_T_SHIFT);
  if (d.type === 'turret') {
    // Mirror the turret horizontally about screen center so clones spread out.
    const x = d.x !== undefined ? (d.x < 240 ? d.x + CLONE_X_SHIFT : d.x - CLONE_X_SHIFT) : d.x;
    return { ...d, t, x };
  }
  // Movers: shift the path's start X (descriptor index 1) by CLONE_X_SHIFT.
  if (d.path) {
    const path = [...d.path];
    if (typeof path[1] === 'number') path[1] = path[1] + CLONE_X_SHIFT;
    return { ...d, t, path };
  }
  return { ...d, t };
}

/**
 * Expand a stage's declarative wave descriptors into a concrete, t-sorted
 * spawn timeline.
 *
 * @param stageDef  the stage entry from STAGES (its `waves` array is read).
 * @param diffMult  per-stage speed multiplier (see diffMultFor); scales path speeds.
 * @param density   enemy-count multiplier (see densityForStage). 1.0 = author's
 *                  baseline; values > 1 deterministically clone that fraction of
 *                  the non-boss waves so the stage feels busier. The boss trigger
 *                  is never cloned. Defaults to 1.0 so tests and any caller that
 *                  omits it get the untouched baseline.
 */
export function buildWaveTable(stageDef: { waves: WaveDescriptor[] }, diffMult: number, density = 1): WaveEntry[] {
  // Boss trigger time bounds where clones may be placed.
  const bossT = stageDef.waves.find(d => d.boss)?.t ?? Infinity;

  // Start from the authored baseline, then append density clones.
  const descriptors: WaveDescriptor[] = [...stageDef.waves];
  if (density > 1) {
    const extraFraction = density - 1;   // e.g. 0.4 => clone ~40% of waves
    // Distribute clones evenly across cloneable waves via a fractional
    // accumulator (deterministic — no RNG, so wave tables stay reproducible).
    let acc = 0;
    for (const d of stageDef.waves) {
      if (d.boss || d.powerup) continue;  // never duplicate the boss or a scripted powerup
      acc += extraFraction;
      if (acc >= 1) {
        acc -= 1;
        descriptors.push(cloneDescriptor(d, bossT));
      }
    }
  }

  const entries: WaveEntry[] = [];
  for (const d of descriptors) {
    if (d.boss) {
      entries.push({ t: d.t, boss: d.boss });
    } else if (d.powerup) {
      entries.push({ t: d.t, powerup: d.powerup, x: d.x, y: d.y });
    } else if (d.type === 'turret') {
      entries.push({ t: d.t, type: d.type, x: d.x, y: d.y, ...(d.elite ? { eliteHp: true } : {}) });
    } else {
      entries.push({ t: d.t, type: d.type, path: expandPath(d.path!, diffMult), ...(d.elite ? { eliteHp: true } : {}) });
    }
  }
  return entries.sort((a, b) => a.t - b.t);
}

/**
 * Advance the stage timeline: spawn every wave whose scheduled time has been
 * reached this frame. Called once per frame from the game loop while PLAYING.
 * Spawning is paused while a boss is alive (the boss owns the screen).
 */
export function updateWaves(dt: number, ctx: GameContext): void {
  if (ctx.boss) return;
  ctx.stageTimer += dt;

  // Drain every entry whose spawn time has arrived (the table is t-sorted).
  while (ctx.waveIndex < ctx.waveTable.length) {
    const entry = ctx.waveTable[ctx.waveIndex];
    if (ctx.stageTimer < entry.t) break;
    ctx.waveIndex++;

    if (entry.boss) {
      ctx.enemies.length = 0;
      ctx.enemyBullets.length = 0;
      ctx.boss = createBoss(ctx);
      ctx.bossSpawned = true;
    } else if (entry.powerup) {
      const def = POWERUP_TYPES.get(entry.powerup)!;
      ctx.powerups.push(new Powerup(def, entry.x ?? 0, entry.y ?? 0));
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

import type { GameContext } from '../../core/GameContext.js';
import type { Boss } from '../../entities/Boss.js';
import { spawnEnemyBullet } from '../../entities/Bullet.js';
import { makeRegistry } from '../../core/registry.js';

/**
 * Per-firing tuning for a named bullet pattern. Fields are pattern-specific —
 * see each registerBulletPattern() call below for which ones it reads. Speed
 * is always `(spdBase + bossPhase * spdPhase) * diffMult` (see speedFor).
 */
export interface PatternOpts {
  /** Base bullet speed (px/s) before phase/difficulty scaling. */
  spdBase: number;
  /** Extra speed (px/s) added per boss phase (0-based); makes later phases faster. */
  spdPhase: number;
  /** Number of bullets in the volley (aimSpread/ring/laserSweep/scatter). */
  count?: number;
  /** Angular spacing in radians between adjacent bullets (aimSpread). */
  gap?: number;
  /** Bullet fill color (CSS color string); defaults vary per pattern. */
  clr?: string;
  /** Angle offsets in radians from the aimed direction, one bullet per entry (aimBurst). */
  offsets?: number[];
  /** Half-width of the sweep arc in radians (laserSweep). */
  halfSpan?: number;
  /** Extra speed multiplier applied on top of the phase-scaled speed (ring/laserSweep/scatter). */
  spdF?: number;
}

/**
 * A named boss bullet-fire pattern, held in the BULLET_PATTERNS registry.
 * Stage/boss data references patterns by `key` plus a PatternOpts, so the
 * same pattern can be reused across bosses/phases with different tuning.
 */
export interface BulletPattern {
  readonly key: string;
  /** Spawn this pattern's volley of enemy bullets from `boss`'s position. */
  fire(boss: Boss, ctx: GameContext, opts: PatternOpts): void;
}

/** Registry of all boss bullet patterns, keyed by BulletPattern.key. */
export const BULLET_PATTERNS = makeRegistry<BulletPattern>();
/** Convenience alias for BULLET_PATTERNS.register. */
export const registerBulletPattern = BULLET_PATTERNS.register;

/**
 * Shared helper: the direction/distance from boss to player, plus this
 * pattern instance's difficulty- and phase-scaled bullet speed.
 */
function speedFor(boss: Boss, ctx: GameContext, opts: PatternOpts): { dx: number; dy: number; d: number; spd: number } {
  const dx = ctx.player!.x - boss.x, dy = ctx.player!.y - boss.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  return { dx, dy, d, spd: (opts.spdBase + ctx.bossPhase * opts.spdPhase) * ctx.diffMult };
}

// Aimed fan: `count` bullets centered on the player, spaced `gap` radians apart.
registerBulletPattern({
  key: 'aimSpread',
  fire(boss, ctx, opts) {
    const { dx, dy, d, spd } = speedFor(boss, ctx, opts);
    const { count = 0, gap = 0, clr = '#ff4444' } = opts;
    // i ranges symmetrically around 0 so the fan is centered on the aim direction.
    for (let i = -(count - 1) / 2; i <= (count - 1) / 2; i++) {
      const a = Math.atan2(dy, dx) + i * gap;
      spawnEnemyBullet(ctx, boss.x, boss.y, Math.cos(a) * spd, Math.sin(a) * spd, clr);
    }
  },
});

// Omnidirectional ring: `count` bullets evenly spaced around a full circle,
// rotated by the boss's current spin angle so it appears to sweep.
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

// Aimed burst: one bullet per entry in `offsets`, each angled off the aimed direction.
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

// Side-alternating triple shot: fires from alternating left/right of the boss
// (flips every 0.5s via bossTimer), each side firing a tight 3-bullet aimed fan.
registerBulletPattern({
  key: 'sideAlternate',
  fire(boss, ctx, opts) {
    const { dx, dy, spd } = speedFor(boss, ctx, opts);
    const side = Math.floor(ctx.bossTimer * 2) % 2 === 0 ? -1 : 1;   // flips every 0.5s
    const ox = side * (boss.r + 14);      // spawn point offset just outside the boss body
    const baseA = Math.atan2(dy, dx);
    for (let j = 0; j < 3; j++) {
      const a = baseA + (j - 1) * 0.08;   // -0.08, 0, +0.08 rad around the aim direction
      spawnEnemyBullet(ctx, boss.x + ox, boss.y, Math.cos(a) * spd, Math.sin(a) * spd, opts.clr || '#ff8800', 5);
    }
  },
});

// Laser sweep: `count` bullets fanned across `halfSpan` rad (rotating with
// bossAngle, like a sweeping beam), plus one extra bullet aimed straight at
// the player (the bright "warning shot" that telegraphs the sweep's center).
registerBulletPattern({
  key: 'laserSweep',
  fire(boss, ctx, opts) {
    const { dx, dy, d, spd } = speedFor(boss, ctx, opts);
    const { count = 0, halfSpan = 0, clr = '#ff8800', spdF = 1 } = opts;
    for (let i = 0; i < count; i++) {
      const a = ctx.bossAngle + (-halfSpan + (i / (count - 1)) * halfSpan * 2);
      spawnEnemyBullet(ctx, boss.x, boss.y, Math.cos(a) * spd * spdF, Math.sin(a) * spd * spdF, clr);
    }
    spawnEnemyBullet(ctx, boss.x, boss.y, (dx / d) * spd, (dy / d) * spd, '#ffff44');   // aimed marker shot
  },
});

// Scatter: `count` bullets flung in uniformly random directions (no aim).
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

// Jitter: a single slow-falling bullet with a randomized horizontal kick;
// unaimed, low-speed, used for light harassment fire (ignores speedFor).
registerBulletPattern({
  key: 'jitter',
  fire(boss, ctx, opts) {
    spawnEnemyBullet(ctx, boss.x, boss.y, (Math.random() - 0.5) * 20, 12, opts.clr ?? '#ff4444', 7);
  },
});

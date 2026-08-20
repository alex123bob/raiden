import { W, H } from '../config.js';
import type { GameContext } from '../core/GameContext.js';
import type { RenderContext } from '../core/Renderer.js';
import { Entity } from '../core/Entity.js';
import { enemyHpScale, fireIntervalScale, extraBulletStreams } from '../core/difficulty.js';
import { spawnEnemyBullet } from './Bullet.js';

export type PathFn = (t: number) => { x: number; y: number };

/**
 * Behavioral definition of one enemy kind, held in the ENEMY_TYPES registry.
 * A single EnemyType instance is shared (by reference) across every Enemy of
 * that kind — it holds the *template* stats and the draw/fire/move behavior,
 * never per-instance mutable state (that lives on the Enemy).
 */
export interface EnemyType {
  /** Registry key, e.g. 'fighter' | 'gunship' | 'bomber' | 'turret'. */
  readonly key: string;
  /** Base hit points before per-stage HP scaling is applied. */
  hp: number;
  /** Collision/draw radius in pixels. */
  r: number;
  /** Base movement speed (interpretation depends on `movement`). */
  spd: number;
  /** Score awarded to the player on kill. */
  score: number;
  /** Probability [0..1] of dropping a power-up on death. */
  dropChance: number;
  /** Primary fill/theme color. */
  color: string;
  /** Seconds between shots before per-stage fire-rate scaling (default 2.2). */
  fireInterval?: number;
  /** If true, this kind gains the extra aimed bullet streams unlocked by stage milestones. */
  extraStreams?: boolean;
  /** Draw the enemy at the origin (caller has already translated to its position). */
  render(rc: RenderContext, e: Enemy): void;
  /** Emit this kind's bullet pattern. */
  fire(e: Enemy, ctx: GameContext): void;
  /** Advance position/rotation for this frame. */
  movement(e: Enemy, dt: number, ctx: GameContext): void;
  /** Optional gate: return false to hold fire (e.g. turret only shoots when on-screen). */
  inRange?(e: Enemy, ctx: GameContext): boolean;
}

/**
 * A live enemy in the world. Wraps a shared EnemyType `def` (its behavior)
 * with the per-instance mutable state: position (via Entity), current HP,
 * path progress, and fire cooldown.
 */
export class Enemy extends Entity {
  /** Current hit points; scaled up from def.hp by the stage's HP multiplier at spawn. */
  hp: number;
  /** Effective movement speed (copied from def.spd; may be read by movement fns). */
  spd: number;
  /** Score awarded on kill (copied from def). */
  score: number;
  /** Power-up drop probability [0..1] (copied from def). */
  dropChance: number;
  /** Theme color (copied from def). */
  color: string;
  /** Movement function, or null for stationary enemies (e.g. turrets). */
  path: PathFn | null;
  /** Seconds elapsed along `path` — the `t` passed to the PathFn. */
  pathT = 0;
  /** Countdown to the next shot; wraps to a fresh interval after firing. */
  fireTimer: number;
  /** Current facing/spin angle in radians (used by some render/fire fns). */
  angle = 0;
  constructor(public readonly def: EnemyType, x: number, y: number, path: PathFn | null,
              ctx?: Pick<GameContext, 'currentStage'>) {
    super(x, y, def.r);
    this.path = path;
    // HP scales with the stage the enemy spawns in. ctx is optional so tests
    // can construct a bare enemy at its unscaled base HP.
    this.hp = ctx ? Math.ceil(def.hp * enemyHpScale(ctx.currentStage)) : def.hp;
    this.spd = def.spd;
    this.score = def.score;
    this.dropChance = def.dropChance;
    this.color = def.color;
    // Randomize the first shot so a formation doesn't fire in perfect unison.
    this.fireTimer = 1.2 + Math.random();
  }
  update(dt: number, ctx: GameContext): void {
    this.def.movement(this, dt, ctx);
    // Despawn once fully off-screen (below, or off either side).
    if (this.y > H + 60 || this.x < -60 || this.x > W + 60) { this.alive = false; return; }
    // Fire interval shrinks with stage (faster) and grows with diffMult
    // (the division keeps higher-speed stages from also over-firing).
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
    // Late-game milestones grant extra aimed streams fanned around the
    // player-ward direction, but only to kinds that opt in via extraStreams.
    const extra = extraBulletStreams(ctx.currentStage);
    if (extra && this.def.extraStreams) {
      const dx = ctx.player.x - this.x, dy = ctx.player.y - this.y;
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


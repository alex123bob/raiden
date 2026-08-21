import { W, H } from '../config.js';
import type { GameContext } from '../core/GameContext.js';
import type { RenderContext } from '../core/Renderer.js';
import { Entity } from '../core/Entity.js';
import { circleHit } from '../core/collision.js';
import type { Enemy } from './Enemy.js';
import { POWERUP_TYPES } from '../registries/powerups/index.js';

/**
 * Behavioral definition of one powerup kind, held in the POWERUP_TYPES
 * registry. Shared by reference; holds only render/apply behavior.
 */
export interface PowerupType {
  readonly key: string;   // 'weapon' | 'bomb'
  /** Draw the powerup at the origin (caller has translated to its position). */
  render(rc: RenderContext, pw: Powerup): void;
  /** Apply this pickup's effect to the player/game state on collection. */
  apply(pw: Powerup, ctx: GameContext): void;
}

/**
 * A floating pickup drifting down the screen. Position comes from Entity;
 * this adds fall speed, a lifetime (despawns if never collected), and for
 * weapon orbs, which weapon type it grants.
 */
export class Powerup extends Entity {
  /** Downward fall speed in pixels/second. */
  vy = 55;
  /** Remaining seconds before this powerup despawns uncollected. */
  life = 9.0;
  /** Weapon type index (0=vulcan,1=spread,2=missile) this grants; meaningless for non-weapon kinds. */
  wType = 0;
  constructor(public readonly def: PowerupType, x: number, y: number, wType?: number) {
    super(x, y, 14);
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
  /** Apply this powerup's effect (delegates to its PowerupType.apply). */
  apply(ctx: GameContext): void {
    this.def.apply(this, ctx);
  }
}

/**
 * Roll a powerup drop for a just-killed enemy: gated by the enemy's
 * dropChance, then an 85/15 split between a weapon orb (random type 0..2) and
 * a bomb pickup.
 */
export function tryDropPowerup(e: Enemy, ctx: GameContext): void {
  if (Math.random() >= e.dropChance) return;
  const isBomb = Math.random() < 0.15;
  const wType = Math.floor(Math.random() * 3);
  const def = POWERUP_TYPES.get(isBomb ? 'bomb' : 'weapon')!;
  ctx.powerups.push(new Powerup(def, e.x, e.y, isBomb ? undefined : wType));
}

/** Advance every live powerup by dt, removing any that fell off-screen or expired. */
export function updatePowerups(dt: number, ctx: GameContext): void {
  for (let i = ctx.powerups.length - 1; i >= 0; i--) {
    const pw = ctx.powerups[i];
    pw.update(dt, ctx);
    if (!pw.alive) ctx.powerups.splice(i, 1);
  }
}

/**
 * Collision pass: player vs powerups. Uses a generous +10px pickup radius
 * (beyond the ship's own hitbox) so grabbing feels forgiving. Applies the
 * effect, plays the pickup SFX, and removes the powerup on contact.
 */
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

/** Draw every live powerup, in array order. */
export function drawPowerups(rc: RenderContext, ctx: GameContext): void {
  ctx.powerups.forEach(pw => pw.draw(rc, ctx));
}

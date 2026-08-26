import { H } from '../config.js';
import type { GameContext } from '../core/GameContext.js';
import type { RenderContext } from '../core/Renderer.js';
import { Entity } from '../core/Entity.js';
import { circleHit } from '../core/collision.js';
import type { Enemy } from './Enemy.js';
import { WEAPON_NAMES } from './Bullet.js';
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
  /** Random per-instance angle offset so simultaneously-spawned pickups don't shimmer in lockstep. */
  spawnPhase = Math.random() * Math.PI * 2;
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
    drawShine(rc, this);
    this.def.render(rc, this);
    rc.restore();
  }
  /** Apply this powerup's effect (delegates to its PowerupType.apply). */
  apply(ctx: GameContext): void {
    this.def.apply(this, ctx);
  }
}

/**
 * Shared "this is a pickup, not a threat" treatment drawn behind every
 * powerup type: a soft breathing gold halo plus a few orbiting twinkle
 * sparkles. Driven by `age` (time since spawn, smooth and monotonic unlike
 * the despawn countdown `life`) so the shimmer never stutters near despawn.
 */
function drawShine(rc: RenderContext, pw: Powerup): void {
  const age = 9.0 - pw.life;
  const haloPulse = 0.5 + Math.sin(age * 3.2) * 0.5;   // 0..1 breathing pulse
  const haloR = pw.r * (2.0 + haloPulse * 0.6);

  rc.save();
  const grad = rc.createRadialGradient(0, 0, pw.r * 0.4, 0, 0, haloR);
  grad.addColorStop(0, `rgba(255,246,190,${0.35 + haloPulse * 0.25})`);
  grad.addColorStop(1, 'rgba(255,246,190,0)');
  rc.fillStyle = grad;
  rc.beginPath(); rc.arc(0, 0, haloR, 0, Math.PI * 2); rc.fill();
  rc.restore();

  const sparkleCount = 4;
  for (let i = 0; i < sparkleCount; i++) {
    const twinkle = Math.sin(age * 5 + i * 1.9 + pw.spawnPhase) * 0.5 + 0.5;   // 0..1, offset per sparkle
    if (twinkle < 0.15) continue;   // let sparkles fully vanish rather than dimly linger
    const orbitAngle = pw.spawnPhase + i * (Math.PI * 2 / sparkleCount) + age * 1.1;
    const orbitR = pw.r * 1.7;
    const sx = Math.cos(orbitAngle) * orbitR;
    const sy = Math.sin(orbitAngle) * orbitR;
    const s = pw.r * 0.22 * twinkle;
    rc.save();
    rc.translate(sx, sy);
    rc.rotate(orbitAngle);
    rc.fillStyle = `rgba(255,255,255,${twinkle})`;
    rc.shadowColor = '#fff6c0';
    rc.shadowBlur = 6;
    // Four-point sparkle: a tall diamond crossed with a wide one.
    rc.beginPath();
    rc.moveTo(0, -s); rc.lineTo(s * 0.3, 0); rc.lineTo(0, s); rc.lineTo(-s * 0.3, 0); rc.closePath();
    rc.fill();
    rc.beginPath();
    rc.moveTo(-s * 1.6, 0); rc.lineTo(0, -s * 0.3); rc.lineTo(s * 1.6, 0); rc.lineTo(0, s * 0.3); rc.closePath();
    rc.fill();
    rc.shadowBlur = 0; rc.shadowColor = 'transparent';
    rc.restore();
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
  const wType = Math.floor(Math.random() * WEAPON_NAMES.length);
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

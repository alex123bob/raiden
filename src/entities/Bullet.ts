import { W, H } from '../config.js';
import type { GameContext } from '../core/GameContext.js';
import type { RenderContext } from '../core/Renderer.js';
import { Entity } from '../core/Entity.js';
import type { Player } from './Player.js';
import { BULLET_KINDS } from '../registries/bullets/index.js';

// === BULLET KINDS ===

/**
 * Behavioral definition of one bullet kind, held in the BULLET_KINDS registry.
 * Shared by reference across every Bullet of that kind — holds only the draw
 * behavior and optional per-frame hook, never per-instance state.
 */
export interface BulletKind {
  /** Registry key, e.g. 'vulcan' | 'spread' | 'missile' | 'enemy'. */
  readonly key: string;
  /** Default collision/draw radius in pixels (instances may override b.r). */
  readonly r: number;
  /** Draw the bullet in world space (no prior translate; render fns read b.x/b.y). */
  render(rc: RenderContext, b: Bullet): void;
  /** Optional per-frame behavior for player bullets (e.g. missile homing); runs before motion. */
  onUpdate?(b: Bullet, dt: number, ctx: GameContext): void;
  /** Optional SFX registry key played when this kind is fired. */
  sfxKey?: string;
}

/**
 * A live projectile — player shot or enemy shot. Position/radius come from
 * Entity; this adds velocity, damage, lifetime, and per-kind extras. Enemy and
 * player bullets share the class but take different update paths (see `isEnemy`).
 */
export class Bullet extends Entity {
  /** Velocity x in pixels/second (world space, +x = right). */
  vx = 0;
  /** Velocity y in pixels/second (world space, +y = down). */
  vy = 0;
  /** Damage dealt on hit (HP). */
  dmg = 0;
  /** Remaining lifetime in seconds for player bullets; <=0 despawns. Unused by enemy bullets. */
  life = 0;
  /** Source weapon level 1..5 (affects some render fns and damage scaling). */
  lv = 1;
  /** Facing angle in radians (-PI/2 = up); set at spawn for oriented sprites. */
  angle = 0;
  /** If true, bullet is not consumed on hit (passes through enemies). */
  pierce = false;
  /** Recent {x,y} positions in world space for drawing a motion trail. */
  trail: { x: number; y: number }[] = [];
  /** Seconds before homing engages (missiles fly straight first); counted down by the homing hook. */
  homingDelay = 0;
  /** Fill color (mainly for enemy bullets); CSS color string. */
  clr = '#ff4444';
  /** Enemy-bullet spawn delay in seconds; bullet holds position until it elapses. */
  delay = 0;
  /** True for enemy bullets (simpler update, hits player); false for player bullets. */
  isEnemy = false;
  constructor(public readonly def: BulletKind, x: number, y: number, vx: number, vy: number) {
    super(x, y, def.r);
    this.vx = vx;
    this.vy = vy;
  }
  update(dt: number, ctx: GameContext): void {
    if (this.isEnemy) {
      // Enemy bullets: honor spawn delay, then move; no lifetime, no onUpdate.
      if (this.delay > 0) {
        this.delay -= dt;
        if (this.delay > 0) return;   // still delayed: stay put this frame
        this.delay = 0;
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      // Despawn once off-screen (20px margin on all sides).
      if (this.y > H + 20 || this.y < -20 || this.x < -20 || this.x > W + 20) this.alive = false;
      return;
    }
    // Player bullets: expire by lifetime or once past the screen edges.
    this.life -= dt;
    if (this.life <= 0 || this.y < -80 || this.x < -40 || this.x > W + 40) {
      this.alive = false;
      return;
    }
    this.def.onUpdate?.(this, dt, ctx);   // e.g. missile homing steers vx/vy
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
  draw(rc: RenderContext, _ctx: GameContext): void {
    this.def.render(rc, this);
  }
}

/** Alias: an enemy-fired bullet is the same class (with isEnemy=true). */
export type EnemyBullet = Bullet;

/**
 * Make a player bullet of the given kind aimed along `angle` (radians).
 * Speed, lifetime, and base damage are set per kind; caller pushes it into
 * ctx.playerBullets. Spread bullets are slower (380) than vulcan/missile (680).
 */
export function mkBullet(kindKey: 'vulcan' | 'spread' | 'missile', x: number, y: number, angle: number): Bullet {
  const kind = BULLET_KINDS.get(kindKey)!;
  const spd = kindKey === 'spread' ? 380 : 680;   // pixels/second
  const b = new Bullet(kind, x, y, Math.cos(angle) * spd, Math.sin(angle) * spd);
  b.angle = angle;
  b.life = 2.0;
  b.dmg = kindKey === 'vulcan' ? 5 : kindKey === 'spread' ? 10 : 8;
  return b;
}

/**
 * Spawn an enemy bullet with an explicit velocity and push it into
 * ctx.enemyBullets. `r` is the radius (default 5) and `delay` (seconds) holds
 * it in place before it starts moving (for telegraphed patterns).
 */
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

/**
 * Seconds between player shots for the given weapon type/level: shorter (faster)
 * at higher levels, floored per weapon. Weapon 1 (spread) fires slower than the
 * default (vulcan/missile) branch.
 */
export function getFireRate(weapon: number, lv: number): number {
  if (weapon === 1) return Math.max(0.18, 0.30 - lv * 0.025);
  return Math.max(0.05, 0.13 - lv * 0.015);
}

/**
 * Aim offset (radians) applied to a weapon slot when two weapons are combined,
 * so the two slots fan apart. Single slot = straight (0); slot 0 tilts left,
 * slot 1 tilts right.
 */
export function comboOffset(slotIndex: number, totalSlots: number): number {
  if (totalSlots === 1) return 0;
  return slotIndex === 0 ? -0.26 : 0.26;
}

/**
 * Fire the player's normal shot for the current frame: iterate every equipped
 * weapon slot and emit its level-dependent bullet pattern into
 * ctx.playerBullets. Handles all three weapon types (vulcan/spread/missile).
 */
export function firePlayer(p: Player, ctx: GameContext): void {
  const total = p.weapons.length;
  p.weapons.forEach((slot, idx) => {
    const lv = slot.lv;
    const off = comboOffset(idx, total);   // per-slot fan tilt in a combo
    const UP = -Math.PI / 2;                // straight up

    if (slot.type === 0) {
      // VULCAN: paired forward shots; higher levels add angled and center shots.
      const spread = lv >= 3 ? 0.18 : 0;   // small outward splay from lv3
      const pushV = (x: number, y: number, a: number) => {
        const b = mkBullet('vulcan', x, y, a);
        b.lv = lv;
        ctx.playerBullets.push(b);
      };
      pushV(p.x - 8, p.y - 20, UP + off - spread);
      pushV(p.x + 8, p.y - 20, UP + off + spread);
      if (lv >= 4) {
        // Extra wide-angle pair from the wings.
        pushV(p.x - 18, p.y - 8, UP + off - 0.38);
        pushV(p.x + 18, p.y - 8, UP + off + 0.38);
      }
      if (lv >= 5) pushV(p.x, p.y - 22, UP + off);   // dead-center shot at max
      ctx.audio.play('shoot', { weapon: 0 });

    } else if (slot.type === 1) {
      // SPREAD: a fan of bullets whose count/arc widens with level.
      if (lv === 1) {
        [UP + off - 0.30, UP + off, UP + off + 0.30].forEach(a =>
          ctx.playerBullets.push(mkSpreadBullet(p.x, p.y - 20, a, lv)));
      } else if (lv === 2) {
        const half = 0.35;   // half-arc in radians; bullets evenly spaced across it
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
        // Plus two extra wide side shots.
        ctx.playerBullets.push(mkSpreadBullet(p.x - 12, p.y - 14, UP + off - 0.70, lv));
        ctx.playerBullets.push(mkSpreadBullet(p.x + 12, p.y - 14, UP + off + 0.70, lv));
      } else {
        // lv5: widest 7-bullet fan.
        const half = 0.50;
        for (let i = 0; i < 7; i++)
          ctx.playerBullets.push(mkSpreadBullet(p.x, p.y - 20, UP + off - half + (i / 6) * (half * 2), lv));
      }
      ctx.audio.play('shoot', { weapon: 1 });

    } else if (slot.type === 2) {
      // MISSILE: a small salvo launched upward that homes after a short delay.
      const missileSpread = total > 1 ? 1.6 : 1.0;   // wider launch spacing in a combo
      const counts = [2, 2, 3, 4, 5];                // missiles per shot by level
      const count = counts[lv - 1];
      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * 16 * missileSpread;   // x offset, centered on player
        const b = mkBullet('missile', p.x + offset, p.y - 20, 0);
        b.vx = offset * 0.6 + Math.sin(off) * 80;   // splay outward, biased by combo tilt
        b.vy = -320;                                // initial upward speed
        b.dmg = 8;
        b.life = 2.2;
        b.homingDelay = 0.15 + i * 0.04;            // stagger when each missile starts homing
        ctx.playerBullets.push(b);
      }
      ctx.audio.play('shoot', { weapon: 2 });
    }
  });
}

/** Make a spread bullet whose radius and damage grow with level. */
function mkSpreadBullet(x: number, y: number, angle: number, lv: number): Bullet {
  const b = mkBullet('spread', x, y, angle);
  b.lv = lv;
  b.r = 5 + lv;
  b.dmg = 10 + lv * 3;
  return b;
}

/**
 * Fire the charged "super" burst when the charge meter fills at lv5. Iterates
 * the weapon slots but only maxed (lv5) slots contribute a burst; a non-maxed
 * combo partner keeps its normal firePlayer pattern and sits this out. Each
 * weapon type has a distinctive super shape (arc / full ring / heavy salvo).
 */
export function fireSuper(p: Player, ctx: GameContext): void {
  const total = p.weapons.length;
  p.weapons.forEach((slot, idx) => {
    // Only maxed weapons unleash a super; a non-maxed combo slot keeps
    // firing its normal pattern (via firePlayer) and sits this burst out.
    if (slot.lv !== 5) return;
    const off = comboOffset(idx, total);
    const UP = -Math.PI / 2;

    if (slot.type === 0) {
      // VULCAN super: a 12-bullet forward arc spanning 240 degrees.
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
      // SPREAD super: a full 360-degree ring of 16 heavy bullets.
      const count = 16;
      for (let i = 0; i < count; i++) {
        const a = off + (i / count) * Math.PI * 2;
        const b = mkSpreadBullet(p.x, p.y, a, 5);
        b.r = 7; b.dmg = 18;
        ctx.playerBullets.push(b);
      }
      ctx.audio.play('shoot', { weapon: 1 });
    } else if (slot.type === 2) {
      // MISSILE super: an 8-missile salvo, immediate homing, extra damage.
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
        b.homingDelay = 0;   // homes right away
        ctx.playerBullets.push(b);
      }
      ctx.audio.play('shoot', { weapon: 2 });
    }
  });
}

/** Advance all player bullets and remove dead ones (reverse loop for safe splice). */
export function updatePlayerBullets(dt: number, ctx: GameContext): void {
  for (let i = ctx.playerBullets.length - 1; i >= 0; i--) {
    const b = ctx.playerBullets[i];
    b.update(dt, ctx);
    if (!b.alive) ctx.playerBullets.splice(i, 1);
  }
}

/** Advance all enemy bullets and remove dead ones (reverse loop for safe splice). */
export function updateEnemyBullets(dt: number, ctx: GameContext): void {
  for (let i = ctx.enemyBullets.length - 1; i >= 0; i--) {
    const b = ctx.enemyBullets[i];
    b.update(dt, ctx);
    if (!b.alive) ctx.enemyBullets.splice(i, 1);
  }
}

/** Draw every player bullet. */
export function drawPlayerBullets(rc: RenderContext, ctx: GameContext): void {
  ctx.playerBullets.forEach(b => b.draw(rc, ctx));
}

/** Draw every enemy bullet. */
export function drawEnemyBullets(rc: RenderContext, ctx: GameContext): void {
  ctx.enemyBullets.forEach(b => b.draw(rc, ctx));
}

/** Display names for the three weapon types, indexed by WeaponSlot.type. */
export const WEAPON_NAMES = ['VULCAN', 'SPREAD', 'MISSILE'];
/** Theme colors for the three weapon types, indexed by WeaponSlot.type. */
export const WEAPON_COLORS = ['#ffaa00', '#ff8800', '#ff4488'];

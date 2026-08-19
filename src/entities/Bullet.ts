import { W, H } from '../config.js';
import type { GameContext } from '../core/GameContext.js';
import type { RenderContext } from '../core/Renderer.js';
import { Entity } from '../core/Entity.js';
import type { Player } from './Player.js';
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

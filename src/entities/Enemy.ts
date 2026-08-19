import { W, H } from '../config.js';
import type { GameContext } from '../core/GameContext.js';
import type { RenderContext } from '../core/Renderer.js';
import { Entity } from '../core/Entity.js';
import { enemyHpScale, fireIntervalScale, extraBulletStreams } from '../core/difficulty.js';
import { spawnEnemyBullet } from './Bullet.js';

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


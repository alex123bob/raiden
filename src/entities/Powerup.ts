import { W, H } from '../config.js';
import type { GameContext } from '../core/GameContext.js';
import type { RenderContext } from '../core/Renderer.js';
import { Entity } from '../core/Entity.js';
import { circleHit } from '../core/collision.js';
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

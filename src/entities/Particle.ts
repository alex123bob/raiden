import type { GameContext } from '../core/GameContext.js';
import type { RenderContext } from '../core/Renderer.js';
import { Entity } from '../core/Entity.js';
import { PARTICLE_KINDS } from '../registries/particles/index.js';

export interface ParticleKind {
  readonly key: string;
  spawn(ctx: GameContext, x: number, y: number, opts: Record<string, unknown>): void;
  update(p: Particle, dt: number, ctx: GameContext): void;
  render(rc: RenderContext, p: Particle): void;
}

export class Particle extends Entity {
  vx = 0;
  vy = 0;
  life = 1.0;
  decay = 1.0;
  color = '#ff8800';
  constructor(public readonly def: ParticleKind, x: number, y: number) {
    super(x, y, 0);
  }
  update(dt: number, ctx: GameContext): void {
    this.life -= this.decay * dt;
    if (this.life <= 0) { this.alive = false; return; }
    this.def.update(this, dt, ctx);
  }
  draw(rc: RenderContext, _ctx: GameContext): void {
    this.def.render(rc, this);
  }
}

export function spawnParticleKind(kind: string, x: number, y: number,
                                  opts: Record<string, unknown>, ctx: GameContext): void {
  const def = PARTICLE_KINDS.get(kind);
  if (!def) return;
  def.spawn(ctx, x, y, opts);
}

// Backward-compat wrappers used by the still-unmigrated Player.ts, Boss.ts and
// collision.ts callers (signature matches the old particles.ts exactly).
// Deleted in Task 10 once every caller uses ctx.spawnParticles.
export function spawnExplosion(x: number, y: number, size: number, color: string, ctx: GameContext): void {
  spawnParticleKind('explosion', x, y, { size, color }, ctx);
}
export function spawnBombFlash(ctx: GameContext): void {
  spawnParticleKind('bombFlash', 0, 0, {}, ctx);
}

export function updateParticles(dt: number, ctx: GameContext): void {
  for (let i = ctx.particles.length - 1; i >= 0; i--) {
    const p = ctx.particles[i];
    p.update(dt, ctx);
    if (!p.alive) ctx.particles.splice(i, 1);
  }
}

export function drawParticles(rc: RenderContext, ctx: GameContext): void {
  ctx.particles.forEach(p => p.draw(rc, ctx));
}

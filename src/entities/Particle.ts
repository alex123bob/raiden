import type { GameContext } from '../core/GameContext.js';
import type { RenderContext } from '../core/Renderer.js';
import { Entity } from '../core/Entity.js';
import { PARTICLE_KINDS } from '../registries/particles/index.js';

/**
 * Behavioral definition of one particle kind (explosion, bombFlash, superFlash),
 * held in the PARTICLE_KINDS registry. Shared by reference; holds only the
 * spawn/update/render behavior, never per-instance state.
 */
export interface ParticleKind {
  /** Registry key, e.g. 'explosion' | 'bombFlash' | 'superFlash'. */
  readonly key: string;
  /** Create and push one or more Particle instances into ctx.particles at (x,y); opts tune size/color/etc. */
  spawn(ctx: GameContext, x: number, y: number, opts: Record<string, unknown>): void;
  /** Advance this particle's kind-specific motion/fields for the frame (life/decay are handled by Particle.update). */
  update(p: Particle, dt: number, ctx: GameContext): void;
  /** Draw the particle in world space (no prior translate; render fns read p.x/p.y). */
  render(rc: RenderContext, p: Particle): void;
}

/**
 * A transient visual effect instance (spark, explosion fragment, screen flash,
 * charge ring, ...). Position comes from Entity; this adds velocity, a
 * fade-out lifetime, and per-kind extras. Despawns itself once `life` runs out.
 */
export class Particle extends Entity {
  /** Velocity x in pixels/second. Not all kinds use this (e.g. full-screen flashes stay put). */
  vx = 0;
  /** Velocity y in pixels/second. */
  vy = 0;
  /** Remaining lifetime, in the kind's own units (commonly 0..1); despawns at/below 0. */
  life = 1.0;
  /** Per-second rate `life` drains at: life -= decay * dt. Higher = shorter-lived. */
  decay = 1.0;
  /** Fill/stroke color (CSS color string); meaning is kind-specific. */
  color = '#ff8800';
  /** Optional kind-specific state (e.g. precomputed geometry, like bombFlash's crack lines). */
  data: unknown = null;
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

/** Look up `kind` in PARTICLE_KINDS and spawn it at (x,y) with `opts`; unknown kinds are a silent no-op. */
export function spawnParticleKind(kind: string, x: number, y: number,
                                  opts: Record<string, unknown>, ctx: GameContext): void {
  const def = PARTICLE_KINDS.get(kind);
  if (!def) return;
  def.spawn(ctx, x, y, opts);
}

/** Advance every live particle by dt, removing any that expired this frame. */
export function updateParticles(dt: number, ctx: GameContext): void {
  for (let i = ctx.particles.length - 1; i >= 0; i--) {
    const p = ctx.particles[i];
    p.update(dt, ctx);
    if (!p.alive) ctx.particles.splice(i, 1);
  }
}

/** Draw every live particle, in array order (oldest first). */
export function drawParticles(rc: RenderContext, ctx: GameContext): void {
  ctx.particles.forEach(p => p.draw(rc, ctx));
}

import { describe, it, expect } from 'vitest';
import { PARTICLE_KINDS } from '../src/registries/particles/index.js';
import { spawnParticleKind } from '../src/entities/Particle.js';
import { stubContext } from './context-stub.js';
import { CanvasRenderer } from '../src/core/Renderer.js';
import { noopCtx } from './dom-setup.js';

describe('particle kinds', () => {
  it('registers explosion and bombFlash', () => {
    expect(PARTICLE_KINDS.all().map(k => k.key).sort()).toEqual(['bombFlash', 'explosion']);
  });

  it('spawnExplosion pushes the declared particle count and never throws', () => {
    const g = stubContext();
    const x = 10, y = 20, size = 2;
    spawnParticleKind('explosion', x, y, { size, color: '#ff8800' }, g);
    expect(g.particles.length).toBe(6 + size * 4);
    for (const p of g.particles) {
      expect(p.x).toBe(x); expect(p.y).toBe(y);
      expect(p.r).toBeGreaterThanOrEqual(2); expect(p.r).toBeLessThanOrEqual(2 + size * 3);
    }
  });

  it('spawnBombFlash pushes exactly one full-screen flash particle', () => {
    const g = stubContext();
    spawnParticleKind('bombFlash', 0, 0, {}, g);
    expect(g.particles.length).toBe(1);
    const rc = new CanvasRenderer(noopCtx);
    expect(() => g.particles[0].update(1 / 60, g)).not.toThrow();
    expect(() => g.particles[0].draw(rc, g)).not.toThrow();
  });

  it('an unknown kind is a silent no-op', () => {
    const g = stubContext();
    expect(() => spawnParticleKind('doesNotExist', 0, 0, {}, g)).not.toThrow();
    expect(g.particles.length).toBe(0);
  });
});

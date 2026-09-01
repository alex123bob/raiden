import { describe, it, expect } from 'vitest';
import { checkGraze, GRAZE_RADIUS } from '../src/core/collision.js';
import { stubContext } from './context-stub.js';

function bullet(x: number, y: number) {
  return { x, y, r: 3, vx: 0, vy: 0, dmg: 1 } as never;
}

describe('graze detection', () => {
  it('grazes a near-miss bullet exactly once and spawns a particle', () => {
    const g = stubContext();
    g.player!.x = 100; g.player!.y = 100; g.player!.invTimer = 0; g.player!.dead = false;
    // Just outside the hit radius but inside the graze band.
    const gap = g.player!.r + GRAZE_RADIUS - 2;
    g.enemyBullets.push(bullet(100 + gap, 100));
    checkGraze(g);
    expect(g.particles.length).toBeGreaterThan(0);
    expect((g.enemyBullets[0] as { grazed?: boolean }).grazed).toBe(true);
    const n = g.particles.length;
    checkGraze(g);                       // second pass: already grazed, no new particle
    expect(g.particles.length).toBe(n);
  });

  it('does not graze a bullet that is far away', () => {
    const g = stubContext();
    g.player!.x = 100; g.player!.y = 100;
    g.enemyBullets.push(bullet(300, 300));
    checkGraze(g);
    expect((g.enemyBullets[0] as { grazed?: boolean }).grazed).toBeFalsy();
  });

  it('is a no-op while the player is dead or invulnerable', () => {
    const g = stubContext();
    g.player!.x = 100; g.player!.y = 100; g.player!.invTimer = 5;
    g.enemyBullets.push(bullet(100, 100));
    expect(() => checkGraze(g)).not.toThrow();
    expect((g.enemyBullets[0] as { grazed?: boolean }).grazed).toBeFalsy();
  });
});

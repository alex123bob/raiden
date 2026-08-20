import { describe, it, expect } from 'vitest';
import { mkBullet, firePlayer, fireSuper } from '../src/entities/Bullet.js';
import { Enemy } from '../src/entities/Enemy.js';
import { ENEMY_TYPES } from '../src/registries/enemies/index.js';
import { stubContext } from './context-stub.js';

describe('bullet kinds', () => {
  it('vulcan firePlayer lv1 fires two 5-damage bullets', () => {
    const g = stubContext();
    const p = g.player!;
    p.x = 240; p.y = 500;
    p.weapons = [{ type: 0, lv: 1 }];
    firePlayer(p, g);
    expect(g.playerBullets.length).toBe(2);
    for (const b of g.playerBullets) expect(b.dmg).toBe(5);
  });

  it('missile homes toward the nearest enemy', () => {
    const g = stubContext();
    const e = new Enemy(ENEMY_TYPES.get('fighter')!, 100, 100, null);
    g.enemies.push(e);
    const m = mkBullet('missile', 240, 300, -Math.PI / 2);
    m.homingDelay = 0;
    g.playerBullets.push(m);
    for (let i = 0; i < 20; i++) m.update(1 / 60, g);
    expect(m.vx).toBeLessThan(0);   // steered left toward the enemy
    expect(m.vy).toBeLessThan(0);   // steered upward toward the enemy
  });

  it('fireSuper lv5 vulcan fires 12 bullets at 15 damage, r 6', () => {
    const g = stubContext();
    const p = g.player!;
    p.x = 240; p.y = 500;
    p.weapons = [{ type: 0, lv: 5 }];
    fireSuper(p, g);
    expect(g.playerBullets.length).toBe(12);
    for (const b of g.playerBullets) {
      expect(b.dmg).toBe(15);
      expect(b.r).toBe(6);
    }
  });

  it('fireSuper spread fires 16 bullets at 18 damage, r 7', () => {
    const g = stubContext();
    const p = g.player!;
    p.x = 240; p.y = 500;
    p.weapons = [{ type: 1, lv: 5 }];
    fireSuper(p, g);
    expect(g.playerBullets.length).toBe(16);
    for (const b of g.playerBullets) {
      expect(b.dmg).toBe(18);
      expect(b.r).toBe(7);
    }
  });

  it('fireSuper in a combo only fires the maxed slot(s)', () => {
    const g = stubContext();
    const p = g.player!;
    p.x = 240; p.y = 500;
    // Slot 0 not maxed (missile L3), slot 1 maxed (vulcan L5).
    p.weapons = [{ type: 2, lv: 3 }, { type: 0, lv: 5 }];
    fireSuper(p, g);
    // Only the vulcan super (12 bullets, r6 dmg15) — the L3 missile sits out.
    expect(g.playerBullets.length).toBe(12);
    for (const b of g.playerBullets) {
      expect(b.dmg).toBe(15);
      expect(b.r).toBe(6);
    }
  });

  it('fireSuper with both slots maxed fires both supers', () => {
    const g = stubContext();
    const p = g.player!;
    p.x = 240; p.y = 500;
    p.weapons = [{ type: 0, lv: 5 }, { type: 1, lv: 5 }];
    fireSuper(p, g);
    // 12 vulcan (r6/dmg15) + 16 spread (r7/dmg18).
    expect(g.playerBullets.length).toBe(12 + 16);
    expect(g.playerBullets.filter(b => b.r === 6 && b.dmg === 15).length).toBe(12);
    expect(g.playerBullets.filter(b => b.r === 7 && b.dmg === 18).length).toBe(16);
  });
});

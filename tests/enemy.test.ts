import { describe, it, expect, vi, afterEach } from 'vitest';
import { Enemy, updateEnemies } from '../src/entities/Enemy.js';
import { ENEMY_TYPES } from '../src/registries/enemies/index.js';
import { enemyHpScale, fireIntervalScale, extraBulletStreams } from '../src/core/difficulty.js';
import { stubContext } from './context-stub.js';

afterEach(() => vi.restoreAllMocks());

describe('enemy difficulty levers', () => {
  it('Enemy scales hp with the stage when ctx is passed', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const e = new Enemy(ENEMY_TYPES.get('fighter')!, 0, 0, null, { currentStage: 18 });
    expect(e.hp).toBe(Math.ceil(3 * enemyHpScale(18)));
    const eBase = new Enemy(ENEMY_TYPES.get('fighter')!, 0, 0, null);
    expect(eBase.hp).toBe(3);
  });

  it('fire fires base shots plus extra streams at milestone stages', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const g = stubContext({ currentStage: 18, diffMult: 1 });
    const e = new Enemy(ENEMY_TYPES.get('fighter')!, 240, 130, null);
    e.fire(g);
    expect(g.enemyBullets.length).toBe(1 + extraBulletStreams(18));
  });

  it('updateEnemies applies the fire-interval scale for turrets', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const g = stubContext({ currentStage: 18, diffMult: 1 });
    g.player.x = 240; g.player.y = 200;
    const e = new Enemy(ENEMY_TYPES.get('turret')!, 240, 220, null);
    e.fireTimer = 0;
    g.enemies.push(e);
    updateEnemies(1 / 60, g);
    const baseInterval = 1.6;
    const scaled = (baseInterval * fireIntervalScale(18)) / 1;
    expect(e.fireTimer).toBeCloseTo(scaled + 0.25, 5);
  });

  it('bomber fires a 5-bullet downward fan', () => {
    const g = stubContext();
    const e = new Enemy(ENEMY_TYPES.get('bomber')!, 240, 130, null);
    e.fire(g);
    expect(g.enemyBullets.length).toBe(5);
    for (const b of g.enemyBullets) {
      expect(b.clr).toBe('#ffcc00');
      expect(b.vy).toBeGreaterThan(0);
    }
  });

  it('turret only fires in range and staggers its 3-shot burst', () => {
    const g = stubContext();
    g.player.x = 240; g.player.y = 500;   // dist 280 > 260 -> out of range
    const far = new Enemy(ENEMY_TYPES.get('turret')!, 240, 220, null);
    far.fireTimer = 0;
    g.enemies.push(far);
    updateEnemies(1 / 60, g);
    expect(g.enemyBullets.length).toBe(0);

    g.enemyBullets.length = 0;
    g.player.x = 240; g.player.y = 200;   // dist 20 < 260 -> in range
    const near = new Enemy(ENEMY_TYPES.get('turret')!, 240, 220, null);
    near.fireTimer = 0;
    g.enemies.push(near);
    updateEnemies(1 / 60, g);
    expect(g.enemyBullets.length).toBe(3);
    expect((g.enemyBullets as unknown as { delay: number }[]).map(b => b.delay))
      .toEqual([0, 0.08, 0.16]);
  });

  it('turret barrel tracks the player', () => {
    const g = stubContext();
    g.player.x = 240; g.player.y = 180;   // directly above the turret
    const e = new Enemy(ENEMY_TYPES.get('turret')!, 240, 220, null);
    e.update(1 / 60, g);
    expect(e.angle).toBeCloseTo(0, 5);    // atan2(0, 40) = 0 -> points up
  });
});

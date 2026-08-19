import { describe, it, expect, vi, afterEach } from 'vitest';
import { mkEnemy, fireEnemy, updateEnemies } from '../src/entities/Enemy.js';
import { extraBulletStreams, enemyHpScale, fireIntervalScale } from '../src/core/difficulty.js';

afterEach(() => vi.restoreAllMocks());

describe('enemy difficulty levers', () => {
  it('mkEnemy scales hp with the stage when g is passed', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const e = mkEnemy(0, 0, 0, null, { currentStage: 18 });
    expect(e.hp).toBe(Math.ceil(3 * enemyHpScale(18)));   // type 0 base hp 3
    const eBase = mkEnemy(0, 0, 0, null);                  // no g -> base hp
    expect(eBase.hp).toBe(3);
  });

  it('fireEnemy fires base shots plus extra streams at milestone stages', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const g = { currentStage: 18, diffMult: 1, player: { x: 240, y: 300, dead: false }, enemyBullets: [] };
    const e = mkEnemy(0, 240, 130, null);
    fireEnemy(e, g);
    expect(g.enemyBullets.length).toBe(1 + extraBulletStreams(18));  // type 0 = 1 aimed shot + 4 streams
  });

  it('updateEnemies applies the fire-interval scale for turrets', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const g = {
      currentStage: 18, diffMult: 1,
      player: { x: 240, y: 200, dead: false },
      enemies: [], enemyBullets: [],
    };
    const e = mkEnemy(3, 240, 220, null);  // turret, in range of player
    e.fireTimer = 0;
    g.enemies.push(e);
    updateEnemies(1 / 60, g);
    const baseInterval = 1.6;              // turret base interval
    const scaled = (baseInterval * fireIntervalScale(18)) / 1;
    expect(e.fireTimer).toBeCloseTo(scaled + 0.25, 5);   // jitter is Math.random()*0.5, random fixed at 0.5
  });
});

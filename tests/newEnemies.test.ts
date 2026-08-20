import { describe, it, expect, vi, afterEach } from 'vitest';
import { Enemy, updateEnemies } from '../src/entities/Enemy.js';
import { ENEMY_TYPES } from '../src/registries/enemies/index.js';
import { STAGES } from '../src/stages/stageData.js';
import { CanvasRenderer } from '../src/core/Renderer.js';
import { noopCtx } from './dom-setup.js';
import { stubContext } from './context-stub.js';

afterEach(() => vi.restoreAllMocks());

describe('every stage wave references a registered enemy type', () => {
  it('ENEMY_TYPES has an entry for every waves[].type in STAGES', () => {
    for (let s = 1; s <= STAGES.length; s++) {
      for (const w of STAGES[s - 1].waves as { type?: string }[]) {
        if (w.type) expect(ENEMY_TYPES.has(w.type), `stage ${s} unregistered enemy '${w.type}'`).toBe(true);
      }
    }
  });
});

describe('swarmer', () => {
  it('never fires', () => {
    const g = stubContext();
    const e = new Enemy(ENEMY_TYPES.get('swarmer')!, 240, 130, null);
    e.fire(g);
    expect(g.enemyBullets.length).toBe(0);
  });

  it('dies in one hit and renders without throwing', () => {
    const e = new Enemy(ENEMY_TYPES.get('swarmer')!, 240, 130, null);
    expect(e.hp).toBe(1);
    expect(() => e.draw(new CanvasRenderer(noopCtx), stubContext())).not.toThrow();
  });
});

describe('dropship', () => {
  it('releases two fighter drones instead of firing bullets', () => {
    const g = stubContext();
    const e = new Enemy(ENEMY_TYPES.get('dropship')!, 240, 130, null);
    e.fire(g);
    expect(g.enemyBullets.length).toBe(0);
    expect(g.enemies.length).toBe(2);
    expect(g.enemies.every(child => child.def.key === 'fighter')).toBe(true);
    expect(g.enemies[0].x).toBeLessThan(e.x);
    expect(g.enemies[1].x).toBeGreaterThan(e.x);
  });

  it('drones spawn via updateEnemies on its fire interval', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const g = stubContext();
    const e = new Enemy(ENEMY_TYPES.get('dropship')!, 240, 130, null);
    e.fireTimer = 0;
    g.enemies.push(e);
    updateEnemies(1 / 60, g);
    expect(g.enemies.filter(x => x.def.key === 'fighter').length).toBe(2);
  });
});

describe('seeker', () => {
  it('weaves side to side while descending', () => {
    const g = stubContext();
    const e = new Enemy(ENEMY_TYPES.get('seeker')!, 240, 0, null);
    const x0 = e.x;
    e.def.movement(e, 1 / 60, g);
    expect(e.y).toBeGreaterThan(0);
    expect(e.x).not.toBe(x0);
  });

  it('fires a homing missile that steers toward the player', () => {
    const g = stubContext();
    g.player!.x = 400; g.player!.y = 400;
    const e = new Enemy(ENEMY_TYPES.get('seeker')!, 240, 130, null);
    e.fire(g);
    expect(g.enemyBullets.length).toBe(1);
    const b = g.enemyBullets[0];
    expect(b.def.key).toBe('enemyMissile');
    b.homingDelay = 0;
    const vxBefore = b.vx, vyBefore = b.vy;
    b.update(1 / 60, g);
    expect(b.vx).not.toBe(vxBefore);
    expect(b.vy).not.toBe(vyBefore);
  });
});

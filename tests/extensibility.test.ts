import { describe, it, expect } from 'vitest';
import { Boss, createBoss } from '../src/entities/Boss.js';
import { BOSS_TYPES, registerBossType, type BossType } from '../src/registries/bosses/index.js';
import { CanvasRenderer } from '../src/core/Renderer.js';
import { noopCtx } from './dom-setup.js';
import { stubContext } from './context-stub.js';

const demo: BossType = {
  key: 'demo',
  tint: null,
  r: 40,
  patterns: [
    { name: 'aimSpread', spdBase: 100, spdPhase: 0, count: 3, gap: 0.2, clr: '#00ff00' },
  ],
  render(c, boss) {
    c.fillStyle = '#00ff00';
    c.beginPath(); c.arc(0, 0, boss.r, 0, Math.PI * 2); c.fill();
  },
};

describe('extensibility: adding a variant touches no existing family file', () => {
  it('a demo 9th boss registers and plays via the same machinery as the built-ins', () => {
    expect(BOSS_TYPES.has('demo')).toBe(false);
    registerBossType(demo);
    expect(BOSS_TYPES.has('demo')).toBe(true);

    const g = stubContext({ currentStage: 1 });
    const boss = new Boss(demo, 1, g);
    expect(boss.def).toBe(demo);
    boss.fire(g);
    expect(g.enemyBullets.length).toBe(3);        // aimSpread count 3
    expect(() => boss.draw(new CanvasRenderer(noopCtx), g)).not.toThrow();
  });

  it('createBoss still resolves built-in stages after the addition', () => {
    const g = stubContext({ currentStage: 1 });
    const boss = createBoss(g);
    expect(boss.def.key).toBe('blaze');
    expect(boss.hp).toBeGreaterThan(0);
  });
});

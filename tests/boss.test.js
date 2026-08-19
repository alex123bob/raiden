import { describe, it, expect, vi } from 'vitest';
import { STAGES } from '../src/stages/stageData.js';
import { fireBoss, drawBoss } from '../src/entities/Boss.js';

// pattern-name -> required option keys
const REQUIRED = {
  aimSpread:    ['count', 'gap', 'clr'],
  ring:         ['count', 'clr'],
  aimBurst:     ['offsets', 'clr'],
  sideAlternate: [],
  laserSweep:   ['count', 'halfSpan', 'clr'],
  scatter:      ['count', 'clr'],
  jitter:       ['clr'],
};

const NEEDS_1 = ['aimSpread', 'ring', 'laserSweep', 'scatter'];   // spdBase required
const NEEDS_2 = ['aimBurst'];                                      // spdBase required

describe('boss pattern data', () => {
  it('every stage 1-8 has a boss with patterns covering all phases', () => {
    for (let s = 1; s <= 8; s++) {
      const boss = STAGES[s - 1].boss;
      expect(boss.patterns.length).toBeGreaterThanOrEqual(boss.phaseCount);
      for (const entry of boss.patterns) {
        const list = Array.isArray(entry) ? entry : [entry];
        for (const p of list) {
          expect(p.name, `stage ${s} pattern name`).toBeDefined();
          expect(REQUIRED[p.name], `stage ${s} unknown pattern ${p.name}`).toBeDefined();
          for (const k of REQUIRED[p.name]) {
            expect(p[k], `stage ${s} ${p.name} missing ${k}`).toBeDefined();
          }
        }
      }
    }
  });

  it('every stage 1-8 has spdBase and non-negative spdPhase', () => {
    for (let s = 1; s <= 8; s++) {
      for (const entry of STAGES[s - 1].boss.patterns) {
        const list = Array.isArray(entry) ? entry : [entry];
        for (const p of list) {
          if (NEEDS_1.includes(p.name) || NEEDS_2.includes(p.name)) {
            expect(p.spdBase, `stage ${s} ${p.name}`).toBeGreaterThan(0);
          }
          expect(p.spdPhase, `stage ${s} ${p.name}`).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

describe('fireBoss dispatch', () => {
  function makeG(boss, opts = {}) {
    return {
      player: { x: 240, y: 300, dead: false },
      boss,
      enemyBullets: [],
      bossPhase: opts.bossPhase ?? 0,
      bossAngle: opts.bossAngle ?? 0,
      bossTimer: opts.bossTimer ?? 0,
      diffMult: opts.diffMult ?? 1.0,
    };
  }

  it('fires the bullet counts the stage data declares (one phase per stage)', () => {
    // [stage, phase] samples — bullet counts verified against the original fireBossN
    const samples = [
      [1, 0], [2, 1], [3, 2], [4, 1], [5, 0], [6, 2], [7, 3], [8, 4],
    ];
    for (const [s, phase] of samples) {
      const boss = { ...STAGES[s - 1].boss, x: 240, y: 130, r: 50 };
      const g = makeG(boss, { bossPhase: phase });
      fireBoss(g);
      const expectCount = (() => {
        const entry = boss.patterns[phase % boss.patterns.length];
        const list = Array.isArray(entry) ? entry : [entry];
        return list.reduce((n, p) => {
          if (p.name === 'aimSpread') return n + p.count;
          if (p.name === 'ring') return n + p.count;
          if (p.name === 'aimBurst') return n + p.offsets.length;
          if (p.name === 'sideAlternate') return n + 3;
          if (p.name === 'laserSweep') return n + p.count + 1;
          if (p.name === 'scatter') return n + p.count;
          if (p.name === 'jitter') return n + 1;
          return n;
        }, 0);
      })();
      expect(g.enemyBullets.length, `stage ${s} phase ${phase}`).toBe(expectCount);
    }
  });

  it('wraps bossPhase beyond patterns.length without throwing', () => {
    const boss = { ...STAGES[0].boss, x: 240, y: 130, r: 50 };
    const g = makeG(boss, { bossPhase: boss.patterns.length });
    expect(() => fireBoss(g)).not.toThrow();
  });

  it('returns early when player is dead or missing', () => {
    const boss = { ...STAGES[0].boss, x: 240, y: 130, r: 50 };
    const gDead = makeG(boss);
    gDead.player.dead = true;
    expect(() => fireBoss(gDead)).not.toThrow();
    expect(gDead.enemyBullets.length).toBe(0);
    const gNoPlayer = makeG(boss);
    gNoPlayer.player = null;
    expect(() => fireBoss(gNoPlayer)).not.toThrow();
  });
});

describe('boss draw paths', () => {
  it('every stage 1-8 boss has tint null, so the direct-render fast path is used (pixel identity)', () => {
    for (let s = 1; s <= 8; s++) {
      expect(STAGES[s - 1].boss.tint, `stage ${s} tint`).toBeNull();
    }
  });

  it('drawBoss renders every archetype without throwing (fast path and tint path)', () => {
    for (let s = 1; s <= 8; s++) {
      const boss = { ...STAGES[s - 1].boss, x: 240, y: 130, r: 50, hp: 100, stageNum: s };
      const g = { boss, bossAngle: 0.7, bossTimer: 1.2, bossMaxHp: 100 };
      expect(() => drawBoss(g), `stage ${s} fast path`).not.toThrow();
    }
    const tinted = { ...STAGES[0].boss, x: 240, y: 130, r: 50, hp: 100, stageNum: 1, tint: '#ff0000' };
    const gTint = { boss: tinted, bossAngle: 0.7, bossTimer: 1.2, bossMaxHp: 100 };
    expect(() => drawBoss(gTint)).not.toThrow();
  });
});

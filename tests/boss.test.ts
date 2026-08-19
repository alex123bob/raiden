import { describe, it, expect } from 'vitest';
import { STAGES } from '../src/stages/stageData.js';
import { Boss, createBoss } from '../src/entities/Boss.js';
import { BOSS_TYPES, type PhasePattern } from '../src/registries/bosses/index.js';
import { BULLET_PATTERNS } from '../src/registries/bullets/patterns.js';
import { bossHpForStage, phaseCountForStage } from '../src/core/difficulty.js';
import { CanvasRenderer, type RenderContext } from '../src/core/Renderer.js';
import { noopCtx } from './dom-setup.js';
import { stubContext } from './context-stub.js';

const REQUIRED: Record<string, string[]> = {
  aimSpread: ['count', 'gap', 'clr'],
  ring: ['count', 'clr'],
  aimBurst: ['offsets', 'clr'],
  sideAlternate: [],
  laserSweep: ['count', 'halfSpan', 'clr'],
  scatter: ['count', 'clr'],
  jitter: ['clr'],
};
const NEEDS_1 = ['aimSpread', 'ring', 'laserSweep', 'scatter'];
const NEEDS_2 = ['aimBurst'];

describe('boss pattern data', () => {
  it('every registered pattern name has a REQUIRED entry', () => {
    for (const p of BULLET_PATTERNS.all()) {
      expect(REQUIRED[p.key], `unknown pattern ${p.key}`).toBeDefined();
    }
  });

  it('every stage has a boss whose patterns cover all phases and are registered', () => {
    for (let s = 1; s <= STAGES.length; s++) {
      const boss = STAGES[s - 1].boss;
      expect(boss.patterns.length).toBe(phaseCountForStage(s));
      for (const entry of boss.patterns) {
        const list: PhasePattern[] = Array.isArray(entry) ? entry : [entry];
        for (const p of list) {
          expect(p.name, `stage ${s} pattern name`).toBeDefined();
          expect(REQUIRED[p.name], `stage ${s} unknown pattern ${p.name}`).toBeDefined();
          expect(BULLET_PATTERNS.has(p.name), `stage ${s} unregistered pattern ${p.name}`).toBe(true);
          for (const k of REQUIRED[p.name]) {
            expect(p[k as keyof typeof p], `stage ${s} ${p.name} missing ${k}`).toBeDefined();
          }
          if (p.name === 'laserSweep') {
            expect(p.count, `stage ${s} laserSweep count`).toBeGreaterThan(1);
          }
        }
      }
    }
  });

  it('every stage has spdBase and non-negative spdPhase', () => {
    for (let s = 1; s <= STAGES.length; s++) {
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

describe('Boss.fire dispatch', () => {
  function bossAt(stage: number, phase: number): { boss: Boss; g: ReturnType<typeof stubContext> } {
    const g = stubContext({ currentStage: stage });
    const boss = createBoss(g);
    boss.x = 240; boss.y = 130;
    g.bossPhase = phase;
    return { boss, g };
  }

  it('fires the bullet counts the stage data declares (one phase per stage)', () => {
    const samples = [
      [1, 0], [2, 1], [3, 2], [4, 1], [5, 0], [6, 2], [7, 3], [8, 4],
    ];
    for (const [s, phase] of samples) {
      const { boss, g } = bossAt(s as number, phase as number);
      boss.fire(g);
      const expectCount = (() => {
        const entry = boss.def.patterns[phase % boss.def.patterns.length];
        const list = Array.isArray(entry) ? entry : [entry];
        return list.reduce((n, p) => {
          if (p.name === 'aimSpread') return n + (p.count ?? 0);
          if (p.name === 'ring') return n + (p.count ?? 0);
          if (p.name === 'aimBurst') return n + (p.offsets?.length ?? 0);
          if (p.name === 'sideAlternate') return n + 3;
          if (p.name === 'laserSweep') return n + (p.count ?? 0) + 1;
          if (p.name === 'scatter') return n + (p.count ?? 0);
          if (p.name === 'jitter') return n + 1;
          return n;
        }, 0);
      })();
      expect(g.enemyBullets.length, `stage ${s} phase ${phase}`).toBe(expectCount);
    }
  });

  it('wraps bossPhase beyond patterns.length without throwing', () => {
    const { boss, g } = bossAt(1, 0);
    g.bossPhase = boss.def.patterns.length;
    expect(() => boss.fire(g)).not.toThrow();
  });

  it('returns early when player is dead or missing', () => {
    const { boss, g } = bossAt(1, 0);
    g.player!.dead = true;
    expect(() => boss.fire(g)).not.toThrow();
    expect(g.enemyBullets.length).toBe(0);
    g.player = null;
    expect(() => boss.fire(g)).not.toThrow();
  });
});

describe('boss draw paths', () => {
  it('every stage 1-8 boss has tint null, so the direct-render fast path is used (pixel identity)', () => {
    for (let s = 1; s <= 8; s++) {
      expect(STAGES[s - 1].boss.tint, `stage ${s} tint`).toBeNull();
    }
  });

  it('Boss.draw renders every archetype (fast path and tint path) and actually draws', () => {
    // Counting renderer: catches "renders nothing" regressions (e.g. a bad archetype key).
    function countingContext() {
      let calls = 0;
      const c = new Proxy({} as Record<string, unknown>, {
        get(t, prop) {
          if (prop in t) return (t as Record<PropertyKey, unknown>)[prop];
          if (prop === 'createRadialGradient' || prop === 'createLinearGradient')
            return () => ({ addColorStop() {} });
          return (..._a: unknown[]) => { calls++; return undefined; };
        },
        set() { return true; },
      }) as unknown as CanvasRenderingContext2D;
      return { c, count: () => calls };
    }

    const spy = countingContext();
    const rc: RenderContext = new CanvasRenderer(spy.c);
    for (let s = 1; s <= 8; s++) {
      const g = stubContext({ currentStage: s });
      const boss = createBoss(g);
      boss.x = 240; boss.y = 130; boss.hp = 100;
      expect(() => boss.draw(rc, g), `stage ${s} fast path`).not.toThrow();
      expect(spy.count(), `stage ${s} draw should emit canvas calls`).toBeGreaterThan(0);
    }
    const g = stubContext({ currentStage: 1 });
    const tinted = new Boss({ ...BOSS_TYPES.get('blaze')!, tint: '#ff0000' }, 1, g);
    expect(() => tinted.draw(rc, g)).not.toThrow();
    expect(spy.count()).toBeGreaterThan(0);
  });
});

describe('Boss.update behavior', () => {
  it('advances bossPhase as hp drops', () => {
    const g = stubContext({ currentStage: 6 });   // carrier: phaseCount 4
    const boss = createBoss(g);
    const max = boss.maxHp;
    boss.update(1 / 60, g);
    expect(g.bossPhase).toBe(0);
    boss.hp = max * 0.7;
    boss.update(1 / 60, g);
    expect(g.bossPhase).toBe(1);   // 3 - floor(0.7*4) = 1
    boss.hp = max * 0.3;
    boss.update(1 / 60, g);
    expect(g.bossPhase).toBe(2);   // 3 - floor(0.3*4) = 2
    boss.hp = 0;
    boss.update(1 / 60, g);
    expect(g.bossPhase).toBe(3);
  });

  it('spawns minions on the spawnMinions cadence', () => {
    const g = stubContext({ currentStage: 6, diffMult: 1 });
    const boss = createBoss(g);
    boss.update(3.01, g);
    expect(g.enemies.length).toBe(1);
    expect(boss.minionTimer).toBeCloseTo(3.0, 5);
  });

  it('phantom onUpdate flickers alpha', () => {
    const g = stubContext({ currentStage: 7 });
    const boss = createBoss(g);
    boss.update(0.1, g);
    expect(boss.phantomAlpha).toBeGreaterThan(0.3);
    expect(boss.phantomAlpha).toBeLessThan(1.0);
  });
});

describe('boss def defaults', () => {
  it('each def default patterns match its archetype first-appearance stage', () => {
    const firstAppearance: Record<string, number> = {
      blaze: 1, hexa: 2, dreadnaught: 3, viper: 4, solar: 5, carrier: 6, phantom: 7, tyrant: 8,
    };
    for (const def of BOSS_TYPES.all()) {
      const stageDef = STAGES[firstAppearance[def.key] - 1].boss;
      expect(def.patterns, def.key).toEqual(stageDef.patterns);
    }
  });
});

describe('createBoss difficulty integration', () => {
  it('boss hp matches bossMaxHp and phaseCount matches the formula', () => {
    for (let s = 1; s <= STAGES.length; s++) {
      const g = stubContext({ currentStage: s });
      const boss = createBoss(g);
      expect(boss.hp).toBe(g.bossMaxHp);
      expect(g.bossMaxHp).toBe(bossHpForStage(s));
      expect(boss.phaseCount).toBe(phaseCountForStage(s));
    }
  });
});

import { describe, it, expect } from 'vitest';
import { buildWaveTable, MOTION, pathArc, pathZigzag } from '../src/stages/waveGen.js';
import { STAGES } from '../src/stages/stageData.js';

describe('buildWaveTable', () => {
  it('produces a t-sorted table ending with the stage boss for every stage 1-18', () => {
    for (let s = 1; s <= STAGES.length; s++) {
      const table = buildWaveTable(STAGES[s - 1], 1.0);
      const ts = table.map(e => e.t);
      expect(ts).toEqual([...ts].sort((a, b) => a - b));
      expect(table[table.length - 1].boss).toBe(s);
      expect(table.length).toBeGreaterThan(0);
    }
  });

  it('stage 1 has exactly 46 entries (5+2+4+3+1+6+1+3+2+2+8+4+4+boss)', () => {
    const table = buildWaveTable(STAGES[0], 1.0);
    expect(table.length).toBe(46);
  });

  it('stage 8 has exactly 64 entries with all regular enemies elite', () => {
    const table = buildWaveTable(STAGES[7], 1.0);
    expect(table.length).toBe(64);
    const regulars = table.filter(e => !e.boss);
    expect(regulars.length).toBeGreaterThan(0);
    expect(regulars.every(e => e.eliteHp === true)).toBe(true);
  });

  it('scales path speed by diffMult', () => {
    const table = buildWaveTable(STAGES[0], 2.0);
    const form = table.find(e => e.type === 'fighter')!;
    const path = form.path!;
    const p0 = path(0);
    const p1 = path(1);
    expect(p1.y - p0.y).toBeCloseTo(105 * 2.0);   // stage 1 formation factor 105
  });

  it('registers Phase 3 motion descriptors', () => {
    expect(MOTION.has('arc')).toBe(true);
    expect(MOTION.has('zigzag')).toBe(true);
  });

  it('arc and zigzag paths move laterally while preserving vertical speed scaling', () => {
    const arc = pathArc(-40, -30, 120 * 2.0, 80, 2.0);
    expect(arc(1).x).toBeGreaterThan(arc(0).x);
    expect(arc(1).y - arc(0).y).toBeCloseTo(240);

    const zigzag = pathZigzag(240, -20, 90 * 1.5, 50, 1.0);
    expect(zigzag(0).x).toBeCloseTo(190);
    expect(zigzag(0.5).x).toBeCloseTo(290);
    expect(zigzag(1).y - zigzag(0).y).toBeCloseTo(135);
  });

  it('stages 9-18 include the Phase 3 enemy roles and movement vocabulary', () => {
    const phase3Kinds = new Set<string>();
    for (let s = 9; s <= STAGES.length; s++) {
      const waves = STAGES[s - 1].waves as { type?: string; path?: (string | number)[] }[];
      const types = new Set(waves.map(w => w.type).filter(Boolean) as string[]);
      const pathKinds = new Set(waves.map(w => w.path?.[0]).filter(Boolean) as string[]);

      expect(types.has('interceptor'), `stage ${s} interceptor`).toBe(true);
      expect(types.has('minelayer'), `stage ${s} minelayer`).toBe(true);
      expect([...pathKinds].some(k => k === 'arc' || k === 'zigzag'), `stage ${s} new motion`).toBe(true);

      pathKinds.forEach(k => phase3Kinds.add(k));
      expect(() => buildWaveTable(STAGES[s - 1], 1.0)).not.toThrow();
    }
    expect(phase3Kinds.has('arc')).toBe(true);
    expect(phase3Kinds.has('zigzag')).toBe(true);
  });

  it('density 1.0 leaves the baseline wave count unchanged', () => {
    const base = buildWaveTable(STAGES[0], 1.0);
    const same = buildWaveTable(STAGES[0], 1.0, 1.0);
    expect(same.length).toBe(base.length);
  });

  it('density > 1 adds non-boss clones without duplicating the boss', () => {
    const base = buildWaveTable(STAGES[0], 1.0, 1.0);
    const dense = buildWaveTable(STAGES[0], 1.0, 1.4);
    const baseRegulars = base.filter(e => !e.boss).length;
    const denseRegulars = dense.filter(e => !e.boss).length;
    // ~40% more regular spawns (fractional accumulator -> floor-ish count).
    expect(denseRegulars).toBeGreaterThan(baseRegulars);
    expect(denseRegulars).toBeLessThanOrEqual(Math.ceil(baseRegulars * 1.4) + 1);
    // Exactly one boss trigger, still last, still stage 1.
    expect(dense.filter(e => e.boss).length).toBe(1);
    expect(dense[dense.length - 1].boss).toBe(1);
  });

  it('density clones stay time-sorted and land before the boss', () => {
    const dense = buildWaveTable(STAGES[0], 1.0, 1.5);
    const ts = dense.map(e => e.t);
    expect(ts).toEqual([...ts].sort((a, b) => a - b));
    const bossT = dense.find(e => e.boss)!.t;
    expect(dense.filter(e => !e.boss).every(e => e.t < bossT)).toBe(true);
  });

  it('is deterministic — same inputs yield identical tables', () => {
    const a = buildWaveTable(STAGES[2], 1.0, 1.4);
    const b = buildWaveTable(STAGES[2], 1.0, 1.4);
    expect(a.length).toBe(b.length);
    expect(a.map(e => e.t)).toEqual(b.map(e => e.t));
  });
});

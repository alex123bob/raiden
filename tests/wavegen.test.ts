import { describe, it, expect } from 'vitest';
import { buildWaveTable } from '../src/stages/waveGen.js';
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

  it('stage 1 has exactly 38 entries (5+2+4+3+1+6+1+3+2+2+8+boss)', () => {
    const table = buildWaveTable(STAGES[0], 1.0);
    expect(table.length).toBe(38);
  });

  it('stage 8 has exactly 60 entries with all regular enemies elite', () => {
    const table = buildWaveTable(STAGES[7], 1.0);
    expect(table.length).toBe(60);
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
});

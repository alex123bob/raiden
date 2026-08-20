import { describe, it, expect } from 'vitest';
import { Powerup } from '../src/entities/Powerup.js';
import { POWERUP_TYPES } from '../src/registries/powerups/index.js';
import { buildWaveTable, updateWaves } from '../src/stages/waveGen.js';
import { STAGES } from '../src/stages/stageData.js';
import { CanvasRenderer } from '../src/core/Renderer.js';
import { noopCtx } from './dom-setup.js';
import { stubContext } from './context-stub.js';

describe('extraLife powerup', () => {
  it('is registered under key "life"', () => {
    expect(POWERUP_TYPES.has('life')).toBe(true);
  });

  it('grants one life on apply, uncapped', () => {
    const g = stubContext();
    g.player!.lives = 1;
    const pw = new Powerup(POWERUP_TYPES.get('life')!, 240, 130);
    pw.apply(g);
    expect(g.player!.lives).toBe(2);
  });

  it('renders without throwing', () => {
    const pw = new Powerup(POWERUP_TYPES.get('life')!, 240, 130);
    expect(() => pw.draw(new CanvasRenderer(noopCtx), stubContext())).not.toThrow();
  });
});

describe('scripted powerup spawns', () => {
  it('every stage with a life pickup places exactly one, before its boss trigger', () => {
    for (let s = 1; s <= STAGES.length; s++) {
      const waves = STAGES[s - 1].waves as { t: number; boss?: number; powerup?: string }[];
      const pickups = waves.filter(w => w.powerup === 'life');
      if (pickups.length === 0) continue;
      expect(pickups.length).toBe(1);
      const bossT = waves.find(w => w.boss)!.t;
      expect(pickups[0].t).toBeLessThan(bossT);
    }
  });

  it('buildWaveTable resolves a powerup entry and never clones it under density', () => {
    const table = buildWaveTable(STAGES[2], 1.0);   // stage 3 has a scripted life pickup
    const pickups = table.filter(e => e.powerup === 'life');
    expect(pickups.length).toBe(1);

    const dense = buildWaveTable(STAGES[2], 1.0, 2.0);
    expect(dense.filter(e => e.powerup === 'life').length).toBe(1);
  });

  it('updateWaves spawns a Powerup into ctx.powerups at the scripted time/position', () => {
    const table = buildWaveTable(STAGES[2], 1.0);
    const g = stubContext({ waveTable: table, waveIndex: 0, stageTimer: 0 });
    const entry = table.find(e => e.powerup === 'life')!;
    updateWaves(entry.t + 0.01, g);
    expect(g.powerups.length).toBe(1);
    expect(g.powerups[0].def.key).toBe('life');
    expect(g.powerups[0].x).toBe(entry.x);
    expect(g.powerups[0].y).toBe(entry.y);
  });
});

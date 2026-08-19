import { describe, it, expect } from 'vitest';
import { diffMultFor } from '../src/core/difficulty.js';

describe('diffMultFor', () => {
  it('matches the original STAGE_DIFF table for stages 1-8', () => {
    const expected = [1.0, 1.15, 1.30, 1.45, 1.60, 1.80, 2.00, 2.25];
    for (let s = 1; s <= 8; s++) {
      expect(diffMultFor(s, 1)).toBeCloseTo(expected[s - 1]);
    }
  });
  it('applies the loop-stack multiplier exactly like startStage', () => {
    expect(diffMultFor(1, 2)).toBeCloseTo(1.0 * 1.2);
    expect(diffMultFor(8, 3)).toBeCloseTo(2.25 * 1.4);
  });
});

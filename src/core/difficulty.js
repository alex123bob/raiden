import { STAGE_COUNT } from '../config.js';

// Stage 1-8 speed multipliers — identical to the original STAGE_DIFF table.
// Phase E replaces this array with the steeper 18-entry curve.
export const DIFF_CURVE = [1.0, 1.15, 1.30, 1.45, 1.60, 1.80, 2.00, 2.25];
export const LOOP_STACK = 0.2;

export function diffMultFor(stage, loopMult) {
  const i = Math.max(0, Math.min(stage - 1, DIFF_CURVE.length - 1));
  return DIFF_CURVE[i] * (1 + (loopMult - 1) * LOOP_STACK);
}

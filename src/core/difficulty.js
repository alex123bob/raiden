import { STAGE_COUNT } from '../config.js';

// Per-stage speed multiplier (stage 1 -> 18). Steeper past stage 8.
export const DIFF_CURVE = [
  1.00, 1.10, 1.20, 1.30, 1.45, 1.65, 1.85, 2.10,
  2.35, 2.60, 2.80, 3.00, 3.15, 3.30, 3.40, 3.48, 3.55, 3.60,
];
export const LOOP_STACK = 0.2;

// Enemy HP: +12% per stage past 1
export const HP_PER_STAGE = 0.12;
// Enemy fire interval: *0.97 per stage past 1
export const FIRERATE_DECAY = 0.97;
// Extra enemy bullet streams granted when stage >= each milestone
export const STREAM_MILESTONES = [4, 8, 12, 16];
// Boss HP: 800 * (1 + (stage-1) * 0.27)  -> stage 18 = 4472
export const BOSS_BASE_HP = 800;
export const BOSS_HP_STEP = 0.27;

export function diffMultFor(stage, loopMult) {
  const i = Math.max(0, Math.min(stage - 1, DIFF_CURVE.length - 1));
  return DIFF_CURVE[i] * (1 + (loopMult - 1) * LOOP_STACK);
}

export function enemyHpScale(stage) {
  return 1 + (stage - 1) * HP_PER_STAGE;
}

export function fireIntervalScale(stage) {
  return Math.pow(FIRERATE_DECAY, stage - 1);
}

export function extraBulletStreams(stage) {
  return STREAM_MILESTONES.filter(s => stage >= s).length;
}

export function bossHpForStage(stage) {
  return Math.round(BOSS_BASE_HP * (1 + (stage - 1) * BOSS_HP_STEP));
}

export function phaseCountForStage(stage) {
  if (stage >= 15) return 6;
  if (stage >= 10) return 5;
  if (stage >= 6) return 4;
  return 3;
}

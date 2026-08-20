// ===========================================================================
// GLOBAL DIFFICULTY / BALANCE KNOBS
// ---------------------------------------------------------------------------
// This module is the single place to tune how the game scales stage-to-stage.
// The per-stage *content* (which enemies spawn, and when) lives in the hand-
// authored wave tables in ../stages/stageData.ts; the numbers here are the
// global multipliers layered on top of that content at runtime.
// ===========================================================================

// Per-stage speed multiplier (stage 1 -> 18). Steeper past stage 8.
// Indexed by (stage - 1); enemy path speeds and bullet speeds are multiplied
// by this via diffMultFor().
export const DIFF_CURVE = [
  1.00, 1.10, 1.20, 1.30, 1.45, 1.65, 1.85, 2.10,
  2.35, 2.60, 2.80, 3.00, 3.15, 3.30, 3.40, 3.48, 3.55, 3.60,
];
// How much each completed game loop (2nd playthrough onward) adds to diffMult.
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

// ---------------------------------------------------------------------------
// ENEMY DENSITY
// ---------------------------------------------------------------------------
// Global multiplier on the NUMBER of enemies spawned per stage. The wave
// tables in stageData.ts define the author's baseline (density 1.0);
// buildWaveTable() thickens that baseline by cloning a deterministic fraction
// of the non-boss waves (offset slightly in time and space so they read as
// reinforcements rather than exact duplicates). Boss triggers are never
// cloned. This is the one knob to make the whole game busier or emptier
// without touching wave data:
//   1.0  = author's original spawn count
//   1.5  = ~40% more enemies (current default — fills early-stage lulls)
//   2.0  = roughly double
export const GLOBAL_DENSITY = 2;

// Optional per-stage overrides, keyed by stage number (1-based). Any stage not
// listed here uses GLOBAL_DENSITY. Use this to make a single stage denser or
// sparser than the rest, e.g. { 1: 1.6, 18: 1.2 }.
export const STAGE_DENSITY: Record<number, number> = {};

export function diffMultFor(stage: number, loopMult: number) {
  const i = Math.max(0, Math.min(stage - 1, DIFF_CURVE.length - 1));
  return DIFF_CURVE[i] * (1 + (loopMult - 1) * LOOP_STACK);
}

/** Enemy-count multiplier for a stage: its explicit override, else the global default. */
export function densityForStage(stage: number): number {
  return STAGE_DENSITY[stage] ?? GLOBAL_DENSITY;
}

export function enemyHpScale(stage: number) {
  return 1 + (stage - 1) * HP_PER_STAGE;
}

export function fireIntervalScale(stage: number) {
  return Math.pow(FIRERATE_DECAY, stage - 1);
}

export function extraBulletStreams(stage: number) {
  return STREAM_MILESTONES.filter(s => stage >= s).length;
}

export function bossHpForStage(stage: number) {
  return Math.round(BOSS_BASE_HP * (1 + (stage - 1) * BOSS_HP_STEP));
}

export function phaseCountForStage(stage: number) {
  if (stage >= 15) return 6;
  if (stage >= 8) return 5;
  if (stage >= 6) return 4;
  return 3;
}

import type { GameContext } from './GameContext.js';

export const COMBO_WINDOW = 2.2;
export const MAX_COMBO = 9;
export const GRAZE_SCORE = 25;
export const NO_MISS_BONUS_BASE = 2000;
export const NO_MISS_BONUS_PER_STAGE = 750;
export const NO_BOMB_BONUS_BASE = 1000;
export const NO_BOMB_BONUS_PER_STAGE = 500;

export type ScoreReason = 'enemy' | 'boss' | 'graze' | 'stage-bonus';

export interface StageBonusAward {
  stage: number;
  loop: number;
  noMiss: boolean;
  noBomb: boolean;
  noMissAward: number;
  noBombAward: number;
  total: number;
}

function cleanPositiveInt(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function cleanLoop(loopMult: number): number {
  return Math.max(1, cleanPositiveInt(loopMult) || 1);
}

function bumpKillCombo(ctx: GameContext): number {
  ctx.combo = ctx.combo > 0 && ctx.comboTimer > 0
    ? Math.min(MAX_COMBO, ctx.combo + 1)
    : 1;
  ctx.comboTimer = COMBO_WINDOW;
  ctx.maxCombo = Math.max(ctx.maxCombo, ctx.combo);
  return ctx.combo;
}

export function resetCombo(ctx: GameContext): void {
  ctx.combo = 0;
  ctx.comboTimer = 0;
}

export function updateScoring(dt: number, ctx: GameContext): void {
  if (ctx.comboTimer <= 0) {
    if (ctx.combo > 0) resetCombo(ctx);
    return;
  }
  ctx.comboTimer = Math.max(0, ctx.comboTimer - Math.max(0, dt));
  if (ctx.comboTimer === 0) resetCombo(ctx);
}

export function awardScore(ctx: GameContext, baseScore: number, reason: ScoreReason): number {
  const base = cleanPositiveInt(baseScore);
  if (base <= 0) return 0;
  let multiplier = cleanLoop(ctx.loopMult);
  if (reason === 'enemy' || reason === 'boss') multiplier *= bumpKillCombo(ctx);
  const awarded = Math.floor(base * multiplier);
  ctx.score += awarded;
  ctx.saveHS();
  return awarded;
}

export function calculateStageBonuses(
  stage: number,
  loopMult: number,
  noMiss: boolean,
  noBomb: boolean,
): StageBonusAward {
  const cleanStage = Math.max(1, cleanPositiveInt(stage) || 1);
  const loop = cleanLoop(loopMult);
  const noMissAward = noMiss ? (NO_MISS_BONUS_BASE + cleanStage * NO_MISS_BONUS_PER_STAGE) * loop : 0;
  const noBombAward = noBomb ? (NO_BOMB_BONUS_BASE + cleanStage * NO_BOMB_BONUS_PER_STAGE) * loop : 0;
  return {
    stage: cleanStage,
    loop,
    noMiss,
    noBomb,
    noMissAward,
    noBombAward,
    total: noMissAward + noBombAward,
  };
}

export function awardStageBonuses(ctx: GameContext): StageBonusAward {
  const award = calculateStageBonuses(ctx.currentStage, ctx.loopMult, ctx.stageNoMiss, ctx.stageNoBomb);
  ctx.lastStageBonus = award;
  if (award.total > 0) {
    ctx.score += award.total;
    ctx.saveHS();
  }
  resetCombo(ctx);
  return award;
}


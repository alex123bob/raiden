import { STAGE_COUNT } from '../config.js';
import { loadLeaderboard, type LeaderboardEntry } from './leaderboard.js';

export const PROGRESS_KEY = 'raidenProgress';

export interface CampaignProgress {
  /** Highest stage unlocked in the first-loop campaign, 1..STAGE_COUNT. */
  highestStage: number;
  /** Best loop the player has reached; loop 1 is the first campaign clear. */
  bestLoop: number;
  /** Highest stage reached within bestLoop, 1..STAGE_COUNT. */
  bestStage: number;
  /** Wall-clock timestamp of the most recent progress update. */
  updatedAt: number;
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function positiveInt(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : fallback;
}

function boundedStage(value: unknown, fallback: number): number {
  return Math.max(1, Math.min(STAGE_COUNT, positiveInt(value, fallback)));
}

export function defaultProgress(now = 0): CampaignProgress {
  return { highestStage: 1, bestLoop: 1, bestStage: 1, updatedAt: now };
}

export function sanitizeProgress(raw: unknown): CampaignProgress {
  if (!raw || typeof raw !== 'object') return defaultProgress();
  const data = raw as Partial<CampaignProgress>;
  return {
    highestStage: boundedStage(data.highestStage, 1),
    bestLoop: positiveInt(data.bestLoop, 1),
    bestStage: boundedStage(data.bestStage, 1),
    updatedAt: positiveInt(data.updatedAt, 0),
  };
}

export function loadProgress(): CampaignProgress {
  const storage = getStorage();
  if (!storage) return defaultProgress();
  try {
    const raw = storage.getItem(PROGRESS_KEY);
    if (raw !== null) return raw ? sanitizeProgress(JSON.parse(raw)) : defaultProgress();

    // Older builds only stored reached stage/loop data in leaderboard rows.
    // Seed the new save once so returning players keep their campaign unlocks.
    const migrated = migrateProgressFromLeaderboard(loadLeaderboard());
    saveProgress(migrated);
    return migrated;
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(progress: CampaignProgress): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(PROGRESS_KEY, JSON.stringify(sanitizeProgress(progress)));
  } catch {
    // Storage may be unavailable or quota-limited; progression is best-effort.
  }
}

export function migrateProgressFromLeaderboard(
  entries: readonly LeaderboardEntry[],
  now = Date.now(),
): CampaignProgress {
  let highestStage = 1;
  let bestLoop = 1;
  let bestStage = 1;

  for (const entry of entries) {
    const stage = boundedStage(entry.stage, 1);
    const loop = positiveInt(entry.loop, 1);
    // Reaching loop 2 means the player already cleared the full first loop.
    if (loop > 1) highestStage = STAGE_COUNT;
    else highestStage = Math.max(highestStage, stage);
    if (loop > bestLoop || (loop === bestLoop && stage > bestStage)) {
      bestLoop = loop;
      bestStage = stage;
    }
  }

  return {
    highestStage,
    bestLoop,
    bestStage,
    updatedAt: entries.length ? positiveInt(now, Date.now()) : 0,
  };
}

export function recordStageReached(
  progress: CampaignProgress,
  stage: number,
  loop: number,
  now = Date.now(),
): CampaignProgress {
  const next = sanitizeProgress(progress);
  const cleanStage = boundedStage(stage, 1);
  const cleanLoop = positiveInt(loop, 1);
  if (cleanLoop > next.bestLoop || (cleanLoop === next.bestLoop && cleanStage > next.bestStage)) {
    next.bestLoop = cleanLoop;
    next.bestStage = cleanStage;
    next.updatedAt = positiveInt(now, Date.now());
  }
  return next;
}

export function unlockNextStage(
  progress: CampaignProgress,
  clearedStage: number,
  now = Date.now(),
): CampaignProgress {
  const next = sanitizeProgress(progress);
  const unlockedStage = Math.min(STAGE_COUNT, boundedStage(clearedStage, 1) + 1);
  if (unlockedStage > next.highestStage) {
    next.highestStage = unlockedStage;
    next.updatedAt = positiveInt(now, Date.now());
  }
  return next;
}

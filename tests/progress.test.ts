import { beforeEach, describe, expect, it } from 'vitest';
import { STAGE_COUNT } from '../src/config.js';
import {
  defaultProgress,
  loadProgress,
  migrateProgressFromLeaderboard,
  PROGRESS_KEY,
  recordStageReached,
  sanitizeProgress,
  saveProgress,
  unlockNextStage,
  type CampaignProgress,
} from '../src/core/progress.js';
import { LEADERBOARD_KEY } from '../src/core/leaderboard.js';

let store: Record<string, string>;

beforeEach(() => {
  store = {};
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
    key: () => null,
    length: 0,
  } as Storage;
});

function progress(overrides: Partial<CampaignProgress> = {}): CampaignProgress {
  return { ...defaultProgress(), ...overrides };
}

describe('campaign progress helpers', () => {
  it('sanitizes corrupt and out-of-range progress', () => {
    expect(sanitizeProgress(null)).toEqual(defaultProgress());
    expect(sanitizeProgress({ highestStage: 99, bestLoop: 2.8, bestStage: -5, updatedAt: 'bad' })).toEqual({
      highestStage: STAGE_COUNT,
      bestLoop: 2,
      bestStage: 1,
      updatedAt: 0,
    });
  });

  it('loads and saves safe JSON without throwing on corrupt storage', () => {
    saveProgress(progress({ highestStage: 4, bestLoop: 1, bestStage: 4, updatedAt: 123 }));
    expect(JSON.parse(store[PROGRESS_KEY]).highestStage).toBe(4);
    expect(loadProgress()).toMatchObject({ highestStage: 4, bestStage: 4 });

    store[PROGRESS_KEY] = '{bad json';
    expect(loadProgress()).toEqual(defaultProgress());
  });

  it('migrates prior leaderboard reach into the new campaign save', () => {
    store[LEADERBOARD_KEY] = JSON.stringify([
      { initials: 'AAA', score: 900, stage: 7, loop: 1, date: 1 },
      { initials: 'BBB', score: 800, stage: 2, loop: 2, date: 2 },
    ]);

    expect(loadProgress()).toMatchObject({
      highestStage: STAGE_COUNT,
      bestLoop: 2,
      bestStage: 2,
    });
    expect(JSON.parse(store[PROGRESS_KEY])).toMatchObject({
      highestStage: STAGE_COUNT,
      bestLoop: 2,
    });
  });

  it('does not overwrite an existing progress save during migration', () => {
    store[PROGRESS_KEY] = JSON.stringify(progress({ highestStage: 3, bestStage: 3 }));
    store[LEADERBOARD_KEY] = JSON.stringify([
      { initials: 'AAA', score: 900, stage: STAGE_COUNT, loop: 2, date: 1 },
    ]);

    expect(loadProgress()).toMatchObject({ highestStage: 3, bestLoop: 1, bestStage: 3 });
  });

  it('records the best reached loop and stage lexicographically', () => {
    const base = progress({ highestStage: 7, bestLoop: 1, bestStage: 5, updatedAt: 10 });
    expect(recordStageReached(base, 4, 1, 20)).toMatchObject({ bestLoop: 1, bestStage: 5, updatedAt: 10 });
    expect(recordStageReached(base, 7, 1, 30)).toMatchObject({ bestLoop: 1, bestStage: 7, updatedAt: 30 });
    expect(recordStageReached(base, 1, 2, 40)).toMatchObject({ bestLoop: 2, bestStage: 1, updatedAt: 40 });
  });

  it('unlocks the next authored stage and clamps at the campaign end', () => {
    expect(unlockNextStage(progress(), 1, 50)).toMatchObject({ highestStage: 2, updatedAt: 50 });
    expect(unlockNextStage(progress({ highestStage: STAGE_COUNT }), STAGE_COUNT, 60)).toMatchObject({
      highestStage: STAGE_COUNT,
    });
  });

  it('builds a default migration result when no leaderboard history exists', () => {
    expect(migrateProgressFromLeaderboard([], 0)).toEqual(defaultProgress());
  });

  it('saveProgress never throws when localStorage is unavailable', () => {
    (globalThis as unknown as { localStorage: undefined }).localStorage = undefined as unknown as undefined;
    expect(() => saveProgress(progress({ highestStage: 2 }))).not.toThrow();
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import {
  insertScore,
  LEADERBOARD_KEY,
  LEGACY_HIGH_SCORE_KEY,
  loadHighScore,
  loadLeaderboard,
  loadLegacyHighScore,
  MAX_LEADERBOARD_ENTRIES,
  normalizeInitials,
  normalizeLeaderboard,
  qualifiesForLeaderboard,
  saveLeaderboard,
  saveLegacyHighScore,
  type LeaderboardEntry,
} from '../src/core/leaderboard.js';

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

function row(score: number, initials = 'AAA'): LeaderboardEntry {
  return { initials, score, stage: 1, loop: 1, date: score };
}

describe('leaderboard helpers', () => {
  it('normalizes initials to three uppercase alphanumeric characters', () => {
    expect(normalizeInitials('jd')).toBe('JDA');
    expect(normalizeInitials('a-b9')).toBe('AB9');
    expect(normalizeInitials(null)).toBe('AAA');
  });

  it('sorts, sanitizes, and truncates entries', () => {
    const entries = Array.from({ length: 12 }, (_, i) => row(100 + i, i === 11 ? 'zz9' : 'ok'));
    const board = normalizeLeaderboard(entries);
    expect(board).toHaveLength(MAX_LEADERBOARD_ENTRIES);
    expect(board[0]).toMatchObject({ initials: 'ZZ9', score: 111 });
    expect(board[board.length - 1].score).toBe(102);
  });

  it('inserts scores in descending order and checks qualification against tenth place', () => {
    const full = Array.from({ length: 10 }, (_, i) => row(1000 - i * 10));
    expect(qualifiesForLeaderboard(911, full)).toBe(true);
    expect(qualifiesForLeaderboard(910, full)).toBe(false);
    expect(insertScore(full, row(995, 'new')).map(e => e.score).slice(0, 3)).toEqual([1000, 995, 990]);
  });

  it('loads and saves safe JSON without throwing on corrupt storage', () => {
    saveLeaderboard([row(500, 'ace')]);
    expect(JSON.parse(store[LEADERBOARD_KEY])[0].initials).toBe('ACE');
    expect(loadLeaderboard()[0].score).toBe(500);
    store[LEADERBOARD_KEY] = '{bad json';
    expect(loadLeaderboard()).toEqual([]);
  });

  it('preserves legacy high-score compatibility', () => {
    saveLegacyHighScore(1234);
    expect(store[LEGACY_HIGH_SCORE_KEY]).toBe('1234');
    expect(loadLegacyHighScore()).toBe(1234);
    saveLeaderboard([row(2000, 'ace')]);
    expect(loadHighScore()).toBe(2000);
  });
});

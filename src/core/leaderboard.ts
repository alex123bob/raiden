export const LEADERBOARD_KEY = 'raidenLeaderboard';
export const LEGACY_HIGH_SCORE_KEY = 'raidenHS';
export const MAX_LEADERBOARD_ENTRIES = 10;

export interface LeaderboardEntry {
  initials: string;
  score: number;
  stage: number;
  loop: number;
  date: number;
}

export interface InitialsEntry {
  initials: string;
  cursor: number;
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

function positiveInt(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

export function normalizeInitials(value: unknown): string {
  const raw = typeof value === 'string' ? value : '';
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
  return clean.padEnd(3, 'A');
}

export function normalizeLeaderboard(entries: unknown): LeaderboardEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry): LeaderboardEntry | null => {
      if (!entry || typeof entry !== 'object') return null;
      const e = entry as Partial<LeaderboardEntry>;
      const score = positiveInt(e.score, 0);
      if (score <= 0) return null;
      return {
        initials: normalizeInitials(e.initials),
        score,
        stage: positiveInt(e.stage, 1),
        loop: positiveInt(e.loop, 1),
        date: positiveInt(e.date, Date.now()),
      };
    })
    .filter((entry): entry is LeaderboardEntry => entry !== null)
    .sort((a, b) => b.score - a.score || a.date - b.date)
    .slice(0, MAX_LEADERBOARD_ENTRIES);
}

export function loadLeaderboard(): LeaderboardEntry[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(LEADERBOARD_KEY);
    return raw ? normalizeLeaderboard(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function saveLeaderboard(entries: LeaderboardEntry[]): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(LEADERBOARD_KEY, JSON.stringify(normalizeLeaderboard(entries)));
  } catch {
    // Storage may be unavailable or quota-limited; the game keeps running.
  }
}

export function insertScore(entries: LeaderboardEntry[], entry: LeaderboardEntry): LeaderboardEntry[] {
  return normalizeLeaderboard([...entries, entry]);
}

export function qualifiesForLeaderboard(score: number, entries: LeaderboardEntry[]): boolean {
  const cleanScore = Number.isFinite(score) ? Math.floor(score) : 0;
  if (cleanScore <= 0) return false;
  const board = normalizeLeaderboard(entries);
  if (board.length < MAX_LEADERBOARD_ENTRIES) return true;
  return cleanScore > board[board.length - 1].score;
}

export function loadLegacyHighScore(): number {
  const storage = getStorage();
  if (!storage) return 0;
  try {
    const raw = storage.getItem(LEGACY_HIGH_SCORE_KEY);
    const n = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function saveLegacyHighScore(score: number): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(LEGACY_HIGH_SCORE_KEY, String(Math.max(0, Math.floor(score))));
  } catch {
    // Ignore storage failures.
  }
}

export function loadHighScore(entries = loadLeaderboard()): number {
  return Math.max(loadLegacyHighScore(), entries[0]?.score ?? 0);
}


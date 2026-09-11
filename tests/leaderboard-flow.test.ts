import { beforeEach, describe, expect, it } from 'vitest';
import { Game } from '../src/core/Game.js';
import { CanvasRenderer } from '../src/core/Renderer.js';
import { SilentBus } from '../src/core/audio.js';
import { LEADERBOARD_KEY } from '../src/core/leaderboard.js';
import { SilentMusic } from '../src/core/music.js';
import { noopCtx } from './dom-setup.js';

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

function newGame() {
  return new Game({ renderer: new CanvasRenderer(noopCtx), audio: new SilentBus(), music: new SilentMusic() });
}

describe('game-over leaderboard flow', () => {
  it('starts initials entry for a qualifying score and saves it', () => {
    const g = newGame();
    g.score = 12345;
    g.currentStage = 4;
    g.loopMult = 2;

    g.enterGameOver();

    expect(g.state).toBe(3);
    expect(g.initialsEntry).toEqual({ initials: 'AAA', cursor: 0 });
    expect(g.handleInitialsKey('KeyA')).toBe(true);
    expect(g.handleInitialsKey('KeyC')).toBe(true);
    expect(g.handleInitialsKey('KeyE')).toBe(true);
    expect(g.initialsEntry!.initials).toBe('ACE');

    expect(g.handleInitialsKey('Enter')).toBe(true);

    expect(g.initialsEntry).toBeNull();
    expect(g.leaderboard[0]).toMatchObject({ initials: 'ACE', score: 12345, stage: 4, loop: 2 });
    expect(JSON.parse(store[LEADERBOARD_KEY])[0].initials).toBe('ACE');
    expect(g.highScore).toBe(12345);
  });

  it('skips initials entry for non-qualifying scores', () => {
    store[LEADERBOARD_KEY] = JSON.stringify(
      Array.from({ length: 10 }, (_, i) => ({ initials: 'AAA', score: 1000 - i * 10, stage: 1, loop: 1, date: i })),
    );
    const g = newGame();
    g.score = 900;

    g.enterGameOver();

    expect(g.initialsEntry).toBeNull();
  });

  it('supports arrow-based initials editing', () => {
    const g = newGame();
    g.score = 100;
    g.enterGameOver();

    g.handleInitialsKey('ArrowUp');
    g.handleInitialsKey('ArrowRight');
    g.handleInitialsKey('ArrowDown');

    expect(g.initialsEntry!.initials).toBe('B9A');
    expect(g.initialsEntry!.cursor).toBe(1);
  });
});


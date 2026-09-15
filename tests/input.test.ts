import { beforeEach, describe, expect, it } from 'vitest';
import { STATE } from '../src/config.js';
import { Game } from '../src/core/Game.js';
import { handleKeyPress } from '../src/core/input.js';
import { CanvasRenderer } from '../src/core/Renderer.js';
import { SilentBus } from '../src/core/audio.js';
import { SilentMusic } from '../src/core/music.js';
import { LEADERBOARD_KEY } from '../src/core/leaderboard.js';
import { PROGRESS_KEY } from '../src/core/progress.js';
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

describe('input menu actions', () => {
  it('stage select navigation is capped by unlocked campaign progress', () => {
    const g = newGame();
    g.state = STATE.STAGESELECT;
    g.progress = { ...g.progress, highestStage: 3 };
    g.selectedStage = 3;

    handleKeyPress(g, 'ArrowRight');
    expect(g.selectedStage).toBe(3);

    handleKeyPress(g, 'ArrowLeft');
    expect(g.selectedStage).toBe(2);
  });

  it('settings reset progress requires a second confirm press and preserves scores', () => {
    store[LEADERBOARD_KEY] = JSON.stringify([
      { initials: 'ACE', score: 1000, stage: 8, loop: 1, date: 1 },
    ]);
    const g = newGame();
    g.settingsOpen = true;
    g.progress = { ...g.progress, highestStage: 8, bestStage: 8 };
    g.selectedStage = 8;

    handleKeyPress(g, 'KeyP');
    expect(g.progressResetArmed).toBe(true);
    expect(g.progress.highestStage).toBe(8);

    handleKeyPress(g, 'KeyP');
    expect(g.progressResetArmed).toBe(false);
    expect(g.progress.highestStage).toBe(1);
    expect(g.selectedStage).toBe(1);
    expect(JSON.parse(store[PROGRESS_KEY]).highestStage).toBe(1);
    expect(store[LEADERBOARD_KEY]).toBeDefined();
  });

  it('settings reset arm is cancelled by other settings actions', () => {
    const g = newGame();
    g.settingsOpen = true;

    handleKeyPress(g, 'KeyP');
    expect(g.progressResetArmed).toBe(true);

    handleKeyPress(g, 'KeyH');
    expect(g.progressResetArmed).toBe(false);
  });
});

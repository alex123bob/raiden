import { describe, it, expect, beforeEach } from 'vitest';
import { Game } from '../src/core/Game.js';
import { CanvasRenderer } from '../src/core/Renderer.js';
import { SilentBus } from '../src/core/audio.js';
import { SilentMusic } from '../src/core/music.js';
import { noopCtx } from './dom-setup.js';

let store: Record<string, string>;
beforeEach(() => {
  store = {};
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; }, key: () => null, length: 0,
  } as Storage;
});

function newGame() {
  return new Game({ renderer: new CanvasRenderer(noopCtx), audio: new SilentBus(), music: new SilentMusic() });
}

describe('settings persistence', () => {
  it('cycleVolume steps and persists volume', () => {
    const g = newGame();
    g.volume = 0.5;
    g.cycleVolume(1);
    expect(g.volume).toBe(0.7);
    expect(JSON.parse(store['raidenSettings']).volume).toBe(0.7);
  });

  it('loadSettings restores persisted values', () => {
    store['raidenSettings'] = JSON.stringify({ soundOn: false, volume: 0.25, gameSpeed: 1.25 });
    const g = newGame();
    expect(g.soundOn).toBe(false);
    expect(g.volume).toBe(0.25);
    expect(g.gameSpeed).toBe(1.25);
  });

  it('saveSettings never throws when localStorage is unavailable', () => {
    (globalThis as unknown as { localStorage: undefined }).localStorage = undefined as unknown as undefined;
    const g = newGame();
    expect(() => g.saveSettings()).not.toThrow();
  });
});

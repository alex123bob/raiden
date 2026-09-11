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
    store['raidenSettings'] = JSON.stringify({ soundOn: false, volume: 0.25, gameSpeed: 1.25, reducedMotion: true, showHitbox: true });
    const g = newGame();
    expect(g.soundOn).toBe(false);
    expect(g.volume).toBe(0.25);
    expect(g.gameSpeed).toBe(1.25);
    expect(g.reducedMotion).toBe(true);
    expect(g.showHitbox).toBe(true);
  });

  it('toggleReducedMotion persists and clears active shake', () => {
    const g = newGame();
    g.shake(12, 0.4);
    expect(g.shakeTime).toBeGreaterThan(0);

    g.toggleReducedMotion();
    expect(g.reducedMotion).toBe(true);
    expect(g.shakeTime).toBe(0);
    expect(g.shakeDur).toBe(0);
    expect(g.shakeMag).toBe(0);
    expect(JSON.parse(store['raidenSettings']).reducedMotion).toBe(true);
  });

  it('reduced motion suppresses shake and clamps hit-stop', () => {
    const g = newGame();
    g.reducedMotion = true;

    g.shake(14, 0.5);
    expect(g.shakeTime).toBe(0);

    g.hitStop(110);
    expect(g.hitStopTimer).toBeCloseTo(0.03, 5);
  });

  it('toggleHitbox persists the visible hitbox setting', () => {
    const g = newGame();
    g.toggleHitbox();
    expect(g.showHitbox).toBe(true);
    expect(JSON.parse(store['raidenSettings']).showHitbox).toBe(true);
  });

  it('saveSettings never throws when localStorage is unavailable', () => {
    (globalThis as unknown as { localStorage: undefined }).localStorage = undefined as unknown as undefined;
    const g = newGame();
    expect(() => g.saveSettings()).not.toThrow();
  });
});

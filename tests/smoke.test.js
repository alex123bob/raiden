import { describe, it, expect, beforeAll } from 'vitest';

const gradient = { addColorStop() {} };
const ctxStub = new Proxy({}, {
  get(t, prop) {
    if (prop in t) return t[prop];
    if (prop === 'createRadialGradient' || prop === 'createLinearGradient')
      return () => gradient;
    if (prop === 'canvas') return {};
    return typeof prop === 'string' ? (() => {}) : undefined;
  },
  set() { return true; },
});

const canvasEl = {
  width: 0, height: 0,
  style: {},
  getContext: () => ctxStub,
  addEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 640 }),
};

function installDomStubs() {
  globalThis.document = {
    getElementById: (id) => (id === 'c' ? canvasEl : null),
    addEventListener() {},
  };
  globalThis.window = {
    innerWidth: 1024, innerHeight: 768,
    addEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    AudioContext: undefined,
  };
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  let rafCb = null;
  globalThis.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
  globalThis.cancelAnimationFrame = () => {};
}

describe('game smoke test (real module graph, stubbed DOM)', () => {
  let Game;

  beforeAll(async () => {
    installDomStubs();
    ({ Game } = await import('../src/core/Game.js'));
    await import('../src/main.js');
  });

  it('boots to TITLE and starts stage 1 on Enter', () => {
    const game = new Game();
    expect(game.state).toBe(0); // STATE.TITLE
    game.loopMult = 1;
    game.startGame();
    expect(game.player).not.toBeNull();
    expect(game.enemies.length).toBe(0);
    expect(game.currentStage).toBe(1);
    expect(game.waveTable.length).toBeGreaterThan(0);
  });

  it('plays through stage 1 to boss spawn, kill, and stage clear', () => {
    const game = new Game();
    game.loopMult = 1;
    game.startGame();
    game.keys['Space'] = true;
    let ts = 1000;
    game.lastTime = ts;
    let bossFrame = -1;
    for (let i = 0; i < 3000; i++) {
      ts += 1000 / 60;
      if (game.player && !game.player.dead) game.player.invTimer = 9999;
      game.loop(ts);
      if (game.boss) { bossFrame = i; break; }
    }
    expect(bossFrame).toBeGreaterThan(-1);
    expect(game.boss).not.toBeNull();
    game.boss.hp = 0;
    game.loop(ts += 1000 / 60);
    expect(game.state).toBe(4); // STATE.STAGECLEAR
    game.stageClearTimer = 0.001;
    game.loop(ts += 1000 / 60);
    expect(game.state).toBe(1); // STATE.PLAYING
    expect(game.currentStage).toBe(2);
  });

  it('reaches VICTORY after stage 8 on loop 1, and restarts the loop on Enter', () => {
    const g2 = new Game();
    g2.loopMult = 1; g2.startGame();
    g2.currentStage = 8; g2.waveTable = [{ t: 0, boss: 8 }]; g2.waveIndex = 0; g2.stageTimer = 99;
    let ts = 1000; g2.lastTime = ts; g2.loop(ts);
    expect(g2.boss).not.toBeNull();
    g2.boss.hp = 0;
    g2.loop(ts += 1000 / 60);
    expect(g2.state).toBe(5); // STATE.VICTORY

    const g3 = new Game();
    g3.loopMult = 2; g3.startGame();
    g3.currentStage = 8; g3.waveTable = [{ t: 0, boss: 8 }]; g3.waveIndex = 0; g3.stageTimer = 99;
    ts += 1000 / 60; g3.lastTime = ts; g3.loop(ts);
    g3.boss.hp = 0;
    g3.loop(ts += 1000 / 60);
    expect(g3.state).toBe(1); // back to PLAYING
    expect(g3.loopMult).toBe(3);
    expect(g3.currentStage).toBe(1);
  });

  it('renders every screen state without unbound references', () => {
    const g4 = new Game();
    let ts = 1000; g4.lastTime = ts;
    const scenes = [
      () => { g4.state = 0; g4.settingsOpen = false; },   // TITLE
      () => { g4.state = 3; g4.settingsOpen = false; },   // GAMEOVER
      () => { g4.state = 5; g4.settingsOpen = false; },   // VICTORY
      () => { g4.state = 2; g4.settingsOpen = true; g4.startGame(); }, // PAUSED + SETTINGS
    ];
    for (const scene of scenes) {
      scene();
      expect(() => g4.loop(ts += 1000 / 60)).not.toThrow();
    }
  });
});

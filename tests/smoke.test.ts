import { describe, it, expect, beforeAll } from 'vitest';
import { Game } from '../src/core/Game.js';
import { CanvasRenderer } from '../src/core/Renderer.js';
import { SilentBus } from '../src/core/audio.js';
import { noopCtx } from './dom-setup.js';

function newGame() {
  return new Game({ renderer: new CanvasRenderer(noopCtx), audio: new SilentBus() });
}

describe('game smoke test (real module graph, stubbed DOM)', () => {
  beforeAll(async () => {
    // Exercises the real boot module (canvas singleton, input wiring) once.
    await import('../src/main.js');
  });

  it('boots to TITLE and starts stage 1 on Enter', () => {
    const game = newGame();
    expect(game.state).toBe(0);
    game.loopMult = 1;
    game.startGame();
    expect(game.player).not.toBeNull();
    expect(game.enemies.length).toBe(0);
    expect(game.currentStage).toBe(1);
    expect(game.waveTable.length).toBeGreaterThan(0);
  });

  it('plays through stage 1 to boss spawn, kill, and stage clear', () => {
    const game = newGame();
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
    game.boss!.hp = 0;
    game.loop(ts += 1000 / 60);
    expect(game.state).toBe(4);
    game.stageClearTimer = 0.001;
    game.loop(ts += 1000 / 60);
    expect(game.state).toBe(1);
    expect(game.currentStage).toBe(2);
  });

  it('reaches VICTORY after stage 18 on loop 1, and restarts the loop on Enter', () => {
    const g2 = newGame();
    g2.loopMult = 1; g2.startGame();
    g2.currentStage = 18; g2.waveTable = [{ t: 0, boss: 18 }]; g2.waveIndex = 0; g2.stageTimer = 99;
    let ts = 1000; g2.lastTime = ts; g2.loop(ts);
    expect(g2.boss).not.toBeNull();
    g2.boss!.hp = 0;
    g2.loop(ts += 1000 / 60);
    expect(g2.state).toBe(5);

    const g3 = newGame();
    g3.loopMult = 2; g3.startGame();
    g3.currentStage = 18; g3.waveTable = [{ t: 0, boss: 18 }]; g3.waveIndex = 0; g3.stageTimer = 99;
    ts += 1000 / 60; g3.lastTime = ts; g3.loop(ts);
    g3.boss!.hp = 0;
    g3.loop(ts += 1000 / 60);
    expect(g3.state).toBe(1);
    expect(g3.loopMult).toBe(3);
    expect(g3.currentStage).toBe(1);
  });

  it('renders every screen state without unbound references', () => {
    const g4 = newGame();
    let ts = 1000; g4.lastTime = ts;
    const scenes = [
      () => { g4.state = 0; g4.settingsOpen = false; },
      () => { g4.state = 3; g4.settingsOpen = false; },
      () => { g4.state = 5; g4.settingsOpen = false; },
      () => { g4.state = 2; g4.settingsOpen = true; g4.startGame(); },
    ];
    for (const scene of scenes) {
      scene();
      expect(() => g4.loop(ts += 1000 / 60)).not.toThrow();
    }
  });
});

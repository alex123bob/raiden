import { describe, it, expect } from 'vitest';
import { Game } from '../src/core/Game.js';
import { CanvasRenderer } from '../src/core/Renderer.js';
import { SilentBus } from '../src/core/audio.js';
import { SilentMusic } from '../src/core/music.js';
import { spawnEnemyBullet } from '../src/entities/Bullet.js';
import { noopCtx } from './dom-setup.js';

function newGame() {
  return new Game({ renderer: new CanvasRenderer(noopCtx), audio: new SilentBus(), music: new SilentMusic() });
}

describe('hit-stop', () => {
  it('freezes gameplay dt while the timer is active but still advances the timer', () => {
    const g = newGame();
    g.loopMult = 1; g.startGame(1);
    g.hitStop(100);                       // 0.1s freeze
    expect(g.hitStopTimer).toBeCloseTo(0.1, 5);
    // Place an enemy bullet moving down; a frozen frame should not move it.
    spawnEnemyBullet(g, 100, 100, 0, 300, '#fff');
    const y0 = g.enemyBullets[0].y;
    let ts = 1000; g.lastTime = ts;
    g.loop(ts += 1000 / 60);              // frozen frame
    expect(g.enemyBullets[0].y).toBe(y0); // no movement
    expect(g.hitStopTimer).toBeLessThan(0.1);   // timer decremented on real time
  });

  it('hitStop extends rather than shortens an active freeze', () => {
    const g = newGame();
    g.hitStop(50);
    g.hitStop(120);
    expect(g.hitStopTimer).toBeCloseTo(0.12, 5);
    g.hitStop(30);
    expect(g.hitStopTimer).toBeCloseTo(0.12, 5);
  });
});

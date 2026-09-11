import { describe, it, expect } from 'vitest';
import { Game } from '../src/core/Game.js';
import { CanvasRenderer } from '../src/core/Renderer.js';
import { SilentBus } from '../src/core/audio.js';
import type { MusicSink } from '../src/core/music.js';
import { noopCtx } from './dom-setup.js';

class SpyMusic implements MusicSink {
  played: string[] = [];
  returns: string[] = [];
  play(k: string, returnKey?: string) { this.played.push(k); if (returnKey) this.returns.push(returnKey); }
  stop() {}
  setEnabled() {}
  setVolume() {}
}

function newGame(music: MusicSink) {
  return new Game({ renderer: new CanvasRenderer(noopCtx), audio: new SilentBus(), music });
}

describe('music cues', () => {
  it('plays a stage theme when a stage starts', () => {
    const spy = new SpyMusic();
    const g = newGame(spy);
    g.loopMult = 1;
    g.startGame(1);
    expect(spy.played).toContain('stage-a');
  });

  it('plays the boss theme when the boss spawns, and stage-clear on boss death', () => {
    const spy = new SpyMusic();
    const g = newGame(spy);
    g.loopMult = 1; g.startGame(1);
    g.currentStage = 1; g.waveTable = [{ t: 0, boss: 1 }]; g.waveIndex = 0; g.stageTimer = 99;
    let ts = 1000; g.lastTime = ts; g.loop(ts);
    expect(spy.played).toContain('boss');
    g.boss!.hp = 0;
    g.loop(ts += 1000 / 60);
    expect(spy.played).toContain('stage-clear');
    expect(spy.returns).toContain('stage-b');
  });

  it('plays game-over when the last life is lost', () => {
    const spy = new SpyMusic();
    const g = newGame(spy);
    g.loopMult = 1; g.startGame(1);
    g.player!.lives = 1;
    g.player!.kill(g);
    g.player!.update(2, g);
    expect(spy.played).toContain('game-over');
    expect(spy.returns).toContain('title');
  });

  it('switches to the title theme on victory', () => {
    const spy = new SpyMusic();
    const g = newGame(spy);
    g.progress = { ...g.progress, highestStage: 18 };
    g.loopMult = 1; g.startGame(18);
    g.waveTable = [{ t: 0, boss: 18 }]; g.waveIndex = 0; g.stageTimer = 99;
    g.lastTime = 1000;
    g.loop(1000);
    g.boss!.hp = 0;
    g.loop(1000 + 1000 / 60);
    expect(g.state).toBe(5);
    expect(spy.played).toContain('title');
  });
});

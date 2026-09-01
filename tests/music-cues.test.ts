import { describe, it, expect } from 'vitest';
import { Game } from '../src/core/Game.js';
import { CanvasRenderer } from '../src/core/Renderer.js';
import { SilentBus } from '../src/core/audio.js';
import type { MusicSink } from '../src/core/music.js';
import { noopCtx } from './dom-setup.js';

class SpyMusic implements MusicSink {
  played: string[] = [];
  play(k: string) { this.played.push(k); }
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
  });

  it('plays game-over when the last life is lost', () => {
    const spy = new SpyMusic();
    const g = newGame(spy);
    g.loopMult = 1; g.startGame(1);
    g.state = 3;               // STATE.GAMEOVER
    g.onGameOver();            // cue helper (added in Step 6)
    expect(spy.played).toContain('game-over');
  });
});

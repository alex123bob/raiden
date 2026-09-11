import { describe, it, expect } from 'vitest';
import { SilentMusic, WebAudioMusic, MUSIC_REGISTRY_KEYS, getTrack, stageThemeFor } from '../src/core/music.js';

describe('music engine', () => {
  it('registers the stage-a track', () => {
    expect(MUSIC_REGISTRY_KEYS()).toContain('stage-a');
    const t = getTrack('stage-a');
    expect(t).toBeDefined();
    expect(t!.layers.length).toBeGreaterThan(0);
    expect(t!.tempo).toBeGreaterThan(0);
  });

  it('SilentMusic never throws and no-ops', () => {
    const m = new SilentMusic();
    expect(() => { m.play('stage-a'); m.setVolume(0.5); m.setEnabled(true); m.stop(); }).not.toThrow();
  });

  it('WebAudioMusic degrades to silent when no AudioContext exists', () => {
    const m = new WebAudioMusic();
    expect(() => { m.play('stage-a'); m.setEnabled(true); m.setVolume(0.4); m.stop(); }).not.toThrow();
  });

  it('WebAudioMusic.play with an unknown track key does not throw', () => {
    const m = new WebAudioMusic();
    expect(() => m.play('does-not-exist')).not.toThrow();
  });

  it('retains the selected track across mute and resumes it when re-enabled', () => {
    class FakeParam {
      value = 0;
      cancelCount = 0;
      setValueAtTime() {}
      exponentialRampToValueAtTime() {}
      linearRampToValueAtTime() {}
      cancelScheduledValues() { this.cancelCount++; }
    }
    class FakeGain { gain = new FakeParam(); connect() {} }
    class FakeOscillator {
      type: OscillatorType = 'sine';
      frequency = new FakeParam();
      connect() {}
      start() {}
      stop() {}
    }
    class FakeAudioContext {
      static instance: FakeAudioContext;
      gains: FakeGain[] = [];
      currentTime = 0;
      state = 'running' as AudioContextState;
      destination = {} as AudioNode;
      constructor() { FakeAudioContext.instance = this; }
      createGain() { const gain = new FakeGain(); this.gains.push(gain); return gain as unknown as GainNode; }
      createOscillator() { return new FakeOscillator() as unknown as OscillatorNode; }
      resume() { return Promise.resolve(); }
    }

    const windowLike = window as unknown as { AudioContext?: unknown };
    const previous = windowLike.AudioContext;
    windowLike.AudioContext = FakeAudioContext;
    try {
      const m = new WebAudioMusic();
      const internals = m as unknown as { current: { key: string } | null; timer: unknown };
      m.play('stage-a');
      expect(internals.timer).not.toBeNull();
      m.play('boss');
      expect(internals.current?.key).toBe('boss');
      expect(FakeAudioContext.instance.gains.some(g => g.gain.cancelCount > 0)).toBe(true);
      m.setEnabled(false);
      expect(internals.current?.key).toBe('boss');
      expect(internals.timer).toBeNull();
      m.setEnabled(true);
      expect(internals.current?.key).toBe('boss');
      expect(internals.timer).not.toBeNull();
      m.play('stage-clear', 'title');
      (FakeAudioContext.instance as unknown as { currentTime: number }).currentTime = 100;
      (m as unknown as { tick(): void }).tick();
      expect(internals.current?.key).toBe('title');
      m.stop();
      expect(internals.current).toBeNull();
    } finally {
      windowLike.AudioContext = previous;
    }
  });
});

describe('music tracks and stage mapping', () => {
  it('registers all authored tracks', () => {
    const keys = MUSIC_REGISTRY_KEYS();
    for (const k of ['stage-a', 'stage-b', 'stage-c', 'boss', 'title', 'stage-clear', 'game-over']) {
      expect(keys, `missing ${k}`).toContain(k);
    }
    expect(getTrack('stage-clear')!.loop).toBe(false);
    expect(getTrack('game-over')!.loop).toBe(false);
  });

  it('every stage 1..18 maps to a registered stage theme', () => {
    for (let s = 1; s <= 18; s++) {
      const key = stageThemeFor(s);
      expect(['stage-a', 'stage-b', 'stage-c']).toContain(key);
      expect(getTrack(key), `stage ${s} theme ${key}`).toBeDefined();
    }
  });

  it('cycles the three themes across consecutive stages', () => {
    expect(stageThemeFor(1)).toBe('stage-a');
    expect(stageThemeFor(2)).toBe('stage-b');
    expect(stageThemeFor(3)).toBe('stage-c');
    expect(stageThemeFor(4)).toBe('stage-a');
  });
});

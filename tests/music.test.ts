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
});

describe('music tracks and stage mapping', () => {
  it('registers all authored tracks', () => {
    const keys = MUSIC_REGISTRY_KEYS();
    for (const k of ['stage-a', 'stage-b', 'stage-c', 'boss', 'title', 'stage-clear', 'game-over']) {
      expect(keys, `missing ${k}`).toContain(k);
    }
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

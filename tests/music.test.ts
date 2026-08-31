import { describe, it, expect } from 'vitest';
import { SilentMusic, WebAudioMusic, MUSIC_REGISTRY_KEYS, getTrack } from '../src/core/music.js';

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

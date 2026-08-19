import { describe, it, expect } from 'vitest';
import { SilentBus, WebAudioBus, getAudio } from '../src/core/audio.js';
import { SFX_REGISTRY_KEYS } from '../src/core/audio.js';

describe('audio bus', () => {
  it('registers the four engine sound effects', () => {
    expect(SFX_REGISTRY_KEYS().sort()).toEqual(['shoot', 'explosion', 'powerup', 'bomb'].sort());
  });

  it('SilentBus never throws and ignores everything', () => {
    const bus = new SilentBus();
    expect(() => { bus.play('shoot', { weapon: 0 }); bus.setEnabled(false); }).not.toThrow();
  });

  it('WebAudioBus is a silent no-op when no AudioContext exists', () => {
    const bus = new WebAudioBus();
    expect(() => bus.play('explosion', { size: 3 })).not.toThrow();
    expect(getAudio()).toBeNull();   // dom-setup defines window.AudioContext = undefined
  });
});

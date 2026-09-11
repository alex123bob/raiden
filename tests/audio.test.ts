import { describe, it, expect } from 'vitest';
import { SilentBus, WebAudioBus, getAudio, setMasterVolume, getMasterVolume, getMasterGain } from '../src/core/audio.js';
import { SFX_REGISTRY_KEYS } from '../src/core/audio.js';

describe('audio bus', () => {
  it('registers the engine sound effects including graze', () => {
    expect(SFX_REGISTRY_KEYS().sort()).toEqual(['shoot', 'explosion', 'powerup', 'bomb', 'graze'].sort());
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

describe('master volume', () => {
  it('defaults to 0.7 and clamps to 0..1', () => {
    setMasterVolume(0.5);
    expect(getMasterVolume()).toBe(0.5);
    setMasterVolume(2);
    expect(getMasterVolume()).toBe(1);
    setMasterVolume(-1);
    expect(getMasterVolume()).toBe(0);
    setMasterVolume(0.7);            // restore default for other tests
  });

  it('WebAudioBus.setVolume and getMasterGain never throw without an AudioContext', () => {
    const bus = new WebAudioBus();
    expect(() => { bus.setVolume(0.3); getMasterGain(); }).not.toThrow();
  });

  it('WebAudioBus applies its volume to the bus-local output gain', () => {
    class FakeParam { value = 0; setValueAtTime() {} exponentialRampToValueAtTime() {} linearRampToValueAtTime() {} }
    class FakeGain { gain = new FakeParam(); connect() {} }
    class FakeOscillator {
      type: OscillatorType = 'sine';
      frequency = new FakeParam();
      connect() {}
      start() {}
      stop() {}
    }
    class FakeAudioContext {
      currentTime = 0;
      state = 'running' as AudioContextState;
      destination = {} as AudioNode;
      createGain() { return new FakeGain() as unknown as GainNode; }
      createOscillator() { return new FakeOscillator() as unknown as OscillatorNode; }
      resume() { return Promise.resolve(); }
    }

    const windowLike = window as unknown as { AudioContext?: unknown };
    const previous = windowLike.AudioContext;
    windowLike.AudioContext = FakeAudioContext;
    try {
      const bus = new WebAudioBus();
      bus.setVolume(0.25);
      bus.play('graze');
      const gain = (bus as unknown as { sfxGain: { gain: { value: number } } }).sfxGain;
      expect(gain.gain.value).toBe(0.25);
      bus.setVolume(0.8);
      expect(gain.gain.value).toBe(0.8);
    } finally {
      windowLike.AudioContext = previous;
    }
  });
});

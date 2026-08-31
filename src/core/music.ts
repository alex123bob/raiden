import { getAudio, outputNode } from './audio.js';

/** One scheduled note in a layer, timed in beats from the loop start. */
export interface Note { time: number; dur: number; freq: number; type: OscillatorType; gain: number; }
/** A voice within a track (role tags it for future intensity gating). */
export interface Layer { role: 'bass' | 'arp' | 'lead' | 'drums'; notes: Note[]; }
/** A looping piece of music: tempo (BPM), loop length in beats, and its layers. */
export interface Track { key: string; tempo: number; loopBeats: number; layers: Layer[]; }

/** Sink handed to the game as ctx.music. WebAudioMusic plays; SilentMusic is the test/no-audio no-op. */
export interface MusicSink {
  play(trackKey: string): void;   // switch to this track (no-op if already playing it)
  stop(): void;                   // halt scheduling immediately
  setEnabled(enabled: boolean): void;
  setVolume(v: number): void;     // 0..1, music's share of master
}

const TRACKS = new Map<string, Track>();
/** Add (or replace) a track in the registry. */
export function registerTrack(t: Track): void { TRACKS.set(t.key, t); }
/** Look up a registered track. */
export function getTrack(key: string): Track | undefined { return TRACKS.get(key); }
/** All registered track keys (for tests). */
export function MUSIC_REGISTRY_KEYS(): string[] { return [...TRACKS.keys()]; }

/** Map a 1-based stage number to one of the three cycling stage themes. */
export function stageThemeFor(stage: number): string {
  return ['stage-a', 'stage-b', 'stage-c'][((stage - 1) % 3 + 3) % 3];
}

/** No-op music sink for headless tests / when audio is unavailable. */
export class SilentMusic implements MusicSink {
  play(_k: string): void {}
  stop(): void {}
  setEnabled(_e: boolean): void {}
  setVolume(_v: number): void {}
}

const LOOKAHEAD_MS = 25;      // scheduler tick interval
const SCHEDULE_AHEAD = 0.1;   // seconds of audio scheduled beyond now

/** Plays tracks by scheduling oscillator notes ~100ms ahead of the audio clock. */
export class WebAudioMusic implements MusicSink {
  private enabled = true;
  private vol = 0.6;                       // music's balance under SFX
  private current: Track | null = null;
  private gain: GainNode | null = null;    // per-music gain feeding the master output
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;                 // audio-clock time of the next loop's start
  private beatDur = 0.5;                    // seconds per beat, from tempo

  setEnabled(e: boolean): void {
    this.enabled = e;
    if (!e) this.stop();
  }
  setVolume(v: number): void {
    this.vol = Math.max(0, Math.min(1, v));
    if (this.gain) this.gain.gain.value = this.vol;
  }
  play(trackKey: string): void {
    if (!this.enabled) return;
    const track = getTrack(trackKey);
    if (!track) return;                     // unknown key: ignore
    if (this.current && this.current.key === track.key) return;  // already playing
    const ac = getAudio();
    if (!ac) return;                        // no audio support: silent
    try {
      this.stopScheduler();
      this.current = track;
      this.beatDur = 60 / track.tempo;
      if (!this.gain) {
        this.gain = ac.createGain();
        this.gain.gain.value = this.vol;
        const out = outputNode() ?? ac.destination;
        this.gain.connect(out);
      }
      this.nextNoteTime = ac.currentTime + 0.05;
      this.timer = setInterval(() => this.tick(), LOOKAHEAD_MS);
    } catch { /* never crash the loop */ }
  }
  stop(): void {
    this.stopScheduler();
    this.current = null;
  }
  private stopScheduler(): void {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
  }
  private tick(): void {
    const ac = getAudio();
    if (!ac || !this.current || !this.gain) return;
    try {
      const loopLen = this.current.loopBeats * this.beatDur;
      // Schedule whole loops until we're SCHEDULE_AHEAD past now.
      while (this.nextNoteTime < ac.currentTime + SCHEDULE_AHEAD) {
        this.scheduleLoop(ac, this.nextNoteTime);
        this.nextNoteTime += loopLen;
      }
    } catch { /* ignore */ }
  }
  private scheduleLoop(ac: AudioContext, loopStart: number): void {
    for (const layer of this.current!.layers) {
      for (const n of layer.notes) {
        const t = loopStart + n.time * this.beatDur;
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = n.type;
        osc.frequency.value = n.freq;
        osc.connect(g); g.connect(this.gain!);
        const dur = n.dur * this.beatDur;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(n.gain, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.start(t); osc.stop(t + dur + 0.02);
      }
    }
  }
}

// A driving minor-key loop: bass pulse + arpeggio. 8 beats.
registerTrack({
  key: 'stage-a',
  tempo: 132,
  loopBeats: 8,
  layers: [
    {
      role: 'bass',
      notes: [0, 1, 2, 3, 4, 5, 6, 7].map(b => ({
        time: b, dur: 0.9, freq: b % 2 === 0 ? 110 : 146.83, type: 'triangle' as OscillatorType, gain: 0.18,
      })),
    },
    {
      role: 'arp',
      notes: [220, 261.63, 329.63, 392, 329.63, 261.63, 220, 261.63].map((f, i) => ({
        time: i, dur: 0.45, freq: f, type: 'square' as OscillatorType, gain: 0.08,
      })),
    },
  ],
});

// Brighter major-key loop.
registerTrack({
  key: 'stage-b',
  tempo: 140,
  loopBeats: 8,
  layers: [
    { role: 'bass', notes: [0,1,2,3,4,5,6,7].map(b => ({
      time: b, dur: 0.9, freq: b % 4 < 2 ? 130.81 : 98, type: 'triangle' as OscillatorType, gain: 0.18 })) },
    { role: 'arp', notes: [261.63,329.63,392,523.25,392,329.63,293.66,329.63].map((f,i) => ({
      time: i, dur: 0.45, freq: f, type: 'square' as OscillatorType, gain: 0.07 })) },
  ],
});

// Darker, tenser loop.
registerTrack({
  key: 'stage-c',
  tempo: 126,
  loopBeats: 8,
  layers: [
    { role: 'bass', notes: [0,1,2,3,4,5,6,7].map(b => ({
      time: b, dur: 0.9, freq: b % 2 === 0 ? 87.31 : 116.54, type: 'sawtooth' as OscillatorType, gain: 0.14 })) },
    { role: 'arp', notes: [174.61,207.65,261.63,311.13,261.63,207.65,174.61,207.65].map((f,i) => ({
      time: i, dur: 0.45, freq: f, type: 'triangle' as OscillatorType, gain: 0.08 })) },
  ],
});

// Boss: faster, minor, insistent.
registerTrack({
  key: 'boss',
  tempo: 158,
  loopBeats: 8,
  layers: [
    { role: 'bass', notes: [0,0.5,1,1.5,2,2.5,3,3.5,4,4.5,5,5.5,6,6.5,7,7.5].map(b => ({
      time: b, dur: 0.4, freq: 82.41, type: 'sawtooth' as OscillatorType, gain: 0.16 })) },
    { role: 'lead', notes: [329.63,392,440,392,329.63,392,440,493.88].map((f,i) => ({
      time: i, dur: 0.8, freq: f, type: 'square' as OscillatorType, gain: 0.09 })) },
  ],
});

// Title: slow, atmospheric.
registerTrack({
  key: 'title',
  tempo: 96,
  loopBeats: 8,
  layers: [
    { role: 'bass', notes: [0,2,4,6].map(b => ({
      time: b, dur: 1.8, freq: 110, type: 'triangle' as OscillatorType, gain: 0.14 })) },
    { role: 'lead', notes: [0,2,4,6].map((b,i) => ({
      time: b, dur: 1.6, freq: [329.63,392,293.66,440][i], type: 'sine' as OscillatorType, gain: 0.10 })) },
  ],
});

// Stage-clear: short triumphant motif (loops harmlessly until the state changes).
registerTrack({
  key: 'stage-clear',
  tempo: 150,
  loopBeats: 4,
  layers: [
    { role: 'lead', notes: [261.63,329.63,392,523.25].map((f,i) => ({
      time: i * 0.75, dur: 0.7, freq: f, type: 'square' as OscillatorType, gain: 0.12 })) },
  ],
});

// Game-over: short descending minor motif.
registerTrack({
  key: 'game-over',
  tempo: 84,
  loopBeats: 4,
  layers: [
    { role: 'lead', notes: [329.63,293.66,246.94,196].map((f,i) => ({
      time: i * 0.9, dur: 0.85, freq: f, type: 'triangle' as OscillatorType, gain: 0.12 })) },
  ],
});

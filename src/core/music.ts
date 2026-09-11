import { getAudio, outputNode } from './audio.js';

/** One scheduled note in a layer, timed in beats from the loop start. */
export interface Note { time: number; dur: number; freq: number; type: OscillatorType; gain: number; }
/** A voice within a track (role tags it for future intensity gating). */
export interface Layer { role: 'bass' | 'arp' | 'lead' | 'drums'; notes: Note[]; }
/** A synthesized piece of music: tempo (BPM), loop length in beats, layers, and optional one-shot mode. */
export interface Track {
  key: string;
  tempo: number;
  loopBeats: number;
  layers: Layer[];
  /** Short cue tracks play once; stage/boss/title tracks loop by default. */
  loop?: boolean;
}

/** Sink handed to the game as ctx.music. WebAudioMusic plays; SilentMusic is the test/no-audio no-op. */
export interface MusicSink {
  play(trackKey: string, returnTrackKey?: string): void;   // crossfade; one-shot tracks may return to a chosen track
  stop(): void;                   // stop scheduling immediately and fade out
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
  play(_k: string, _returnKey?: string): void {}
  stop(): void {}
  setEnabled(_e: boolean): void {}
  setVolume(_v: number): void {}
}

const LOOKAHEAD_MS = 25;      // scheduler tick interval
const SCHEDULE_AHEAD = 0.1;   // seconds of audio scheduled beyond now
const CROSSFADE_SECONDS = 0.4;

/** Plays tracks by scheduling oscillator notes ~100ms ahead of the audio clock. */
export class WebAudioMusic implements MusicSink {
  private enabled = true;
  private vol = 0.6;                       // music's balance under SFX
  private current: Track | null = null;
  private gain: GainNode | null = null;    // per-music gain feeding the master output
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextNoteTime = 0;                 // audio-clock time of the next loop's start
  private beatDur = 0.5;                    // seconds per beat, from tempo
  private oneShotScheduled = false;
  private oneShotEndTime = Infinity;
  private returnTrack: Track | null = null;

  setEnabled(e: boolean): void {
    this.enabled = e;
    if (!e) {
      // Preserve the selected track so a mute toggle can resume it later.
      this.stopScheduler();
      if (this.gain) this.gain.gain.value = 0;
    } else if (this.current && this.timer === null) {
      this.startScheduler();
    }
  }
  setVolume(v: number): void {
    this.vol = Math.max(0, Math.min(1, v));
    if (this.gain) this.gain.gain.value = this.vol;
  }
  play(trackKey: string, returnTrackKey?: string): void {
    if (!this.enabled) return;
    const track = getTrack(trackKey);
    if (!track) return;                     // unknown key: ignore
    if (this.current && this.current.key === track.key && this.timer !== null) return;  // already playing
    try {
      this.stopScheduler();
      this.current = track;
      this.returnTrack = returnTrackKey ? getTrack(returnTrackKey) ?? null : null;
      this.startScheduler();
    } catch { /* never crash the loop */ }
  }
  stop(): void {
    this.stopScheduler();
    try {
      this.fadeOut(this.gain, getAudio()?.currentTime ?? 0);
    } catch { /* never let an audio glitch crash a state transition */ }
    this.gain = null;
    this.current = null;
    this.returnTrack = null;
  }
  private stopScheduler(): void {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
  }
  private startScheduler(): void {
    try {
      const ac = getAudio();
      if (!ac || !this.current) return;       // no audio support: remain silent
      const previousGain = this.gain;
      this.beatDur = 60 / this.current.tempo;
      this.fadeOut(previousGain, ac.currentTime);
      this.gain = ac.createGain();
      const out = outputNode() ?? ac.destination;
      this.gain.connect(out);
      this.gain.gain.setValueAtTime(0.0001, ac.currentTime);
      this.gain.gain.linearRampToValueAtTime(this.vol, ac.currentTime + CROSSFADE_SECONDS);
      this.nextNoteTime = ac.currentTime + 0.05;
      this.oneShotScheduled = false;
      this.oneShotEndTime = this.current.loop === false
        ? this.nextNoteTime + this.trackDuration(this.current) * this.beatDur
        : Infinity;
      this.timer = setInterval(() => this.tick(), LOOKAHEAD_MS);
    } catch { /* remain silent if the browser audio graph rejects a change */ }
  }
  private fadeOut(gain: GainNode | null, now: number): void {
    if (!gain) return;
    try {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now);
      gain.gain.linearRampToValueAtTime(0.0001, now + CROSSFADE_SECONDS);
    } catch { /* ignore */ }
  }
  private trackDuration(track: Track): number {
    let lastBeat = track.loopBeats;
    for (const layer of track.layers) {
      for (const note of layer.notes) lastBeat = Math.max(lastBeat, note.time + note.dur);
    }
    return lastBeat;
  }
  private tick(): void {
    try {
      const ac = getAudio();
      if (!ac || !this.current || !this.gain) return;
      if (this.current.loop === false) {
        if (!this.oneShotScheduled && this.nextNoteTime < ac.currentTime + SCHEDULE_AHEAD) {
          this.scheduleLoop(ac, this.nextNoteTime);
          this.oneShotScheduled = true;
        }
        if (this.oneShotScheduled && ac.currentTime >= this.oneShotEndTime) {
          const returnTrack = this.returnTrack;
          this.returnTrack = null;
          if (returnTrack) this.play(returnTrack.key);
          else this.stop();
        }
        return;
      }
      const loopLen = this.current.loopBeats * this.beatDur;
      // Schedule whole loops until we're SCHEDULE_AHEAD past now.
      while (this.nextNoteTime < ac.currentTime + SCHEDULE_AHEAD) {
        this.scheduleLoop(ac, this.nextNoteTime);
        this.nextNoteTime += loopLen;
      }
    } catch { /* ignore */ }
  }
  private scheduleLoop(ac: AudioContext, loopStart: number): void {
    const trackGain = this.gain;
    if (!trackGain || !this.current) return;
    for (const layer of this.current!.layers) {
      for (const n of layer.notes) {
        const t = loopStart + n.time * this.beatDur;
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = n.type;
        osc.frequency.value = n.freq;
        osc.connect(g); g.connect(trackGain);
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
  loop: false,
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
  loop: false,
  layers: [
    { role: 'lead', notes: [329.63,293.66,246.94,196].map((f,i) => ({
      time: i * 0.9, dur: 0.85, freq: f, type: 'triangle' as OscillatorType, gain: 0.12 })) },
  ],
});

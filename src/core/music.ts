import { getAudio, outputNode } from './audio.js';

/** One scheduled note in a layer, timed in beats from the loop start. */
export interface Note { time: number; dur: number; freq: number; type: OscillatorType; gain: number; }
/** A voice within a track (role tags it for future intensity gating). */
export interface Layer { role: 'bass' | 'arp' | 'lead' | 'drums'; notes: Note[]; }
/** A looping piece of music: tempo (BPM), loop length in beats, and its layers. */
export interface Track { key: string; tempo: number; loopBeats: number; layers: Layer[]; }

/** Sink handed to the game as ctx.music. WebAudioMusic plays; SilentMusic is the test/no-audio no-op. */
export interface MusicSink {
  play(trackKey: string): void;   // crossfade to this track; no-op if already current
  stop(): void;                   // fade out and stop scheduling
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

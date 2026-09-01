import { W, H, STATE, VOLUME_STEPS } from '../config.js';
import { ctx } from '../canvas.js';
import type { GameContext } from './GameContext.js';
import { CanvasRenderer, type RenderContext } from './Renderer.js';
import { WebAudioBus, setMasterVolume, type AudioBus } from './audio.js';
import { WebAudioMusic, stageThemeFor, type MusicSink } from './music.js';
import { isTouch } from './input.js';
import { diffMultFor, densityForStage } from './difficulty.js';
import { initBackground, updateStars, drawStars, updateBackground, drawBackground } from '../stages/background.js';
import { updateParticles, drawParticles, spawnParticleKind } from '../entities/Particle.js';
import { createPlayer, updatePlayer, drawPlayer } from '../entities/Player.js';
import { updatePlayerBullets, drawPlayerBullets, updateEnemyBullets, drawEnemyBullets } from '../entities/Bullet.js';
import { updateEnemies } from '../entities/Enemy.js';
import { updatePowerups, drawPowerups } from '../entities/Powerup.js';
import type { Player } from '../entities/Player.js';
import type { Enemy } from '../entities/Enemy.js';
import type { Boss } from '../entities/Boss.js';
import type { Bullet, EnemyBullet } from '../entities/Bullet.js';
import type { Powerup } from '../entities/Powerup.js';
import type { Particle } from '../entities/Particle.js';
import { runCollision } from './collision.js';
import { STAGES } from '../stages/stageData.js';
import { buildWaveTable, updateWaves, type WaveEntry } from '../stages/waveGen.js';
import { drawHUD } from '../render/hud.js';
import { drawTitle, drawPause, drawSettings, drawGameOver, drawStageClear, drawVictory, drawStageSelect } from '../render/screens.js';
import { drawTouchControls } from './input.js';

/** Optional constructor overrides for Game — lets tests inject a stub renderer/audio bus. */
export interface GameDeps {
  renderer?: RenderContext;
  audio?: AudioBus;
  music?: MusicSink;
}

/**
 * The whole game: owns every mutable piece of state (player, enemies, boss,
 * bullets, particles, powerups, stage/wave progress, score, screen-shake) and
 * drives the single requestAnimationFrame loop that updates and draws them.
 * Implements GameContext directly — `this` IS the `ctx`/`g` passed everywhere.
 */
export class Game implements GameContext {
  state = STATE.TITLE;             // current STATE.* enum value
  settingsOpen = false;            // true while the settings overlay is showing
  soundOn = true;                  // mute toggle mirrored into `audio`
  gameSpeed = 1.0;                 // global time multiplier from SPEED_STEPS (settings)
  volume = 0.7;                    // master volume (0..1), persisted
  score = 0;                       // current run's score
  highScore = (() => { try { return parseInt(localStorage.getItem('raidenHS') || '0'); } catch { return 0; } })();   // persisted best score
  keys: Record<string, boolean> = {};       // held-key map by KeyboardEvent.code
  moveVec = { x: 0, y: 0 };                 // analog move input from the touch stick, each axis -1..1
  player: Player | null = null;             // the ship, or null before spawn
  enemies: Enemy[] = [];                    // live regular enemies
  boss: Boss | null = null;                 // active boss, or null
  playerBullets: Bullet[] = [];
  enemyBullets: EnemyBullet[] = [];
  powerups: Powerup[] = [];
  particles: Particle[] = [];
  diffMult = 1.0;                  // per-stage speed/difficulty multiplier (see diffMultFor)
  loopMult = 1;                    // 1-based loop count; increments each time the game is beaten and replayed
  waveTable: WaveEntry[] = [];     // t-sorted spawn timeline for the current stage
  waveIndex = 0;                   // index of the next unspawned waveTable entry
  stageTimer = 0;                  // seconds elapsed since the current stage started
  currentStage = 1;                // 1-based stage number currently being played
  selectedStage = 1;                // stage highlighted on the STAGESELECT screen
  bossSpawned = false;             // true once this stage's boss trigger has fired
  bossMaxHp = 0;                   // boss HP at spawn, for the HUD/boss health bar
  bossPhase = 0;                   // boss attack-phase index (0-based)
  bossTimer = 0;                   // seconds since the current boss fight started
  bossAngle = 0;                   // boss spin/aim angle in radians, advances every frame
  stageClearTimer = 0;             // countdown (s) during the STAGECLEAR interlude
  victoryTimer = 0;                // countdown (s) used by the VICTORY sequence (currently unused by updateVictory)
  lastTime = 0;                    // rAF timestamp (ms) of the previous frame, for computing dt
  shakeTime = 0;                   // remaining seconds of the current screen shake (0 = none active)
  hitStopTimer = 0;                // seconds of gameplay freeze remaining (rendering continues)
  shakeDur = 0;                    // total duration (s) of the current shake, for computing decay fraction
  shakeMag = 0;                    // peak amplitude (px) of the current shake
  readonly renderer: RenderContext;   // drawing surface (CanvasRenderer, or a test stub)
  readonly audio: AudioBus;           // sound effect sink (WebAudioBus, or SilentBus in tests)
  readonly music: MusicSink;          // background music sink
  private lastMusicState = -1;        // last STATE.* value seen by loop(), drives the music state machine
  private loopFn: (ts: number) => void;   // bound loop() reference, so each rAF request reuses the same closure

  constructor(deps: GameDeps = {}) {
    this.renderer = deps.renderer ?? new CanvasRenderer(ctx);
    this.audio = deps.audio ?? new WebAudioBus();
    this.loadSettings();
    setMasterVolume(this.volume);
    this.audio.setEnabled(this.soundOn);
    this.music = deps.music ?? new WebAudioMusic();
    this.music.setEnabled(this.soundOn);
    this.music.setVolume(1.0);     // music sits under SFX via its own internal balance; master scales both
    this.loopFn = (ts) => this.loop(ts);
  }

  /** Flip the mute setting and propagate it to the audio bus. */
  toggleSound(): void {
    this.soundOn = !this.soundOn;
    this.audio.setEnabled(this.soundOn);
    this.music.setEnabled(this.soundOn);
    this.saveSettings();
  }

  /** Read persisted settings from localStorage into soundOn/volume/gameSpeed (best-effort). */
  loadSettings(): void {
    try {
      const raw = localStorage.getItem('raidenSettings');
      if (!raw) return;
      const s = JSON.parse(raw) as { soundOn?: boolean; volume?: number; gameSpeed?: number };
      if (typeof s.soundOn === 'boolean') this.soundOn = s.soundOn;
      if (typeof s.volume === 'number') this.volume = Math.max(0, Math.min(1, s.volume));
      if (typeof s.gameSpeed === 'number') this.gameSpeed = Math.max(0.75, Math.min(1.25, s.gameSpeed));
    } catch { /* ignore corrupt/absent storage */ }
  }

  /** Persist soundOn/volume/gameSpeed to localStorage (best-effort). */
  saveSettings(): void {
    try {
      localStorage.setItem('raidenSettings', JSON.stringify({
        soundOn: this.soundOn, volume: this.volume, gameSpeed: this.gameSpeed,
      }));
    } catch { /* ignore quota/unavailable */ }
  }

  /** Step master volume through VOLUME_STEPS, apply it, and persist. */
  cycleVolume(dir: number): void {
    // Snap to the nearest step, then move by dir.
    let i = VOLUME_STEPS.indexOf(this.volume);
    if (i === -1) { i = VOLUME_STEPS.findIndex(v => v >= this.volume); if (i === -1) i = VOLUME_STEPS.length - 1; }
    i = Math.max(0, Math.min(VOLUME_STEPS.length - 1, i + dir));
    this.volume = VOLUME_STEPS[i];
    setMasterVolume(this.volume);
    this.saveSettings();
  }

  /** Cue the game-over music sting. Called when the final life is lost. */
  onGameOver(): void { this.music.play('game-over'); }

  /** Persist the current score as the new high score if it beats the stored one. */
  saveHS(): void {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      try {
        localStorage.setItem('raidenHS', String(this.highScore));
      } catch { /* ignore quota/unavailable */ }
    }
  }

  /** Reset for a brand-new run: fresh player/score, clear transient arrays, enter stage `stage` (1-based, default 1). */
  startGame(stage = 1): void {
    this.score = 0;
    this.player = createPlayer();
    this.particles.length = 0;
    this.powerups.length = 0;
    this.startStage(stage);
    this.state = STATE.PLAYING;
  }

  /** Reset per-stage state and begin stage `n` (1-based): rebuild difficulty, background, and wave table. */
  startStage(stage: number): void {
    this.currentStage = stage;
    this.music.play(stageThemeFor(stage));
    this.diffMult = diffMultFor(stage, this.loopMult);
    initBackground(stage, this);
    this.waveTable = buildWaveTable(STAGES[stage - 1], this.diffMult, densityForStage(stage));
    this.waveIndex = 0;
    this.stageTimer = 0;
    this.bossSpawned = false;
    this.boss = null;
    this.enemies.length = 0;
    this.enemyBullets.length = 0;
    this.playerBullets.length = 0;
    this.powerups.length = 0;
  }

  /** GameContext hook: spawn a particle-kind burst at (x,y); opts are kind-specific tuning. */
  spawnParticles(kind: string, x: number, y: number, opts?: Record<string, unknown>): void {
    spawnParticleKind(kind, x, y, opts ?? {}, this);
  }

  /** GameContext hook: trigger/extend a screen shake. `mag` px amplitude, `dur` seconds. */
  shake(mag: number, dur: number): void {
    // Take the stronger/longer of any overlapping shakes rather than stacking.
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeDur = Math.max(this.shakeDur, dur);
    this.shakeTime = Math.max(this.shakeTime, dur);
  }

  /** GameContext hook: freeze gameplay for `ms` ms; takes the longer of any overlapping freeze. */
  hitStop(ms: number): void {
    this.hitStopTimer = Math.max(this.hitStopTimer, ms / 1000);
  }

  /** GameContext hook: haptic buzz on touch devices that support the Vibration API (Android; iOS haptics are driven by the real switch overlay in input.ts instead — see there). */
  vibrate(ms: number): void {
    if (isTouch && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms);
  }

  /** Count down the STAGECLEAR interlude; once it elapses, advance to the next stage. */
  updateStageClear(dt: number): void {
    this.stageClearTimer -= dt;
    if (this.stageClearTimer <= 0) {
      this.startStage(this.currentStage + 1);
      this.state = STATE.PLAYING;
    }
  }

  updateVictory(_dt: number): void { /* victory stays until Enter */ }

  /**
   * The single game loop: reschedules itself via requestAnimationFrame, computes
   * dt, then runs update (world state) followed by draw (in fixed z-order:
   * background → enemies/boss/bullets/powerups/player → particles → shake
   * restore → HUD/overlays → touch controls). Called once per animation frame.
   */
  loop(ts: number): void {
    requestAnimationFrame(this.loopFn);
    const rawDt = Math.min((ts - this.lastTime) / 1000, 0.05);   // clamp dt so a tab-switch stall can't jump-cut the sim
    this.lastTime = ts;
    // Music state machine: title theme on TITLE; pause silences; resume restores stage/boss theme.
    if (this.state !== this.lastMusicState) {
      if (this.state === STATE.TITLE) this.music.play('title');
      else if (this.state === STATE.PAUSED) this.music.stop();
      else if (this.state === STATE.PLAYING && this.lastMusicState === STATE.PAUSED) {
        this.music.play(this.boss ? 'boss' : stageThemeFor(this.currentStage));
      }
      this.lastMusicState = this.state;
    }
    let dt = rawDt * this.gameSpeed;   // gameSpeed-scaled dt for gameplay; rawDt (below) drives shake decay
    if (this.hitStopTimer > 0) {
      this.hitStopTimer = Math.max(0, this.hitStopTimer - rawDt);   // decays on real time
      dt = 0;                                                        // freeze gameplay this frame
    }

    // NOTE: background.ts is the BG_FEATURES registry module (Task 12).
    if (this.state !== STATE.PAUSED) updateStars(dt, this);
    if (this.state === STATE.PLAYING || this.state === STATE.STAGECLEAR) updateBackground(dt, this);
    if (this.state === STATE.PLAYING || this.state === STATE.STAGECLEAR) updateParticles(dt, this);
    if (this.state === STATE.STAGECLEAR) this.updateStageClear(dt);
    if (this.state === STATE.VICTORY) this.updateVictory(dt);
    // Shake decays on real time (rawDt), not gameSpeed-scaled dt, so it isn't slowed by settings.
    if (this.shakeTime > 0) this.shakeTime = Math.max(0, this.shakeTime - rawDt);
    if (this.state === STATE.PLAYING) {
      updatePlayer(dt, this);
      updatePlayerBullets(dt, this);
      updateEnemies(dt, this);
      updateEnemyBullets(dt, this);
      runCollision(this);
      updatePowerups(dt, this);
      this.boss?.update(dt, this);
      updateWaves(dt, this);
    }

    ctx.textAlign = 'left';
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    // Screen shake: offset the whole world layer, restore before HUD/overlays.
    let shaking = false;
    if (this.shakeTime > 0 && this.shakeDur > 0) {
      const k = (this.shakeTime / this.shakeDur) * this.shakeMag;   // linear decay of amplitude over the shake's life
      ctx.save();
      ctx.translate((Math.random() - 0.5) * 2 * k, (Math.random() - 0.5) * 2 * k);   // random jitter within +-k px
      shaking = true;
    }

    if (this.state === STATE.PLAYING || this.state === STATE.STAGECLEAR || this.state === STATE.PAUSED) {
      drawBackground(this.renderer, this);
    } else {
      ctx.fillStyle = '#020208';
      ctx.fillRect(0, 0, W, H);
      drawStars(this.renderer, this);
    }

    if (this.state === STATE.TITLE)         drawTitle(this);
    else if (this.state === STATE.GAMEOVER) drawGameOver(this);
    else if (this.state === STATE.VICTORY)  drawVictory(this);
    else if (this.state === STATE.STAGESELECT) drawStageSelect(this);
    else {
      this.enemies.forEach(e => e.draw(this.renderer, this));
      this.boss?.draw(this.renderer, this);
      drawEnemyBullets(this.renderer, this);
      drawPowerups(this.renderer, this);
      drawPlayerBullets(this.renderer, this);
      if (this.player) drawPlayer(this.player, this.renderer, this);
      drawParticles(this.renderer, this);
      if (shaking) { ctx.restore(); shaking = false; }   // stop shaking before HUD/overlays draw
      drawHUD(this);
      if (this.state === STATE.PAUSED)     drawPause(this);
      if (this.state === STATE.STAGECLEAR) drawStageClear(this);
    }
    if (shaking) ctx.restore();   // safety net: restore if the shaking branch above wasn't reached (TITLE/GAMEOVER/VICTORY)
    if (this.settingsOpen) drawSettings(this);
    drawTouchControls(this);
  }
}

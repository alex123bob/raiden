import { W, H, STATE, STAGE_COUNT, VOLUME_STEPS } from '../config.js';
import { ctx } from '../canvas.js';
import type { GameContext } from './GameContext.js';
import { CanvasRenderer, type RenderContext } from './Renderer.js';
import { WebAudioBus, setMasterVolume, type AudioBus } from './audio.js';
import { WebAudioMusic, stageThemeFor, type MusicSink } from './music.js';
import {
  insertScore,
  loadHighScore,
  loadLeaderboard,
  saveLeaderboard,
  saveLegacyHighScore,
  type InitialsEntry,
  type LeaderboardEntry,
  qualifiesForLeaderboard,
} from './leaderboard.js';
import {
  loadProgress,
  recordStageReached,
  sanitizeProgress,
  saveProgress,
  unlockNextStage as unlockProgressNextStage,
  type CampaignProgress,
} from './progress.js';
import { resetCombo, updateScoring, type StageBonusAward } from './scoring.js';
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

const INITIALS_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

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
  reducedMotion = false;           // accessibility comfort toggle; suppresses shake/haptics and softens hit-stop
  showHitbox = false;              // accessibility/meta toggle; draws the player's true collision circle
  threatContrast = false;          // accessibility toggle; outlines enemy bullets for dense screens
  score = 0;                       // current run's score
  leaderboard: LeaderboardEntry[] = loadLeaderboard(); // local top-10 scores with initials
  highScore = loadHighScore(this.leaderboard);   // persisted best score, compatible with legacy raidenHS
  initialsEntry: InitialsEntry | null = null;    // active game-over initials entry, if the score qualifies
  progress: CampaignProgress = loadProgress();   // local campaign unlocks and best reached loop/stage
  combo = 0;                         // active kill-chain multiplier (0 = inactive)
  comboTimer = 0;                    // seconds until active combo expires
  maxCombo = 0;                      // best combo reached during this run
  stageNoMiss = true;                // false once a life is lost during the current stage
  stageNoBomb = true;                // false once a bomb is spent during the current stage
  lastStageBonus: StageBonusAward | null = null; // shown on the stage-clear overlay
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

  /** Flip reduced-motion mode and clear active motion effects immediately. */
  toggleReducedMotion(): void {
    this.reducedMotion = !this.reducedMotion;
    if (this.reducedMotion) {
      this.shakeTime = 0;
      this.shakeDur = 0;
      this.shakeMag = 0;
      this.hitStopTimer = Math.min(this.hitStopTimer, 0.03);
    }
    this.saveSettings();
  }

  /** Flip the visible player-hitbox overlay and persist it. */
  toggleHitbox(): void {
    this.showHitbox = !this.showHitbox;
    this.saveSettings();
  }

  /** Flip the high-contrast threat outline overlay and persist it. */
  toggleThreatContrast(): void {
    this.threatContrast = !this.threatContrast;
    this.saveSettings();
  }

  /** Read persisted settings from localStorage into soundOn/volume/gameSpeed/reducedMotion/showHitbox/threatContrast (best-effort). */
  loadSettings(): void {
    try {
      const raw = localStorage.getItem('raidenSettings');
      if (!raw) return;
      const s = JSON.parse(raw) as {
        soundOn?: boolean;
        volume?: number;
        gameSpeed?: number;
        reducedMotion?: boolean;
        showHitbox?: boolean;
        threatContrast?: boolean;
      };
      if (typeof s.soundOn === 'boolean') this.soundOn = s.soundOn;
      if (typeof s.volume === 'number') this.volume = Math.max(0, Math.min(1, s.volume));
      if (typeof s.gameSpeed === 'number') this.gameSpeed = Math.max(0.75, Math.min(1.25, s.gameSpeed));
      if (typeof s.reducedMotion === 'boolean') this.reducedMotion = s.reducedMotion;
      if (typeof s.showHitbox === 'boolean') this.showHitbox = s.showHitbox;
      if (typeof s.threatContrast === 'boolean') this.threatContrast = s.threatContrast;
    } catch { /* ignore corrupt/absent storage */ }
  }

  /** Persist soundOn/volume/gameSpeed/reducedMotion/showHitbox/threatContrast to localStorage (best-effort). */
  saveSettings(): void {
    try {
      localStorage.setItem('raidenSettings', JSON.stringify({
        soundOn: this.soundOn,
        volume: this.volume,
        gameSpeed: this.gameSpeed,
        reducedMotion: this.reducedMotion,
        showHitbox: this.showHitbox,
        threatContrast: this.threatContrast,
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

  /** Persist the current score as the new high score if it beats the stored one. */
  saveHS(): void {
    if (this.score > this.highScore) {
      this.highScore = Math.floor(this.score);
      saveLegacyHighScore(this.highScore);
    }
  }

  /** Highest stage the player may launch from the title stage-select menu. */
  maxSelectableStage(): number {
    this.progress = sanitizeProgress(this.progress);
    return this.progress.highestStage;
  }

  /** Persist the next stage unlock after a clear, keeping storage best-effort. */
  unlockNextStage(clearedStage: number): void {
    this.progress = unlockProgressNextStage(this.progress, clearedStage);
    saveProgress(this.progress);
  }

  private clampAuthoredStage(stage: number): number {
    const clean = Number.isFinite(stage) ? Math.floor(stage) : 1;
    return Math.max(1, Math.min(STAGE_COUNT, clean));
  }

  private clampSelectableStage(stage: number): number {
    return Math.max(1, Math.min(this.maxSelectableStage(), this.clampAuthoredStage(stage)));
  }

  /** Enter game-over and prepare a leaderboard initials prompt for qualifying scores. */
  enterGameOver(): void {
    this.state = STATE.GAMEOVER;
    this.music.play('game-over', 'title');
    this.saveHS();
    this.leaderboard = loadLeaderboard();
    this.highScore = loadHighScore(this.leaderboard);
    this.initialsEntry = qualifiesForLeaderboard(this.score, this.leaderboard)
      ? { initials: 'AAA', cursor: 0 }
      : null;
  }

  /** Handle keyboard-style initials entry on GAMEOVER. Returns true when it consumes the key. */
  handleInitialsKey(code: string): boolean {
    if (!this.initialsEntry) return false;
    if (code === 'Enter') { this.submitLeaderboardInitials(); return true; }
    if (code === 'ArrowLeft') { this.moveInitialsCursor(-1); return true; }
    if (code === 'ArrowRight') { this.moveInitialsCursor(1); return true; }
    if (code === 'ArrowUp') { this.cycleInitial(1); return true; }
    if (code === 'ArrowDown') { this.cycleInitial(-1); return true; }
    if (code === 'Backspace') { this.setInitialAtCursor('A', false); this.moveInitialsCursor(-1); return true; }
    if (/^Key[A-Z]$/.test(code)) { this.setInitialAtCursor(code.slice(3), true); return true; }
    if (/^Digit[0-9]$/.test(code)) { this.setInitialAtCursor(code.slice(5), true); return true; }
    return false;
  }

  /** Save the active initials entry into the local top-10 leaderboard. */
  submitLeaderboardInitials(): boolean {
    if (!this.initialsEntry) return false;
    if (!qualifiesForLeaderboard(this.score, this.leaderboard)) {
      this.initialsEntry = null;
      return false;
    }
    this.leaderboard = insertScore(this.leaderboard, {
      initials: this.initialsEntry.initials,
      score: Math.floor(this.score),
      stage: this.currentStage,
      loop: this.loopMult,
      date: Date.now(),
    });
    saveLeaderboard(this.leaderboard);
    this.highScore = loadHighScore(this.leaderboard);
    saveLegacyHighScore(this.highScore);
    this.initialsEntry = null;
    return true;
  }

  private moveInitialsCursor(dir: number): void {
    if (!this.initialsEntry) return;
    this.initialsEntry.cursor = Math.max(0, Math.min(2, this.initialsEntry.cursor + dir));
  }

  private cycleInitial(dir: number): void {
    if (!this.initialsEntry) return;
    const current = this.initialsEntry.initials[this.initialsEntry.cursor] ?? 'A';
    const i = Math.max(0, INITIALS_CHARS.indexOf(current));
    const next = (i + dir + INITIALS_CHARS.length) % INITIALS_CHARS.length;
    this.setInitialAtCursor(INITIALS_CHARS[next], false);
  }

  private setInitialAtCursor(ch: string, advance: boolean): void {
    if (!this.initialsEntry || !INITIALS_CHARS.includes(ch)) return;
    const chars = this.initialsEntry.initials.split('');
    chars[this.initialsEntry.cursor] = ch;
    this.initialsEntry.initials = chars.join('');
    if (advance) this.moveInitialsCursor(1);
  }

  /** Reset for a brand-new run: fresh player/score, clear transient arrays, enter an unlocked stage (default 1). */
  startGame(stage = 1): void {
    const firstStage = this.clampSelectableStage(stage);
    this.score = 0;
    resetCombo(this);
    this.maxCombo = 0;
    this.stageNoMiss = true;
    this.stageNoBomb = true;
    this.lastStageBonus = null;
    this.initialsEntry = null;
    this.leaderboard = loadLeaderboard();
    this.highScore = loadHighScore(this.leaderboard);
    this.player = createPlayer();
    this.particles.length = 0;
    this.powerups.length = 0;
    this.selectedStage = firstStage;
    this.startStage(firstStage);
    this.state = STATE.PLAYING;
  }

  /** Reset per-stage state and begin stage `n` (1-based): rebuild difficulty, background, and wave table. */
  startStage(stage: number): void {
    stage = this.clampAuthoredStage(stage);
    this.currentStage = stage;
    this.progress = recordStageReached(this.progress, stage, this.loopMult);
    saveProgress(this.progress);
    this.music.play(stageThemeFor(stage));
    resetCombo(this);
    this.stageNoMiss = true;
    this.stageNoBomb = true;
    this.lastStageBonus = null;
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
    if (this.reducedMotion) return;
    // Take the stronger/longer of any overlapping shakes rather than stacking.
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeDur = Math.max(this.shakeDur, dur);
    this.shakeTime = Math.max(this.shakeTime, dur);
  }

  /** GameContext hook: freeze gameplay for `ms` ms; takes the longer of any overlapping freeze. */
  hitStop(ms: number): void {
    const cappedMs = this.reducedMotion ? Math.min(ms, 30) : ms;
    this.hitStopTimer = Math.max(this.hitStopTimer, cappedMs / 1000);
  }

  /** GameContext hook: haptic buzz on touch devices that support the Vibration API (Android; iOS haptics are driven by the real switch overlay in input.ts instead — see there). */
  vibrate(ms: number): void {
    if (this.reducedMotion) return;
    if (isTouch && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(ms);
  }

  /** Count down the STAGECLEAR interlude; once it elapses, advance to the next stage. */
  updateStageClear(dt: number): void {
    this.stageClearTimer -= dt;
    if (this.stageClearTimer <= 0) {
      this.unlockNextStage(this.currentStage);
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
      updateScoring(dt, this);
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

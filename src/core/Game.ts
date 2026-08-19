import { W, H, STATE } from '../config.js';
import { ctx } from '../canvas.js';
import type { GameContext } from './GameContext.js';
import { CanvasRenderer, type RenderContext } from './Renderer.js';
import { WebAudioBus, type AudioBus } from './audio.js';
import { diffMultFor } from './difficulty.js';
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
import { drawTitle, drawPause, drawSettings, drawGameOver, drawStageClear, drawVictory } from '../render/screens.js';
import { drawTouchControls } from './input.js';

export interface GameDeps {
  renderer?: RenderContext;
  audio?: AudioBus;
}

export class Game implements GameContext {
  state = STATE.TITLE;
  settingsOpen = false;
  soundOn = true;
  gameSpeed = 1.0;
  score = 0;
  highScore = parseInt(localStorage.getItem('raidenHS') || '0');
  keys: Record<string, boolean> = {};
  moveVec = { x: 0, y: 0 };
  player: Player | null = null;
  enemies: Enemy[] = [];
  boss: Boss | null = null;
  playerBullets: Bullet[] = [];
  enemyBullets: EnemyBullet[] = [];
  powerups: Powerup[] = [];
  particles: Particle[] = [];
  diffMult = 1.0;
  loopMult = 1;
  waveTable: WaveEntry[] = [];
  waveIndex = 0;
  stageTimer = 0;
  currentStage = 1;
  bossSpawned = false;
  bossMaxHp = 0;
  bossPhase = 0;
  bossTimer = 0;
  bossAngle = 0;
  stageClearTimer = 0;
  victoryTimer = 0;
  lastTime = 0;
  readonly renderer: RenderContext;
  readonly audio: AudioBus;
  private loopFn: (ts: number) => void;

  constructor(deps: GameDeps = {}) {
    this.renderer = deps.renderer ?? new CanvasRenderer(ctx);
    this.audio = deps.audio ?? new WebAudioBus();
    this.audio.setEnabled(this.soundOn);
    this.loopFn = (ts) => this.loop(ts);
  }

  toggleSound(): void {
    this.soundOn = !this.soundOn;
    this.audio.setEnabled(this.soundOn);
  }

  saveHS(): void {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('raidenHS', String(this.highScore));
    }
  }

  startGame(): void {
    this.score = 0;
    this.player = createPlayer();
    this.particles.length = 0;
    this.powerups.length = 0;
    this.startStage(1);
    this.state = STATE.PLAYING;
  }

  startStage(stage: number): void {
    this.currentStage = stage;
    this.diffMult = diffMultFor(stage, this.loopMult);
    initBackground(stage);   // old one-argument signature until Task 12
    this.waveTable = buildWaveTable(STAGES[stage - 1], this.diffMult);
    this.waveIndex = 0;
    this.stageTimer = 0;
    this.bossSpawned = false;
    this.boss = null;
    this.enemies.length = 0;
    this.enemyBullets.length = 0;
    this.playerBullets.length = 0;
    this.powerups.length = 0;
  }

  spawnParticles(kind: string, x: number, y: number, opts?: Record<string, unknown>): void {
    spawnParticleKind(kind, x, y, opts ?? {}, this);
  }

  updateStageClear(dt: number): void {
    this.stageClearTimer -= dt;
    if (this.stageClearTimer <= 0) {
      this.startStage(this.currentStage + 1);
      this.state = STATE.PLAYING;
    }
  }

  updateVictory(_dt: number): void { /* victory stays until Enter */ }

  loop(ts: number): void {
    requestAnimationFrame(this.loopFn);
    const rawDt = Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;
    const dt = rawDt * this.gameSpeed;

    // NOTE: background.ts is still the old ctx-singleton module until Task 12,
    // so these are the OLD one-argument signatures. Task 12 switches them.
    if (this.state !== STATE.PAUSED) updateStars(dt);
    if (this.state === STATE.PLAYING || this.state === STATE.STAGECLEAR) updateBackground(dt);
    if (this.state === STATE.PLAYING || this.state === STATE.STAGECLEAR) updateParticles(dt, this);
    if (this.state === STATE.STAGECLEAR) this.updateStageClear(dt);
    if (this.state === STATE.VICTORY) this.updateVictory(dt);
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
    if (this.state === STATE.PLAYING || this.state === STATE.STAGECLEAR || this.state === STATE.PAUSED) {
      drawBackground(this);
    } else {
      ctx.fillStyle = '#020208';
      ctx.fillRect(0, 0, W, H);
      drawStars();
    }

    if (this.state === STATE.TITLE)         drawTitle(this);
    else if (this.state === STATE.GAMEOVER) drawGameOver(this);
    else if (this.state === STATE.VICTORY)  drawVictory(this);
    else {
      this.enemies.forEach(e => e.draw(this.renderer, this));
      this.boss?.draw(this.renderer, this);
      drawEnemyBullets(this.renderer, this);
      drawPowerups(this.renderer, this);
      drawPlayerBullets(this.renderer, this);
      if (this.player) drawPlayer(this.player, this.renderer, this);
      drawParticles(this.renderer, this);
      drawHUD(this);
      if (this.state === STATE.PAUSED)     drawPause(this);
      if (this.state === STATE.STAGECLEAR) drawStageClear(this);
    }
    if (this.settingsOpen) drawSettings(this);
    drawTouchControls(this);
  }
}

import { W, H, STATE, STAGE_COUNT } from '../config.js';
import { ctx } from '../canvas.js';
import { diffMultFor } from './difficulty.js';
import { initBackground, updateStars, drawStars, updateBackground, drawBackground } from '../stages/background.js';
import { updateParticles, drawParticles } from '../entities/Particle.js';
import { createPlayer, drawPlayer, updatePlayer } from '../entities/Player.js';
import { updatePlayerBullets, drawPlayerBullets,
         updateEnemyBullets, drawEnemyBullets } from '../entities/Bullet.js';
import { drawEnemy, updateEnemies } from '../entities/Enemy.js';
import { updatePowerups, drawPowerups } from '../entities/Powerup.js';
import { drawBoss, updateBoss } from '../entities/Boss.js';
import { runCollision } from './collision.js';
import { STAGES } from '../stages/stageData.js';
import { buildWaveTable, updateWaves } from '../stages/waveGen.js';
import { drawHUD } from '../render/hud.js';
import { drawTitle, drawPause, drawSettings, drawGameOver, drawStageClear, drawVictory } from '../render/screens.js';
import { drawTouchControls } from './input.js';
import { CanvasRenderer, type RenderContext } from './Renderer.js';
import { WebAudioBus, type AudioBus } from './audio.js';
import { spawnParticleKind } from '../entities/Particle.js';

export class Game {
  readonly renderer: RenderContext;
  readonly audio: AudioBus;

  constructor() {
    this.renderer = new CanvasRenderer(ctx);
    this.audio = new WebAudioBus();
    this.state = STATE.TITLE;
    this.settingsOpen = false;
    this.soundOn = true;
    this.gameSpeed = 1.0;
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('raidenHS') || '0');
    this.keys = {};
    this.moveVec = { x: 0, y: 0 };
    this.player = null;
    this.enemies = [];
    this.boss = null;
    this.playerBullets = [];
    this.enemyBullets = [];
    this.powerups = [];
    this.particles = [];
    this.diffMult = 1.0;
    this.loopMult = 1;
    this.waveTable = [];
    this.waveIndex = 0;
    this.stageTimer = 0;
    this.currentStage = 1;
    this.bossSpawned = false;
    this.bossMaxHp = 0;
    this.bossPhase = 0;
    this.bossTimer = 0;
    this.bossAngle = 0;
    this.stageClearTimer = 0;
    this.victoryTimer = 0;
    this.lastTime = 0;
    this.loop = this.loop.bind(this);
  }

  spawnParticles(kind: string, x: number, y: number, opts?: Record<string, unknown>): void {
    spawnParticleKind(kind, x, y, opts ?? {}, this);
  }

  saveHS() {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('raidenHS', this.highScore);
    }
  }

  startGame() {
    this.score = 0;
    this.player = createPlayer();
    this.particles.length = 0;
    this.powerups.length = 0;
    this.startStage(1);
    this.state = STATE.PLAYING;
  }

  startStage(stage) {
    this.currentStage = stage;
    this.diffMult = diffMultFor(stage, this.loopMult);
    initBackground(stage);
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

  updateStageClear(dt) {
    this.stageClearTimer -= dt;
    if (this.stageClearTimer <= 0) {
      this.startStage(this.currentStage + 1);
      this.state = STATE.PLAYING;
    }
  }

  updateVictory(dt) { /* victory stays until Enter */ }

  loop(ts) {
    requestAnimationFrame(this.loop);
    const rawDt = Math.min((ts - this.lastTime) / 1000, 0.05);
    this.lastTime = ts;
    const dt = rawDt * this.gameSpeed;

    // Update
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
      updateBoss(dt, this);
      updateWaves(dt, this);
    }

    // Render
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
      this.enemies.forEach(drawEnemy);
      drawBoss(this);
      drawEnemyBullets(this.renderer, this);
      drawPowerups(this.renderer, this);
      drawPlayerBullets(this.renderer, this);
      drawPlayer(this.player);
      drawParticles(this.renderer, this);
      drawHUD(this);
      if (this.state === STATE.PAUSED)     drawPause(this);
      if (this.state === STATE.STAGECLEAR) drawStageClear(this);
    }
    if (this.settingsOpen) drawSettings(this);
    drawTouchControls(this);
  }
}

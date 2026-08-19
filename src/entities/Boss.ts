import { W, H, STATE, STAGE_COUNT } from '../config.js';
import type { GameContext } from '../core/GameContext.js';
import type { RenderContext } from '../core/Renderer.js';
import { Entity } from '../core/Entity.js';
import { bossHpForStage, phaseCountForStage } from '../core/difficulty.js';
import { STAGES } from '../stages/stageData.js';
import { BULLET_PATTERNS } from '../registries/bullets/patterns.js';
import { BOSS_TYPES, type BossType } from '../registries/bosses/index.js';
import { ENEMY_TYPES } from '../registries/enemies/index.js';
import { Enemy } from './Enemy.js';
import type { PhaseEntry } from '../registries/bosses/index.js';

export class Boss extends Entity {
  stageNum: number;
  hp: number;
  maxHp: number;
  targetX: number;
  targetY: number;
  spd: number;
  fireTimer: number;
  phaseCount: number;
  minionTimer: number;
  phantomAlpha = 1.0;
  constructor(public readonly def: BossType, stage: number, ctx: GameContext) {
    super(W / 2, 130, def.r ?? 50);
    this.stageNum = stage;
    this.maxHp = bossHpForStage(stage);
    this.hp = this.maxHp;
    this.targetX = W / 2;
    this.targetY = 130;
    this.spd = def.speed ?? 58;
    this.fireTimer = 1.8;
    this.phaseCount = phaseCountForStage(stage);
    this.minionTimer = 3.0;
    ctx.bossMaxHp = this.maxHp;
    ctx.bossPhase = 0;
    ctx.bossTimer = 0;
    ctx.bossAngle = 0;
  }
  update(dt: number, ctx: GameContext): void {
    ctx.bossTimer += dt;
    ctx.bossAngle += dt * 0.85;

    const dx = this.targetX - this.x, dy = this.targetY - this.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    if (d > 5) {
      this.x += (dx / d) * this.spd * dt;
      this.y += (dy / d) * this.spd * dt;
    } else {
      this.targetX = 80 + Math.random() * (W - 160);
      this.targetY = 60 + Math.random() * 140;
    }

    const hpPct = this.hp / this.maxHp;
    ctx.bossPhase = this.phaseCount - 1 - Math.floor(hpPct * this.phaseCount);
    ctx.bossPhase = Math.max(0, Math.min(this.phaseCount - 1, ctx.bossPhase));

    this.def.onUpdate?.(this, dt, ctx);

    if (this.def.spawnMinions) {
      this.minionTimer -= dt;
      if (this.minionTimer <= 0) {
        spawnMinion(this, ctx);
        this.minionTimer = 3.0 / ctx.diffMult;
      }
    }

    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fire(ctx);
      const rate = [1.2, 0.85, 0.55, 0.38, 0.28][Math.min(ctx.bossPhase, 4)];
      this.fireTimer = rate / ctx.diffMult + Math.random() * 0.25;
    }
  }
  draw(rc: RenderContext, ctx: GameContext): void {
    rc.withTint(this.def.tint, this.r, this.x, this.y, (c) => {
      this.def.render(c, this, ctx.bossAngle, ctx.bossTimer);
    });
    drawBossHpBar(rc, this);
  }
  fire(ctx: GameContext): void {
    if (!ctx.player || ctx.player.dead) return;
    const patterns: PhaseEntry[] = this.def.patterns;
    if (!patterns.length) return;
    const phasePatterns = patterns[ctx.bossPhase % patterns.length];
    const list = Array.isArray(phasePatterns) ? phasePatterns : [phasePatterns];
    for (const p of list) {
      const pat = BULLET_PATTERNS.get(p.name);
      if (!pat) { console.error('unknown boss pattern: ' + p.name); continue; }
      pat.fire(this, ctx, p);
    }
  }
}

function spawnMinion(boss: Boss, ctx: GameContext): void {
  const e = new Enemy(ENEMY_TYPES.get('fighter')!, boss.x + (Math.random() - 0.5) * 40, boss.y + 20, null, ctx);
  e.spd = ENEMY_TYPES.get('fighter')!.spd * ctx.diffMult * 1.2;
  ctx.enemies.push(e);
}

function drawBossHpBar(rc: RenderContext, b: Boss): void {
  const bw = 200, bh = 10;
  const bx = (W - bw) / 2, by = H - 28;
  rc.fillStyle = '#222';
  rc.fillRect(bx, by, bw, bh);
  const frac = Math.max(0, b.hp / b.maxHp);
  const hpColor = frac > 0.5 ? '#00ee44' : frac > 0.25 ? '#ffaa00' : '#ff2200';
  rc.fillStyle = hpColor;
  rc.fillRect(bx, by, bw * frac, bh);
  rc.strokeStyle = '#fff'; rc.lineWidth = 1;
  rc.strokeRect(bx, by, bw, bh);
  rc.fillStyle = '#fff';
  rc.font = '8px monospace'; rc.textAlign = 'center'; rc.textBaseline = 'alphabetic';
  rc.fillText('BOSS', W / 2, by - 3);
}

export function createBoss(ctx: GameContext): Boss {
  const stageDef = STAGES[ctx.currentStage - 1].boss;
  const base = BOSS_TYPES.get(stageDef.type)!;
  const def: BossType = {
    key: base.key,
    tint: stageDef.tint ?? base.tint,
    speed: stageDef.speed ?? base.speed,
    spawnMinions: stageDef.spawnMinions ?? base.spawnMinions,
    patterns: stageDef.patterns ?? base.patterns,
    render: base.render,
    onUpdate: base.onUpdate,
    r: stageDef.r,
  };
  return new Boss(def, ctx.currentStage, ctx);
}

export function onBossDeath(ctx: GameContext): void {
  const boss = ctx.boss!;
  const bossStage = boss.stageNum || 1;
  const explosionCount = 2 + Math.floor(bossStage * 0.5);
  ctx.spawnParticles('explosion', boss.x, boss.y, { size: 6, color: '#ffaa00' });
  ctx.spawnParticles('explosion', boss.x + 35, boss.y - 25, { size: 4, color: '#ff4400' });
  ctx.spawnParticles('explosion', boss.x - 35, boss.y + 15, { size: 4, color: '#ffcc00' });
  for (let i = 0; i < explosionCount - 3; i++) {
    const ox = (Math.random() - 0.5) * boss.r * 2;
    const oy = (Math.random() - 0.5) * boss.r * 2;
    ctx.spawnParticles('explosion', boss.x + ox, boss.y + oy, { size: 3, color: '#ff8800' });
  }
  const bossScore = 5000 + bossStage * 2000;
  ctx.score += bossScore * ctx.loopMult;
  ctx.saveHS();
  ctx.boss = null;

  if (ctx.currentStage < STAGE_COUNT) {
    ctx.state = STATE.STAGECLEAR;
    ctx.stageClearTimer = 3.0;
  } else {
    if (ctx.loopMult === 1) {
      ctx.state = STATE.VICTORY;
      ctx.victoryTimer = 0;
    } else {
      ctx.loopMult++;
      ctx.startStage(1);
      ctx.state = STATE.PLAYING;
    }
  }
}

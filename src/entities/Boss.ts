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

/**
 * The stage-ending boss. Wraps a shared BossType `def` (its behavior: render,
 * fire patterns, optional per-frame hook) with per-instance mutable state:
 * position (via Entity), HP, drift target, phase, and fire/minion timers.
 * Spawned once per stage by createBoss(); mirrors several live values onto the
 * GameContext (bossPhase/bossTimer/bossAngle/bossMaxHp) for HUD and pattern use.
 */
export class Boss extends Entity {
  /** 1-based stage number this boss belongs to; drives HP, death score, next-state. */
  stageNum: number;
  /** Current hit points; reaches 0 -> onBossDeath. */
  hp: number;
  /** Max hit points for this stage (from bossHpForStage); denominator for HP bar/phase. */
  maxHp: number;
  /** Drift destination x in pixels [0..W]; boss eases toward it, then re-randomizes. */
  targetX: number;
  /** Drift destination y in pixels [0..H]; kept near the top of the screen. */
  targetY: number;
  /** Drift speed in pixels/second toward (targetX, targetY). */
  spd: number;
  /** Countdown in seconds to the next fire(); reset to a phase-dependent interval after firing. */
  fireTimer: number;
  /** Number of HP-banded difficulty phases for this stage (from phaseCountForStage). */
  phaseCount: number;
  /** Countdown in seconds to the next minion spawn (only used when def.spawnMinions). */
  minionTimer: number;
  /** Render opacity [0..1]; kind-specific hook may fade the boss (e.g. phantom). */
  phantomAlpha = 1.0;
  /** Last frame's phase index, to detect phase-break for hit-stop. */
  private prevPhase = 0;
  constructor(public readonly def: BossType, stage: number, ctx: GameContext) {
    // Enter at top-center; radius from def or a 50px default.
    super(W / 2, 130, def.r ?? 50);
    this.stageNum = stage;
    this.maxHp = bossHpForStage(stage);
    this.hp = this.maxHp;
    this.targetX = W / 2;
    this.targetY = 130;
    this.spd = def.speed ?? 58;
    this.fireTimer = 1.8;               // grace delay before the first volley
    this.phaseCount = phaseCountForStage(stage);
    this.minionTimer = 3.0;
    // Publish per-fight state onto the shared context for HUD/patterns.
    ctx.bossMaxHp = this.maxHp;
    ctx.bossPhase = 0;
    ctx.bossTimer = 0;                  // seconds since fight start (pattern clock)
    ctx.bossAngle = 0;                  // ever-increasing spin angle (radians)
  }
  update(dt: number, ctx: GameContext): void {
    ctx.bossTimer += dt;
    ctx.bossAngle += dt * 0.85;         // constant spin: 0.85 rad/s

    // Ease toward the current drift target; on arrival pick a new one.
    const dx = this.targetX - this.x, dy = this.targetY - this.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;   // guard against divide-by-zero
    if (d > 5) {
      this.x += (dx / d) * this.spd * dt;
      this.y += (dy / d) * this.spd * dt;
    } else {
      // New wander target: x in [80..W-80], y in [60..200] (stays up top).
      this.targetX = 80 + Math.random() * (W - 160);
      this.targetY = 60 + Math.random() * 140;
    }

    // Phase advances as HP drains: full HP -> phase 0, near-dead -> last phase.
    const hpPct = this.hp / this.maxHp;
    ctx.bossPhase = this.phaseCount - 1 - Math.floor(hpPct * this.phaseCount);
    ctx.bossPhase = Math.max(0, Math.min(this.phaseCount - 1, ctx.bossPhase));
    if (ctx.bossPhase > this.prevPhase) ctx.hitStop(70);
    this.prevPhase = ctx.bossPhase;

    this.def.onUpdate?.(this, dt, ctx);  // optional kind-specific per-frame hook

    if (this.def.spawnMinions) {
      this.minionTimer -= dt;
      if (this.minionTimer <= 0) {
        spawnMinion(this, ctx);
        this.minionTimer = 3.0 / ctx.diffMult;   // faster respawn on harder diffs
      }
    }

    this.fireTimer -= dt;
    if (this.fireTimer <= 0) {
      this.fire(ctx);
      // Later phases fire faster; index clamped to the 5-entry table.
      const rate = [1.2, 0.85, 0.55, 0.38, 0.28][Math.min(ctx.bossPhase, 4)];
      this.fireTimer = rate / ctx.diffMult + Math.random() * 0.25;
    }
  }
  draw(rc: RenderContext, ctx: GameContext): void {
    // Draw the boss body through a tint wrapper, then overlay the HP bar.
    rc.withTint(this.def.tint, this.r, this.x, this.y, (c) => {
      this.def.render(c, this, ctx.bossAngle, ctx.bossTimer);
    });
    drawBossHpBar(rc, this);
  }
  fire(ctx: GameContext): void {
    if (!ctx.player || ctx.player.dead) return;
    const patterns: PhaseEntry[] = this.def.patterns;
    if (!patterns.length) return;
    // Select this phase's pattern entry (wraps if fewer entries than phases).
    const phasePatterns = patterns[ctx.bossPhase % patterns.length];
    // An entry may be a single pattern ref or an array fired together.
    const list = Array.isArray(phasePatterns) ? phasePatterns : [phasePatterns];
    for (const p of list) {
      const pat = BULLET_PATTERNS.get(p.name);
      if (!pat) { console.error('unknown boss pattern: ' + p.name); continue; }
      pat.fire(this, ctx, p);
    }
  }
}

/** Spawn one fighter minion just below the boss, slightly faster than a normal fighter. */
function spawnMinion(boss: Boss, ctx: GameContext): void {
  const e = new Enemy(ENEMY_TYPES.get('fighter')!, boss.x + (Math.random() - 0.5) * 40, boss.y + 20, null, ctx);
  e.spd = ENEMY_TYPES.get('fighter')!.spd * ctx.diffMult * 1.2;
  ctx.enemies.push(e);
}

/** Draw the boss HP bar (200x10) near the bottom of the screen, color-coded by remaining fraction. */
function drawBossHpBar(rc: RenderContext, b: Boss): void {
  const bw = 200, bh = 10;                 // bar width/height in pixels
  const bx = (W - bw) / 2, by = H - 28;    // centered horizontally, 28px above the bottom edge
  rc.fillStyle = '#222';
  rc.fillRect(bx, by, bw, bh);             // dark track behind the fill
  const frac = Math.max(0, b.hp / b.maxHp);   // remaining HP [0..1]
  // Green > 50%, amber > 25%, else red.
  const hpColor = frac > 0.5 ? '#00ee44' : frac > 0.25 ? '#ffaa00' : '#ff2200';
  rc.fillStyle = hpColor;
  rc.fillRect(bx, by, bw * frac, bh);
  rc.strokeStyle = '#fff'; rc.lineWidth = 1;
  rc.strokeRect(bx, by, bw, bh);
  rc.fillStyle = '#fff';
  rc.font = '8px monospace'; rc.textAlign = 'center'; rc.textBaseline = 'alphabetic';
  rc.fillText('BOSS', W / 2, by - 3);      // label just above the bar
}

/**
 * Build the boss for the current stage and return a live Boss instance.
 * Merges the base BossType from the registry with per-stage overrides from
 * stageData (tint/speed/minions/patterns/radius), so a stage can reskin or
 * retune a shared boss kind without defining a new type.
 */
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

/**
 * Handle the boss dying: spawn a burst of explosions, award score (scaled by
 * loop multiplier), save the high score, clear ctx.boss, then advance the game
 * state — next stage, VICTORY on the final stage of loop 1, or start a fresh
 * harder loop.
 */
export function onBossDeath(ctx: GameContext): void {
  const boss = ctx.boss!;
  ctx.hitStop(110);
  const bossStage = boss.stageNum || 1;
  // 3 fixed explosions plus a few extra scattered ones on later stages.
  const explosionCount = 2 + Math.floor(bossStage * 0.5);
  ctx.spawnParticles('explosion', boss.x, boss.y, { size: 6, color: '#ffaa00' });
  ctx.spawnParticles('explosion', boss.x + 35, boss.y - 25, { size: 4, color: '#ff4400' });
  ctx.spawnParticles('explosion', boss.x - 35, boss.y + 15, { size: 4, color: '#ffcc00' });
  for (let i = 0; i < explosionCount - 3; i++) {
    // Random offsets within the boss's bounding box.
    const ox = (Math.random() - 0.5) * boss.r * 2;
    const oy = (Math.random() - 0.5) * boss.r * 2;
    ctx.spawnParticles('explosion', boss.x + ox, boss.y + oy, { size: 3, color: '#ff8800' });
  }
  const bossScore = 5000 + bossStage * 2000;
  ctx.score += bossScore * ctx.loopMult;   // higher loops score more
  ctx.saveHS();
  ctx.boss = null;

  if (ctx.currentStage < STAGE_COUNT) {
    // More stages remain: brief stage-clear interlude, then the next stage.
    ctx.state = STATE.STAGECLEAR;
    ctx.stageClearTimer = 3.0;
    ctx.music.play('stage-clear');
  } else {
    if (ctx.loopMult === 1) {
      // Beat the final stage on the first loop: show victory.
      ctx.state = STATE.VICTORY;
      ctx.victoryTimer = 0;
    } else {
      // Already looping: bump the multiplier and restart from stage 1, harder.
      ctx.loopMult++;
      ctx.startStage(1);
      ctx.state = STATE.PLAYING;
    }
  }
}

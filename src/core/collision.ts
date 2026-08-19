import { killPlayer } from '../entities/Player.js';
import { tryDropPowerup, checkPlayerVsPowerups } from '../entities/Powerup.js';
import { onBossDeath } from '../entities/Boss.js';
import type { GameContext } from './GameContext.js';

// === COLLISION ===
export function circleHit(ax: number, ay: number, ar: number, bx: number, by: number, br: number) {
  const dx = ax - bx, dy = ay - by;
  return dx*dx + dy*dy < (ar + br) * (ar + br);
}

export function checkPlayerBulletsVsEnemies(ctx: GameContext) {
  // All bullet types (vulcan, plasma, missile) use circle collision
  for (let i = ctx.enemies.length - 1; i >= 0; i--) {
    const e = ctx.enemies[i];
    for (let j = ctx.playerBullets.length - 1; j >= 0; j--) {
      const b = ctx.playerBullets[j];
      if (circleHit(e.x, e.y, e.r, b.x, b.y, b.r)) {
        e.hp -= b.dmg;
        if (b.def.key === 'vulcan' && b.lv === 5) {
          ctx.spawnParticles('explosion', b.x, b.y, { size: 0.5, color: '#ffffff' });
        }
        if (!b.pierce) { ctx.playerBullets.splice(j, 1); j--; }
      }
    }
    if (e.hp <= 0) {
      ctx.score += e.score * ctx.loopMult;
      ctx.saveHS();
      const SIZE_BY_KEY: Record<string, number> = { fighter: 1, gunship: 2, bomber: 3, turret: 4 };
      ctx.spawnParticles('explosion', e.x, e.y, { size: SIZE_BY_KEY[e.def.key] ?? 1, color: e.color });
      tryDropPowerup(e, ctx);
      ctx.enemies.splice(i, 1);
    }
  }
}

export function checkEnemyBulletsVsPlayer(ctx: GameContext) {
  if (!ctx.player || ctx.player.dead || ctx.player.invTimer > 0) return;
  for (let i = ctx.enemyBullets.length - 1; i >= 0; i--) {
    const b = ctx.enemyBullets[i];
    if (circleHit(b.x, b.y, b.r, ctx.player.x, ctx.player.y, ctx.player.r)) {
      ctx.enemyBullets.splice(i, 1);
      killPlayer(ctx);
      return; // one hit per frame
    }
  }
}

export function checkEnemyBodiesVsPlayer(ctx: GameContext) {
  const p = ctx.player;
  if (!p || p.dead || p.invTimer > 0) return;
  ctx.enemies.forEach(e => {
    if (circleHit(e.x, e.y, e.r, p.x, p.y, p.r)) {
      killPlayer(ctx);
    }
  });
}

export function checkPlayerBulletsVsBoss(ctx: GameContext) {
  if (!ctx.boss) return;

  // All bullet types vs boss — circle collision
  for (let j = ctx.playerBullets.length - 1; j >= 0; j--) {
    const b = ctx.playerBullets[j];
    if (circleHit(ctx.boss.x, ctx.boss.y, ctx.boss.r, b.x, b.y, b.r)) {
      ctx.boss.hp -= b.dmg;
      if (b.def.key === 'vulcan' && b.lv === 5) {
        ctx.spawnParticles('explosion', b.x, b.y, { size: 0.5, color: '#ffffff' });
      }
      if (!b.pierce) { ctx.playerBullets.splice(j, 1); j--; }
    }
  }
  if (ctx.boss && ctx.boss.hp <= 0) onBossDeath(ctx);
}

export function checkBossBodyVsPlayer(ctx: GameContext) {
  if (!ctx.boss || !ctx.player || ctx.player.dead || ctx.player.invTimer > 0) return;
  if (circleHit(ctx.boss.x, ctx.boss.y, ctx.boss.r, ctx.player.x, ctx.player.y, ctx.player.r)) {
    killPlayer(ctx);
  }
}

export function runCollision(ctx: GameContext) {
  checkPlayerBulletsVsEnemies(ctx);
  checkEnemyBulletsVsPlayer(ctx);
  checkEnemyBodiesVsPlayer(ctx);
  checkPlayerBulletsVsBoss(ctx);
  checkBossBodyVsPlayer(ctx);
  checkPlayerVsPowerups(ctx);
}

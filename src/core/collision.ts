import { killPlayer } from '../entities/Player.js';
import { tryDropPowerup, checkPlayerVsPowerups } from '../entities/Powerup.js';
import { onBossDeath } from '../entities/Boss.js';

// === COLLISION ===
export function circleHit(ax, ay, ar, bx, by, br) {
  const dx = ax - bx, dy = ay - by;
  return dx*dx + dy*dy < (ar + br) * (ar + br);
}

export function checkPlayerBulletsVsEnemies(g) {
  // All bullet types (vulcan, plasma, missile) use circle collision
  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i];
    for (let j = g.playerBullets.length - 1; j >= 0; j--) {
      const b = g.playerBullets[j];
      if (circleHit(e.x, e.y, e.r, b.x, b.y, b.r)) {
        e.hp -= b.dmg;
        if (b.def.key === 'vulcan' && b.lv === 5) {
          g.spawnParticles('explosion', b.x, b.y, { size: 0.5, color: '#ffffff' });
        }
        if (!b.pierce) { g.playerBullets.splice(j, 1); j--; }
      }
    }
    if (e.hp <= 0) {
      g.score += e.score * g.loopMult;
      g.saveHS();
      const SIZE_BY_KEY: Record<string, number> = { fighter: 1, gunship: 2, bomber: 3, turret: 4 };
      g.spawnParticles('explosion', e.x, e.y, { size: SIZE_BY_KEY[e.def.key] ?? 1, color: e.color });
      tryDropPowerup(e, g);
      g.enemies.splice(i, 1);
    }
  }
}

export function checkEnemyBulletsVsPlayer(ctx) {
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

export function checkEnemyBodiesVsPlayer(ctx) {
  if (!ctx.player || ctx.player.dead || ctx.player.invTimer > 0) return;
  ctx.enemies.forEach(e => {
    if (circleHit(e.x, e.y, e.r, ctx.player.x, ctx.player.y, ctx.player.r)) {
      killPlayer(ctx);
    }
  });
}

export function checkPlayerBulletsVsBoss(g) {
  if (!g.boss) return;

  // All bullet types vs boss — circle collision
  for (let j = g.playerBullets.length - 1; j >= 0; j--) {
    const b = g.playerBullets[j];
    if (circleHit(g.boss.x, g.boss.y, g.boss.r, b.x, b.y, b.r)) {
      g.boss.hp -= b.dmg;
      if (b.def.key === 'vulcan' && b.lv === 5) {
        g.spawnParticles('explosion', b.x, b.y, { size: 0.5, color: '#ffffff' });
      }
      if (!b.pierce) { g.playerBullets.splice(j, 1); j--; }
    }
  }
  if (g.boss && g.boss.hp <= 0) onBossDeath(g);
}

export function checkBossBodyVsPlayer(ctx) {
  if (!ctx.boss || !ctx.player || ctx.player.dead || ctx.player.invTimer > 0) return;
  if (circleHit(ctx.boss.x, ctx.boss.y, ctx.boss.r, ctx.player.x, ctx.player.y, ctx.player.r)) {
    killPlayer(ctx);
  }
}

export function runCollision(g) {
  checkPlayerBulletsVsEnemies(g);
  checkEnemyBulletsVsPlayer(g);
  checkEnemyBodiesVsPlayer(g);
  checkPlayerBulletsVsBoss(g);
  checkBossBodyVsPlayer(g);
  checkPlayerVsPowerups(g);
}

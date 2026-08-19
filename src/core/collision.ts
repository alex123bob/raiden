import { spawnExplosion } from './particles.js';
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
        if (b.type === 'bullet' && b.lv === 5) {
          spawnExplosion(b.x, b.y, 0.5, '#ffffff', g);
        }
        if (!b.pierce) { g.playerBullets.splice(j, 1); j--; }
      }
    }
    if (e.hp <= 0) {
      g.score += e.score * g.loopMult;
      g.saveHS();
      spawnExplosion(e.x, e.y, e.type + 1, e.color, g);
      tryDropPowerup(e, g);
      g.enemies.splice(i, 1);
    }
  }
}

export function checkEnemyBulletsVsPlayer(g) {
  if (!g.player || g.player.dead || g.player.invTimer > 0) return;
  for (let i = g.enemyBullets.length - 1; i >= 0; i--) {
    const b = g.enemyBullets[i];
    if (circleHit(b.x, b.y, b.r, g.player.x, g.player.y, g.player.r)) {
      g.enemyBullets.splice(i, 1);
      killPlayer(g);
      return; // one hit per frame
    }
  }
}

export function checkEnemyBodiesVsPlayer(g) {
  if (!g.player || g.player.dead || g.player.invTimer > 0) return;
  g.enemies.forEach(e => {
    if (circleHit(e.x, e.y, e.r, g.player.x, g.player.y, g.player.r)) {
      killPlayer(g);
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
      if (b.type === 'bullet' && b.lv === 5) {
        spawnExplosion(b.x, b.y, 0.5, '#ffffff', g);
      }
      if (!b.pierce) { g.playerBullets.splice(j, 1); j--; }
    }
  }
  if (g.boss && g.boss.hp <= 0) onBossDeath(g);
}

export function checkBossBodyVsPlayer(g) {
  if (!g.boss || !g.player || g.player.dead || g.player.invTimer > 0) return;
  if (circleHit(g.boss.x, g.boss.y, g.boss.r, g.player.x, g.player.y, g.player.r)) {
    killPlayer(g);
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

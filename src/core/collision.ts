import { killPlayer } from '../entities/Player.js';
import { tryDropPowerup, checkPlayerVsPowerups } from '../entities/Powerup.js';
import { onBossDeath } from '../entities/Boss.js';
import type { GameContext } from './GameContext.js';

// ===========================================================================
// COLLISION — pairwise hit tests run once per frame (see runCollision), each
// pass mutates ctx.* arrays/HP directly rather than returning results.
// ===========================================================================

/** True if two circles (centers a, b; radii ar, br) overlap. Squared-distance test, no sqrt. */
export function circleHit(ax: number, ay: number, ar: number, bx: number, by: number, br: number) {
  const dx = ax - bx, dy = ay - by;
  return dx*dx + dy*dy < (ar + br) * (ar + br);
}

/**
 * Player bullets vs regular enemies. Applies damage, spawns a small hit-flash
 * for lv5 vulcan hits, removes non-piercing bullets on impact, and on kill:
 * awards score, saves the high score, spawns a size-tiered explosion, rolls a
 * powerup drop, and removes the enemy.
 */
export function checkPlayerBulletsVsEnemies(ctx: GameContext) {
  // All bullet types (vulcan, plasma, missile) use circle collision
  for (let i = ctx.enemies.length - 1; i >= 0; i--) {
    const e = ctx.enemies[i];
    for (let j = ctx.playerBullets.length - 1; j >= 0; j--) {
      const b = ctx.playerBullets[j];
      if (circleHit(e.x, e.y, e.r, b.x, b.y, b.r)) {
        e.hp -= b.dmg;
        if (b.def.key === 'vulcan' && b.lv === 5) {
          // Tiny white spark on a max-level vulcan hit (extra hit feedback).
          ctx.spawnParticles('explosion', b.x, b.y, { size: 0.5, color: '#ffffff' });
        }
        if (!b.pierce) { ctx.playerBullets.splice(j, 1); j--; }   // consume the bullet; j-- keeps the loop aligned
      }
    }
    if (e.hp <= 0) {
      ctx.score += e.score * ctx.loopMult;   // higher loops score more
      ctx.saveHS();
      // Explosion size scales with enemy "bulk"; unlisted kinds default to 1.
      const SIZE_BY_KEY: Record<string, number> = { fighter: 1, gunship: 2, bomber: 3, turret: 4 };
      ctx.spawnParticles('explosion', e.x, e.y, { size: SIZE_BY_KEY[e.def.key] ?? 1, color: e.color });
      tryDropPowerup(e, ctx);
      ctx.enemies.splice(i, 1);
    }
  }
}

/**
 * Enemy bullets vs the player. Skips entirely while the player is dead or
 * invulnerable. On a hit, consumes just that bullet and kills the player —
 * only one hit is processed per frame (further bullets are handled next frame,
 * by which point invTimer/dead guards this again).
 */
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

/** Player colliding directly with a regular enemy's body (contact damage, not bullets). */
export function checkEnemyBodiesVsPlayer(ctx: GameContext) {
  const p = ctx.player;
  if (!p || p.dead || p.invTimer > 0) return;
  ctx.enemies.forEach(e => {
    if (circleHit(e.x, e.y, e.r, p.x, p.y, p.r)) {
      killPlayer(ctx);
    }
  });
}

/**
 * Player bullets vs the boss. Same damage/hit-flash/pierce rules as regular
 * enemies; when HP drops to 0 or below, hands off to onBossDeath (which clears
 * ctx.boss and advances stage/state), so ctx.boss must be re-checked after.
 */
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
  if (ctx.boss && ctx.boss.hp <= 0) onBossDeath(ctx);   // re-check: onBossDeath may have just cleared ctx.boss
}

/** Player colliding directly with the boss's body (contact damage). */
export function checkBossBodyVsPlayer(ctx: GameContext) {
  if (!ctx.boss || !ctx.player || ctx.player.dead || ctx.player.invTimer > 0) return;
  if (circleHit(ctx.boss.x, ctx.boss.y, ctx.boss.r, ctx.player.x, ctx.player.y, ctx.player.r)) {
    killPlayer(ctx);
  }
}

/** Run every collision pass for the frame, in a fixed order. Called once per frame from Game.loop. */
export function runCollision(ctx: GameContext) {
  checkPlayerBulletsVsEnemies(ctx);
  checkEnemyBulletsVsPlayer(ctx);
  checkEnemyBodiesVsPlayer(ctx);
  checkPlayerBulletsVsBoss(ctx);
  checkBossBodyVsPlayer(ctx);
  checkPlayerVsPowerups(ctx);
}

import { type EnemyType } from '../../entities/Enemy.js';
import { spawnEnemyBullet } from '../../entities/Bullet.js';

/**
 * Seeker — electric-cyan weaver. Custom side-to-side sine movement (distinct
 * from the shared path-or-down movers) makes it read as erratic even on a
 * plain downward path. Fires rarely, but each shot is a homing missile that
 * actively tracks the player, demanding sustained attention rather than a
 * quick dodge.
 */
export const seeker: EnemyType = {
  key: 'seeker',
  hp: 6, r: 11, spd: 85, score: 250, dropChance: 0.3, color: '#33eecc',
  fireInterval: 3.0,
  render(rc, e) {
    rc.fillStyle = e.color;
    rc.beginPath();
    rc.moveTo(0, -11); rc.lineTo(9, 6); rc.lineTo(0, 2); rc.lineTo(-9, 6);
    rc.closePath(); rc.fill();
    rc.fillStyle = '#003333';
    rc.beginPath(); rc.arc(0, -1, 3, 0, Math.PI * 2); rc.fill();
  },
  fire(e, ctx) {
    // Slow homing missile aimed roughly at the player, then steered by enemyMissile.onUpdate.
    const dx = ctx.player!.x - e.x, dy = ctx.player!.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const spd = 90 * ctx.diffMult;
    const b = spawnEnemyBullet(ctx, e.x, e.y, (dx / d) * spd, (dy / d) * spd, '#33eecc', 4, 0, 'enemyMissile');
    b.homingDelay = 0.4;
  },
  movement(e, dt, ctx) {
    // Weave side-to-side while descending; independent of the shared path-or-down movers.
    e.pathT += dt;
    e.x += Math.sin(e.pathT * 2.4) * 60 * dt;
    e.y += e.spd * ctx.diffMult * dt;
  },
};

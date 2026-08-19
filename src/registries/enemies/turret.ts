import { type Enemy, type EnemyType } from '../../entities/Enemy.js';
import { spawnEnemyBullet } from '../../entities/Bullet.js';

export const turret: EnemyType = {
  key: 'turret',
  hp: 12, r: 12, spd: 0, score: 150, dropChance: 0.50, color: '#cc4466',
  fireInterval: 1.6,
  render(rc, e) {
    rc.fillStyle = '#884422';
    rc.beginPath(); rc.arc(0, 0, 10, 0, Math.PI * 2); rc.fill();
    rc.fillStyle = '#cc6644';
    rc.save(); rc.rotate(e.angle);
    rc.fillRect(-3, -14, 6, 14);
    rc.restore();
  },
  fire(e, ctx) {
    const dx = ctx.player!.x - e.x, dy = ctx.player!.y - e.y;
    const spd = 190 * ctx.diffMult;
    for (let j = 0; j < 3; j++) {
      const ang = Math.atan2(dy, dx);
      const bspd = spd * (0.85 + j * 0.1);
      spawnEnemyBullet(ctx, e.x, e.y, Math.cos(ang) * bspd, Math.sin(ang) * bspd, '#ff66ff', 4, j * 0.08);
    }
  },
  movement(e, _dt, ctx) {
    if (ctx.player && !ctx.player.dead) {
      const dx = ctx.player.x - e.x, dy = ctx.player.y - e.y;
      e.angle = Math.atan2(dx, -dy);
    }
  },
  inRange(e, ctx) {
    if (!ctx.player || ctx.player.dead) return false;
    const dx = ctx.player.x - e.x, dy = ctx.player.y - e.y;
    return dx * dx + dy * dy < 260 * 260;
  },
};

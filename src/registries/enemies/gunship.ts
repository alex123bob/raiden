import { type Enemy, type EnemyType } from '../../entities/Enemy.js';
import { spawnEnemyBullet } from '../../entities/Bullet.js';
import { movePathOrDown } from './shared.js';

/**
 * Gunship — a mid-tier enemy: tougher and slower than a fighter. Diamond-ish
 * olive hull with a yellow gun port. Fires a 3-way aimed spread. Opts into
 * extraStreams like fighter.
 */
export const gunship: EnemyType = {
  key: 'gunship',
  hp: 8, r: 14, spd: 65, score: 200, dropChance: 0.25, color: '#aacc44',
  extraStreams: true,
  render(rc, e) {
    rc.fillStyle = e.color;
    rc.beginPath();
    rc.moveTo(0, -14); rc.lineTo(14, 4);
    rc.lineTo(8, 14);  rc.lineTo(-8, 14); rc.lineTo(-14, 4);
    rc.closePath(); rc.fill();
    rc.fillStyle = '#ffff44';
    rc.beginPath(); rc.arc(0, 2, 5, 0, Math.PI * 2); rc.fill();
  },
  fire(e, ctx) {
    // Three bullets fanned +-0.28 rad around the aimed direction.
    const dx = ctx.player!.x - e.x, dy = ctx.player!.y - e.y;
    const spd = 190 * ctx.diffMult;
    [-0.28, 0, 0.28].forEach(a => {
      const ang = Math.atan2(dy, dx) + a;
      spawnEnemyBullet(ctx, e.x, e.y, Math.cos(ang) * spd, Math.sin(ang) * spd, '#ff8800', 4);
    });
  },
  movement: movePathOrDown,
};

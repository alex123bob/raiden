import { type Enemy, type EnemyType } from '../../entities/Enemy.js';
import { spawnEnemyBullet } from '../../entities/Bullet.js';
import { movePathOrDown } from './shared.js';

/**
 * Interceptor — a fast knife-wing attacker for late stages. It uses authored
 * arc/zigzag paths to cross lanes, then fires a tight, delayed crossing pair
 * around the aimed vector so the player has to dodge a slash-shaped threat.
 */
export const interceptor: EnemyType = {
  key: 'interceptor',
  hp: 7, r: 11, spd: 125, score: 275, dropChance: 0.25, color: '#ff4fa3',
  fireInterval: 2.0,
  extraStreams: true,
  render(rc, e) {
    rc.fillStyle = e.color;
    rc.beginPath();
    rc.moveTo(0, -14); rc.lineTo(13, 9); rc.lineTo(4, 5);
    rc.lineTo(0, 13);  rc.lineTo(-4, 5); rc.lineTo(-13, 9);
    rc.closePath(); rc.fill();
    rc.fillStyle = '#ffe0f0';
    rc.beginPath(); rc.arc(0, -4, 3, 0, Math.PI * 2); rc.fill();
  },
  fire(e, ctx) {
    const dx = ctx.player!.x - e.x, dy = ctx.player!.y - e.y;
    const aim = Math.atan2(dy, dx);
    const spd = 215 * ctx.diffMult;
    [-0.32, 0.32].forEach((off, idx) => {
      const ang = aim + off;
      spawnEnemyBullet(ctx, e.x, e.y, Math.cos(ang) * spd, Math.sin(ang) * spd, '#ff4fa3', 4, idx * 0.09);
    });
  },
  movement: movePathOrDown,
};

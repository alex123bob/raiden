import { type EnemyType } from '../../entities/Enemy.js';
import { spawnEnemyBullet } from '../../entities/Bullet.js';
import { movePathOrDown } from './shared.js';

/**
 * Mine layer — a slow support ship that drops delayed, drifting mines. The
 * pattern creates area denial instead of adding more direct aimed fire.
 */
export const minelayer: EnemyType = {
  key: 'minelayer',
  hp: 14, r: 15, spd: 46, score: 325, dropChance: 0.35, color: '#55d8ff',
  fireInterval: 2.8,
  render(rc, e) {
    rc.fillStyle = e.color;
    rc.beginPath();
    rc.moveTo(-16, -8); rc.lineTo(16, -8); rc.lineTo(20, 4);
    rc.lineTo(7, 15);   rc.lineTo(-7, 15); rc.lineTo(-20, 4);
    rc.closePath(); rc.fill();
    rc.fillStyle = '#103040';
    rc.beginPath(); rc.arc(-7, 3, 4, 0, Math.PI * 2); rc.fill();
    rc.beginPath(); rc.arc(7, 3, 4, 0, Math.PI * 2); rc.fill();
  },
  fire(e, ctx) {
    const spd = 42 * ctx.diffMult;
    [-18, 0, 18].forEach((off, idx) => {
      const b = spawnEnemyBullet(ctx, e.x + off, e.y + 12, off * 0.35, spd, '#55d8ff', 7, 0.18 + idx * 0.10, 'enemyMine');
      b.angle = Math.PI / 2;
    });
  },
  movement: movePathOrDown,
};

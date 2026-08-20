import { type Enemy, type EnemyType } from '../../entities/Enemy.js';
import { spawnEnemyBullet } from '../../entities/Bullet.js';
import { movePathOrDown } from './shared.js';

/**
 * Bomber — the tankiest, slowest regular enemy. Orange pentagon hull with
 * twin engine pods. Fires a wide 5-bullet downward fan (unaimed, always
 * pointed toward the bottom of the screen) rather than tracking the player.
 * No extraStreams — its own pattern is already wide.
 */
export const bomber: EnemyType = {
  key: 'bomber',
  hp: 20, r: 18, spd: 48, score: 400, dropChance: 0.50, color: '#cc6622',
  render(rc, e) {
    rc.fillStyle = e.color;
    rc.beginPath();
    rc.moveTo(0, -18); rc.lineTo(18, 0);
    rc.lineTo(16, 16); rc.lineTo(-16, 16); rc.lineTo(-18, 0);
    rc.closePath(); rc.fill();
    rc.fillStyle = '#ff8800';
    rc.beginPath(); rc.arc(-9, 0, 5, 0, Math.PI * 2); rc.fill();
    rc.beginPath(); rc.arc(9, 0, 5, 0, Math.PI * 2); rc.fill();
  },
  fire(e, ctx) {
    // Fixed downward fan, 5 bullets spanning +-0.48 rad around straight-down, at 75% speed.
    const spd = 190 * ctx.diffMult;
    for (let i = -2; i <= 2; i++) {
      const ang = Math.PI / 2 + i * 0.24;
      spawnEnemyBullet(ctx, e.x, e.y, Math.cos(ang) * spd * 0.75, Math.sin(ang) * spd * 0.75, '#ffcc00', 4);
    }
  },
  movement: movePathOrDown,
};

import { type Enemy, type EnemyType } from '../../entities/Enemy.js';
import { spawnEnemyBullet } from '../../entities/Bullet.js';
import { movePathOrDown } from './shared.js';

/**
 * Fighter — the cheapest, fastest regular enemy. Small blue arrowhead with a
 * red cockpit dot. Fires a single aimed shot at the player. Opts into
 * extraStreams, so late-game milestones add extra fanned shots to its fire.
 */
export const fighter: EnemyType = {
  key: 'fighter',
  hp: 3, r: 10, spd: 110, score: 100, dropChance: 0.15, color: '#66aaff',
  extraStreams: true,
  render(rc, e) {
    rc.fillStyle = e.color;
    rc.beginPath();
    rc.moveTo(0, -12); rc.lineTo(10, 8);
    rc.lineTo(0, 4);   rc.lineTo(-10, 8);
    rc.closePath(); rc.fill();
    rc.fillStyle = '#ff4444';
    rc.beginPath(); rc.arc(0, -1, 3, 0, Math.PI * 2); rc.fill();
  },
  fire(e, ctx) {
    // Single bullet aimed straight at the player's current position.
    const dx = ctx.player!.x - e.x, dy = ctx.player!.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    const spd = 190 * ctx.diffMult;
    spawnEnemyBullet(ctx, e.x, e.y, (dx / d) * spd, (dy / d) * spd, '#ff4444', 4);
  },
  movement: movePathOrDown,
};

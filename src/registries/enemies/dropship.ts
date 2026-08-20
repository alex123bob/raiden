import { Enemy, type EnemyType } from '../../entities/Enemy.js';
import { fighter } from './fighter.js';
import { movePathOrDown } from './shared.js';

/**
 * Dropship — a slow violet flying wing that never fires bullets directly.
 * Instead, on each fire interval it releases two fighter drones from its
 * flank pods, which then move/fire independently. Punishes players who
 * ignore it while focused on louder threats.
 */
export const dropship: EnemyType = {
  key: 'dropship',
  hp: 16, r: 16, spd: 40, score: 350, dropChance: 0.4, color: '#9955cc',
  fireInterval: 3.4,
  render(rc, e) {
    rc.fillStyle = e.color;
    rc.beginPath();
    rc.moveTo(-20, -6); rc.lineTo(20, -6); rc.lineTo(16, 10); rc.lineTo(-16, 10);
    rc.closePath(); rc.fill();
    rc.fillStyle = '#cc99ff';
    rc.beginPath(); rc.arc(-14, 2, 4, 0, Math.PI * 2); rc.fill();
    rc.beginPath(); rc.arc(14, 2, 4, 0, Math.PI * 2); rc.fill();
  },
  fire(e, ctx) {
    // Release two fighter drones from the flank pods; they fly/fire on their own.
    ctx.enemies.push(new Enemy(fighter, e.x - 20, e.y + 10, null, ctx));
    ctx.enemies.push(new Enemy(fighter, e.x + 20, e.y + 10, null, ctx));
  },
  movement: movePathOrDown,
};

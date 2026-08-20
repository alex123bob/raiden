import { type EnemyType } from '../../entities/Enemy.js';
import { movePathOrDown } from './shared.js';

/**
 * Swarmer — the earliest, cheapest enemy: 1 HP, never fires, but the fastest
 * mover in the roster. Spawns in tight 'form' clusters. Pure contact threat
 * meant to teach dodging before fighter's aimed shots show up.
 */
export const swarmer: EnemyType = {
  key: 'swarmer',
  hp: 1, r: 7, spd: 140, score: 60, dropChance: 0.05, color: '#88ffaa',
  render(rc, e) {
    rc.fillStyle = e.color;
    rc.beginPath();
    rc.moveTo(0, 7); rc.lineTo(6, -6); rc.lineTo(-6, -6);
    rc.closePath(); rc.fill();
  },
  fire(_e, _ctx) {
    // Never fires — pure movement/collision threat.
  },
  movement: movePathOrDown,
};

import type { PowerupType } from '../../entities/Powerup.js';

/**
 * Extra life — a pulsing red heart, never dropped from enemy kills (unlike
 * weapon/bomb pickups). Only ever appears via a scripted `powerup: 'life'`
 * wave entry, placed sparsely across the campaign to give a struggling
 * player a real shot at reaching later stages. Grants one life, uncapped.
 */
export const extraLife: PowerupType = {
  key: 'life',
  render(rc, pw) {
    const pulse = 1 + Math.sin(pw.life * 6) * 0.15;
    rc.fillStyle = '#ff2255';
    rc.beginPath();
    const s = pw.r * 1.45 * pulse;
    rc.moveTo(0, s * 0.5);
    rc.bezierCurveTo(-s, -s * 0.4, -s * 0.5, -s, 0, -s * 0.2);
    rc.bezierCurveTo(s * 0.5, -s, s, -s * 0.4, 0, s * 0.5);
    rc.closePath(); rc.fill();
  },
  apply(_pw, ctx) {
    ctx.player!.lives++;
  },
};

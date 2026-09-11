import type { BulletKind } from '../../entities/Bullet.js';

/**
 * Drifting mine round used by mine layers. It keeps normal enemy-bullet
 * collision semantics but renders as a slow spinning hazard instead of a shot.
 */
export const enemyMine: BulletKind = {
  key: 'enemyMine',
  r: 7,
  onUpdate(b, dt) {
    b.angle += dt * 2.4;
  },
  render(rc, b) {
    const pulse = 0.75 + Math.sin(b.angle * 2) * 0.25;
    rc.save();
    rc.translate(b.x, b.y);
    rc.rotate(b.angle);
    rc.strokeStyle = b.clr;
    rc.lineWidth = 2;
    rc.beginPath(); rc.arc(0, 0, b.r + pulse * 2, 0, Math.PI * 2); rc.stroke();
    rc.fillStyle = b.clr;
    rc.beginPath(); rc.arc(0, 0, b.r * 0.65, 0, Math.PI * 2); rc.fill();
    rc.strokeStyle = 'rgba(255,255,255,0.75)';
    rc.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      rc.moveTo(Math.cos(a) * (b.r + 1), Math.sin(a) * (b.r + 1));
      rc.lineTo(Math.cos(a) * (b.r + 6), Math.sin(a) * (b.r + 6));
    }
    rc.stroke();
    rc.restore();
  },
};

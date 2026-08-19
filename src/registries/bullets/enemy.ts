import type { Bullet, BulletKind } from '../../entities/Bullet.js';

export const enemyBullet: BulletKind = {
  key: 'enemy',
  r: 4,
  render(rc, b) {
    rc.fillStyle = b.clr;
    rc.beginPath(); rc.arc(b.x, b.y, b.r, 0, Math.PI * 2); rc.fill();
    rc.fillStyle = 'rgba(255,255,255,0.5)';
    rc.beginPath(); rc.arc(b.x, b.y, b.r * 0.45, 0, Math.PI * 2); rc.fill();
  },
};

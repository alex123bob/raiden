import type { Bullet, BulletKind } from '../../entities/Bullet.js';

/**
 * Generic round used by every enemy/boss bullet pattern. No per-kind logic —
 * just a filled circle in the bullet's own `clr` with a lighter core, at
 * whatever radius the spawning call set on the instance (b.r).
 */
export const enemyBullet: BulletKind = {
  key: 'enemy',
  r: 4,          // default collision radius, px (spawnEnemyBullet often overrides via b.r)
  render(rc, b) {
    rc.fillStyle = b.clr;
    rc.beginPath(); rc.arc(b.x, b.y, b.r, 0, Math.PI * 2); rc.fill();
    // Lighter inner core (45% of radius) for a bit of depth.
    rc.fillStyle = 'rgba(255,255,255,0.5)';
    rc.beginPath(); rc.arc(b.x, b.y, b.r * 0.45, 0, Math.PI * 2); rc.fill();
  },
};

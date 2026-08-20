import type { BulletKind } from '../../entities/Bullet.js';

/**
 * Homing variant of the generic enemy round, used by the seeker enemy type.
 * Flies straight during `homingDelay` (reused as a "delay before steering"
 * counter, mirroring the player missile's onUpdate), then eases its velocity
 * toward the player, closing at a fixed 150 px/s regardless of spawn speed.
 */
export const enemyMissile: BulletKind = {
  key: 'enemyMissile',
  r: 4,
  onUpdate(b, dt, ctx) {
    b.homingDelay -= dt;
    if (b.homingDelay > 0) return;   // still flying straight; no steering yet
    if (!ctx.player || ctx.player.dead) return;
    const dx = ctx.player.x - b.x, dy = ctx.player.y - b.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    // Ease velocity toward the player rather than snapping (dt*4 sets turn rate).
    b.vx += (dx / d * 150 - b.vx) * dt * 4;
    b.vy += (dy / d * 150 - b.vy) * dt * 4;
  },
  render(rc, b) {
    rc.fillStyle = b.clr;
    rc.beginPath(); rc.arc(b.x, b.y, b.r, 0, Math.PI * 2); rc.fill();
    rc.strokeStyle = 'rgba(51,238,204,0.5)';
    rc.lineWidth = 2;
    rc.beginPath();
    rc.moveTo(b.x, b.y);
    rc.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    rc.stroke();
  },
};

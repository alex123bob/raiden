import type { GameContext } from '../../core/GameContext.js';
import type { Bullet, BulletKind } from '../../entities/Bullet.js';

export const missile: BulletKind = {
  key: 'missile',
  r: 5,
  onUpdate(b, dt, ctx) {
    b.homingDelay -= dt;
    if (b.homingDelay > 0) return;
    let nearX: number | null = null, nearY: number | null = null, nearD = Infinity;
    ctx.enemies.forEach(e => {
      const d2 = (e.x - b.x) ** 2 + (e.y - b.y) ** 2;
      if (d2 < nearD) { nearD = d2; nearX = e.x; nearY = e.y; }
    });
    if (ctx.boss) {
      const d2 = (ctx.boss.x - b.x) ** 2 + (ctx.boss.y - b.y) ** 2;
      if (d2 < nearD) { nearX = ctx.boss.x; nearY = ctx.boss.y; }
    }
    if (nearX !== null) {
      const dx = nearX - b.x, dy = nearY - b.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      b.vx += (dx / d * 340 - b.vx) * dt * 5;
      b.vy += (dy / d * 340 - b.vy) * dt * 5;
    }
  },
  render(rc, b) {
    rc.fillStyle = '#ff8800';
    rc.beginPath(); rc.arc(b.x, b.y, 3, 0, Math.PI * 2); rc.fill();
    rc.strokeStyle = 'rgba(255,160,0,0.4)';
    rc.lineWidth = 2;
    rc.beginPath();
    rc.moveTo(b.x, b.y);
    rc.lineTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
    rc.stroke();
  },
};

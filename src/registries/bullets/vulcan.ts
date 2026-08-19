import type { Bullet, BulletKind } from '../../entities/Bullet.js';

export const vulcan: BulletKind = {
  key: 'vulcan',
  r: 4,
  sfxKey: 'shoot',
  onUpdate(b) {
    b.trail.unshift({ x: b.x, y: b.y });
    if (b.trail.length > 5) b.trail.length = 5;
  },
  render(rc, b) {
    if (b.trail.length > 0 && b.lv >= 3) {
      const trailLen = b.lv >= 4 ? 5 : 3;
      const pts = b.trail.slice(0, trailLen);
      for (let t = 0; t < pts.length; t++) {
        const alpha = (1 - (t + 1) / (trailLen + 1)) * 0.55;
        rc.strokeStyle = `rgba(200,240,255,${alpha})`;
        rc.lineWidth = Math.max(0.5, 2.5 - t * 0.4);
        rc.beginPath();
        if (t === 0) { rc.moveTo(b.x, b.y); rc.lineTo(pts[t].x, pts[t].y); }
        else { rc.moveTo(pts[t - 1].x, pts[t - 1].y); rc.lineTo(pts[t].x, pts[t].y); }
        rc.stroke();
      }
    }
    rc.save();
    rc.translate(b.x, b.y);
    rc.rotate(b.angle !== undefined ? b.angle + Math.PI / 2 : 0);
    rc.fillStyle = 'rgba(100,220,255,0.5)';
    rc.beginPath(); rc.ellipse(0, 0, 3, 8, 0, 0, Math.PI * 2); rc.fill();
    rc.fillStyle = '#ffffff';
    rc.beginPath(); rc.ellipse(0, 0, 1.5, 5, 0, 0, Math.PI * 2); rc.fill();
    rc.restore();
  },
};

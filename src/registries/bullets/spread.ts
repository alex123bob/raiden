import type { Bullet, BulletKind } from '../../entities/Bullet.js';

export const spread: BulletKind = {
  key: 'spread',
  r: 5,
  render(rc, b) {
    rc.save();
    rc.translate(b.x, b.y);
    rc.rotate(b.angle + Math.PI / 2);
    const lv = b.lv;
    if (lv <= 2) {
      const w = 4 + lv * 1, h = 8 + lv * 2;
      rc.fillStyle = '#ff8800';
      rc.beginPath(); rc.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); rc.fill();
      rc.fillStyle = '#ffcc44';
      rc.beginPath(); rc.ellipse(0, -h * 0.45, w * 0.5, h * 0.3, 0, 0, Math.PI * 2); rc.fill();
    } else if (lv === 3) {
      const w = 6, h = 11;
      rc.fillStyle = '#ff7700';
      rc.beginPath(); rc.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); rc.fill();
      rc.fillStyle = '#ffee00';
      rc.beginPath(); rc.ellipse(0, -h * 0.25, w * 0.55, h * 0.45, 0, 0, Math.PI * 2); rc.fill();
      rc.fillStyle = '#ffffff';
      rc.beginPath(); rc.arc(0, -h * 0.6, 2, 0, Math.PI * 2); rc.fill();
    } else if (lv === 4) {
      const w = 7, h = 12;
      rc.strokeStyle = 'rgba(255,140,0,0.4)';
      rc.lineWidth = 3;
      rc.beginPath(); rc.moveTo(0, h * 0.3); rc.lineTo(0, h * 1.1); rc.stroke();
      rc.lineWidth = 1.5;
      rc.beginPath(); rc.moveTo(-w * 0.5, h * 0.6); rc.lineTo(-w * 0.3, h * 1.2); rc.stroke();
      rc.beginPath(); rc.moveTo(w * 0.5, h * 0.6); rc.lineTo(w * 0.3, h * 1.2); rc.stroke();
      rc.fillStyle = '#ff7700';
      rc.beginPath(); rc.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); rc.fill();
      rc.fillStyle = '#ffcc00';
      rc.beginPath(); rc.ellipse(0, -h * 0.25, w * 0.6, h * 0.45, 0, 0, Math.PI * 2); rc.fill();
      rc.fillStyle = '#ffffff';
      rc.beginPath(); rc.arc(0, -h * 0.6, 2, 0, Math.PI * 2); rc.fill();
    } else {
      const w = 9, h = 15;
      rc.strokeStyle = 'rgba(255,100,0,0.35)';
      rc.lineWidth = 4;
      rc.beginPath(); rc.ellipse(0, 0, w + 5, h + 5, 0, 0, Math.PI * 2); rc.stroke();
      const grad = rc.createRadialGradient(0, -h * 0.2, 1, 0, 0, h);
      grad.addColorStop(0, '#ffff88');
      grad.addColorStop(0.3, '#ff8800');
      grad.addColorStop(1, '#cc2200');
      rc.fillStyle = grad;
      rc.beginPath(); rc.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); rc.fill();
      rc.fillStyle = '#ffffff';
      rc.beginPath(); rc.arc(0, -h * 0.45, 3, 0, Math.PI * 2); rc.fill();
    }
    rc.restore();
  },
};

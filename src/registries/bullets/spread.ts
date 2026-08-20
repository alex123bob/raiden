import type { Bullet, BulletKind } from '../../entities/Bullet.js';

/**
 * Player spread weapon (weapon type 1). A slower fan of fiery rounds; travels
 * straight along `angle` (no onUpdate). Purely a visual kind — the fan geometry
 * lives in firePlayer/fireSuper. Its appearance escalates by power level `lv`:
 * a plain orange blob at low levels, gaining a hot core, exhaust streaks, and a
 * radial-gradient fireball with an aura at level 5. Sprite drawn pointing up,
 * rotated to face travel (`angle + PI/2`).
 */
export const spread: BulletKind = {
  key: 'spread', // registry id
  r: 5,          // base collision radius, px (firePlayer bumps it by lv)
  render(rc, b) {
    rc.save();
    rc.translate(b.x, b.y);
    rc.rotate(b.angle + Math.PI / 2); // orient up-drawn sprite along travel dir
    const lv = b.lv;
    if (lv <= 2) {
      // Levels 1-2: orange ellipse that grows with lv, plus a small hot cap.
      const w = 4 + lv * 1, h = 8 + lv * 2;
      rc.fillStyle = '#ff8800';
      rc.beginPath(); rc.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); rc.fill();
      rc.fillStyle = '#ffcc44';
      rc.beginPath(); rc.ellipse(0, -h * 0.45, w * 0.5, h * 0.3, 0, 0, Math.PI * 2); rc.fill();
    } else if (lv === 3) {
      // Level 3: larger body, hotter yellow core, and a white leading spark.
      const w = 6, h = 11;
      rc.fillStyle = '#ff7700';
      rc.beginPath(); rc.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); rc.fill();
      rc.fillStyle = '#ffee00';
      rc.beginPath(); rc.ellipse(0, -h * 0.25, w * 0.55, h * 0.45, 0, 0, Math.PI * 2); rc.fill();
      rc.fillStyle = '#ffffff';
      rc.beginPath(); rc.arc(0, -h * 0.6, 2, 0, Math.PI * 2); rc.fill(); // nose spark
    } else if (lv === 4) {
      // Level 4: adds trailing exhaust streaks behind the body (+y is behind).
      const w = 7, h = 12;
      rc.strokeStyle = 'rgba(255,140,0,0.4)';
      rc.lineWidth = 3;
      rc.beginPath(); rc.moveTo(0, h * 0.3); rc.lineTo(0, h * 1.1); rc.stroke(); // center trail
      rc.lineWidth = 1.5;
      rc.beginPath(); rc.moveTo(-w * 0.5, h * 0.6); rc.lineTo(-w * 0.3, h * 1.2); rc.stroke(); // left
      rc.beginPath(); rc.moveTo(w * 0.5, h * 0.6); rc.lineTo(w * 0.3, h * 1.2); rc.stroke();   // right
      rc.fillStyle = '#ff7700';
      rc.beginPath(); rc.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); rc.fill();
      rc.fillStyle = '#ffcc00';
      rc.beginPath(); rc.ellipse(0, -h * 0.25, w * 0.6, h * 0.45, 0, 0, Math.PI * 2); rc.fill();
      rc.fillStyle = '#ffffff';
      rc.beginPath(); rc.arc(0, -h * 0.6, 2, 0, Math.PI * 2); rc.fill(); // nose spark
    } else {
      // Level 5+: big radial-gradient fireball with a translucent outer aura.
      const w = 9, h = 15;
      rc.strokeStyle = 'rgba(255,100,0,0.35)';
      rc.lineWidth = 4;
      rc.beginPath(); rc.ellipse(0, 0, w + 5, h + 5, 0, 0, Math.PI * 2); rc.stroke(); // aura ring
      // Gradient from white-hot core (offset up) out to a dark red rim.
      const grad = rc.createRadialGradient(0, -h * 0.2, 1, 0, 0, h);
      grad.addColorStop(0, '#ffff88');
      grad.addColorStop(0.3, '#ff8800');
      grad.addColorStop(1, '#cc2200');
      rc.fillStyle = grad;
      rc.beginPath(); rc.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); rc.fill();
      rc.fillStyle = '#ffffff';
      rc.beginPath(); rc.arc(0, -h * 0.45, 3, 0, Math.PI * 2); rc.fill(); // nose spark
    }
    rc.restore();
  },
};

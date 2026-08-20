import type { Bullet, BulletKind } from '../../entities/Bullet.js';

/**
 * Player primary weapon (weapon type 0). A small fast round travelling in its
 * `angle` direction. onUpdate records recent positions so render can draw a
 * fading motion trail; the trail only appears at power level >= 3. Visual is a
 * translucent cyan capsule with a bright white core, rotated to face travel.
 */
export const vulcan: BulletKind = {
  key: 'vulcan',       // registry id
  r: 4,                // collision radius, px
  sfxKey: 'shoot',     // sound effect key played on fire
  onUpdate(b) {
    // Push current position to the front, cap the trail buffer at 5 samples.
    b.trail.unshift({ x: b.x, y: b.y });
    if (b.trail.length > 5) b.trail.length = 5;
  },
  render(rc, b) {
    // Trail only drawn once powered up (lv >= 3); lv >= 4 shows the full 5.
    if (b.trail.length > 0 && b.lv >= 3) {
      const trailLen = b.lv >= 4 ? 5 : 3;
      const pts = b.trail.slice(0, trailLen);
      for (let t = 0; t < pts.length; t++) {
        // Fade older samples toward transparent; 0.55 is the head opacity.
        const alpha = (1 - (t + 1) / (trailLen + 1)) * 0.55;
        rc.strokeStyle = `rgba(200,240,255,${alpha})`;
        // Taper the line width from 2.5px at the head, floor at 0.5px.
        rc.lineWidth = Math.max(0.5, 2.5 - t * 0.4);
        rc.beginPath();
        // First segment links the live bullet to the newest sample.
        if (t === 0) { rc.moveTo(b.x, b.y); rc.lineTo(pts[t].x, pts[t].y); }
        else { rc.moveTo(pts[t - 1].x, pts[t - 1].y); rc.lineTo(pts[t].x, pts[t].y); }
        rc.stroke();
      }
    }
    rc.save();
    rc.translate(b.x, b.y);
    // Sprite is drawn pointing up; +PI/2 aligns its long axis with `angle`.
    rc.rotate(b.angle !== undefined ? b.angle + Math.PI / 2 : 0);
    rc.fillStyle = 'rgba(100,220,255,0.5)';
    rc.beginPath(); rc.ellipse(0, 0, 3, 8, 0, 0, Math.PI * 2); rc.fill(); // outer glow capsule
    rc.fillStyle = '#ffffff';
    rc.beginPath(); rc.ellipse(0, 0, 1.5, 5, 0, 0, Math.PI * 2); rc.fill(); // bright core
    rc.restore();
  },
};

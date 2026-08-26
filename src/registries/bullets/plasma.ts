import type { BulletKind } from '../../entities/Bullet.js';

/**
 * Player plasma weapon (weapon type 3). Thin piercing energy bolts (b.pierce
 * is always true for this kind — see mkPlasmaBullet) fired in parallel
 * vertical lanes rather than a fan. Purely a visual kind — the lane layout
 * lives in firePlayer/fireSuper. Escalates by level `lv`: a plain violet
 * needle at low levels, gaining an electric zigzag core and a wider glow at
 * higher levels. Sprite drawn pointing up, rotated to face travel.
 */
export const plasma: BulletKind = {
  key: 'plasma', // registry id
  r: 4,          // base collision radius, px (mkPlasmaBullet scales by lv)
  onUpdate(b) {
    // Re-roll the crackle jitter each frame so the zigzag core flickers in place.
    b.trail = [{ x: (Math.random() - 0.5) * 1, y: 0 }];
  },
  render(rc, b) {
    rc.save();
    rc.translate(b.x, b.y);
    rc.rotate(b.angle + Math.PI / 2); // orient up-drawn sprite along travel dir
    const lv = b.lv;
    const len = 10 + lv * 1.5, w = 2 + lv * 0.3;

    // Outer violet glow, built from stacked translucent ellipses (cheap) rather
    // than shadowBlur — shadowBlur is costly per-draw and this kind can have
    // dozens of bullets alive at once at high level, so it must stay light.
    rc.fillStyle = `rgba(190,120,255,${(0.35 + lv * 0.05) * 0.4})`;
    rc.beginPath(); rc.ellipse(0, 0, w * 3.0, len * 1.3, 0, 0, Math.PI * 2); rc.fill();
    rc.fillStyle = `rgba(190,120,255,${0.35 + lv * 0.05})`;
    rc.beginPath(); rc.ellipse(0, 0, w * 2.2, len, 0, 0, Math.PI * 2); rc.fill();

    // Bright white-violet core.
    rc.fillStyle = '#f0e0ff';
    rc.beginPath(); rc.ellipse(0, 0, w, len * 0.85, 0, 0, Math.PI * 2); rc.fill();

    // Electric zigzag crackle down the core, jittering slightly each frame.
    const jitter = b.trail[0]?.x ?? 0;
    rc.strokeStyle = '#ffffff';
    rc.lineWidth = Math.max(0.6, w * 0.4);
    rc.beginPath();
    rc.moveTo(0, -len * 0.8);
    rc.lineTo(w * 0.6 + jitter, -len * 0.3);
    rc.lineTo(-w * 0.6 + jitter, len * 0.2);
    rc.lineTo(0, len * 0.7);
    rc.stroke();

    rc.restore();
  },
};

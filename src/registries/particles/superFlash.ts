import { Particle, type ParticleKind } from '../../entities/Particle.js';

// A quick expanding ring + core pop at the player, fired when the max-level
// super auto-unleashes. Purely cosmetic positive feedback; carries no damage.
/**
 * Super flash — a quick expanding double ring at the player's position,
 * fired when a maxed weapon's charge meter fills and auto-unleashes a super
 * burst (see Player.ts). Purely cosmetic positive feedback; carries no
 * damage. Colored by the maxed weapon's WEAPON_COLORS entry (via spawn opts).
 */
export const superFlash: ParticleKind = {
  key: 'superFlash',
  spawn(ctx, x, y, opts) {
    const color = typeof opts.color === 'string' ? opts.color : '#ffaa00';
    const p = new Particle(superFlash, x, y);
    p.life = 1.0;
    p.decay = 3.2;      // short-lived: fully decays in ~0.31s
    p.r = 10;            // starting ring radius, px
    p.color = color;
    ctx.particles.push(p);
  },
  update(p, dt) {
    p.r += 420 * dt;   // ring expands outward at a constant 420 px/s
  },
  render(rc, p) {
    const a = Math.max(0, p.life);   // fades to 0 as life drains
    rc.save();
    // Outer ring in the weapon's color.
    rc.globalAlpha = a * 0.9;
    rc.strokeStyle = p.color;
    rc.lineWidth = 3 * a + 1;   // thins out as it fades
    rc.beginPath();
    rc.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    rc.stroke();
    // Smaller white inner ring for extra brightness.
    rc.globalAlpha = a * 0.5;
    rc.strokeStyle = '#ffffff';
    rc.lineWidth = 1.5;
    rc.beginPath();
    rc.arc(p.x, p.y, p.r * 0.7, 0, Math.PI * 2);
    rc.stroke();
    rc.restore();
    rc.globalAlpha = 1;
  },
};

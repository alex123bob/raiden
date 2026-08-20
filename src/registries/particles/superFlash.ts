import { Particle, type ParticleKind } from '../../entities/Particle.js';

// A quick expanding ring + core pop at the player, fired when the max-level
// super auto-unleashes. Purely cosmetic positive feedback; carries no damage.
export const superFlash: ParticleKind = {
  key: 'superFlash',
  spawn(ctx, x, y, opts) {
    const color = typeof opts.color === 'string' ? opts.color : '#ffaa00';
    const p = new Particle(superFlash, x, y);
    p.life = 1.0;
    p.decay = 3.2;
    p.r = 10;
    p.color = color;
    ctx.particles.push(p);
  },
  update(p, dt) {
    p.r += 420 * dt;
  },
  render(rc, p) {
    const a = Math.max(0, p.life);
    rc.save();
    rc.globalAlpha = a * 0.9;
    rc.strokeStyle = p.color;
    rc.lineWidth = 3 * a + 1;
    rc.beginPath();
    rc.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    rc.stroke();
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

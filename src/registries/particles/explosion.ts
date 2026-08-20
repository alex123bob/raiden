import { Particle, type ParticleKind } from '../../entities/Particle.js';

/**
 * Explosion — a burst of `6 + size*4` outward-flying spark particles that
 * decelerate and fade. Used for enemy/boss/player deaths and hit-flashes;
 * `size` (from spawn opts) scales both particle count and their speed/radius.
 */
export const explosion: ParticleKind = {
  key: 'explosion',
  spawn(ctx, x, y, opts) {
    const size = typeof opts.size === 'number' ? opts.size : 1;
    const color = typeof opts.color === 'string' ? opts.color : '#ff8800';
    const count = 6 + size * 4;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;      // uniformly random outward direction
      const spd = 40 + Math.random() * 80 * size;      // faster sparks on bigger explosions
      const p = new Particle(explosion, x, y);
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.life = 1.0;
      p.decay = 0.7 + Math.random() * 0.8;   // randomized per-spark lifetime (~0.67s..1.43s)
      p.r = 2 + Math.random() * size * 3;
      p.color = color;
      ctx.particles.push(p);
    }
    ctx.audio.play('explosion', { size });
  },
  update(p, dt) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.94;   // per-frame drag: sparks decelerate rather than flying forever
    p.vy *= 0.94;
  },
  render(rc, p) {
    // Fade opacity AND shrink radius together as life drains, for a soft dissolve.
    rc.globalAlpha = Math.max(0, p.life);
    rc.fillStyle = p.color;
    rc.beginPath();
    rc.arc(p.x, p.y, Math.max(0.5, p.r * p.life), 0, Math.PI * 2);
    rc.fill();
    rc.globalAlpha = 1;
  },
};

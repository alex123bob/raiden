import { Particle, type ParticleKind } from '../../entities/Particle.js';

export const explosion: ParticleKind = {
  key: 'explosion',
  spawn(ctx, x, y, opts) {
    const size = typeof opts.size === 'number' ? opts.size : 1;
    const color = typeof opts.color === 'string' ? opts.color : '#ff8800';
    const count = 6 + size * 4;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 80 * size;
      const p = new Particle(explosion, x, y);
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.life = 1.0;
      p.decay = 0.7 + Math.random() * 0.8;
      p.r = 2 + Math.random() * size * 3;
      p.color = color;
      ctx.particles.push(p);
    }
    ctx.audio.play('explosion', { size });
  },
  update(p, dt) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.94;
    p.vy *= 0.94;
  },
  render(rc, p) {
    rc.globalAlpha = Math.max(0, p.life);
    rc.fillStyle = p.color;
    rc.beginPath();
    rc.arc(p.x, p.y, Math.max(0.5, p.r * p.life), 0, Math.PI * 2);
    rc.fill();
    rc.globalAlpha = 1;
  },
};

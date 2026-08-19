import { W, H } from '../../config.js';
import { Particle, type ParticleKind } from '../../entities/Particle.js';

export const bombFlash: ParticleKind = {
  key: 'bombFlash',
  spawn(ctx, x, y) {
    const p = new Particle(bombFlash, x, y);
    p.life = 1.0;
    p.decay = 2.5;
    ctx.particles.push(p);
  },
  update() {},
  render(rc, p) {
    rc.fillStyle = 'rgba(255,255,200,' + (p.life * 0.75) + ')';
    rc.fillRect(0, 0, W, H);
  },
};

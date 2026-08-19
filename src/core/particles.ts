import { W, H } from '../config.js';
import { ctx } from '../canvas.js';
import { sfxExplosion } from './audio.js';

export function spawnExplosion(x, y, size, color, g) {
  const count = 6 + size * 4;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd   = 40 + Math.random() * 80 * size;
    g.particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 1.0,
      decay: 0.7 + Math.random() * 0.8,
      r: 2 + Math.random() * size * 3,
      color: color || '#ff8800',
      bomb: false,
    });
  }
  sfxExplosion(size, g);
}

export function spawnBombFlash(g) {
  g.particles.push({ bomb: true, life: 1.0, decay: 2.5,
    x: 0, y: 0, vx: 0, vy: 0, r: 0, color: '' });
}

export function updateParticles(dt, g) {
  for (let i = g.particles.length - 1; i >= 0; i--) {
    const p = g.particles[i];
    p.life -= p.decay * dt;
    if (p.life <= 0) { g.particles.splice(i, 1); continue; }
    if (!p.bomb) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
  }
}

export function drawParticles(g) {
  g.particles.forEach(p => {
    if (p.bomb) {
      ctx.fillStyle = 'rgba(255,255,200,' + (p.life * 0.75) + ')';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, p.r * p.life), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

import type { BossType } from './index.js';

export const solar: BossType = {
  key: 'solar',
  tint: null,
  spawnMinions: false,
  patterns: [
    { name: 'laserSweep', spdBase: 155, spdPhase: 30, count: 5, halfSpan: 0.40, spdF: 0.85, clr: '#ffaa00' },
    { name: 'laserSweep', spdBase: 155, spdPhase: 30, count: 7, halfSpan: 0.40, spdF: 0.85, clr: '#ffaa00' },
    { name: 'laserSweep', spdBase: 155, spdPhase: 30, count: 9, halfSpan: 0.40, spdF: 0.85, clr: '#ffaa00' },
  ],
  render(c, b, angle) {
    const glow = c.createRadialGradient(0, 0, b.r * 0.5, 0, 0, b.r * 1.8);
    glow.addColorStop(0, 'rgba(255,200,0,0.3)');
    glow.addColorStop(1, 'rgba(255,80,0,0)');
    c.fillStyle = glow;
    c.beginPath(); c.arc(0, 0, b.r * 1.8, 0, Math.PI * 2); c.fill();
    c.save(); c.rotate(angle * 0.7);
    for (let i = 0; i < 8; i++) {
      c.save(); c.rotate(i * Math.PI / 4);
      c.fillStyle = '#ffaa00';
      c.beginPath();
      c.moveTo(-5, b.r * 0.8); c.lineTo(0, b.r * 1.5); c.lineTo(5, b.r * 0.8);
      c.closePath(); c.fill();
      c.restore();
    }
    c.restore();
    const solarGrad = c.createRadialGradient(-8, -8, 4, 0, 0, b.r);
    solarGrad.addColorStop(0, '#ffffff'); solarGrad.addColorStop(0.3, '#ffee44');
    solarGrad.addColorStop(0.8, '#ff8800'); solarGrad.addColorStop(1, '#cc2200');
    c.fillStyle = solarGrad;
    c.beginPath(); c.arc(0, 0, b.r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#cc4400'; c.beginPath(); c.arc(8, -6, 7, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#882200'; c.beginPath(); c.arc(8, -6, 4, 0, Math.PI * 2); c.fill();
  },
};

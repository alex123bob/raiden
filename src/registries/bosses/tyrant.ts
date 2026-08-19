import type { BossType } from './index.js';

export const tyrant: BossType = {
  key: 'tyrant',
  tint: null,
  spawnMinions: true,
  patterns: [
    { name: 'ring', spdBase: 175, spdPhase: 28, count: 8,  spdF: 0.65, clr: '#ff2200' },
    [{ name: 'ring',     spdBase: 175, spdPhase: 28, count: 10, spdF: 0.65, clr: '#ff2200' },
     { name: 'aimBurst', spdBase: 175, spdPhase: 28, offsets: [-0.10, 0, 0.10], clr: '#ff8800' }],
    [{ name: 'ring',     spdBase: 175, spdPhase: 28, count: 12, spdF: 0.65, clr: '#ff2200' },
     { name: 'aimBurst', spdBase: 175, spdPhase: 28, offsets: [-0.10, 0, 0.10], clr: '#ff8800' },
     { name: 'scatter',  spdBase: 175, spdPhase: 28, count: 4, spdF: 0.75, clr: '#ffaa00' }],
    [{ name: 'ring',     spdBase: 175, spdPhase: 28, count: 14, spdF: 0.65, clr: '#ff2200' },
     { name: 'aimBurst', spdBase: 175, spdPhase: 28, offsets: [-0.10, 0, 0.10], clr: '#ff8800' },
     { name: 'scatter',  spdBase: 175, spdPhase: 28, count: 4, spdF: 0.75, clr: '#ffaa00' }],
    [{ name: 'ring',     spdBase: 175, spdPhase: 28, count: 16, spdF: 0.65, clr: '#ff2200' },
     { name: 'aimBurst', spdBase: 175, spdPhase: 28, offsets: [-0.10, 0, 0.10], clr: '#ff8800' },
     { name: 'scatter',  spdBase: 175, spdPhase: 28, count: 4, spdF: 0.75, clr: '#ffaa00' }],
  ],
  render(c, b, angle, timer) {
    const pulse = 0.85 + Math.sin(timer * 2.2) * 0.15;
    const outerR = b.r * pulse;
    const outerGlow = c.createRadialGradient(0, 0, outerR * 0.5, 0, 0, outerR * 1.4);
    outerGlow.addColorStop(0, 'rgba(180,0,20,0.2)');
    outerGlow.addColorStop(1, 'rgba(80,0,10,0)');
    c.fillStyle = outerGlow;
    c.beginPath(); c.arc(0, 0, outerR * 1.4, 0, Math.PI * 2); c.fill();
    c.beginPath();
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
      const distort = 1 + Math.sin(a * 5 + timer) * 0.08;
      const rx = Math.cos(a) * outerR * distort;
      const ry = Math.sin(a) * outerR * distort;
      a === 0 ? c.moveTo(rx, ry) : c.lineTo(rx, ry);
    }
    c.closePath();
    c.fillStyle = '#550010'; c.fill();
    c.strokeStyle = '#bb0022'; c.lineWidth = 2; c.stroke();
    c.save(); c.rotate(-angle * 0.5);
    c.fillStyle = '#880022';
    c.beginPath(); c.arc(0, 0, b.r * 0.7, 0, Math.PI * 2); c.fill();
    for (let i = 0; i < 6; i++) {
      c.save(); c.rotate(i * Math.PI / 3);
      c.fillStyle = '#aa0033';
      c.beginPath();
      c.moveTo(-4, b.r * 0.5); c.lineTo(0, b.r * 0.72); c.lineTo(4, b.r * 0.5);
      c.closePath(); c.fill();
      c.restore();
    }
    c.restore();
    const coreR = b.r * 0.4 * pulse;
    const coreGrad = c.createRadialGradient(0, 0, 2, 0, 0, coreR);
    coreGrad.addColorStop(0, '#ffffff'); coreGrad.addColorStop(0.4, '#ff4444'); coreGrad.addColorStop(1, '#880000');
    c.fillStyle = coreGrad;
    c.beginPath(); c.arc(0, 0, coreR, 0, Math.PI * 2); c.fill();
  },
};

import type { BossType } from './index.js';

export const hexa: BossType = {
  key: 'hexa',
  tint: null,
  spawnMinions: false,
  patterns: [
    { name: 'ring', spdBase: 120, spdPhase: 20, count: 8,  clr: '#4466ff' },
    { name: 'ring', spdBase: 120, spdPhase: 20, count: 12, clr: '#4466ff' },
    { name: 'ring', spdBase: 120, spdPhase: 20, count: 16, clr: '#4466ff' },
  ],
  render(c, b, angle) {
    c.fillStyle = '#334455';
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 - Math.PI / 6;
      i === 0 ? c.moveTo(Math.cos(a) * b.r, Math.sin(a) * b.r)
              : c.lineTo(Math.cos(a) * b.r, Math.sin(a) * b.r);
    }
    c.closePath(); c.fill();
    c.strokeStyle = '#8899bb'; c.lineWidth = 2; c.stroke();
    c.save(); c.rotate(angle * 0.6);
    for (let i = 0; i < 6; i++) {
      c.save(); c.rotate(i * Math.PI / 3);
      c.fillStyle = '#5566aa';
      c.fillRect(-5, 0, 10, b.r * 0.9);
      c.fillStyle = '#aabbff';
      c.beginPath(); c.arc(0, b.r * 0.85, 8, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    c.restore();
    c.fillStyle = '#2244ff'; c.beginPath(); c.arc(0, 0, 14, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#88aaff'; c.beginPath(); c.arc(0, 0,  8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, 0,  3, 0, Math.PI * 2); c.fill();
  },
};

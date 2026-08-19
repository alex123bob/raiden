import type { BossType } from './index.js';

export const dreadnaught: BossType = {
  key: 'dreadnaught',
  tint: null,
  spawnMinions: false,
  patterns: [
    { name: 'sideAlternate', spdBase: 165, spdPhase: 30 },
    { name: 'sideAlternate', spdBase: 165, spdPhase: 30 },
    { name: 'sideAlternate', spdBase: 165, spdPhase: 30 },
  ],
  render(c, b) {
    c.fillStyle = '#443300';
    c.fillRect(-b.r, -b.r * 0.6, b.r * 2, b.r * 1.2);
    c.strokeStyle = '#aa6600'; c.lineWidth = 2;
    c.strokeRect(-b.r, -b.r * 0.6, b.r * 2, b.r * 1.2);
    c.fillStyle = '#664400';
    c.fillRect(-b.r - 22, -8, 22, 16);
    c.fillStyle = '#aa7700';
    c.fillRect(-b.r - 28, -5, 8, 10);
    c.fillStyle = '#664400';
    c.fillRect(b.r, -8, 22, 16);
    c.fillStyle = '#aa7700';
    c.fillRect(b.r + 20, -5, 8, 10);
    c.strokeStyle = '#ffaa00'; c.lineWidth = 1;
    for (let i = -1; i <= 1; i++) {
      c.beginPath(); c.moveTo(i * b.r * 0.55, -b.r * 0.6);
      c.lineTo(i * b.r * 0.55, -b.r * 0.6 - 12); c.stroke();
    }
    c.fillStyle = '#ffcc00'; c.beginPath(); c.arc(0, 0, 12, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff4400'; c.beginPath(); c.arc(0, 0,  7, 0, Math.PI * 2); c.fill();
  },
};

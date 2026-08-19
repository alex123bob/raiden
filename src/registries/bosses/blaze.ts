import type { BossType } from './index.js';

export const blaze: BossType = {
  key: 'blaze',
  tint: null,
  spawnMinions: false,
  patterns: [
    { name: 'aimSpread', spdBase: 175, spdPhase: 35, count: 7, gap: 0.14, clr: '#ff2200' },
    { name: 'aimBurst',  spdBase: 175, spdPhase: 35, offsets: [-0.08, 0.08], clr: '#ff8800' },
    { name: 'ring',      spdBase: 175, spdPhase: 35, count: 8, spdF: 0.7, clr: '#cc00ff' },
  ],
  render(c, b, angle) {
    const grad = c.createRadialGradient(0, 0, 8, 0, 0, b.r);
    grad.addColorStop(0, '#ff6622'); grad.addColorStop(0.5, '#882211'); grad.addColorStop(1, '#330800');
    c.fillStyle = grad;
    c.beginPath(); c.arc(0, 0, b.r, 0, Math.PI * 2); c.fill();
    c.save(); c.rotate(angle);
    for (let i = 0; i < 4; i++) {
      c.save(); c.rotate(i * Math.PI / 2);
      c.fillStyle = '#bb3300';
      c.fillRect(-4, 0, 8, b.r * 0.88);
      c.fillStyle = '#ff7700';
      c.beginPath(); c.arc(0, b.r * 0.82, 9, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    c.restore();
    c.fillStyle = '#ffff00'; c.beginPath(); c.arc(0, 0, 13, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff0000'; c.beginPath(); c.arc(0, 0, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#000';    c.beginPath(); c.arc(0, 0, 3, 0, Math.PI * 2); c.fill();
  },
};

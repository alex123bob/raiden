import type { BossType } from './index.js';

export const viper: BossType = {
  key: 'viper',
  tint: null,
  spawnMinions: false,
  patterns: [
    [{ name: 'jitter',   spdBase: 140, spdPhase: 25, clr: '#44ee44' },
     { name: 'aimBurst', spdBase: 140, spdPhase: 25, offsets: [-0.22, 0, 0.22], clr: '#88cc00' }],
    [{ name: 'jitter',   spdBase: 140, spdPhase: 25, clr: '#44ee44' },
     { name: 'aimBurst', spdBase: 140, spdPhase: 25, offsets: [-0.22, 0, 0.22], clr: '#88cc00' }],
    [{ name: 'jitter',   spdBase: 140, spdPhase: 25, clr: '#44ee44' },
     { name: 'aimBurst', spdBase: 140, spdPhase: 25, offsets: [-0.22, 0, 0.22], clr: '#88cc00' }],
  ],
  render(c, b, angle) {
    const grad = c.createRadialGradient(0, 0, 4, 0, 0, b.r);
    grad.addColorStop(0, '#44aa44'); grad.addColorStop(0.6, '#226622'); grad.addColorStop(1, '#112211');
    c.fillStyle = grad;
    c.beginPath(); c.arc(0, 0, b.r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#66ee44'; c.lineWidth = 2; c.stroke();
    c.save(); c.rotate(angle * 0.4);
    for (let i = 0; i < 4; i++) {
      c.save(); c.rotate(i * Math.PI / 2);
      c.fillStyle = '#88cc22';
      c.beginPath();
      c.moveTo(0, b.r); c.lineTo(6, b.r + 16);
      c.lineTo(0, b.r + 24); c.lineTo(-6, b.r + 16);
      c.closePath(); c.fill();
      c.restore();
    }
    c.restore();
    c.fillStyle = '#ccff00'; c.beginPath(); c.arc(0, 0, 12, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#446600'; c.beginPath(); c.arc(0, 0,  6, 0, Math.PI * 2); c.fill();
  },
};

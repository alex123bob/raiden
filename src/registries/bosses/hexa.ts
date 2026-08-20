import type { BossType } from './index.js';

/**
 * Hexa — a steel-blue hexagonal boss with six spinning cannon spokes around
 * a blue core. All three phases fire an expanding omnidirectional ring
 * (8 -> 12 -> 16 bullets); the spokes visually spin independent of the ring
 * angle (0.6x bossAngle) for a layered look.
 */
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
    // Hexagonal hull outline.
    c.fillStyle = '#334455';
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 - Math.PI / 6;
      i === 0 ? c.moveTo(Math.cos(a) * b.r, Math.sin(a) * b.r)
              : c.lineTo(Math.cos(a) * b.r, Math.sin(a) * b.r);
    }
    c.closePath(); c.fill();
    c.strokeStyle = '#8899bb'; c.lineWidth = 2; c.stroke();
    // Six cannon spokes, spinning at 0.6x the boss's spin angle (visually offset from the ring pattern).
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
    // Layered blue core with a white highlight.
    c.fillStyle = '#2244ff'; c.beginPath(); c.arc(0, 0, 14, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#88aaff'; c.beginPath(); c.arc(0, 0,  8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, 0,  3, 0, Math.PI * 2); c.fill();
  },
};

import type { BossType } from './index.js';

/**
 * Carrier — a boxy capital ship with side hangars, deck lines, and gun pods.
 * The only trait that matters mechanically beyond its fire pattern is that it
 * continually launches fighter minions (spawnMinions). Across four phases it
 * fires ever-wider aimed fans (5 -> 8 bullets) at the player. Cyan/steel-blue.
 */
export const carrier: BossType = {
  key: 'carrier',
  tint: null,
  spawnMinions: true,       // periodically launches fighter minions
  patterns: [
    // Phases widen the aimed fan: more bullets, roughly the same total spread.
    { name: 'aimSpread', spdBase: 160, spdPhase: 28, count: 5, gap: 0.175, clr: '#00ccff' },
    { name: 'aimSpread', spdBase: 160, spdPhase: 28, count: 6, gap: 0.14,  clr: '#00ccff' },
    { name: 'aimSpread', spdBase: 160, spdPhase: 28, count: 7, gap: 0.70 / 6, clr: '#00ccff' }, // ~0.117 rad
    { name: 'aimSpread', spdBase: 160, spdPhase: 28, count: 8, gap: 0.1,   clr: '#00ccff' },
  ],
  render(c, b) {
    // Main hull: wide rectangle spanning 2r x 1.4r.
    c.fillStyle = '#223344';
    c.fillRect(-b.r, -b.r * 0.7, b.r * 2, b.r * 1.4);
    // Three horizontal deck lines across the hull.
    c.strokeStyle = '#334466'; c.lineWidth = 2;
    for (let row = -1; row <= 1; row++) {
      c.beginPath();
      c.moveTo(-b.r + 4, row * b.r * 0.3);
      c.lineTo( b.r - 4, row * b.r * 0.3);
      c.stroke();
    }
    // Left side hangar block (20x30) with outline.
    c.fillStyle = '#112233';
    c.fillRect(-b.r - 20, -15, 20, 30);
    c.strokeStyle = '#4466aa'; c.lineWidth = 1;
    c.strokeRect(-b.r - 20, -15, 20, 30);
    // Right side hangar block, mirrored.
    c.fillStyle = '#112233';
    c.fillRect(b.r, -15, 20, 30);
    c.strokeRect(b.r, -15, 20, 30);
    // Two lower gun pods (left/right), each a dark ring with a lit center.
    for (const side of [-1, 1]) {
      c.fillStyle = '#334455';
      c.beginPath(); c.arc(side * b.r * 0.6, b.r * 0.5, 8, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#6688aa';
      c.beginPath(); c.arc(side * b.r * 0.6, b.r * 0.5, 5, 0, Math.PI * 2); c.fill();
    }
    // Bridge fin jutting above the hull, plus the glowing cyan command core.
    c.fillStyle = '#4455aa'; c.fillRect(-18, -b.r * 0.7 - 14, 36, 14);
    c.fillStyle = '#00ccff'; c.beginPath(); c.arc(0, 0, 10, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, 0,  5, 0, Math.PI * 2); c.fill();
  },
};

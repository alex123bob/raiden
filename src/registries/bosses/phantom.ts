import type { BossType } from './index.js';

/**
 * Phantom — a purple octagonal wraith that pulses in and out of visibility
 * (phantomAlpha, driven by onUpdate) and spins four trailing "arms" counter
 * to the boss's own spin. Each phase fires a tight aimed burst plus a
 * scatter volley that widens (2 -> 5 bullets) across phases.
 */
export const phantom: BossType = {
  key: 'phantom',
  tint: null,
  spawnMinions: false,
  patterns: [
    [{ name: 'aimBurst', spdBase: 200, spdPhase: 35, offsets: [-0.06, 0.06], clr: '#aa44ff' },
     { name: 'scatter',  spdBase: 200, spdPhase: 35, count: 2, spdF: 0.7, clr: '#cc88ff' }],
    [{ name: 'aimBurst', spdBase: 200, spdPhase: 35, offsets: [-0.06, 0.06], clr: '#aa44ff' },
     { name: 'scatter',  spdBase: 200, spdPhase: 35, count: 3, spdF: 0.7, clr: '#cc88ff' }],
    [{ name: 'aimBurst', spdBase: 200, spdPhase: 35, offsets: [-0.06, 0.06], clr: '#aa44ff' },
     { name: 'scatter',  spdBase: 200, spdPhase: 35, count: 4, spdF: 0.7, clr: '#cc88ff' }],
    [{ name: 'aimBurst', spdBase: 200, spdPhase: 35, offsets: [-0.06, 0.06], clr: '#aa44ff' },
     { name: 'scatter',  spdBase: 200, spdPhase: 35, count: 5, spdF: 0.7, clr: '#cc88ff' }],
  ],
  render(c, b, angle) {
    c.globalAlpha = b.phantomAlpha;   // whole boss fades in/out per onUpdate's pulse
    // Octagonal hull outline.
    c.fillStyle = '#220044';
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 - Math.PI / 8;
      i === 0 ? c.moveTo(Math.cos(a) * b.r, Math.sin(a) * b.r)
              : c.lineTo(Math.cos(a) * b.r, Math.sin(a) * b.r);
    }
    c.closePath(); c.fill();
    c.strokeStyle = '#9933ff'; c.lineWidth = 2; c.stroke();
    // Four trailing arms, spinning opposite (-1.2x) the boss's own spin angle.
    c.save(); c.rotate(-angle * 1.2);
    for (let i = 0; i < 4; i++) {
      c.save(); c.rotate(i * Math.PI / 2);
      c.strokeStyle = 'rgba(180,60,255,0.6)';
      c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(0, 10); c.lineTo(0, b.r * 0.75); c.stroke();
      c.fillStyle = '#aa44ff';
      c.beginPath(); c.arc(0, b.r * 0.7, 5, 0, Math.PI * 2); c.fill();
      c.restore();
    }
    c.restore();
    // Layered purple core.
    c.fillStyle = '#cc00ff'; c.beginPath(); c.arc(0, 0, 12, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#440088'; c.beginPath(); c.arc(0, 0,  7, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff88ff'; c.beginPath(); c.arc(0, 0,  3, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
  },
  onUpdate(boss, _dt, ctx) {
    // Alpha oscillates 0.30..1.00 on a 1.5 rad/s sine, giving the "phantom" flicker.
    boss.phantomAlpha = 0.65 + Math.sin(ctx.bossTimer * 1.5) * 0.35;
  },
};

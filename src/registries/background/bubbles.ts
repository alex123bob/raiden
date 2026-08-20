import { W, H } from '../../config.js';
import type { BgFeature } from '../../stages/background.js';

/** One rising bubble: position, radius, opacity, rise speed, and a sine-wobble (amplitude/freq/phase) for its horizontal drift. */
interface Bubble { x: number; y: number; r: number; alpha: number; spd: number;
  wobbleAmp: number; wobbleFreq: number; wobbleOff: number; color: string; t: number; }

/**
 * Bubbles — the one background feature that scrolls UPWARD (used for the
 * underwater stages), unlike every other feature which falls down. 40
 * bubbles rise at varying speed while wobbling side to side, each with a
 * small offset highlight for a glassy look.
 */
export const bubbles: BgFeature = {
  key: 'bubbles',
  build(): Bubble[] {
    const out: Bubble[] = [];
    for (let i = 0; i < 40; i++) {
      out.push({ x: Math.random()*W, y: Math.random()*H,
        r: 4+Math.random()*8, alpha: 0.08+Math.random()*0.12,
        spd: 18+Math.random()*22, wobbleAmp: 8+Math.random()*14,
        wobbleFreq: 0.6+Math.random()*0.8, wobbleOff: Math.random()*Math.PI*2,
        color: Math.random()<0.6 ? '#44ee44' : '#aaee00',
        t: Math.random()*100 });
    }
    return out;
  },
  update(state, dt) {
    const bubbles = state as Bubble[];
    bubbles.forEach(b => {
      b.t += dt; b.y -= b.spd * dt;   // rises (y decreases), unlike every other feature
      b.x += Math.sin(b.t * b.wobbleFreq + b.wobbleOff) * b.wobbleAmp * dt;
      if (b.y < -b.r*2) { b.y = H+b.r*2; b.x = Math.random()*W; }   // wrap to the bottom
    });
  },
  render(rc, state) {
    const bubbles = state as Bubble[];
    bubbles.forEach(b => {
      rc.save(); rc.globalAlpha = b.alpha; rc.fillStyle = b.color;
      rc.beginPath(); rc.arc(b.x, b.y, b.r, 0, Math.PI*2); rc.fill();
      // Small offset highlight, half as opaque as the fill, for a glassy sheen.
      rc.globalAlpha = b.alpha * 0.5; rc.fillStyle = '#ccffcc';
      rc.beginPath(); rc.arc(b.x-b.r*0.3, b.y-b.r*0.3, b.r*0.4, 0, Math.PI*2); rc.fill();
      rc.restore();
    });
    rc.globalAlpha = 1;
  },
};

import { W, H } from '../../config.js';
import type { BgFeature } from '../../stages/background.js';

/** One drifting rock: position, radius, fall speed, rotation angle/speed, and which of the 2 depth layers it belongs to. */
interface Rock { x: number; y: number; r: number; spd: number; rot: number; rotSpd: number; layer: number; }

/**
 * Rocks — asteroid-field parallax layer. Two depth layers: 14 larger/slower/
 * darker rocks (layer 0) and 8 smaller/faster/lighter rocks (layer 1), each
 * tumbling as it falls. Drawn as flattened, semi-transparent ellipses.
 */
export const rocks: BgFeature = {
  key: 'rocks',
  build(): Rock[] {
    const out: Rock[] = [];
    for (let i = 0; i < 14; i++) {
      // Layer 0: larger, slower, lighter-gray.
      out.push({ x: Math.random() * W, y: Math.random() * H, r: 8 + Math.random() * 12,
        spd: 60 + Math.random() * 40, rot: Math.random() * Math.PI * 2,
        rotSpd: (Math.random() - 0.5) * 0.8, layer: 0 });
    }
    for (let i = 0; i < 8; i++) {
      // Layer 1: smaller, faster, darker-gray.
      out.push({ x: Math.random() * W, y: Math.random() * H, r: 5 + Math.random() * 8,
        spd: 100 + Math.random() * 40, rot: Math.random() * Math.PI * 2,
        rotSpd: (Math.random() - 0.5) * 1.2, layer: 1 });
    }
    return out;
  },
  update(state, dt) {
    const rocks = state as Rock[];
    rocks.forEach(r => {
      r.y += r.spd * dt; r.rot += r.rotSpd * dt;
      if (r.y > H + r.r * 2) { r.y = -r.r * 2; r.x = Math.random() * W; }   // wrap to the top
    });
  },
  render(rc, state) {
    const rocks = state as Rock[];
    rocks.forEach(r => {
      rc.save(); rc.translate(r.x, r.y); rc.rotate(r.rot);
      rc.fillStyle = r.layer === 0 ? 'rgba(130,120,110,0.5)' : 'rgba(100,95,85,0.45)';
      rc.beginPath(); rc.ellipse(0, 0, r.r * 1.4, r.r, 0, 0, Math.PI * 2); rc.fill();   // flattened ellipse (1.4x wider than tall)
      rc.strokeStyle = 'rgba(180,170,155,0.2)'; rc.lineWidth = 1; rc.stroke();
      rc.restore();
    });
  },
};

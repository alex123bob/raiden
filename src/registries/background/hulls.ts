import { W, H } from '../../config.js';
import type { BgFeature } from '../../stages/background.js';

/** One derelict hull-plate silhouette: position/size, slow fall speed, and opacity. */
interface Hull { x: number; y: number; w: number; h: number; spd: number; alpha: number; }

/**
 * Hulls — slow, dark rectangular wreckage/hull-plate silhouettes with riveted
 * detail (used for derelict-ship/station themed stages). 10 plates, each
 * drawn as a dark rectangle with a row of rivet dots and a top highlight line.
 */
export const hulls: BgFeature = {
  key: 'hulls',
  build(): Hull[] {
    const out: Hull[] = [];
    for (let i = 0; i < 10; i++) {
      out.push({
        x: Math.random() * (W - 120),
        y: Math.random() * H,
        w: 60 + Math.random() * 60,
        h: 12 + Math.random() * 14,
        spd: 25 + Math.random() * 15,
        alpha: 0.18 + Math.random() * 0.12,
      });
    }
    return out;
  },
  update(state, dt) {
    const hulls = state as Hull[];
    hulls.forEach(h => {
      h.y += h.spd * dt;
      if (h.y > H+h.h) { h.y = -h.h; h.x = Math.random()*(W-h.w); }   // wrap to the top
    });
  },
  render(rc, state) {
    const hulls = state as Hull[];
    hulls.forEach(h => {
      rc.save(); rc.globalAlpha = h.alpha;
      rc.fillStyle = '#1a1a28'; rc.fillRect(h.x, h.y, h.w, h.h);
      // Evenly-spaced rivet dots along the plate (~1 per 14px of width).
      rc.fillStyle = 'rgba(100,100,140,0.6)';
      const rivets = Math.floor(h.w/14);
      for (let i = 0; i < rivets; i++) {
        rc.beginPath(); rc.arc(h.x+8+i*14, h.y+h.h/2, 1.5, 0, Math.PI*2); rc.fill();
      }
      // Thin highlight line near the top edge.
      rc.strokeStyle = 'rgba(80,80,120,0.4)'; rc.lineWidth = 1;
      rc.beginPath(); rc.moveTo(h.x, h.y+3); rc.lineTo(h.x+h.w, h.y+3); rc.stroke();
      rc.restore();
    });
    rc.globalAlpha = 1;
  },
};

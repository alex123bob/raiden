import { W, H } from '../../config.js';
import type { BgFeature } from '../../stages/background.js';

interface Wisp { x1: number; y1: number; x2: number; y2: number; cx1: number; cy1: number;
  cx2: number; cy2: number; alpha: number; color: string; width: number; }

export const wisps: BgFeature = {
  key: 'wisps',
  build(): Wisp[] {
    const out: Wisp[] = [];
    for (let i = 0; i < 8; i++) {
      const x1 = Math.random()*W, y1 = Math.random()*H;
      out.push({ x1, y1,
        x2: x1+(Math.random()-0.5)*160, y2: y1+(Math.random()-0.5)*100,
        cx1: x1+(Math.random()-0.5)*80, cy1: y1+(Math.random()-0.5)*80,
        cx2: x1+(Math.random()-0.5)*80, cy2: y1+(Math.random()-0.5)*80,
        alpha: 0.04+Math.random()*0.06,
        color: Math.random()<0.5 ? '#9944ff' : '#cc88ff',
        width: 1+Math.random()*2 });
    }
    return out;
  },
  update() {},
  render(rc, state) {
    const wisps = state as Wisp[];
    wisps.forEach(w => {
      rc.save(); rc.globalAlpha = w.alpha; rc.strokeStyle = w.color; rc.lineWidth = w.width;
      rc.beginPath(); rc.moveTo(w.x1, w.y1);
      rc.bezierCurveTo(w.cx1, w.cy1, w.cx2, w.cy2, w.x2, w.y2);
      rc.stroke(); rc.restore();
    });
    rc.globalAlpha = 1;
  },
};

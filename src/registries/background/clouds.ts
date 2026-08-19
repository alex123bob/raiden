import { W, H } from '../../config.js';
import type { BgFeature } from '../../stages/background.js';

interface Cloud { x: number; y: number; w: number; h: number; alpha: number; spd: number; hue: string; }

export const clouds: BgFeature = {
  key: 'clouds',
  build(): Cloud[] {
    const out: Cloud[] = [];
    for (let i = 0; i < 12; i++) {
      out.push({ x: Math.random()*W, y: Math.random()*H,
        w: 80+Math.random()*80, h: 40+Math.random()*40,
        alpha: 0.06+Math.random()*0.06, spd: 20+Math.random()*20,
        hue: Math.random()<0.5 ? '#cc2244' : '#aa1133' });
    }
    return out;
  },
  update(state, dt) {
    const clouds = state as Cloud[];
    clouds.forEach(c => {
      c.y += c.spd * dt;
      if (c.y > H + c.h) { c.y = -c.h; c.x = Math.random()*W; }
    });
  },
  render(rc, state) {
    const clouds = state as Cloud[];
    clouds.forEach(c => {
      rc.save(); rc.globalAlpha = c.alpha; rc.fillStyle = c.hue;
      rc.beginPath(); rc.ellipse(c.x, c.y, c.w/2, c.h/2, 0, 0, Math.PI*2); rc.fill();
      rc.restore();
    });
    rc.globalAlpha = 1;
  },
};

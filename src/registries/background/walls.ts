import { W, H } from '../../config.js';
import type { GameContext } from '../../core/GameContext.js';
import type { BgFeature } from '../../stages/background.js';

interface Wall { side: 'left' | 'right'; y: number; baseX: number; h: number;
  sineAmp: number; sineFreq: number; sineOff: number; color: string; }
interface Ember { x: number; y: number; r: number; spd: number; alpha: number; color: string; }
interface WallsState { walls: Wall[]; embers: Ember[]; }

export const walls: BgFeature = {
  key: 'walls',
  build(): WallsState {
    const walls: Wall[] = [];
    const embers: Ember[] = [];
    for (let i = 0; i < 8; i++) {
      walls.push({ side:'left', y: i*(H/8), baseX: 30+Math.random()*20,
        h: H/8+4, sineAmp: 14+Math.random()*10,
        sineFreq: 0.4+Math.random()*0.4, sineOff: Math.random()*Math.PI*2, color:'#550011' });
      walls.push({ side:'right', y: i*(H/8), baseX: W-30-Math.random()*20,
        h: H/8+4, sineAmp: 14+Math.random()*10,
        sineFreq: 0.4+Math.random()*0.4, sineOff: Math.random()*Math.PI*2, color:'#550011' });
    }
    for (let i = 0; i < 50; i++) {
      embers.push({ x: Math.random()*W, y: Math.random()*H,
        r: 1+Math.random()*2, spd: 30+Math.random()*50,
        alpha: 0.3+Math.random()*0.4,
        color: Math.random()<0.7 ? '#ff2200' : '#ff6600' });
    }
    return { walls, embers };
  },
  update(state, dt) {
    const s = state as WallsState;
    s.embers.forEach(p => {
      p.y -= p.spd * dt;
      if (p.y < -p.r*2) { p.y = H+p.r*2; p.x = Math.random()*W; }
    });
  },
  render(rc, state, ctx) {
    const s = state as WallsState;
    const t = (ctx as GameContext).stageTimer;
    s.walls.forEach(w => {
      const xOff = Math.sin(t * w.sineFreq + w.sineOff) * w.sineAmp;
      const drawX = w.side === 'left' ? w.baseX + xOff : w.baseX - xOff;
      rc.save(); rc.fillStyle = w.color;
      if (w.side === 'left') {
        rc.fillRect(0, w.y, drawX, w.h);
      } else {
        rc.fillRect(drawX, w.y, W - drawX, w.h);
      }
      rc.strokeStyle = '#aa0022'; rc.lineWidth = 2;
      rc.beginPath(); rc.moveTo(drawX, w.y); rc.lineTo(drawX, w.y + w.h); rc.stroke();
      rc.restore();
    });
    s.embers.forEach(p => {
      rc.save(); rc.globalAlpha = p.alpha; rc.fillStyle = p.color;
      rc.beginPath(); rc.arc(p.x, p.y, p.r, 0, Math.PI*2); rc.fill();
      rc.restore();
    });
    rc.globalAlpha = 1;
  },
};

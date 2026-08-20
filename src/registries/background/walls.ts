import { W, H } from '../../config.js';
import type { GameContext } from '../../core/GameContext.js';
import type { BgFeature } from '../../stages/background.js';

/** One canyon-wall segment: which side, its vertical band, base inset from the edge, height, and a sine-wobble (amplitude/freq/phase) driving its inward/outward sway. */
interface Wall { side: 'left' | 'right'; y: number; baseX: number; h: number;
  sineAmp: number; sineFreq: number; sineOff: number; color: string; }
/** One rising ember spark: position, radius, rise speed, opacity, and color. */
interface Ember { x: number; y: number; r: number; spd: number; alpha: number; color: string; }
/** Full walls-feature state: the wall segments (static rows) plus the rising ember particles. */
interface WallsState { walls: Wall[]; embers: Ember[]; }

/**
 * Walls — a narrowing dark-red canyon: 8 rows of wall segments on each side
 * (16 total, never move vertically — only sway in/out via a per-row sine),
 * plus 50 rising embers drifting up through the gap. Used for tight,
 * hazard-corridor stages. Segments' sway is driven by ctx.stageTimer, so it
 * needs the real GameContext (cast at render time) rather than just dt.
 */
export const walls: BgFeature = {
  key: 'walls',
  build(): WallsState {
    const walls: Wall[] = [];
    const embers: Ember[] = [];
    for (let i = 0; i < 8; i++) {
      // One row: a left-side segment and a mirrored right-side segment at the same y-band.
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
    // Only the embers animate here; wall sway is computed at render time from stageTimer.
    const s = state as WallsState;
    s.embers.forEach(p => {
      p.y -= p.spd * dt;   // embers rise
      if (p.y < -p.r*2) { p.y = H+p.r*2; p.x = Math.random()*W; }   // wrap to the bottom
    });
  },
  render(rc, state, ctx) {
    const s = state as WallsState;
    const t = (ctx as GameContext).stageTimer;
    s.walls.forEach(w => {
      // Sway in/out with a per-row sine; left walls push right, right walls push left (mirrored).
      const xOff = Math.sin(t * w.sineFreq + w.sineOff) * w.sineAmp;
      const drawX = w.side === 'left' ? w.baseX + xOff : w.baseX - xOff;
      rc.save(); rc.fillStyle = w.color;
      if (w.side === 'left') {
        rc.fillRect(0, w.y, drawX, w.h);
      } else {
        rc.fillRect(drawX, w.y, W - drawX, w.h);
      }
      // Bright inner edge line where the wall meets the open corridor.
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

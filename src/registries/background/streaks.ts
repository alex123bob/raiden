import { W, H } from '../../config.js';
import type { BgFeature } from '../../stages/background.js';

/** One motion-blur streak: position, size, fast fall speed, opacity, and fire-toned color. */
interface Streak { x: number; y: number; w: number; h: number; spd: number; alpha: number; color: string; }

/**
 * Streaks — fast-falling thin horizontal motion-blur bars (fire-toned), used
 * for high-speed hazard stages. Each streak fades from transparent to solid
 * along its leading 30% (via a linear gradient) for a sense of motion.
 */
export const streaks: BgFeature = {
  key: 'streaks',
  build(): Streak[] {
    const out: Streak[] = [];
    for (let i = 0; i < 30; i++) {
      out.push({ x: Math.random()*W, y: Math.random()*H,
        w: 40+Math.random()*80, h: 1+Math.floor(Math.random()*2),
        spd: 300+Math.random()*200, alpha: 0.18+Math.random()*0.25,
        color: Math.random()<0.7 ? '#ff8800' : '#ffcc44' });
    }
    return out;
  },
  update(state, dt) {
    const streaks = state as Streak[];
    streaks.forEach(s => {
      s.y += s.spd * dt;
      if (s.y > H+4) { s.y = -4; s.x = Math.random()*(W-s.w); }   // wrap to the top
    });
  },
  render(rc, state) {
    const streaks = state as Streak[];
    streaks.forEach(s => {
      rc.save(); rc.globalAlpha = s.alpha; rc.fillStyle = s.color;
      rc.fillRect(s.x, s.y, s.w, s.h);
      // Fade-in gradient over the leading 30% of the streak's width, for a motion-blur look.
      const grad = rc.createLinearGradient(s.x, s.y, s.x+s.w*0.3, s.y);
      grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, s.color);
      rc.fillStyle = grad; rc.fillRect(s.x, s.y, s.w*0.3, s.h);
      rc.restore();
    });
    rc.globalAlpha = 1;
  },
};

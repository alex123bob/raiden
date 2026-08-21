import type { PowerupType } from '../../entities/Powerup.js';

/** Bomb pickup — a pink disc labeled 'B'; grants one extra bomb, capped at 3. */
export const bomb: PowerupType = {
  key: 'bomb',
  render(rc, pw) {
    rc.fillStyle = '#ff88ff';
    rc.beginPath(); rc.arc(0, 0, pw.r, 0, Math.PI * 2); rc.fill();
    rc.fillStyle = '#fff';
    rc.font = 'bold 11px monospace'; rc.textAlign = 'center'; rc.textBaseline = 'middle';
    rc.fillText('B', 0, 1);
  },
  apply(_pw, ctx) {
    ctx.player!.bombs = Math.min(3, ctx.player!.bombs + 1);
  },
};

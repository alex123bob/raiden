import { WEAPON_NAMES, WEAPON_COLORS } from '../../entities/Bullet.js';
import type { PowerupType } from '../../entities/Powerup.js';

export const weaponOrb: PowerupType = {
  key: 'weapon',
  render(rc, pw) {
    rc.fillStyle = WEAPON_COLORS[pw.wType];
    rc.beginPath(); rc.arc(0, 0, pw.r, 0, Math.PI * 2); rc.fill();
    rc.fillStyle = '#fff';
    rc.font = 'bold 7px monospace'; rc.textAlign = 'center'; rc.textBaseline = 'middle';
    rc.fillText(WEAPON_NAMES[pw.wType][0], 0, 1);
  },
  apply(pw, ctx) {
    const slots = ctx.player!.weapons;
    const existing = slots.findIndex(s => s.type === pw.wType);
    if (existing !== -1) {
      slots[existing].lv = Math.min(5, slots[existing].lv + 1);
    } else {
      if (slots.length >= 2) slots.shift();
      slots.push({ type: pw.wType, lv: 1 });
    }
  },
};

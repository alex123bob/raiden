import { WEAPON_NAMES, WEAPON_COLORS } from '../../entities/Bullet.js';
import type { PowerupType } from '../../entities/Powerup.js';

/**
 * Weapon orb — a colored disc (tinted by weapon type, labeled with its first
 * letter) that levels up the matching equipped weapon, or equips a new one
 * if the player doesn't have it (evicting the oldest slot if both are full).
 */
export const weaponOrb: PowerupType = {
  key: 'weapon',
  render(rc, pw) {
    rc.fillStyle = WEAPON_COLORS[pw.wType];
    rc.beginPath(); rc.arc(0, 0, pw.r, 0, Math.PI * 2); rc.fill();
    rc.fillStyle = '#fff';
    rc.font = 'bold 10px monospace'; rc.textAlign = 'center'; rc.textBaseline = 'middle';
    rc.fillText(WEAPON_NAMES[pw.wType][0], 0, 1);   // single-letter label, e.g. 'V'/'S'/'M'
  },
  apply(pw, ctx) {
    const slots = ctx.player!.weapons;
    const existing = slots.findIndex(s => s.type === pw.wType);
    if (existing !== -1) {
      // Already equipped: level it up, capped at 5.
      slots[existing].lv = Math.min(5, slots[existing].lv + 1);
    } else {
      // New weapon type: equip at lv1, evicting the oldest slot if both are full (max 2 slots).
      if (slots.length >= 2) slots.shift();
      slots.push({ type: pw.wType, lv: 1 });
    }
  },
};

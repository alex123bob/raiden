import { W, H } from '../config.js';
import { ctx } from '../canvas.js';
import { WEAPON_NAMES, WEAPON_COLORS } from './Bullet.js';
import { circleHit } from '../core/collision.js';
import { sfxPowerup } from '../core/audio.js';

// === POWERUPS ===

export function tryDropPowerup(e, g) {
  if (Math.random() >= e.dropChance) return;
  // Bomb pickup chance ~15% of drops; remainder is weapon orb
  const isBomb = Math.random() < 0.15;
  const wType  = Math.floor(Math.random() * 3);
  g.powerups.push({ x: e.x, y: e.y, vy: 55, r: 10, type: wType, isBomb, life: 9.0 });
}

export function updatePowerups(dt, g) {
  for (let i = g.powerups.length - 1; i >= 0; i--) {
    const pw = g.powerups[i];
    pw.y   += pw.vy * dt;
    pw.life -= dt;
    if (pw.y > H + 20 || pw.life <= 0) { g.powerups.splice(i, 1); }
  }
}

export function checkPlayerVsPowerups(g) {
  if (!g.player || g.player.dead) return;
  for (let i = g.powerups.length - 1; i >= 0; i--) {
    const pw = g.powerups[i];
    if (!circleHit(pw.x, pw.y, pw.r, g.player.x, g.player.y, g.player.r + 10)) continue;
    sfxPowerup(g);
    if (pw.isBomb) {
      g.player.bombs = Math.min(3, g.player.bombs + 1);
    } else {
      const slots = g.player.weapons;
      const existing = slots.findIndex(s => s.type === pw.type);
      if (existing !== -1) {
        // [ARCADE] Same type already held: level up that slot (cap 5)
        slots[existing].lv = Math.min(5, slots[existing].lv + 1);
      } else {
        // [COMBO] New weapon type — add to FIFO queue
        if (slots.length >= 2) {
          slots.shift(); // evict oldest
        }
        slots.push({ type: pw.type, lv: 1 });
      }
    }
    g.powerups.splice(i, 1);
  }
}

export function drawPowerups(g) {
  g.powerups.forEach(pw => {
    ctx.save();
    ctx.translate(pw.x, pw.y);
    if (pw.isBomb) {
      ctx.fillStyle = '#ff88ff';
      ctx.beginPath(); ctx.arc(0, 0, pw.r, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('B', 0, 1);
    } else {
      ctx.fillStyle = WEAPON_COLORS[pw.type];
      ctx.beginPath(); ctx.arc(0, 0, pw.r, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 7px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(WEAPON_NAMES[pw.type][0], 0, 1);
    }
    ctx.restore();
  });
}

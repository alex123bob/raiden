import { W, H } from '../config.js';
import { ctx } from '../canvas.js';
import { WEAPON_NAMES, WEAPON_COLORS } from '../entities/Bullet.js';

// === HUD ===
export function drawHUD(g) {
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Score (top-left)
  ctx.fillStyle = '#fff';
  ctx.font = '13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('SCORE: ' + g.score, 8, 18);

  // Hi-score (top-right)
  ctx.textAlign = 'right';
  ctx.fillText('HI: ' + g.highScore, W - 8, 18);

  // Stage / loop (top-center)
  ctx.fillStyle = '#999';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  const loopStr = g.loopMult > 1 ? '  Loop ' + g.loopMult : '';
  ctx.fillText('STAGE ' + g.currentStage + loopStr, W/2, 18);

  // Lives icons (bottom-left row)
  ctx.fillStyle = '#88ccff';
  ctx.font = '13px monospace';
  ctx.textAlign = 'left';
  for (let i = 0; i < g.player.lives; i++) ctx.fillText('\u25c6', 8 + i * 14, H - 8);

  // Bomb icons (above lives row)
  ctx.fillStyle = '#ff88ff';
  for (let i = 0; i < g.player.bombs; i++) ctx.fillText('\u2605', 8 + i * 14, H - 24);

  // Weapon name + level (bottom-right)
  ctx.textAlign = 'right';
  ctx.font = '12px monospace';
  const wSlots = g.player.weapons;
  if (wSlots.length === 1) {
    ctx.fillStyle = WEAPON_COLORS[wSlots[0].type];
    ctx.fillText(WEAPON_NAMES[wSlots[0].type] + ' Lv' + wSlots[0].lv, W - 8, H - 8);
  } else {
    wSlots.forEach((slot, i) => {
      ctx.fillStyle = WEAPON_COLORS[slot.type];
      ctx.fillText(WEAPON_NAMES[slot.type] + ' Lv' + slot.lv, W - 8, H - 8 - i * 16);
    });
  }

  ctx.restore();
}

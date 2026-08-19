import { W, H } from '../config.js';
import { ctx } from '../canvas.js';
import { isTouch } from '../core/input.js';

// === SCREENS ===
export function drawTitle(g) {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, H);

  ctx.shadowColor = '#0099ff';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 72px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('RAIDEN', W/2, 200);
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';

  ctx.fillStyle = '#aaaaff';
  ctx.font = '14px monospace';
  ctx.fillText('ARCADE CLONE', W/2, 230);

  ctx.fillStyle = '#ffff44';
  ctx.font = '16px monospace';
  if (Math.floor(Date.now() / 500) % 2)
    ctx.fillText('PRESS ENTER TO START', W/2, 340);

  ctx.fillStyle = '#aaaaaa';
  ctx.font = '13px monospace';
  ctx.fillText('HI-SCORE: ' + g.highScore, W/2, 390);

  ctx.fillStyle = '#888';
  ctx.font = '11px monospace';
  if (isTouch) {
    ctx.fillText('TAP TO START', W/2, 460);
    ctx.fillText('L-stick move   FIRE   ★ bomb   ⚙ settings', W/2, 478);
  } else {
    ctx.fillText('ARROWS move   SPACE fire   B bomb', W/2, 460);
    ctx.fillText('P pause   S settings', W/2, 478);
  }
}

export function drawPause(g) {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', W/2, H/2 - 10);
  ctx.fillStyle = '#aaa';
  ctx.font = '14px monospace';
  ctx.fillText('P to resume', W/2, H/2 + 24);
}

export function drawSettings(g) {
  const bx = W/2 - 130, by = H/2 - 90, bw = 260, bh = 185;
  ctx.fillStyle = 'rgba(0,10,30,0.94)';
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = '#4488ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, bw, bh);

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SETTINGS', W/2, by + 30);

  ctx.font = '13px monospace';
  ctx.fillStyle = '#aaaaff';
  ctx.fillText('M  Sound: ' + (g.soundOn ? 'ON ' : 'OFF'), W/2, by + 68);
  ctx.fillText('[  Speed: ' + g.gameSpeed.toFixed(2) + 'x  ]', W/2, by + 92);

  ctx.fillStyle = '#666';
  ctx.font = '11px monospace';
  ctx.fillText('M = toggle sound   [ / ] = speed', W/2, by + 130);
  ctx.fillText('S to close', W/2, by + 150);
}

export function drawGameOver(g) {
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ff4444';
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', W/2, 260);
  ctx.fillStyle = '#fff';
  ctx.font = '18px monospace';
  ctx.fillText('SCORE: ' + g.score, W/2, 320);
  ctx.fillText('HI-SCORE: ' + g.highScore, W/2, 348);
  ctx.fillStyle = '#aaffaa';
  ctx.font = '13px monospace';
  ctx.fillText('ENTER → title    C → copy score', W/2, 405);
}

export function drawStageClear(g) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffff44';
  ctx.shadowColor = '#ffaa00';
  ctx.shadowBlur = 20;
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('STAGE CLEAR!', W/2, H/2 - 10);
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  ctx.fillText('STAGE ' + (g.currentStage + 1) + ' INCOMING...', W/2, H/2 + 30);
}

export function drawVictory(g) {
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, W, H);
  ctx.shadowColor = '#ffcc00';
  ctx.shadowBlur  = 40;
  ctx.fillStyle   = '#ffd700';
  ctx.font = 'bold 42px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('MISSION', W/2, H/2 - 70);
  ctx.fillText('COMPLETE', W/2, H/2 - 22);
  ctx.shadowBlur  = 0;
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px monospace';
  ctx.fillText('SCORE: ' + g.score, W/2, H/2 + 30);
  ctx.fillText('HI-SCORE: ' + g.highScore, W/2, H/2 + 58);
  ctx.fillStyle = '#ffff44';
  ctx.font = '14px monospace';
  if (Math.floor(Date.now() / 500) % 2)
    ctx.fillText('PRESS ENTER', W/2, H/2 + 100);
}

import { W, H } from '../config.js';
import { ctx } from '../canvas.js';
import { isTouch } from '../core/input.js';
import type { Game } from '../core/Game.js';
import { STAGES } from '../stages/stageData.js';

// === SCREENS ===
/** Title screen: glowing "RAIDEN" logo, blinking start prompt, hi-score, and input hints (keyboard vs touch). */
export function drawTitle(g: Game) {
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
  if (Math.floor(Date.now() / 500) % 2)   // blinks on/off every 0.5s
    ctx.fillText('PRESS ENTER TO START', W/2, 340);

  ctx.fillStyle = '#aaaaaa';
  ctx.font = '13px monospace';
  ctx.fillText('HI-SCORE: ' + g.highScore, W/2, 390);

  // Control hints differ by input method.
  ctx.fillStyle = '#888';
  ctx.font = '11px monospace';
  if (isTouch) {
    ctx.fillText('TAP TO START', W/2, 460);
    ctx.fillText('L-stick move   FIRE   ★ bomb   ⚙ settings', W/2, 478);
  } else {
    ctx.fillText('ARROWS move   SPACE fire   B bomb', W/2, 460);
    ctx.fillText('P pause   S settings   L select stage', W/2, 478);
  }
}

/** Stage-select screen: pick any authored stage (1..STAGE_COUNT) to jump straight into, for testing/replay. */
export function drawStageSelect(g: Game) {
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#aaaaff';
  ctx.font = '14px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SELECT STAGE', W/2, 140);

  const stage = STAGES[g.selectedStage - 1];

  ctx.shadowColor = '#0099ff';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px monospace';
  ctx.fillText('◄ ' + String(g.selectedStage).padStart(2, '0') + ' ►', W/2, 240);
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';

  // Distinct enemy types this stage spawns (in wave order, deduped) plus its boss.
  const seen = new Set<string>();
  const enemyTypes: string[] = [];
  for (const wave of stage.waves) {
    if ('type' in wave && wave.type && !seen.has(wave.type)) { seen.add(wave.type); enemyTypes.push(wave.type); }
  }
  ctx.fillStyle = '#aaffaa';
  ctx.font = '13px monospace';
  ctx.fillText('ENEMIES: ' + (enemyTypes.join(', ') || 'none'), W/2, 300);
  ctx.fillStyle = '#ffaa88';
  ctx.fillText('BOSS: ' + stage.boss.type, W/2, 322);

  ctx.fillStyle = '#666';
  ctx.font = '11px monospace';
  ctx.fillText('◄ ► CHANGE   ENTER START   ESC BACK', W/2, 460);
}

/** Pause overlay: dim scrim plus "PAUSED" and the resume hint. Drawn on top of the frozen world layer. */
export function drawPause(g: Game) {
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

/** Settings panel: a centered box showing sound toggle, speed, and volume settings, with key hints. */
export function drawSettings(g: Game) {
  // Panel geometry (touch input.ts's touchDiscrete hit-tests mirror these bands).
  const bx = W/2 - 130, by = H/2 - 90, bw = 260, bh = 210;
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
  ctx.fillText('V  Volume: ' + Math.round(g.volume * 100) + '%', W/2, by + 116);

  ctx.fillStyle = '#666';
  ctx.font = '11px monospace';
  ctx.fillText('M sound   [ / ] speed   V volume', W/2, by + 154);
  ctx.fillText('S to close', W/2, by + 174);
}

/** Game-over screen: dark scrim, "GAME OVER", final score/hi-score, and the continue/share hint. */
export function drawGameOver(g: Game) {
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

/** Stage-clear interlude: glowing "STAGE CLEAR!" banner plus the next-stage countdown message. */
export function drawStageClear(g: Game) {
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

/** Victory screen (beating the final stage on loop 1): glowing "MISSION COMPLETE", final score, and a blinking continue prompt. */
export function drawVictory(g: Game) {
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
  if (Math.floor(Date.now() / 500) % 2)   // blinks on/off every 0.5s
    ctx.fillText('PRESS ENTER', W/2, H/2 + 100);
}

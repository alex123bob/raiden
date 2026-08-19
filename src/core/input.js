import { W, H, STATE, SPEED_STEPS } from '../config.js';
import { canvas, ctx } from '../canvas.js';
import { getAudio } from './audio.js';

// === INPUT ===

export const isTouch = ('ontouchstart' in window) ||
                       (window.matchMedia && matchMedia('(pointer: coarse)').matches);

function handleKeyPress(g, code) {
  if (g.settingsOpen) {
    if (code === 'KeyM')        g.soundOn = !g.soundOn;
    if (code === 'BracketLeft') cycleSpeed(g, -1);
    if (code === 'BracketRight')cycleSpeed(g, 1);
    if (code === 'KeyS')        g.settingsOpen = false;
    return;
  }
  if (code === 'KeyP') {
    if (g.state === STATE.PLAYING) g.state = STATE.PAUSED;
    else if (g.state === STATE.PAUSED) g.state = STATE.PLAYING;
  }
  if (code === 'KeyS') {
    if (g.settingsOpen) {
      g.settingsOpen = false;
    } else if (g.state === STATE.TITLE || g.state === STATE.PAUSED) {
      g.settingsOpen = true;
    } else if (g.state === STATE.PLAYING) {
      // Auto-pause so the game doesn't run under the settings panel
      g.state = STATE.PAUSED;
      g.settingsOpen = true;
    }
  }
  if (code === 'Enter') {
    if (g.state === STATE.TITLE)    { g.loopMult = 1; g.startGame(); }
    if (g.state === STATE.GAMEOVER) g.state = STATE.TITLE;
    if (g.state === STATE.VICTORY)  { g.loopMult++; g.startGame(); }  // start loop 2+
  }
  if (code === 'KeyC' && g.state === STATE.GAMEOVER) {
    navigator.clipboard && navigator.clipboard.writeText(
      'RAIDEN — Score: ' + g.score + ' | Hi: ' + g.highScore);
  }
}

function cycleSpeed(g, dir) {
  let i = SPEED_STEPS.indexOf(g.gameSpeed);
  i = Math.max(0, Math.min(SPEED_STEPS.length - 1, i + dir));
  g.gameSpeed = SPEED_STEPS[i];
}

// === TOUCH CONTROLS (mobile) ===
// Touch is just another writer into the keys[] map + handleKeyPress(), so the
// game logic below is untouched. Controls render/handle only on touch devices.

// Control geometry, in game coordinates (480x640).
const TC = {
  fire:  { x: W - 66, y: H - 86, r: 48 },
  bomb:  { x: W - 66, y: H - 176, r: 34 },
  pause: { x: W - 26, y: 52, r: 16 },
  gear:  { x: W - 68, y: 52, r: 16 },
};
// Analog movement stick: floating base appears where the thumb lands (left
// side of the screen); the knob follows the thumb, and the ship moves in that
// direction at a speed proportional to how far the knob is pushed (0..1).
const STICK_R    = 56;                       // max knob travel from base
const STICK_DEAD = 0.14;                     // deadzone (fraction of travel)
const STICK_HOME = { x: 96, y: H - 108 };    // resting display position
const stick = { id: null, bx: 0, by: 0, kx: 0, ky: 0 };
const roles = {};                            // touch identifier -> 'fire' | 'bomb'
let firePressed = false;                     // glow flags for drawing
let bombPressed = false;

function toCanvas(t) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (t.clientX - rect.left) / rect.width  * W,
    y: (t.clientY - rect.top)  / rect.height * H,
  };
}
function within(p, c) {
  const dx = p.x - c.x, dy = p.y - c.y;
  return dx * dx + dy * dy <= c.r * c.r;
}

// Discrete (one-per-press) actions for a freshly-started touch.
// Returns true if the touch was consumed (should not drive movement/fire).
function touchDiscrete(p, g) {
  if (g.settingsOpen) {
    const bx = W/2 - 130, by = H/2 - 90, bw = 260, bh = 185;
    if (p.y > by + 55 && p.y < by + 80) { handleKeyPress(g, 'KeyM'); return true; }
    if (p.y > by + 80 && p.y < by + 105) { cycleSpeed(g, p.x < W/2 ? -1 : 1); return true; }
    if (p.x < bx || p.x > bx + bw || p.y < by || p.y > by + bh) g.settingsOpen = false;
    return true;  // swallow all taps while settings is open
  }
  if (within(p, TC.gear) &&
      (g.state === STATE.TITLE || g.state === STATE.PLAYING || g.state === STATE.PAUSED)) {
    handleKeyPress(g, 'KeyS');
    return true;
  }
  if (within(p, TC.pause) && (g.state === STATE.PLAYING || g.state === STATE.PAUSED)) {
    handleKeyPress(g, 'KeyP');
    return true;
  }
  if (g.state === STATE.TITLE || g.state === STATE.GAMEOVER || g.state === STATE.VICTORY) {
    handleKeyPress(g, 'Enter');
    return true;
  }
  return false;
}

// Recompute the analog movement vector from the stick's base + knob positions.
function recomputeMoveVec(g) {
  if (stick.id === null) { g.moveVec.x = 0; g.moveVec.y = 0; return; }
  let dx = stick.kx - stick.bx, dy = stick.ky - stick.by;
  const len = Math.hypot(dx, dy);
  if (len > STICK_R) { dx = dx / len * STICK_R; dy = dy / len * STICK_R; }
  const mag = len / STICK_R;                 // 0..1
  if (mag < STICK_DEAD) { g.moveVec.x = 0; g.moveVec.y = 0; return; }
  g.moveVec.x = dx / STICK_R;
  g.moveVec.y = dy / STICK_R;
}

// Recompute button glow flags from currently-held button touches.
function recomputeButtons(g) {
  firePressed = bombPressed = false;
  for (const id in roles) {
    if (roles[id] === 'fire') firePressed = true;
    if (roles[id] === 'bomb') bombPressed = true;
  }
  g.keys['Space'] = firePressed;               // FIRE held → Space (drives charge too)
  g.keys['KeyB']  = bombPressed;               // _bombUsed latch makes bomb one-shot
}

export function initInput(g) {
  document.addEventListener('keydown', e => {
    if (!g.keys[e.code]) {
      g.keys[e.code] = true;
      handleKeyPress(g, e.code);
    }
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('keyup', e => { g.keys[e.code] = false; e.preventDefault(); }, { passive: false });

  if (isTouch) {
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      getAudio();  // unlock WebAudio on first user gesture
      for (const t of e.changedTouches) {
        const p = toCanvas(t);
        if (touchDiscrete(p, g)) continue;        // consumed by a menu/button
        if (within(p, TC.fire)) { roles[t.identifier] = 'fire'; continue; }
        if (within(p, TC.bomb)) { roles[t.identifier] = 'bomb'; continue; }
        if (stick.id === null) {               // claim as the movement stick
          stick.id = t.identifier;
          stick.bx = p.x; stick.by = p.y;
          stick.kx = p.x; stick.ky = p.y;
        }
      }
      recomputeButtons(g);
      recomputeMoveVec(g);
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === stick.id) {
          const p = toCanvas(t);
          stick.kx = p.x; stick.ky = p.y;
        }
      }
      recomputeMoveVec(g);
    }, { passive: false });

    const endTouch = e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === stick.id) stick.id = null;
        delete roles[t.identifier];
      }
      recomputeButtons(g);
      recomputeMoveVec(g);
    };
    canvas.addEventListener('touchend', endTouch, { passive: false });
    canvas.addEventListener('touchcancel', endTouch, { passive: false });
  }
}

function drawTcBtn(c, stroke, label, fontPx) {
  ctx.strokeStyle = stroke;
  ctx.fillStyle = 'rgba(20,30,50,0.38)';
  ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#dde';
  ctx.font = (fontPx || 15) + 'px monospace';
  ctx.fillText(label, c.x, c.y);
}

export function drawTouchControls(g) {
  if (!isTouch) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2;

  const playing = (g.state === STATE.PLAYING || g.state === STATE.PAUSED);

  if (playing) {
    // Analog movement stick — floating base + knob (or resting home ring)
    const active = stick.id !== null;
    const baseX = active ? stick.bx : STICK_HOME.x;
    const baseY = active ? stick.by : STICK_HOME.y;
    let knobX = baseX, knobY = baseY;
    if (active) {
      let dx = stick.kx - stick.bx, dy = stick.ky - stick.by;
      const len = Math.hypot(dx, dy);
      if (len > STICK_R) { dx = dx / len * STICK_R; dy = dy / len * STICK_R; }
      knobX = baseX + dx; knobY = baseY + dy;
    }
    // base ring
    ctx.strokeStyle = active ? 'rgba(120,180,255,0.7)' : 'rgba(120,180,255,0.35)';
    ctx.fillStyle   = 'rgba(30,50,90,0.22)';
    ctx.beginPath(); ctx.arc(baseX, baseY, STICK_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // knob
    ctx.fillStyle   = active ? 'rgba(160,210,255,0.85)' : 'rgba(160,200,255,0.5)';
    ctx.strokeStyle = 'rgba(200,230,255,0.9)';
    ctx.beginPath(); ctx.arc(knobX, knobY, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Fire
    const f = TC.fire;
    ctx.strokeStyle = 'rgba(255,120,120,0.55)';
    ctx.fillStyle = firePressed ? 'rgba(255,80,80,0.42)' : 'rgba(90,30,30,0.28)';
    ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffcccc'; ctx.font = 'bold 15px monospace';
    ctx.fillText('FIRE', f.x, f.y);

    // Bomb
    const b = TC.bomb;
    ctx.strokeStyle = 'rgba(255,150,255,0.55)';
    ctx.fillStyle = bombPressed ? 'rgba(255,100,255,0.42)' : 'rgba(70,30,70,0.28)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffccff'; ctx.font = 'bold 18px monospace';
    ctx.fillText('★', b.x, b.y);

    // Pause
    drawTcBtn(TC.pause, 'rgba(200,200,200,0.5)',
              g.state === STATE.PAUSED ? '▶' : '‖');
  }

  if (g.state === STATE.TITLE || playing) {
    drawTcBtn(TC.gear, 'rgba(120,180,255,0.5)', '⚙');
  }

  if (g.state === STATE.TITLE || g.state === STATE.GAMEOVER || g.state === STATE.VICTORY) {
    ctx.fillStyle = 'rgba(255,255,120,0.85)';
    ctx.font = '13px monospace';
    ctx.fillText('( TAP SCREEN )', W/2, H - 40);
  }

  ctx.restore();
}

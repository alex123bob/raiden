import { W, H, STATE, SPEED_STEPS } from '../config.js';
import { canvas, ctx } from '../canvas.js';
import { getAudio } from './audio.js';
import type { Game } from './Game.js';

// === INPUT ===

/** True on touch/coarse-pointer devices; gates whether on-screen touch controls render/handle input. */
export const isTouch = typeof window !== 'undefined' && (('ontouchstart' in window) ||
                       (window.matchMedia && window.matchMedia('(pointer: coarse)').matches));

// Safari on iOS has never implemented navigator.vibrate(). WebKit's native
// <input type="checkbox" switch> control (Safari 17.4+) fires a real OS haptic tick,
// but ONLY on a genuine finger tap on the element itself — a JS-triggered .click(),
// sync or deferred, never fires it (confirmed by manual on-device testing). So instead
// of clicking a proxy element from game code, we lay an invisible real switch directly
// over the on-screen bomb button (see bombSwitchEl below): the player's tap IS the tap
// on the switch, and the resulting 'change' event drives the existing bomb-fire latch.
/** True on iOS/iPadOS (including iPadOS 13+, which masquerades as MacIntel with touch). */
const isIOS = typeof navigator !== 'undefined' &&
  (/iP(hone|od|ad)/.test(navigator.platform) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

/**
 * One-shot key-press actions (menus, pause, settings, speed cycling, start/
 * restart, clipboard share). Called only on the keydown transition (not while
 * held) — see the debounce in initInput's keydown listener. Also invoked
 * synthetically by touch controls tapping the equivalent on-screen button.
 */
function handleKeyPress(g: Game, code: string) {
  if (g.settingsOpen) {
    if (code === 'KeyM') {
      g.toggleSound();
    }
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
    const nc = navigator.clipboard;
    if (nc) nc.writeText('RAIDEN — Score: ' + g.score + ' | Hi: ' + g.highScore).catch(() => {});
  }
}

/** Move g.gameSpeed one step up/down through SPEED_STEPS (clamped to the array bounds). */
function cycleSpeed(g: Game, dir: number) {
  let i = SPEED_STEPS.indexOf(g.gameSpeed);
  i = Math.max(0, Math.min(SPEED_STEPS.length - 1, i + dir));
  g.gameSpeed = SPEED_STEPS[i];
}

// === TOUCH CONTROLS (mobile) ===
// Touch is just another writer into the keys[] map + handleKeyPress(), so the
// game logic below is untouched. Controls render/handle only on touch devices.

// Control geometry, in game coordinates (480x640).
/** Fixed screen-space hit circles for the on-screen touch buttons (fire/bomb/pause/gear). */
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
/** Live analog-stick touch state: `id` is the owning touch identifier (null = not held). */
const stick: { id: number | null; bx: number; by: number; kx: number; ky: number } =
  { id: null, bx: 0, by: 0, kx: 0, ky: 0 };
const roles: Record<string, 'fire' | 'bomb'> = {};    // touch identifier -> 'fire' | 'bomb'
let firePressed = false;                     // glow flags for drawing
let bombPressed = false;

/** Convert a raw Touch's page coordinates into game/canvas coordinates (0..W, 0..H). */
function toCanvas(t: Touch) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (t.clientX - rect.left) / rect.width  * W,
    y: (t.clientY - rect.top)  / rect.height * H,
  };
}
/** True if point `p` falls inside circle `c` (used for button hit-testing). */
function within(p: { x: number; y: number }, c: { x: number; y: number; r: number }) {
  const dx = p.x - c.x, dy = p.y - c.y;
  return dx * dx + dy * dy <= c.r * c.r;
}

// Discrete (one-per-press) actions for a freshly-started touch.
// Returns true if the touch was consumed (should not drive movement/fire).
/**
 * Handle a touch that just started (touchstart), for menu/button taps that
 * fire once rather than being held. Returns true if the touch was consumed
 * (so the caller won't also treat it as a movement-stick or fire/bomb grab).
 */
function touchDiscrete(p: { x: number; y: number }, g: Game) {
  if (g.settingsOpen) {
    // Hand-tuned hit bands matching the settings panel's drawn layout (see screens.ts drawSettings).
    const bx = W/2 - 130, by = H/2 - 90, bw = 260, bh = 185;
    if (p.y > by + 55 && p.y < by + 80) { handleKeyPress(g, 'KeyM'); return true; }
    if (p.y > by + 80 && p.y < by + 105) { cycleSpeed(g, p.x < W/2 ? -1 : 1); return true; }
    if (p.x < bx || p.x > bx + bw || p.y < by || p.y > by + bh) g.settingsOpen = false;   // tap outside closes it
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
    handleKeyPress(g, 'Enter');   // tap anywhere to start/restart/continue
    return true;
  }
  return false;
}

// Recompute the analog movement vector from the stick's base + knob positions.
function recomputeMoveVec(g: Game) {
  if (stick.id === null) { g.moveVec.x = 0; g.moveVec.y = 0; return; }
  let dx = stick.kx - stick.bx, dy = stick.ky - stick.by;
  const len = Math.hypot(dx, dy);
  if (len > STICK_R) { dx = dx / len * STICK_R; dy = dy / len * STICK_R; }   // clamp knob to the stick's radius
  const mag = len / STICK_R;                 // 0..1
  if (mag < STICK_DEAD) { g.moveVec.x = 0; g.moveVec.y = 0; return; }        // inside deadzone: no movement
  g.moveVec.x = dx / STICK_R;
  g.moveVec.y = dy / STICK_R;
}

// Recompute button glow flags from currently-held button touches.
function recomputeButtons(g: Game) {
  firePressed = bombPressed = false;
  for (const id in roles) {
    if (roles[id] === 'fire') firePressed = true;
    if (roles[id] === 'bomb') bombPressed = true;
  }
  g.keys['Space'] = firePressed;               // FIRE held → Space (drives charge too)
  g.keys['KeyB']  = bombPressed;               // _bombUsed latch makes bomb one-shot
}

// iOS-only: an invisible native switch laid exactly over the on-screen bomb button (see
// the header comment above `isIOS`). It intercepts touches there directly — rather than
// canvas hit-testing — so the tap is a genuine gesture on the switch and WebKit fires the
// real haptic tick as a side effect; the same touch still drives the ordinary bomb-role
// bookkeeping (roles/recomputeButtons) that Player.ts's bomb latch depends on.
// Known platform limitation (confirmed on-device, not fixable in code): WebKit only
// fires the tick when the switch's touch is the SOLE active touch on the page — bombing
// while the movement stick is also held drops the haptic silently. Visuals/gameplay are
// unaffected either way; this is just the tactile feedback being unavailable that frame.
let bombSwitch: HTMLInputElement | null = null;

/** Lazily create the overlay switch described above. No-op off iOS. */
function ensureBombSwitch(g: Game): HTMLInputElement | null {
  if (!isIOS || typeof document === 'undefined') return null;
  if (bombSwitch) return bombSwitch;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.setAttribute('aria-hidden', 'true');
  input.tabIndex = -1;
  input.style.position = 'fixed';
  input.style.opacity = '0';
  input.style.margin = '0';
  input.style.touchAction = 'none';
  // No preventDefault/stopPropagation on its touch handlers below — WebKit's haptic
  // tick only fires for the browser's own native tap handling on the control, and
  // interfering with that (as the offscreen-proxy .click() approach did) killed it.
  input.addEventListener('touchstart', e => {
    getAudio();
    for (const t of Array.from(e.changedTouches)) roles[t.identifier] = 'bomb';
    recomputeButtons(g);
  });
  const release = (e: TouchEvent) => {
    for (const t of Array.from(e.changedTouches)) delete roles[t.identifier];
    recomputeButtons(g);
  };
  input.addEventListener('touchend', release);
  input.addEventListener('touchcancel', release);
  document.body.appendChild(input);
  bombSwitch = input;
  return input;
}

/** Keep the overlay switch aligned with TC.bomb's current on-screen position/size. */
function positionBombSwitch() {
  if (!bombSwitch) return;
  const rect = canvas.getBoundingClientRect();
  const scale = rect.width / W;
  const b = TC.bomb;
  bombSwitch.style.left   = (rect.left + (b.x - b.r) * scale) + 'px';
  bombSwitch.style.top    = (rect.top  + (b.y - b.r) * scale) + 'px';
  bombSwitch.style.width  = (b.r * 2 * scale) + 'px';
  bombSwitch.style.height = (b.r * 2 * scale) + 'px';
}

/**
 * Wire up all input for the game: keyboard listeners always, plus touch
 * listeners (movement stick + fire/bomb/pause/gear buttons) when isTouch.
 * Call once at startup.
 */
export function initInput(g: Game) {
  document.addEventListener('keydown', e => {
    if (!g.keys[e.code]) {
      // Only fire handleKeyPress on the down-transition, not on OS auto-repeat.
      g.keys[e.code] = true;
      handleKeyPress(g, e.code);
    }
    e.preventDefault();
  }, { passive: false });
  document.addEventListener('keyup', e => { g.keys[e.code] = false; e.preventDefault(); }, { passive: false });

  if (isTouch) {
    ensureBombSwitch(g);
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      getAudio();  // unlock WebAudio on first user gesture
      for (const t of Array.from(e.changedTouches)) {
        const p = toCanvas(t);
        if (touchDiscrete(p, g)) continue;        // consumed by a menu/button
        if (within(p, TC.fire)) { roles[t.identifier] = 'fire'; continue; }
        if (!isIOS && within(p, TC.bomb)) { roles[t.identifier] = 'bomb'; continue; }  // iOS: the overlay switch owns this hit area instead
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
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === stick.id) {
          const p = toCanvas(t);
          stick.kx = p.x; stick.ky = p.y;
        }
      }
      recomputeMoveVec(g);
    }, { passive: false });

    const endTouch = (e: TouchEvent) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        if (t.identifier === stick.id) stick.id = null;   // release the movement stick
        delete roles[t.identifier];                       // release fire/bomb if this touch held one
      }
      recomputeButtons(g);
      recomputeMoveVec(g);
    };
    canvas.addEventListener('touchend', endTouch, { passive: false });
    canvas.addEventListener('touchcancel', endTouch, { passive: false });
  }
}

/** Draw one round touch button: filled/stroked circle plus a centered label. */
function drawTcBtn(c: { x: number; y: number; r: number }, stroke: string, label: string, fontPx?: number) {
  ctx.strokeStyle = stroke;
  ctx.fillStyle = 'rgba(20,30,50,0.38)';
  ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#dde';
  ctx.font = (fontPx || 15) + 'px monospace';
  ctx.fillText(label, c.x, c.y);
}

/**
 * Draw the on-screen touch controls (movement stick, fire/bomb/pause/gear
 * buttons, and the "tap to start" hint) for the current game state. No-op on
 * non-touch devices.
 */
export function drawTouchControls(g: Game) {
  if (!isTouch) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 2;

  const playing = (g.state === STATE.PLAYING || g.state === STATE.PAUSED);
  const bombActive = playing && !g.settingsOpen;   // hide/disable while the settings panel is swallowing taps

  if (bombSwitch) {
    bombSwitch.style.display = bombActive ? '' : 'none';
    if (bombActive) positionBombSwitch();
  }

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

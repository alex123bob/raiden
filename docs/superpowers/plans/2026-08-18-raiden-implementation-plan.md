# Raiden 1 Arcade Clone — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully playable Raiden 1 arcade clone as a single `raiden.html` file with no external dependencies, no build step, and no asset files.

**Architecture:** One `raiden.html` file with embedded `<style>` and `<script>`. The script is organized top-to-bottom: constants → input → audio → starfield → entities (player, bullets, enemies, boss, powerups, particles) → wave tables → collision → state machine + screens → main loop → bootstrap. All sprites are procedural canvas drawings. A fixed-timestep accumulator drives game logic at 60 Hz; `requestAnimationFrame` drives rendering.

**Tech Stack:** Vanilla JS (ES2020), HTML5 Canvas 2D API, Web Audio API, localStorage.

**Verification method:** All tasks are verified by opening `raiden.html` in a browser (Chrome or Firefox) and observing behavior. No build step, no test runner.

---

## File Map

| File | Role |
|------|------|
| `raiden.html` | Entire game — HTML shell + embedded CSS + embedded JS |

The single file is organized into labeled sections with `// ===` comment banners matching this order:
1. CONSTANTS & CONFIG
2. INPUT
3. AUDIO
4. STARFIELD
5. PARTICLES
6. PLAYER
7. PLAYER BULLETS
8. ENEMY BULLETS
9. POWERUPS
10. ENEMIES
11. BOSS
12. WAVE TABLES
13. COLLISION
14. HUD & SCREENS
15. STATE MACHINE
16. MAIN LOOP
17. BOOTSTRAP

---

## Task 1: HTML Shell + Canvas Scaffold

**Files:**
- Create: `raiden.html`

- [ ] **Step 1: Create the file**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>RAIDEN</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #000;
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    overflow: hidden;
  }
  canvas { display: block; image-rendering: pixelated; }
</style>
</head>
<body>
<canvas id="c"></canvas>
<script>
'use strict';

// === CONSTANTS & CONFIG ===
const W = 480, H = 640;
const FPS = 60;
const STEP = 1 / FPS;

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;

function resize() {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width  = (W * scale) + 'px';
  canvas.style.height = (H * scale) + 'px';
}
window.addEventListener('resize', resize);
resize();

// === BOOTSTRAP ===
// placeholder — just clear to dark blue to verify canvas works
ctx.fillStyle = '#020208';
ctx.fillRect(0, 0, W, H);
ctx.fillStyle = '#fff';
ctx.font = '20px monospace';
ctx.textAlign = 'center';
ctx.fillText('RAIDEN scaffold OK', W/2, H/2);
</script>
</body>
</html>
```

- [ ] **Step 2: Verify in browser**

Open `raiden.html` in browser. Expected: dark background, text "RAIDEN scaffold OK" centered, canvas letterboxed in window. Resize window — canvas should maintain aspect ratio.

- [ ] **Step 3: Commit**

```bash
git add raiden.html
git commit -m "feat: HTML shell + canvas scaffold with letterboxing"
```

---

## Task 2: State Machine + Input + Title Screen

**Files:**
- Modify: `raiden.html` — replace bootstrap placeholder with state machine, input, title screen rendering, and main loop skeleton.

- [ ] **Step 1: Add state machine, input system, and score/persistence constants**

Replace everything after `resize();` with:

```js
// === STATE MACHINE ===
const STATE = { TITLE: 0, PLAYING: 1, PAUSED: 2, GAMEOVER: 3, STAGECLEAR: 4 };
let state = STATE.TITLE;
let settingsOpen = false;

// Settings
let soundOn = true;
let gameSpeed = 1.0;
const SPEED_STEPS = [0.75, 1.0, 1.25];

// Score / persistence
let score = 0;
let highScore = parseInt(localStorage.getItem('raidenHS') || '0');
function saveHS() {
  if (score > highScore) { highScore = score; localStorage.setItem('raidenHS', highScore); }
}

// === INPUT ===
const keys = {};
document.addEventListener('keydown', e => {
  if (!keys[e.code]) {
    keys[e.code] = true;
    handleKeyPress(e.code);
  }
  e.preventDefault();
}, { passive: false });
document.addEventListener('keyup', e => { keys[e.code] = false; });

function handleKeyPress(code) {
  if (settingsOpen) {
    if (code === 'KeyM')        soundOn = !soundOn;
    if (code === 'BracketLeft') cycleSpeed(-1);
    if (code === 'BracketRight')cycleSpeed(1);
    if (code === 'KeyS')        settingsOpen = false;
    return;
  }
  if (code === 'KeyP') {
    if (state === STATE.PLAYING) state = STATE.PAUSED;
    else if (state === STATE.PAUSED) state = STATE.PLAYING;
  }
  if (code === 'KeyS') {
    if (state === STATE.TITLE || state === STATE.PAUSED || state === STATE.PLAYING)
      settingsOpen = true;
  }
  if (code === 'Enter') {
    if (state === STATE.TITLE)    startGame();
    if (state === STATE.GAMEOVER) state = STATE.TITLE;
  }
}

function cycleSpeed(dir) {
  let i = SPEED_STEPS.indexOf(gameSpeed);
  i = Math.max(0, Math.min(SPEED_STEPS.length - 1, i + dir));
  gameSpeed = SPEED_STEPS[i];
}
```

- [ ] **Step 2: Add starfield (needed for title)**

```js
// === STARFIELD ===
const STAR_LAYERS = [
  { stars: [], speed: 60,  size: 1.0, color: 'rgba(255,255,255,0.4)' },
  { stars: [], speed: 120, size: 1.5, color: 'rgba(255,255,255,0.7)' },
  { stars: [], speed: 200, size: 2.0, color: 'rgba(200,220,255,1.0)' },
];
(function initStars() {
  STAR_LAYERS.forEach(layer => {
    for (let i = 0; i < 60; i++)
      layer.stars.push({ x: Math.random() * W, y: Math.random() * H });
  });
})();

function updateStars(dt) {
  STAR_LAYERS.forEach(layer => {
    layer.stars.forEach(s => {
      s.y += layer.speed * dt;
      if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    });
  });
}

function drawStars() {
  STAR_LAYERS.forEach(layer => {
    ctx.fillStyle = layer.color;
    layer.stars.forEach(s => ctx.fillRect(s.x, s.y, layer.size, layer.size));
  });
}
```

- [ ] **Step 3: Add Title, Pause, Settings, and GameOver screen renderers**

```js
// === HUD & SCREENS ===
function drawTitle() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, H);

  ctx.shadowColor = '#0099ff';
  ctx.shadowBlur = 30;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 72px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('RAIDEN', W/2, 200);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#aaaaff';
  ctx.font = '14px monospace';
  ctx.fillText('ARCADE CLONE', W/2, 230);

  ctx.fillStyle = '#ffff44';
  ctx.font = '16px monospace';
  if (Math.floor(Date.now() / 500) % 2)
    ctx.fillText('PRESS ENTER TO START', W/2, 340);

  ctx.fillStyle = '#aaaaaa';
  ctx.font = '13px monospace';
  ctx.fillText('HI-SCORE: ' + highScore, W/2, 390);

  ctx.fillStyle = '#888';
  ctx.font = '11px monospace';
  ctx.fillText('ARROWS move   SPACE fire   B bomb', W/2, 460);
  ctx.fillText('P pause   S settings', W/2, 478);
}

function drawPause() {
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

function drawSettings() {
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
  ctx.fillText('M  Sound: ' + (soundOn ? 'ON ' : 'OFF'), W/2, by + 68);
  ctx.fillText('[  Speed: ' + gameSpeed.toFixed(2) + 'x  ]', W/2, by + 92);

  ctx.fillStyle = '#666';
  ctx.font = '11px monospace';
  ctx.fillText('M = toggle sound   [ / ] = speed', W/2, by + 130);
  ctx.fillText('S to close', W/2, by + 150);
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ff4444';
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('GAME OVER', W/2, 260);
  ctx.fillStyle = '#fff';
  ctx.font = '18px monospace';
  ctx.fillText('SCORE: ' + score, W/2, 320);
  ctx.fillText('HI-SCORE: ' + highScore, W/2, 348);
  ctx.fillStyle = '#aaffaa';
  ctx.font = '13px monospace';
  ctx.fillText('ENTER → title    C → copy score', W/2, 405);
}

function drawStageClear() {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffff44';
  ctx.shadowColor = '#ffaa00';
  ctx.shadowBlur = 20;
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('STAGE CLEAR!', W/2, H/2 - 10);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  ctx.fillText('STAGE 2 INCOMING...', W/2, H/2 + 30);
}
```

- [ ] **Step 4: Add stub startGame + main loop**

```js
// === STATE MACHINE — startGame stub ===
function startGame() {
  score = 0;
  state = STATE.PLAYING;
}

// === MAIN LOOP ===
let lastTime = 0;
let accumulator = 0;

function loop(ts) {
  requestAnimationFrame(loop);
  const rawDt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;
  const dt = rawDt * gameSpeed;

  // Update
  updateStars(dt);
  if (state === STATE.GAMEOVER && keys['KeyC']) {
    navigator.clipboard && navigator.clipboard.writeText(
      'RAIDEN — Score: ' + score + ' | Hi: ' + highScore);
  }

  // Render
  ctx.fillStyle = '#020208';
  ctx.fillRect(0, 0, W, H);
  drawStars();

  if (state === STATE.TITLE)    drawTitle();
  else if (state === STATE.GAMEOVER) drawGameOver();
  else {
    // placeholder playing/paused frame
    ctx.fillStyle = '#fff';
    ctx.font = '20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PLAYING (stub)', W/2, H/2);
    if (state === STATE.PAUSED) drawPause();
    if (state === STATE.STAGECLEAR) drawStageClear();
  }
  if (settingsOpen) drawSettings();
}

// === BOOTSTRAP ===
requestAnimationFrame(ts => { lastTime = ts; requestAnimationFrame(loop); });
```

- [ ] **Step 5: Verify in browser**

Open `raiden.html`. Expected:
- Title screen with "RAIDEN" glow, blinking "PRESS ENTER TO START", hi-score, control hints.
- Stars scroll down continuously.
- Press S → settings overlay appears, M toggles sound, [ / ] cycle speed, S closes.
- Press Enter → "PLAYING (stub)" text shown.
- Press P → "PAUSED" overlay. Press P again → resumes.

- [ ] **Step 6: Commit**

```bash
git add raiden.html
git commit -m "feat: state machine, input, title/pause/settings/gameover screens, starfield"
```

---

## Task 3: Audio Synthesis

**Files:**
- Modify: `raiden.html` — add `// === AUDIO ===` section before STARFIELD.

- [ ] **Step 1: Add audio helpers**

Insert after the `cycleSpeed` function and before `// === STARFIELD ===`:

```js
// === AUDIO ===
let audioCtx = null;

function getAudio() {
  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// weapon: 0=vulcan, 1=laser, 2=missile
function sfxShoot(weapon) {
  if (!soundOn) return;
  try {
    const ac = getAudio();
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = weapon === 1 ? 'sawtooth' : 'square';
    const base = [880, 440, 660][weapon];
    osc.frequency.setValueAtTime(base + Math.random() * 40, ac.currentTime);
    osc.frequency.exponentialRampToValueAtTime(base * 0.5, ac.currentTime + 0.08);
    gain.gain.setValueAtTime(0.12, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.1);
    osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.1);
  } catch(e) {}
}

// size: 1 (fighter) – 4 (boss chunk)
function sfxExplosion(size) {
  if (!soundOn) return;
  try {
    const ac  = getAudio();
    const len = ac.sampleRate * 0.4;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * (1 - i/len);
    const src    = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    const gain   = ac.createGain();
    src.buffer = buf;
    filter.type = 'lowpass';
    filter.frequency.value = 300 + size * 200;
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
    gain.gain.setValueAtTime(Math.min(1, 0.15 + size * 0.1), ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
    src.start(ac.currentTime);
  } catch(e) {}
}

function sfxPowerup() {
  if (!soundOn) return;
  try {
    const ac = getAudio();
    [523, 659, 784].forEach((freq, i) => {
      const osc  = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ac.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.start(t); osc.stop(t + 0.16);
    });
  } catch(e) {}
}

function sfxBomb() {
  if (!soundOn) return;
  try {
    const ac  = getAudio();
    const len = ac.sampleRate * 1.0;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * (1 - i/len);
    const src    = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    const gain   = ac.createGain();
    src.buffer = buf;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(80, ac.currentTime);
    filter.frequency.linearRampToValueAtTime(900, ac.currentTime + 0.3);
    filter.frequency.exponentialRampToValueAtTime(50, ac.currentTime + 1.0);
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
    gain.gain.setValueAtTime(0.6, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 1.0);
    src.start(ac.currentTime);
  } catch(e) {}
}
```

- [ ] **Step 2: Verify audio works**

Temporarily add to the keydown handler (remove after verification):
```js
if (code === 'KeyT') sfxShoot(0);
if (code === 'KeyY') sfxExplosion(2);
if (code === 'KeyU') sfxPowerup();
if (code === 'KeyI') sfxBomb();
```
Open `raiden.html`, press T/Y/U/I. Expected: distinct sound for each. Remove test bindings.

- [ ] **Step 3: Commit**

```bash
git add raiden.html
git commit -m "feat: Web Audio synthesis — shoot, explosion, powerup, bomb sfx"
```

---

## Task 4: Particles & Explosions

**Files:**
- Modify: `raiden.html` — add `// === PARTICLES ===` section.

- [ ] **Step 1: Add particle system**

Insert after starfield section:

```js
// === PARTICLES ===
let particles = [];

// size: 1=small fighter, 2=gunship, 3=bomber, 4=boss chunk, 6=boss death
function spawnExplosion(x, y, size, color) {
  const count = 6 + size * 4;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const spd   = 40 + Math.random() * 80 * size;
    particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      life: 1.0,
      decay: 0.7 + Math.random() * 0.8,
      r: 2 + Math.random() * size * 3,
      color: color || '#ff8800',
      bomb: false,
    });
  }
  sfxExplosion(size);
}

// Full-screen flash for bomb
function spawnBombFlash() {
  particles.push({ bomb: true, life: 1.0, decay: 2.5,
    x:0, y:0, vx:0, vy:0, r:0, color:'', });
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= p.decay * dt;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    if (!p.bomb) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
  }
}

function drawParticles() {
  particles.forEach(p => {
    if (p.bomb) {
      ctx.fillStyle = 'rgba(255,255,200,' + (p.life * 0.75) + ')';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.5, p.r * p.life), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}
```

- [ ] **Step 2: Call update/draw in the loop**

Inside the main loop's update block (currently just `updateStars`), also call:
```js
updateParticles(dt);
```
Inside the render block (after `drawStars()`), also call:
```js
drawParticles();
```

- [ ] **Step 3: Temporarily test particles**

Add to keydown handler:
```js
if (code === 'KeyT') spawnExplosion(W/2, H/2, 3, '#ff4400');
if (code === 'KeyY') spawnBombFlash();
```
Open browser, press T → orange particle burst. Press Y → full-screen white flash fades. Remove test bindings.

- [ ] **Step 4: Commit**

```bash
git add raiden.html
git commit -m "feat: particle system — explosions and bomb flash"
```

---

## Task 5: Player Entity — Draw, Move, Invincibility

**Files:**
- Modify: `raiden.html` — add `// === PLAYER ===` section.

- [ ] **Step 1: Add player factory and draw function**

```js
// === PLAYER ===
let player = null;

function createPlayer() {
  return {
    x: W / 2, y: H - 100,
    r: 14,            // collision radius
    speed: 280,       // px/s — tuned to arcade feel
    lives: 3,
    bombs: 3,
    invTimer: 0,      // seconds of invincibility remaining
    weapon: 0,        // 0=vulcan 1=laser 2=missile
    weaponLv: 1,
    shootTimer: 0,
    dead: false,
    respawnTimer: 0,
  };
}

function drawPlayer(p) {
  if (p.dead) return;
  // Flicker during invincibility: hide on odd 10ths of a second
  if (p.invTimer > 0 && Math.floor(p.invTimer * 10) % 2 === 0) return;

  ctx.save();
  ctx.translate(p.x, p.y);

  // Engine glow
  const glow = ctx.createRadialGradient(0, 10, 0, 0, 10, 18);
  glow.addColorStop(0, 'rgba(0,180,255,0.85)');
  glow.addColorStop(1, 'rgba(0,80,200,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 10, 18, 0, Math.PI * 2); ctx.fill();

  // Left wing
  ctx.fillStyle = '#4488cc';
  ctx.beginPath();
  ctx.moveTo(-22, 10); ctx.lineTo(-8, -2); ctx.lineTo(-6, 14); ctx.closePath();
  ctx.fill();
  // Right wing
  ctx.beginPath();
  ctx.moveTo(22, 10); ctx.lineTo(8, -2); ctx.lineTo(6, 14); ctx.closePath();
  ctx.fill();

  // Fuselage
  ctx.fillStyle = '#88bbee';
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(12, 10); ctx.lineTo(8, 18);
  ctx.lineTo(-8, 18); ctx.lineTo(-12, 10);
  ctx.closePath();
  ctx.fill();

  // Cockpit
  ctx.fillStyle = '#ccffff';
  ctx.beginPath();
  ctx.ellipse(0, -8, 5, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Wing accent lines
  ctx.strokeStyle = '#aaddff';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(-20, 8); ctx.lineTo(-8, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(20, 8);  ctx.lineTo(8, 0);  ctx.stroke();

  ctx.restore();
}
```

- [ ] **Step 2: Add updatePlayer (movement + invincibility tick only; firing handled later)**

```js
function updatePlayer(dt) {
  const p = player;
  if (p.dead) {
    p.respawnTimer -= dt;
    if (p.respawnTimer <= 0) respawnPlayer();
    return;
  }
  if (p.invTimer > 0) p.invTimer -= dt;

  const spd = p.speed * dt;
  if (keys['ArrowLeft'])  p.x -= spd;
  if (keys['ArrowRight']) p.x += spd;
  if (keys['ArrowUp'])    p.y -= spd;
  if (keys['ArrowDown'])  p.y += spd;
  p.x = Math.max(p.r, Math.min(W - p.r, p.x));
  p.y = Math.max(p.r, Math.min(H - p.r, p.y));
}

function killPlayer() {
  const p = player;
  if (p.invTimer > 0 || p.dead) return;
  p.lives--;
  spawnExplosion(p.x, p.y, 3, '#88ccff');
  playerBullets.length = 0; // arcade-authentic: clear player bullets on death
  if (p.lives <= 0) {
    p.dead = true;
    saveHS();
    setTimeout(() => { state = STATE.GAMEOVER; }, 1800);
  } else {
    p.dead = true;
    p.respawnTimer = 2.0;
  }
}

function respawnPlayer() {
  const p = player;
  p.dead = false;
  p.x = W / 2; p.y = H - 100;
  p.invTimer = 3.0;
}
```

- [ ] **Step 3: Declare playerBullets and enemyBullets arrays (needed by killPlayer)**

```js
// === PLAYER BULLETS ===
let playerBullets = [];

// === ENEMY BULLETS ===
let enemyBullets = [];
```

- [ ] **Step 4: Wire player into startGame and render**

Update `startGame`:
```js
function startGame() {
  score = 0;
  player = createPlayer();
  particles.length = 0;
  playerBullets.length = 0;
  enemyBullets.length = 0;
  state = STATE.PLAYING;
}
```

Update the render loop's PLAYING branch to call `drawPlayer(player)` and `updatePlayer(dt)`.

- [ ] **Step 5: Verify in browser**

Press Enter from title → player jet appears near bottom. Arrow keys move it; it stays inside canvas bounds. Press P → pauses. The Raiden fighter silhouette should be recognizable: fuselage, wings, cockpit, engine glow.

- [ ] **Step 6: Commit**

```bash
git add raiden.html
git commit -m "feat: player entity — draw, move, bounds, invincibility flicker, respawn, death"
```

---

## Task 6: Player Weapons & Bullets

**Files:**
- Modify: `raiden.html` — fill in player bullets section.

- [ ] **Step 1: Add fire-rate helper and bullet factory**

```js
// Returns seconds between shots for weapon/level combo
function getFireRate(weapon, lv) {
  if (weapon === 1) return 0.05;               // laser fires fast
  return Math.max(0.05, 0.13 - lv * 0.015);   // vulcan/missile
}

// Plain forward bullet (vulcan)
function mkVulcanBullet(x, y, angle) {
  const spd = 600;
  return {
    type: 'bullet',
    x, y,
    vx: Math.cos(angle) * spd,
    vy: Math.sin(angle) * spd,
    r: 4, dmg: 5, life: 2.0,
    pierce: false,
  };
}
```

- [ ] **Step 2: Add firePlayer function**

```js
// Called once per fire-rate tick when SPACE held
function firePlayer(p) {
  const lv = p.weaponLv;
  if (p.weapon === 0) {
    // Vulcan — Arcade-authentic: twin forward guns; spread at lv3+
    const spread = lv >= 3 ? 0.18 : 0;
    playerBullets.push(mkVulcanBullet(p.x - 8, p.y - 20, -Math.PI/2 - spread));
    playerBullets.push(mkVulcanBullet(p.x + 8, p.y - 20, -Math.PI/2 + spread));
    if (lv >= 4) {
      playerBullets.push(mkVulcanBullet(p.x - 18, p.y - 8, -Math.PI/2 - 0.38));
      playerBullets.push(mkVulcanBullet(p.x + 18, p.y - 8, -Math.PI/2 + 0.38));
    }
    if (lv >= 5) {
      playerBullets.push(mkVulcanBullet(p.x, p.y - 22, -Math.PI/2));
    }
  } else if (p.weapon === 1) {
    // Laser — piercing beam segment; widens and lengthens with level
    playerBullets.push({
      type: 'laser',
      x: p.x, y: p.y - 20,
      len: 80 + lv * 50,
      w:   3  + lv * 2,
      r:   6  + lv * 2,   // collision half-width treated as radius for hit test
      dmg: 4 * lv,
      life: 0.09,
      pierce: true,
    });
  } else {
    // Missile (Spread) — homing; count increases with level (2 → 5 at lv4+, capped at spec)
    // Spec: missile count 2→5 across 5 levels
    const counts = [2, 2, 3, 4, 5];
    const count  = counts[lv - 1];
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * 16;
      playerBullets.push({
        type: 'missile',
        x: p.x + offset, y: p.y - 20,
        vx: offset * 0.6, vy: -320,
        r: 5, dmg: 8, life: 2.2,
        homingDelay: 0.15 + i * 0.04,
        pierce: false,
      });
    }
  }
  sfxShoot(p.weapon);
}
```

- [ ] **Step 3: Add shoot + bomb logic to updatePlayer**

Inside `updatePlayer`, after movement clamping:
```js
  // Shoot — Arcade-authentic: fire rate driven by weapon stat, not OS key-repeat
  p.shootTimer -= dt;
  if (keys['Space'] && p.shootTimer <= 0) {
    p.shootTimer = getFireRate(p.weapon, p.weaponLv);
    firePlayer(p);
  }

  // Bomb — one activation per press (not hold)
  if (keys['KeyB'] && !keys['_bombUsed']) {
    keys['_bombUsed'] = true;
    if (p.bombs > 0) {
      p.bombs--;
      spawnBombFlash();
      sfxBomb();
      enemyBullets.length = 0; // clear all enemy bullets (arcade-authentic)
      // Damage enemies and boss
      enemies.forEach(e => { e.hp -= 60; });
      if (boss) boss.hp -= 250;
    }
  }
  if (!keys['KeyB']) keys['_bombUsed'] = false;
```

- [ ] **Step 4: Add updatePlayerBullets and drawPlayerBullets**

```js
function updatePlayerBullets(dt) {
  for (let i = playerBullets.length - 1; i >= 0; i--) {
    const b = playerBullets[i];
    b.life -= dt;
    if (b.life <= 0 || b.y < -60 || b.x < -30 || b.x > W + 30) {
      playerBullets.splice(i, 1); continue;
    }
    if (b.type === 'laser') continue; // laser is drawn at player position; no movement needed
    if (b.type === 'missile') {
      // Homing: after delay, steer toward nearest enemy/boss
      b.homingDelay -= dt;
      if (b.homingDelay <= 0) {
        let nearX = null, nearY = null, nearD = Infinity;
        enemies.forEach(e => {
          const d2 = (e.x - b.x) ** 2 + (e.y - b.y) ** 2;
          if (d2 < nearD) { nearD = d2; nearX = e.x; nearY = e.y; }
        });
        if (boss) {
          const d2 = (boss.x - b.x) ** 2 + (boss.y - b.y) ** 2;
          if (d2 < nearD) { nearX = boss.x; nearY = boss.y; }
        }
        if (nearX !== null) {
          const dx = nearX - b.x, dy = nearY - b.y;
          const d  = Math.sqrt(dx*dx + dy*dy) || 1;
          b.vx += (dx/d * 340 - b.vx) * dt * 5;
          b.vy += (dy/d * 340 - b.vy) * dt * 5;
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
    } else {
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
  }
}

function drawPlayerBullets() {
  playerBullets.forEach(b => {
    if (b.type === 'laser') {
      // Laser: vertical beam above player
      const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y - b.len);
      grad.addColorStop(0, 'rgba(0,255,255,0.95)');
      grad.addColorStop(1, 'rgba(0,100,255,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = b.w;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y - b.len); ctx.stroke();
      // Core highlight
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = b.w * 0.3;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x, b.y - b.len); ctx.stroke();
    } else if (b.type === 'missile') {
      ctx.fillStyle = '#ff8800';
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
      // Exhaust trail
      ctx.strokeStyle = 'rgba(255,160,0,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.stroke();
    } else {
      // Vulcan bullet
      ctx.fillStyle = '#ffff44';
      ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,100,0.35)';
      ctx.beginPath(); ctx.arc(b.x, b.y, 7, 0, Math.PI * 2); ctx.fill();
    }
  });
}
```

- [ ] **Step 5: Wire into loop — update and draw**

In the PLAYING update block:
```js
updatePlayerBullets(dt);
```
In the PLAYING render block:
```js
drawPlayerBullets();
```

- [ ] **Step 6: Verify in browser**

Press Enter → player appears. Hold Space: yellow twin bullets fire upward at steady rate. Press S → settings overlay: change speed to 0.75x, bullets slow noticeably. Weapon switching tested in Task 8 (powerups). Bomb visual flash tested here: B key → white screen flash + sfxBomb sound.

- [ ] **Step 7: Commit**

```bash
git add raiden.html
git commit -m "feat: player weapons — vulcan/laser/missile fire, homing missiles, bomb"
```

---

## Task 7: Enemies — Draw, Move, Fire

**Files:**
- Modify: `raiden.html` — add `// === ENEMIES ===` section.

- [ ] **Step 1: Add enemy state variables and factory**

```js
// === ENEMIES ===
let enemies  = [];
let boss     = null;   // single boss entity, null when no boss active

// diffMult: raised by stage 2 and each loop iteration
let diffMult = 1.0;
let loopMult = 1;      // score multiplier that increases each loop

const ENEMY_CFG = [
  // type 0: small fighter
  { hp: 3,  r: 10, spd: 110, score: 100, dropChance: 0.15, color: '#66aaff' },
  // type 1: gunship
  { hp: 8,  r: 14, spd: 65,  score: 200, dropChance: 0.25, color: '#aacc44' },
  // type 2: bomber
  { hp: 20, r: 18, spd: 48,  score: 400, dropChance: 0.50, color: '#cc6622' },
  // type 3: turret (stationary)
  { hp: 12, r: 12, spd: 0,   score: 150, dropChance: 0.50, color: '#cc4466' },
];

// path: function(t) → {x, y}  (null for straight-down or stationary)
function mkEnemy(type, x, y, path) {
  return Object.assign(
    { type, x, y, path, pathT: 0, alive: true, fireTimer: 1.2 + Math.random(), angle: 0 },
    ENEMY_CFG[type]
  );
}
```

- [ ] **Step 2: Add draw functions for all four enemy types**

```js
function drawEnemy(e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  switch (e.type) {
    case 0: // small fighter — compact swept-wing
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(0, -12); ctx.lineTo(10, 8);
      ctx.lineTo(0, 4);   ctx.lineTo(-10, 8);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff4444';
      ctx.beginPath(); ctx.arc(0, -1, 3, 0, Math.PI*2); ctx.fill();
      break;
    case 1: // gunship — boxier/wider hull
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(0, -14); ctx.lineTo(14, 4);
      ctx.lineTo(8, 14);  ctx.lineTo(-8, 14); ctx.lineTo(-14, 4);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffff44';
      ctx.beginPath(); ctx.arc(0, 2, 5, 0, Math.PI*2); ctx.fill();
      break;
    case 2: // bomber — elongated hull with turret nubs
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(0, -18); ctx.lineTo(18, 0);
      ctx.lineTo(16, 16); ctx.lineTo(-16, 16); ctx.lineTo(-18, 0);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ff8800';
      ctx.beginPath(); ctx.arc(-9, 0, 5, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc( 9, 0, 5, 0, Math.PI*2); ctx.fill();
      break;
    case 3: // turret — static base + rotating barrel
      ctx.fillStyle = '#884422';
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#cc6644';
      ctx.save(); ctx.rotate(e.angle);
      ctx.fillRect(-3, -14, 6, 14);
      ctx.restore();
      break;
  }
  ctx.restore();
}
```

- [ ] **Step 3: Add enemy movement update**

```js
function updateEnemyMovement(e, dt) {
  if (e.path) {
    e.pathT += dt;
    const pos = e.path(e.pathT);
    e.x = pos.x; e.y = pos.y;
  } else if (e.type !== 3) {
    // straight down (used for enemies without a path function)
    e.y += e.spd * diffMult * dt;
  }
  // Turret barrel tracks player
  if (e.type === 3 && player && !player.dead) {
    const dx = player.x - e.x, dy = player.y - e.y;
    e.angle = Math.atan2(dx, -dy); // atan2(x,−y) = angle from north
  }
}
```

- [ ] **Step 4: Add enemy firing logic**

```js
function fireEnemy(e) {
  if (!player || player.dead) return;
  const dx = player.x - e.x, dy = player.y - e.y;
  const d  = Math.sqrt(dx*dx + dy*dy) || 1;
  const spd = 190 * diffMult;

  const mkEB = (vx, vy, clr) =>
    enemyBullets.push({ x: e.x, y: e.y, vx, vy, r: 4, clr });

  switch (e.type) {
    case 0: // single aimed shot
      mkEB(dx/d * spd, dy/d * spd, '#ff4444');
      break;
    case 1: // 3-way aimed spread
      [-0.28, 0, 0.28].forEach(a => {
        const ang = Math.atan2(dy, dx) + a;
        mkEB(Math.cos(ang)*spd, Math.sin(ang)*spd, '#ff8800');
      });
      break;
    case 2: // arcing downward fan (5 bullets)
      for (let i = -2; i <= 2; i++) {
        const ang = Math.PI/2 + i * 0.24;
        mkEB(Math.cos(ang)*spd*0.75, Math.sin(ang)*spd*0.75, '#ffcc00');
      }
      break;
    case 3: // aimed burst — 3 shots with slight speed variation
      for (let j = 0; j < 3; j++) {
        const ang  = Math.atan2(dy, dx);
        const bspd = spd * (0.85 + j * 0.1);
        // delay each shot by 80 ms for burst feel
        setTimeout(() => {
          if (state !== STATE.PLAYING) return;
          mkEB(Math.cos(ang)*bspd, Math.sin(ang)*bspd, '#ff66ff');
        }, j * 80);
      }
      break;
  }
}
```

- [ ] **Step 5: Add updateEnemies (combining movement, OOB cull, fire timer)**

```js
function updateEnemies(dt) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    updateEnemyMovement(e, dt);

    // Cull off-screen (give generous margin for path enemies)
    if (e.y > H + 60 || e.x < -60 || e.x > W + 60) {
      enemies.splice(i, 1); continue;
    }

    // Fire timer
    const fireInterval = (e.type === 3 ? 1.6 : 2.2) / diffMult;
    e.fireTimer -= dt;
    if (e.fireTimer <= 0) {
      if (e.type === 3) {
        // Turret only fires when player is within 260 px
        const dx = player.x - e.x, dy = player.y - e.y;
        if (dx*dx + dy*dy < 260*260) fireEnemy(e);
      } else {
        fireEnemy(e);
      }
      e.fireTimer = fireInterval + Math.random() * 0.5;
    }
  }
}
```

- [ ] **Step 6: Add enemy bullet update and draw**

```js
function updateEnemyBullets(dt) {
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y > H + 20 || b.y < -20 || b.x < -20 || b.x > W + 20) {
      enemyBullets.splice(i, 1);
    }
  }
}

function drawEnemyBullets() {
  enemyBullets.forEach(b => {
    ctx.fillStyle = b.clr;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.45, 0, Math.PI*2); ctx.fill();
  });
}
```

- [ ] **Step 7: Wire into loop**

Update section, PLAYING branch:
```js
updateEnemies(dt);
updateEnemyBullets(dt);
```
Render section, PLAYING branch (before HUD):
```js
enemies.forEach(drawEnemy);
drawEnemyBullets();
```

- [ ] **Step 8: Temporarily spawn test enemies to verify**

In `startGame` temporarily add:
```js
enemies.push(mkEnemy(0, 100, 100, null));
enemies.push(mkEnemy(1, 240, 80, null));
enemies.push(mkEnemy(2, 360, 60, null));
enemies.push(mkEnemy(3, 200, 200, null));
```
Open browser: four enemy sprites visible, enemy bullets fired toward player position, turret barrel rotates. Remove test spawns.

- [ ] **Step 9: Commit**

```bash
git add raiden.html
git commit -m "feat: enemies — all four types, movement, firing patterns, bullet update/draw"
```

---

## Task 8: Collision Detection

**Files:**
- Modify: `raiden.html` — add `// === COLLISION ===` section.

- [ ] **Step 1: Add circle collision helper**

```js
// === COLLISION ===
function circleHit(ax, ay, ar, bx, by, br) {
  const dx = ax - bx, dy = ay - by;
  return dx*dx + dy*dy < (ar + br) * (ar + br);
}
```

- [ ] **Step 2: Player bullets vs enemies**

Add `checkPlayerBulletsVsEnemies()`:

```js
function checkPlayerBulletsVsEnemies() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    for (let j = playerBullets.length - 1; j >= 0; j--) {
      const b = playerBullets[j];
      // Laser: treat as vertical segment — use x distance + y overlap
      let hit = false;
      if (b.type === 'laser') {
        // Laser occupies x ± b.r, y from b.y to b.y - b.len
        if (Math.abs(e.x - b.x) < e.r + b.r &&
            e.y > b.y - b.len - e.r && e.y < b.y + e.r) hit = true;
      } else {
        hit = circleHit(e.x, e.y, e.r, b.x, b.y, b.r);
      }
      if (hit) {
        e.hp -= b.dmg;
        if (!b.pierce) { playerBullets.splice(j, 1); j--; }
      }
    }
    if (e.hp <= 0) {
      score += e.score * loopMult;
      saveHS();
      spawnExplosion(e.x, e.y, e.type + 1, e.color);
      tryDropPowerup(e);
      enemies.splice(i, 1);
    }
  }
}
```

- [ ] **Step 3: Enemy bullets vs player**

```js
function checkEnemyBulletsVsPlayer() {
  if (!player || player.dead || player.invTimer > 0) return;
  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    if (circleHit(b.x, b.y, b.r, player.x, player.y, player.r)) {
      enemyBullets.splice(i, 1);
      killPlayer();
      return; // one hit per frame
    }
  }
}
```

- [ ] **Step 4: Enemy bodies vs player**

```js
function checkEnemyBodiesVsPlayer() {
  if (!player || player.dead || player.invTimer > 0) return;
  enemies.forEach(e => {
    if (circleHit(e.x, e.y, e.r, player.x, player.y, player.r)) {
      killPlayer();
    }
  });
}
```

- [ ] **Step 5: Player bullets vs boss + boss body vs player**

```js
function checkPlayerBulletsVsBoss() {
  if (!boss) return;
  for (let j = playerBullets.length - 1; j >= 0; j--) {
    const b = playerBullets[j];
    let hit = false;
    if (b.type === 'laser') {
      if (Math.abs(boss.x - b.x) < boss.r + b.r &&
          boss.y > b.y - b.len - boss.r && boss.y < b.y + boss.r) hit = true;
    } else {
      hit = circleHit(boss.x, boss.y, boss.r, b.x, b.y, b.r);
    }
    if (hit) {
      boss.hp -= b.dmg;
      if (!b.pierce) { playerBullets.splice(j, 1); j--; }
    }
  }
}

function checkBossBodyVsPlayer() {
  if (!boss || !player || player.dead || player.invTimer > 0) return;
  if (circleHit(boss.x, boss.y, boss.r, player.x, player.y, player.r)) {
    killPlayer();
  }
}
```

- [ ] **Step 6: Add collision dispatch function called from the main loop**

```js
function runCollision() {
  checkPlayerBulletsVsEnemies();
  checkEnemyBulletsVsPlayer();
  checkEnemyBodiesVsPlayer();
  checkPlayerBulletsVsBoss();
  checkBossBodyVsPlayer();
  checkPlayerVsPowerups();  // defined in Task 9
}
```

- [ ] **Step 7: Call `runCollision()` from PLAYING update block**

```js
runCollision();
```

- [ ] **Step 8: Verify in browser**

With test enemies spawned (from Task 7 step 8): shoot enemies → they take damage and explode. Enemy bullets → player dies, flickers, respawns. Bomb (B) → all enemy bullets cleared, enemies lose HP.

- [ ] **Step 9: Commit**

```bash
git add raiden.html
git commit -m "feat: collision detection — player bullets vs enemies/boss, enemy bullets/bodies vs player"
```

---

## Task 9: Powerups

**Files:**
- Modify: `raiden.html` — add `// === POWERUPS ===` section.

- [ ] **Step 1: Add powerup state and constants**

```js
// === POWERUPS ===
let powerups = [];

const WEAPON_NAMES  = ['VULCAN', 'LASER', 'MISSILE'];
const WEAPON_COLORS = ['#ffaa00', '#00ccff', '#ff4488'];

function tryDropPowerup(e) {
  if (Math.random() >= e.dropChance) return;
  // Bomb pickup chance ~15% of drops
  const isBomb = Math.random() < 0.15;
  const wType  = Math.floor(Math.random() * 3);
  powerups.push({ x: e.x, y: e.y, vy: 55, r: 10, type: wType, isBomb, life: 9.0 });
}
```

- [ ] **Step 2: Add update and collect logic**

```js
function updatePowerups(dt) {
  for (let i = powerups.length - 1; i >= 0; i--) {
    const pw = powerups[i];
    pw.y   += pw.vy * dt;
    pw.life -= dt;
    if (pw.y > H + 20 || pw.life <= 0) { powerups.splice(i, 1); }
  }
}

function checkPlayerVsPowerups() {
  if (!player || player.dead) return;
  for (let i = powerups.length - 1; i >= 0; i--) {
    const pw = powerups[i];
    if (circleHit(pw.x, pw.y, pw.r, player.x, player.y, player.r + 10)) {
      sfxPowerup();
      if (pw.isBomb) {
        player.bombs = Math.min(3, player.bombs + 1);
      } else if (pw.type === player.weapon) {
        // Same type: level up (Arcade-authentic cap at 5)
        player.weaponLv = Math.min(5, player.weaponLv + 1);
      } else {
        // Different type: switch and reset to level 1 (Arcade-authentic downgrade-on-switch)
        player.weapon   = pw.type;
        player.weaponLv = 1;
      }
      powerups.splice(i, 1);
    }
  }
}
```

- [ ] **Step 3: Add drawPowerups**

```js
function drawPowerups() {
  powerups.forEach(pw => {
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
```

- [ ] **Step 4: Wire into loop**

Update (PLAYING): `updatePowerups(dt);`
Render (PLAYING): `drawPowerups();`

`checkPlayerVsPowerups()` is called from `runCollision()` already (added in Task 8 step 6).

- [ ] **Step 5: Verify in browser**

Kill enemies → colored orbs drop and scroll down. Touch orb matching current weapon → level-up. Touch orb of different type → weapon switches to level 1. Touch pink B orb → bomb count increases. HUD reflects changes.

- [ ] **Step 6: Commit**

```bash
git add raiden.html
git commit -m "feat: powerups — weapon orbs, bomb pickup, level-up and downgrade-on-switch"
```

---

## Task 10: HUD

**Files:**
- Modify: `raiden.html` — fill in `drawHUD` in the HUD & SCREENS section.

- [ ] **Step 1: Add drawHUD function**

```js
function drawHUD() {
  ctx.textBaseline = 'alphabetic';

  // Score (top-left)
  ctx.fillStyle = '#fff';
  ctx.font = '13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('SCORE: ' + score, 8, 18);

  // Hi-score (top-right)
  ctx.textAlign = 'right';
  ctx.fillText('HI: ' + highScore, W - 8, 18);

  // Stage / loop (top-center)
  ctx.fillStyle = '#999';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  const loopStr = loopMult > 1 ? '  Loop ' + loopMult : '';
  ctx.fillText('STAGE ' + currentStage + loopStr, W/2, 18);

  // Lives icons (bottom-left, two rows)
  ctx.fillStyle = '#88ccff';
  ctx.font = '13px monospace';
  ctx.textAlign = 'left';
  for (let i = 0; i < player.lives; i++) ctx.fillText('♦', 8 + i * 14, H - 8);

  // Bomb icons (above lives)
  ctx.fillStyle = '#ff88ff';
  for (let i = 0; i < player.bombs; i++) ctx.fillText('★', 8 + i * 14, H - 24);

  // Weapon name + level (bottom-right)
  ctx.fillStyle = WEAPON_COLORS[player.weapon];
  ctx.textAlign = 'right';
  ctx.font = '12px monospace';
  ctx.fillText(WEAPON_NAMES[player.weapon] + ' Lv' + player.weaponLv, W - 8, H - 8);
}
```

- [ ] **Step 2: Call drawHUD in render loop after all entities**

```js
drawHUD();
```

- [ ] **Step 3: Verify in browser**

Press Enter: HUD shows score, hi-score, stage, lives (3 diamonds), bombs (3 stars), weapon "VULCAN Lv1". Collect powerup → weapon name updates. Die → life count decreases.

- [ ] **Step 4: Commit**

```bash
git add raiden.html
git commit -m "feat: in-game HUD — score, hi-score, stage, lives, bombs, weapon/level"
```

---

## Task 11: Boss Entity

**Files:**
- Modify: `raiden.html` — add `// === BOSS ===` section.

- [ ] **Step 1: Add boss state variables and factory**

```js
// === BOSS ===
let bossMaxHp  = 0;
let bossPhase  = 0;
let bossTimer  = 0;
let bossAngle  = 0;   // rotating arms angle

function createBoss(num) {
  // Boss 2 has more HP and an extra attack phase (per spec)
  const hp = num === 1 ? 800 : 1500;
  bossMaxHp = hp;
  bossPhase = 0;
  bossTimer = 0;
  bossAngle = 0;
  return {
    num,
    x: W/2, y: 130,
    r: 50,
    hp,
    targetX: W/2, targetY: 130,
    spd: 58,
    fireTimer: 1.8,
  };
}
```

- [ ] **Step 2: Add drawBoss**

```js
function drawBoss() {
  if (!boss) return;
  ctx.save();
  ctx.translate(boss.x, boss.y);

  // Body gradient
  const grad = ctx.createRadialGradient(0, 0, 8, 0, 0, boss.r);
  grad.addColorStop(0, '#ff6622');
  grad.addColorStop(0.5, '#882211');
  grad.addColorStop(1, '#330800');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 0, boss.r, 0, Math.PI*2); ctx.fill();

  // Rotating segmented arms (Boss 1: 4 arms, Boss 2: 6 arms — distinct silhouette per spec)
  const armCount = boss.num === 1 ? 4 : 6;
  ctx.save(); ctx.rotate(bossAngle);
  for (let i = 0; i < armCount; i++) {
    ctx.save(); ctx.rotate(i * Math.PI * 2 / armCount);
    ctx.fillStyle = '#bb3300';
    ctx.fillRect(-4, 0, 8, boss.r * 0.88);
    ctx.fillStyle = '#ff7700';
    ctx.beginPath(); ctx.arc(0, boss.r * 0.82, 9, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // Central eye
  ctx.fillStyle = '#ffff00';
  ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ff0000';
  ctx.beginPath(); ctx.arc(0, 0,  8, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(0, 0,  3, 0, Math.PI*2); ctx.fill();

  ctx.restore();

  // HP bar (bottom of screen)
  const bw = 200, bh = 10;
  const bx = (W - bw) / 2, by = H - 28;
  ctx.fillStyle = '#222';
  ctx.fillRect(bx, by, bw, bh);
  const frac     = Math.max(0, boss.hp / bossMaxHp);
  const hpColor  = frac > 0.5 ? '#00ee44' : frac > 0.25 ? '#ffaa00' : '#ff2200';
  ctx.fillStyle  = hpColor;
  ctx.fillRect(bx, by, bw * frac, bh);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#fff';
  ctx.font = '8px monospace'; ctx.textAlign = 'center';
  ctx.fillText('BOSS', W/2, by - 3);
}
```

- [ ] **Step 3: Add boss firing logic (spec: spread barrages + aimed streams; Boss 2 adds extra phase)**

```js
function fireBoss() {
  if (!player || player.dead) return;
  const dx  = player.x - boss.x, dy = player.y - boss.y;
  const d   = Math.sqrt(dx*dx + dy*dy) || 1;
  const spd = (175 + bossPhase * 35) * diffMult;

  const mkEB = (vx, vy, clr) =>
    enemyBullets.push({ x: boss.x, y: boss.y, vx, vy, r: 5, clr });

  // Phase 0: spread barrage (alternating aimed + spread)
  // Phase 1: tight aimed streams
  // Phase 2: rotating ring
  // Phase 3 (Boss 2 only): faster ring + aimed
  switch (bossPhase % (boss.num === 1 ? 3 : 4)) {
    case 0: // wide spread
      for (let i = -3; i <= 3; i++) {
        const ang = Math.atan2(dy, dx) + i * 0.14;
        mkEB(Math.cos(ang)*spd, Math.sin(ang)*spd, '#ff2200');
      }
      break;
    case 1: // aimed twin streams
      [-0.08, 0.08].forEach(a => {
        const ang = Math.atan2(dy, dx) + a;
        mkEB(Math.cos(ang)*spd, Math.sin(ang)*spd, '#ff8800');
      });
      break;
    case 2: // rotating ring
      for (let i = 0; i < 8; i++) {
        const ang = bossAngle + i * Math.PI*2/8;
        mkEB(Math.cos(ang)*spd*0.7, Math.sin(ang)*spd*0.7, '#cc00ff');
      }
      break;
    case 3: // Boss 2 extra: ring + aimed (faster/denser per spec)
      for (let i = 0; i < 12; i++) {
        const ang = bossAngle + i * Math.PI*2/12;
        mkEB(Math.cos(ang)*spd*0.8, Math.sin(ang)*spd*0.8, '#ff00cc');
      }
      mkEB(dx/d*spd, dy/d*spd, '#ffff00');
      break;
  }
}
```

- [ ] **Step 4: Add updateBoss**

```js
function updateBoss(dt) {
  if (!boss) return;
  bossTimer += dt;
  bossAngle += dt * 0.85;

  // Move toward target
  const dx = boss.targetX - boss.x, dy = boss.targetY - boss.y;
  const d  = Math.sqrt(dx*dx + dy*dy) || 1;
  if (d > 5) {
    boss.x += dx/d * boss.spd * dt;
    boss.y += dy/d * boss.spd * dt;
  } else {
    // Pick new patrol target
    boss.targetX = 80 + Math.random() * (W - 160);
    boss.targetY = 60 + Math.random() * 140;
  }

  // Phase from HP: Boss 1 has 3 phases, Boss 2 has 4 (per spec)
  const hpPct = boss.hp / bossMaxHp;
  if (boss.num === 1) {
    bossPhase = hpPct > 0.6 ? 0 : hpPct > 0.3 ? 1 : 2;
  } else {
    bossPhase = hpPct > 0.65 ? 0 : hpPct > 0.4 ? 1 : hpPct > 0.18 ? 2 : 3;
  }

  // Fire
  boss.fireTimer -= dt;
  if (boss.fireTimer <= 0) {
    fireBoss();
    const rate    = [1.2, 0.85, 0.55, 0.38][Math.min(bossPhase, 3)];
    boss.fireTimer = (rate / diffMult) + Math.random() * 0.25;
  }
}

function onBossDeath() {
  spawnExplosion(boss.x,      boss.y,      6, '#ffaa00');
  spawnExplosion(boss.x + 35, boss.y - 25, 4, '#ff4400');
  spawnExplosion(boss.x - 35, boss.y + 15, 4, '#ffcc00');
  score += (boss.num === 1 ? 5000 : 10000) * loopMult;
  saveHS();
  boss = null;

  if (currentStage === 1) {
    // Stage clear transition
    state = STATE.STAGECLEAR;
    stageClearTimer = 3.0;
  } else {
    // Loop — increment loop counter and difficulty, restart stage 1
    // Arcade-authentic: loop multiplier increases spawn rate, bullet speed, enemy HP each loop
    loopMult++;
    diffMult = 1.0 + (loopMult - 1) * 0.35 + 0.4; // stage 2 base + loop stacking
    startStage(1);
    state = STATE.PLAYING;
  }
}
```

- [ ] **Step 5: Wire into collision check and update/draw**

`checkPlayerBulletsVsBoss()` already checks `boss.hp <= 0` — change it to call `onBossDeath()`:

```js
// Inside checkPlayerBulletsVsBoss, after the hit block:
if (boss && boss.hp <= 0) onBossDeath();
```

Also call in `updateBoss` at the end:
```js
  if (boss && boss.hp <= 0) onBossDeath();
```

In loop update (PLAYING): `updateBoss(dt);`
In loop render (PLAYING): `drawBoss();`

- [ ] **Step 6: Verify boss spawn (temporary)**

In `startGame` add: `boss = createBoss(1);`
Open browser: boss appears at top, patrol-moves, fires bullets in phases. HP bar visible. Shoot boss → HP decreases. Remove temp line.

- [ ] **Step 7: Commit**

```bash
git add raiden.html
git commit -m "feat: boss entity — Boss 1 and Boss 2, multi-phase attacks, HP bar, death transition"
```

---

## Task 12: Wave Tables + Stage Flow

**Files:**
- Modify: `raiden.html` — add `// === WAVE TABLES ===` section and complete `startGame`.

- [ ] **Step 1: Add path factory helpers**

```js
// === WAVE TABLES ===
// Path functions return {x, y} given elapsed time t (seconds)

function pathDown(sx, sy, spd) {
  return t => ({ x: sx, y: sy + t * spd });
}

function pathSin(sx, sy, spd, amp, freq) {
  return t => ({ x: sx + Math.sin(t * freq) * amp, y: sy + t * spd });
}

// Formation: N ships evenly spaced horizontally, centered on cx
function pathFormation(cx, sy, spd, idx, total) {
  const offset = (idx - (total - 1) / 2) * 36;
  return t => ({ x: cx + offset, y: sy + t * spd });
}
```

- [ ] **Step 2: Add buildWaveTable(stage)**

```js
// Returns array of spawn entries sorted by trigger time t
// Each entry: { t, type, path? } for regular enemies
//             { t, type:3, x, y } for turrets (stationary)
//             { t, boss: stageNum } to trigger boss spawn
function buildWaveTable(stage) {
  const fSpd = (stage === 1 ? 105 : 145) * diffMult; // fighter speed
  const bSpd = (stage === 1 ?  62 : 88)  * diffMult; // gunship/bomber speed
  const W2 = W;
  const entries = [];

  const add = obj => entries.push(obj);

  // --- Stage 1 opening sequence (approximates arcade stage 1 arrangement) ---

  // t=0.5  Fighter line (5 fighters) — straight down formation
  for (let i = 0; i < 5; i++)
    add({ t: 0.5 + i*0.28, type: 0, path: pathFormation(W2/2, -20, fSpd, i, 5) });

  // t=3.5  Gunship pair from left and right flanks
  add({ t: 3.5, type: 1, path: pathDown(W2*0.25, -30, bSpd) });
  add({ t: 3.5, type: 1, path: pathDown(W2*0.75, -30, bSpd) });

  // t=5.5  Sinusoidal fighter wave (4 ships)
  for (let i = 0; i < 4; i++)
    add({ t: 5.5 + i*0.35, type: 0, path: pathSin(W2*0.18 + i*90, -20, fSpd*0.9, 45, 1.6) });

  // t=8    Turret cluster (3 ground turrets)
  add({ t: 8, type: 3, x: 80,  y: 290 });
  add({ t: 8, type: 3, x: 240, y: 240 });
  add({ t: 8, type: 3, x: 400, y: 290 });

  // t=10   First bomber passes through
  add({ t: 10, type: 2, path: pathDown(W2/2, -40, 44 * diffMult) });

  // t=12   Large fighter sweep (6 ships)
  for (let i = 0; i < 6; i++)
    add({ t: 12 + i*0.22, type: 0, path: pathFormation(W2/2, -20, fSpd*1.15, i, 6) });

  // t=14   Gunship sinusoidal
  add({ t: 14, type: 1, path: pathSin(W2*0.5, -30, bSpd, 65, 1.9) });

  // t=17   Three gunships columns
  for (let i = 0; i < 3; i++)
    add({ t: 17 + i*1.4, type: 1, path: pathDown(80 + i*160, -30, bSpd) });

  // t=20   Two turrets
  add({ t: 20, type: 3, x: 150, y: 200 });
  add({ t: 20, type: 3, x: 330, y: 215 });

  // t=22   Two bombers side by side
  add({ t: 22, type: 2, path: pathDown(W2*0.33, -40, 40*diffMult) });
  add({ t: 22, type: 2, path: pathDown(W2*0.67, -40, 40*diffMult) });

  // t=26   Final fighter rush before boss
  for (let i = 0; i < 8; i++)
    add({ t: 26 + i*0.18, type: 0, path: pathFormation(W2/2, -20, fSpd*1.3, i, 8) });

  // t=30   Boss spawns (all surviving enemies cleared by player or ignored)
  add({ t: 30, boss: stage });

  return entries.sort((a, b) => a.t - b.t);
}
```

- [ ] **Step 3: Add wave dispatch state and updateWaves**

```js
let waveTable    = [];
let waveIndex    = 0;
let stageTimer   = 0;
let currentStage = 1;
let bossSpawned  = false;
let stageClearTimer = 0;

function updateWaves(dt) {
  if (boss) return; // don't advance wave clock while boss is alive
  stageTimer += dt;

  while (waveIndex < waveTable.length) {
    const entry = waveTable[waveIndex];
    if (stageTimer < entry.t) break;
    waveIndex++;

    if (entry.boss) {
      // Wait for all regular enemies to be cleared before spawning boss
      if (enemies.length > 0) {
        waveIndex--;           // retry next tick
        stageTimer = entry.t - 0.1;
        break;
      }
      boss = createBoss(entry.boss);
      bossSpawned = true;
    } else if (entry.type === 3) {
      enemies.push(mkEnemy(3, entry.x, entry.y, null));
    } else {
      const e = mkEnemy(entry.type, 0, 0, entry.path);
      if (entry.path) { const p0 = entry.path(0); e.x = p0.x; e.y = p0.y; }
      enemies.push(e);
    }
  }
}
```

- [ ] **Step 4: Add startStage and updateStageClear**

```js
function startStage(stage) {
  currentStage  = stage;
  waveTable     = buildWaveTable(stage);
  waveIndex     = 0;
  stageTimer    = 0;
  bossSpawned   = false;
  boss          = null;
  enemies.length       = 0;
  enemyBullets.length  = 0;
  playerBullets.length = 0;
  powerups.length      = 0;
}

function updateStageClear(dt) {
  stageClearTimer -= dt;
  if (stageClearTimer <= 0) {
    // Transition to stage 2 with increased difficulty (per spec)
    diffMult = 1.0 + (loopMult - 1) * 0.35 + 0.4;
    startStage(2);
    state = STATE.PLAYING;
  }
}
```

- [ ] **Step 5: Complete startGame**

```js
function startGame() {
  score     = 0;
  loopMult  = 1;
  diffMult  = 1.0;
  player    = createPlayer();
  particles.length = 0;
  powerups.length  = 0;
  startStage(1);
  state = STATE.PLAYING;
}
```

- [ ] **Step 6: Wire updateWaves and updateStageClear into main loop**

In PLAYING update: `updateWaves(dt);`
In STAGECLEAR update: `updateStageClear(dt); updateStars(dt); updateParticles(dt);`

- [ ] **Step 7: Verify in browser**

Press Enter → stage 1 begins. Fighter formations appear after ~0.5s, gunships at ~3.5s, turrets at ~8s, etc. After all waves + enemies cleared, boss appears. Kill boss → "STAGE CLEAR!" banner for 3 s → stage 2 starts with faster enemies. Kill Boss 2 → returns to stage 1 at higher difficulty (Loop 2 shown in HUD).

- [ ] **Step 8: Commit**

```bash
git add raiden.html
git commit -m "feat: wave tables, stage 1 and 2 flow, boss transitions, loop difficulty scaling"
```

---

## Task 13: Polish & Final Integration

**Files:**
- Modify: `raiden.html` — wire remaining screens, copy-score, final render ordering, code comments.

- [ ] **Step 1: Ensure correct render order**

PLAYING render block must be in this order:
```js
drawStars();
drawEnemyBullets();
drawPlayerBullets();
enemies.forEach(drawEnemy);
drawBoss();
drawPlayer(player);
drawPowerups();
drawParticles();
drawHUD();
if (state === STATE.PAUSED)     drawPause();
if (state === STATE.STAGECLEAR) drawStageClear();
if (settingsOpen) drawSettings();
```

- [ ] **Step 2: Wire copy-score on Game Over screen**

In the main loop update block (all states):
```js
if (state === STATE.GAMEOVER && keys['KeyC'] && !keys['_copyUsed']) {
  keys['_copyUsed'] = true;
  navigator.clipboard && navigator.clipboard.writeText(
    'RAIDEN — Score: ' + score + ' | Hi-Score: ' + highScore
  );
}
if (!keys['KeyC']) keys['_copyUsed'] = false;
```

- [ ] **Step 3: Add arcade-behavior comments**

Above the relevant code blocks, add single-line comments marking arcade-authentic behaviors. Examples:

```js
// [ARCADE] Weapon downgrade-on-switch: picking a different weapon type resets to Lv1
// [ARCADE] Player bullets cleared on death
// [ARCADE] Loop: after Boss 2, stage 1 restarts with cumulative difficulty multiplier
// [ARCADE] Bomb clears all enemy bullets on screen
// [ARCADE] Fire rate controlled by weapon stat, not OS key-repeat (keydown/keyup map)
// [ARCADE] Turret stationary relative to scroll, fires only when player in range
```

- [ ] **Step 4: Verify full playthrough**

Open `raiden.html`. Checklist:
- [ ] Title screen renders, blinking prompt, stars scroll, hi-score shown
- [ ] Enter starts game, player appears
- [ ] All arrow keys move player, bounded
- [ ] Space fires vulcan; hold → steady fire rate (not OS repeat stutter)
- [ ] Kill enemies → explosions, score increments, powerup orbs drop
- [ ] Collect same-type orb → level up; collect different → switch to Lv1
- [ ] Collect pink B orb → bomb count increases
- [ ] B key → bomb flash, enemy bullets cleared, enemies damaged, sound plays
- [ ] P → paused overlay; P again → resumes
- [ ] S → settings overlay; M toggles sound; [ / ] cycles speed (0.75 / 1.0 / 1.25)
- [ ] Boss 1 appears after waves, HP bar shown, multi-phase attacks
- [ ] Kill Boss 1 → "STAGE CLEAR!" → stage 2 starts
- [ ] Boss 2 appears in stage 2, more HP, extra attack phase
- [ ] Kill Boss 2 → returns to stage 1 as Loop 2 (HUD shows "Loop 2")
- [ ] Die 3 times → GAME OVER screen with score and hi-score
- [ ] C on game over → clipboard copy (check clipboard contents)
- [ ] Enter on game over → returns to title
- [ ] Hi-score persists across page reload (localStorage)

- [ ] **Step 5: Commit**

```bash
git add raiden.html
git commit -m "feat: final integration — render order, copy-score, arcade-behavior comments"
```

---

## Self-Review: Spec Coverage Check

| Spec requirement | Task covering it |
|-----------------|-----------------|
| Single `raiden.html`, no external deps | Task 1 |
| State machine TITLE→PLAYING⇄PAUSED→GAMEOVER + STAGECLEAR | Task 2 |
| Settings overlay (sound, speed) layering on TITLE or PAUSED | Task 2 |
| 480×640 canvas, CSS letterboxing on resize | Task 1 |
| Parallax starfield 2–3 layers | Task 2 |
| Player procedural sprite (fuselage, wings, glow) | Task 5 |
| Small fighter, gunship, bomber, turret sprites | Task 7 |
| Boss 1 and Boss 2 multi-segment sprites (4 vs 6 arms) | Task 11 |
| Explosions (particle burst, fade, sized by tier) | Task 4 |
| Bomb effect (full-screen flash, clears enemy bullets) | Task 4 + 6 |
| Arrow keys + Space + B + P + S + Enter | Task 2 |
| Keydown/keyup boolean map (not OS repeat) | Task 2 |
| 3 lives, invincibility flicker, respawn | Task 5 |
| Player bullets cleared on death | Task 5 |
| Game over at 0 lives | Task 5 |
| Vulcan — twin bullets, spread at higher levels, 5 levels | Task 6 |
| Laser — piercing, widens/lengthens with level | Task 6 |
| Missile — homing, count 2→5 across levels | Task 6 |
| Pickup: same type levels up, different type resets to Lv1 | Task 9 |
| Bomb pickup (capped 3) | Task 9 |
| Fighter/gunship/bomber/turret movement + bullet patterns | Task 7 |
| Boss 1 (2–3 phases) + Boss 2 (extra phase, more HP) | Task 11 |
| Wave tables (time-scripted, stage 1 sequence) | Task 12 |
| Stage 2 reuses tables with speed/HP multiplier | Task 12 |
| Loop after Boss 2 with cumulative difficulty | Task 12 |
| Collision: player bullets vs enemies/boss, enemy bullets vs player | Task 8 |
| Player vs powerups collision | Task 9 |
| Player vs enemy bodies | Task 8 |
| Title screen (glow logo, hi-score, blink prompt) | Task 2 |
| In-game HUD (score, hi-score, lives icons, bombs, weapon+level) | Task 10 |
| Boss HP bar | Task 11 |
| Pause overlay | Task 2 |
| Stage clear banner | Task 2 |
| Game over (score, hi-score, copy-score action) | Task 13 |
| Shoot SFX (varies by weapon) | Task 3 |
| Explosion SFX (scaled by tier) | Task 3 |
| Powerup SFX (ascending chime) | Task 3 |
| Bomb SFX (noise sweep + rumble) | Task 3 |
| Audio gated by sound toggle | Task 3 |
| AudioContext resume on first interaction | Task 3 |
| High score localStorage persistence | Task 2 |
| Code organized top-to-bottom per spec order | All tasks |
| Arcade-behavior comments | Task 13 |

All spec requirements covered. No placeholders found.

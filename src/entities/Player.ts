import { W, H, CHARGE_DURATION, STATE } from '../config.js';
import { ctx } from '../canvas.js';
import { WEAPON_COLORS, getFireRate, firePlayer, fireSuper } from './Bullet.js';
import { spawnExplosion, spawnBombFlash } from '../core/particles.js';
import { sfxBomb } from '../core/audio.js';

// Persistent laser state — beam is drawn directly each frame when firing, not stored in playerBullets
let laserActive  = false;   // unused now, kept to avoid reference errors in collision code
let laserPulse   = 0;       // unused now

// === PLAYER ===
function createPlayer() {
  return {
    x: W / 2, y: H - 100,
    r: 14,            // collision radius
    speed: 280,       // px/s — tuned to arcade feel
    lives: 3,
    bombs: 3,
    invTimer: 0,      // seconds of invincibility remaining
    weapons: [{ type: 0, lv: 1 }],  // FIFO queue, max 2. Each: {type:0-2, lv:1-5}
    shootTimer: 0,
    dead: false,
    respawnTimer: 0,
    gameOverTimer: undefined,
    chargeTime:  0,
    charging:    false,
    chargeFired: false,
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

  // Charge ring indicator — only at lv5 while charging
  if (p.weapons[0].lv === 5 && p.charging && p.chargeTime > 0) {
    const frac  = Math.min(1, p.chargeTime / CHARGE_DURATION);
    const ringR = 28 + frac * 8;
    const startAngle = -Math.PI / 2;
    const endAngle   = startAngle + frac * Math.PI * 2;
    ctx.save();
    ctx.translate(p.x, p.y);
    const primaryColor = WEAPON_COLORS[p.weapons[0].type];
    ctx.shadowColor = primaryColor;
    ctx.shadowBlur  = 12 + frac * 16;
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth   = 3;
    ctx.globalAlpha = 0.55 + frac * 0.45;
    ctx.beginPath();
    ctx.arc(0, 0, ringR, startAngle, endAngle);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 1.2;
    ctx.globalAlpha = 0.7 * frac;
    ctx.beginPath();
    ctx.arc(0, 0, ringR - 3, startAngle, endAngle);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha  = 1;
    ctx.shadowBlur   = 0;
    ctx.shadowColor  = 'transparent';
  }
}

function updatePlayer(dt, g) {
  const p = g.player;
  if (p.dead) {
    if (p.gameOverTimer !== undefined) {
      p.gameOverTimer -= dt;
      if (p.gameOverTimer <= 0) g.state = STATE.GAMEOVER;
    } else {
      p.respawnTimer -= dt;
      if (p.respawnTimer <= 0) respawnPlayer(g);
    }
    return;
  }
  if (p.invTimer > 0) p.invTimer -= dt;

  const spd = p.speed * dt;
  // Keyboard (desktop): discrete arrows
  if (g.keys['ArrowLeft'])  p.x -= spd;
  if (g.keys['ArrowRight']) p.x += spd;
  if (g.keys['ArrowUp'])    p.y -= spd;
  if (g.keys['ArrowDown'])  p.y += spd;
  // Analog stick (touch): proportional vector
  p.x += g.moveVec.x * spd;
  p.y += g.moveVec.y * spd;
  p.x = Math.max(p.r, Math.min(W - p.r, p.x));
  p.y = Math.max(p.r, Math.min(H - p.r, p.y));
  // [ARCADE] Fire rate controlled by weapon stat, not OS key-repeat (keydown/keyup map)
  laserActive = false;
  p.shootTimer -= dt;

  if (p.weapons[0].lv === 5) {
    // Hold-to-charge, release-to-fire super-shot (lv5 only)
    if (g.keys['Space']) {
      p.charging = true;
      p.chargeTime = Math.min(CHARGE_DURATION, p.chargeTime + dt); // cap at full
    } else if (p.charging) {
      // Space released after charging
      if (p.chargeTime >= CHARGE_DURATION) {
        fireSuper(p, g);            // full charge → super-shot
        p.shootTimer = 0.3;      // brief cooldown after super
      } else if (p.shootTimer <= 0) {
        p.shootTimer = getFireRate(p.weapons[0].type, p.weapons[0].lv);
        firePlayer(p, g);           // partial charge → single normal volley
      }
      // Reset charge state
      p.chargeTime  = 0;
      p.charging    = false;
    }
    p.chargeFired = false;
  } else {
    p.chargeTime  = 0;
    p.charging    = false;
    p.chargeFired = false;
    if (g.keys['Space'] && p.shootTimer <= 0) {
      p.shootTimer = getFireRate(p.weapons[0].type, p.weapons[0].lv);
      firePlayer(p, g);
    }
  }

  // Bomb — one activation per press (not hold)
  if (g.keys['KeyB'] && !g.keys['_bombUsed']) {
    g.keys['_bombUsed'] = true;
    if (p.bombs > 0) {
      p.bombs--;
      spawnBombFlash(g);
      sfxBomb(g);
      // [ARCADE] Bomb clears all enemy bullets on screen
      g.enemyBullets.length = 0;
      // Damage enemies and boss (will reference enemies/boss defined in later tasks)
      if (typeof g.enemies !== 'undefined') g.enemies.forEach(e => { e.hp -= 60; });
      if (typeof g.boss !== 'undefined' && g.boss) g.boss.hp -= 250;
    }
  }
  if (!g.keys['KeyB']) g.keys['_bombUsed'] = false;
}

function killPlayer(g) {
  const p = g.player;
  if (p.invTimer > 0 || p.dead) return;
  p.lives--;
  spawnExplosion(p.x, p.y, 3, '#88ccff', g);
  // [ARCADE] Player bullets cleared on death
  g.playerBullets.length = 0;
  laserActive = false;
  // [ARCADE] Weapon resets to Vulcan Lv1 on any death
  p.weapons = [{ type: 0, lv: 1 }];
  p.chargeTime  = 0;
  p.charging    = false;
  p.chargeFired = false;
  if (p.lives <= 0) {
    p.dead = true;
    g.saveHS();
    p.gameOverTimer = 1.8;  // counted down in updatePlayer, not a setTimeout
  } else {
    p.dead = true;
    p.respawnTimer = 2.0;
  }
}

function respawnPlayer(g) {
  const p = g.player;
  p.dead = false;
  p.x = W / 2; p.y = H - 100;
  p.invTimer = 3.0;
}

export { createPlayer, drawPlayer, updatePlayer, killPlayer, respawnPlayer };

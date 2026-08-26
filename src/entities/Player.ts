import { W, H, CHARGE_DURATION, STATE } from '../config.js';
import type { GameContext } from '../core/GameContext.js';
import type { RenderContext } from '../core/Renderer.js';
import { Entity } from '../core/Entity.js';
import { WEAPON_COLORS, getFireRate, firePlayer, fireSuper, comboOffset } from './Bullet.js';

/** One equipped weapon: `type` selects vulcan(0)/spread(1)/missile(2); `lv` is its power level 1..5. */
export interface WeaponSlot { type: number; lv: number; }

/**
 * The player's ship. Owns movement, up to 2 weapon slots (with per-slot super
 * charge at max level), bombs, lives/respawn, and invulnerability. update()
 * reads ctx.keys/moveVec for input and pushes bullets into ctx.playerBullets.
 */
export class Player extends Entity {
  /** Movement speed in pixels/second (both keyboard and analog-stick input scale by this). */
  speed = 280;
  /** Remaining lives; hitting 0 on death triggers game over. */
  lives = 3;
  /** Remaining bombs; each use clears enemy bullets and damages all enemies/boss. */
  bombs = 3;
  /** Seconds of remaining invulnerability (post-spawn/respawn); ship blinks and takes no damage while > 0. */
  invTimer = 0;
  /** Equipped weapons, up to 2 slots. New pickups push to the end; a full loadout shifts the oldest off. */
  weapons: WeaponSlot[] = [{ type: 0, lv: 1 }];
  /** Countdown to the next normal shot; reset to getFireRate() after each firePlayer() call. */
  shootTimer = 0;
  /** True while dead (either mid-respawn countdown or mid-game-over countdown). */
  dead = false;
  /** Seconds until respawn, counting down while dead (and gameOverTimer is undefined). */
  respawnTimer = 0;
  /** Seconds until the GAMEOVER state, counting down after the last life is lost; undefined = not the final death. */
  gameOverTimer?: number;
  /** Seconds accumulated toward the next super burst (0..CHARGE_DURATION) while a weapon is maxed and firing. */
  chargeTime = 0;
  /** True while holding fire with a maxed weapon (drives the charge-ring draw). */
  charging = false;
  /** Unused latch, always reset to false; kept for compatibility with any external reads. */
  chargeFired = false;
  constructor() {
    super(W / 2, H - 100, 14);
  }
  update(dt: number, ctx: GameContext): void {
    const p = this;
    if (p.dead) {
      if (p.gameOverTimer !== undefined) {
        p.gameOverTimer -= dt;
        if (p.gameOverTimer <= 0) ctx.state = STATE.GAMEOVER;
      } else {
        p.respawnTimer -= dt;
        if (p.respawnTimer <= 0) respawnPlayer(p, ctx);
      }
      return;
    }
    if (p.invTimer > 0) p.invTimer -= dt;

    const spd = p.speed * dt;
    if (ctx.keys['ArrowLeft'])  p.x -= spd;
    if (ctx.keys['ArrowRight']) p.x += spd;
    if (ctx.keys['ArrowUp'])    p.y -= spd;
    if (ctx.keys['ArrowDown'])  p.y += spd;
    p.x += ctx.moveVec.x * spd;   // analog stick input (touch), added on top of digital keys
    p.y += ctx.moveVec.y * spd;
    p.x = Math.max(p.r, Math.min(W - p.r, p.x));   // clamp to the play field
    p.y = Math.max(p.r, Math.min(H - p.r, p.y));
    p.shootTimer -= dt;

    const maxedIdx = p.weapons.findIndex(s => s.lv === 5);
    if (maxedIdx !== -1) {
      // At least one weapon is maxed: fire continuously like every other
      // level, while a super meter fills in the background and auto-unleashes
      // a burst when full. No hold-and-release gate — the gun never goes quiet.
      // In a combo, only the maxed slot(s) super-fire (see fireSuper); a
      // non-maxed partner keeps its normal pattern via firePlayer.
      const maxed = p.weapons[maxedIdx];
      if (ctx.keys['Space']) {
        p.charging = true;
        if (p.shootTimer <= 0) {
          p.shootTimer = getFireRate(maxed.type, maxed.lv);
          firePlayer(p, ctx);
        }
        p.chargeTime += dt;
        if (p.chargeTime >= CHARGE_DURATION) {
          fireSuper(p, ctx);
          ctx.spawnParticles('superFlash', p.x, p.y,
            { color: WEAPON_COLORS[maxed.type] });
          p.chargeTime -= CHARGE_DURATION;   // roll over any overshoot rather than clamping to 0
        }
      } else {
        p.charging = false;
        p.chargeTime = 0;
      }
      p.chargeFired = false;
    } else {
      p.chargeTime = 0;
      p.charging = false;
      p.chargeFired = false;
      if (ctx.keys['Space'] && p.shootTimer <= 0) {
        p.shootTimer = getFireRate(p.weapons[0].type, p.weapons[0].lv);
        firePlayer(p, ctx);
      }
    }

    if (ctx.keys['KeyB'] && !ctx.keys['_bombUsed']) {
      ctx.keys['_bombUsed'] = true;   // latch: one bomb per physical key-press, even if held
      if (p.bombs > 0) {
        p.bombs--;
        ctx.spawnParticles('bombFlash', p.x, p.y);
        ctx.audio.play('bomb');
        ctx.vibrate(300);
        ctx.enemyBullets.length = 0;        // bomb clears all enemy bullets on screen
        ctx.enemies.forEach(e => { e.hp -= 60; });
        if (ctx.boss) ctx.boss.hp -= 250;
      }
    }
    if (!ctx.keys['KeyB']) ctx.keys['_bombUsed'] = false;   // release resets the latch
  }
  draw(rc: RenderContext, _ctx: GameContext): void {
    const p = this;
    if (p.dead) return;
    if (p.invTimer > 0 && Math.floor(p.invTimer * 10) % 2 === 0) return;   // blink every other 0.1s tick while invulnerable

    rc.save();
    rc.translate(p.x, p.y);

    // Engine glow beneath the ship.
    const glow = rc.createRadialGradient(0, 10, 0, 0, 10, 18);
    glow.addColorStop(0, 'rgba(0,180,255,0.85)');
    glow.addColorStop(1, 'rgba(0,80,200,0)');
    rc.fillStyle = glow;
    rc.beginPath(); rc.arc(0, 10, 18, 0, Math.PI * 2); rc.fill();

    // Left and right wings.
    rc.fillStyle = '#4488cc';
    rc.beginPath();
    rc.moveTo(-22, 10); rc.lineTo(-8, -2); rc.lineTo(-6, 14); rc.closePath();
    rc.fill();
    rc.beginPath();
    rc.moveTo(22, 10); rc.lineTo(8, -2); rc.lineTo(6, 14); rc.closePath();
    rc.fill();

    // Main fuselage.
    rc.fillStyle = '#88bbee';
    rc.beginPath();
    rc.moveTo(0, -22);
    rc.lineTo(12, 10); rc.lineTo(8, 18);
    rc.lineTo(-8, 18); rc.lineTo(-12, 10);
    rc.closePath();
    rc.fill();

    // Cockpit canopy.
    rc.fillStyle = '#ccffff';
    rc.beginPath(); rc.ellipse(0, -8, 5, 8, 0, 0, Math.PI * 2); rc.fill();

    // Wing struts.
    rc.strokeStyle = '#aaddff';
    rc.lineWidth = 1;
    rc.beginPath(); rc.moveTo(-20, 8); rc.lineTo(-8, 0); rc.stroke();
    rc.beginPath(); rc.moveTo(20, 8); rc.lineTo(8, 0); rc.stroke();

    rc.restore();

    // Combo synergy: when two different weapon types are equipped, a fusion
    // core forms above the nose (see drawComboSynergy) — a cosmetic cue that
    // the pair is an intentional combo rather than two independent guns.
    if (p.weapons.length === 2 && p.weapons[0].type !== p.weapons[1].type) {
      drawComboSynergy(rc, p);
    }

    // Charge ring: shown while holding fire with a maxed weapon; sweeps a full
    // circle over CHARGE_DURATION and is colored/glowed by that weapon's color.
    const ringSlot = p.weapons.find(s => s.lv === 5);
    if (ringSlot && p.charging && p.chargeTime > 0) {
      const frac = Math.min(1, p.chargeTime / CHARGE_DURATION);   // 0..1 progress toward the next super
      const ringR = 28 + frac * 8;                                 // ring grows slightly as it fills
      const startAngle = -Math.PI / 2;                             // sweep starts at 12 o'clock
      const endAngle = startAngle + frac * Math.PI * 2;
      rc.save();
      rc.translate(p.x, p.y);
      const primaryColor = WEAPON_COLORS[ringSlot.type];
      rc.shadowColor = primaryColor;
      rc.shadowBlur = 12 + frac * 16;      // glow intensifies as the meter fills
      rc.strokeStyle = primaryColor;
      rc.lineWidth = 3;
      rc.globalAlpha = 0.55 + frac * 0.45;
      rc.beginPath();
      rc.arc(0, 0, ringR, startAngle, endAngle);
      rc.stroke();
      // Thin white inner ring adds a bright highlight on top of the colored arc.
      rc.strokeStyle = '#ffffff';
      rc.lineWidth = 1.2;
      rc.globalAlpha = 0.7 * frac;
      rc.beginPath();
      rc.arc(0, 0, ringR - 3, startAngle, endAngle);
      rc.stroke();
      rc.restore();
      rc.globalAlpha = 1;
      rc.shadowBlur = 0;
      rc.shadowColor = 'transparent';
    }
  }
  kill(ctx: GameContext): void {
    const p = this;
    if (p.invTimer > 0 || p.dead) return;   // invulnerable or already dying: ignore
    p.lives--;
    ctx.spawnParticles('explosion', p.x, p.y, { size: 3, color: '#88ccff' });
    ctx.playerBullets.length = 0;
    p.weapons = [{ type: 0, lv: 1 }];        // death fully resets the loadout to base vulcan
    p.chargeTime = 0;
    p.charging = false;
    p.chargeFired = false;
    if (p.lives <= 0) {
      p.dead = true;
      ctx.saveHS();
      p.gameOverTimer = 1.8;
    } else {
      p.dead = true;
      p.respawnTimer = 2.0;
    }
  }
}

export function createPlayer(): Player { return new Player(); }
export function drawPlayer(p: Player, rc: RenderContext, ctx: GameContext): void { p.draw(rc, ctx); }
export function updatePlayer(dt: number, ctx: GameContext): void { if (ctx.player) ctx.player.update(dt, ctx); }
export function killPlayer(ctx: GameContext): void { if (ctx.player) ctx.player.kill(ctx); }
/** Revive the player at center-bottom with a grace period of invulnerability. */
export function respawnPlayer(p: Player, _ctx: GameContext): void {
  p.dead = false;
  p.x = W / 2; p.y = H - 100;
  p.invTimer = 3.0;
}

/**
 * Combo synergy fusion effect, drawn above the nose when two different
 * weapon types are equipped: a pulsing white-hot core (gradient blending
 * both weapon colors) fed by two crackling energy arcs from each muzzle,
 * with a pair of orbiting sparks per weapon color. Reuses the crackle-jitter
 * and orbiting-sparkle idioms already used by plasma bullets/powerup shine,
 * so the fusion reads as "these two streams are merging" rather than a
 * decorative line between two guns.
 */
function drawComboSynergy(rc: RenderContext, p: Player): void {
  const t = Date.now() / 1000;
  const pulse = 0.5 + Math.sin(t * 6) * 0.5;          // 0..1 breathing pulse
  const colorA = WEAPON_COLORS[p.weapons[0].type];
  const colorB = WEAPON_COLORS[p.weapons[1].type];
  const leftOff = comboOffset(0, 2), rightOff = comboOffset(1, 2);
  const muzzleA = { x: p.x + leftOff, y: p.y - 20 };
  const muzzleB = { x: p.x + rightOff, y: p.y - 20 };
  const core = { x: p.x, y: p.y - 34 };                // fusion point above the nose, between the muzzles
  const coreR = 5 + pulse * 3;

  rc.save();

  // Two crackling arcs feed from each muzzle into the fusion core, jittering
  // deterministically over time (not per-frame random) so replay stays stable.
  const drawArc = (muzzle: { x: number; y: number }, color: string, phase: number) => {
    const jitter = Math.sin(t * 14 + phase) * 3;
    const midX = (muzzle.x + core.x) / 2 + jitter;
    const midY = (muzzle.y + core.y) / 2;
    rc.strokeStyle = color;
    rc.lineWidth = 1 + pulse * 1.2;
    rc.globalAlpha = 0.5 + pulse * 0.4;
    rc.beginPath();
    rc.moveTo(muzzle.x, muzzle.y);
    rc.lineTo(midX, midY);
    rc.lineTo(core.x, core.y);
    rc.stroke();
  };
  drawArc(muzzleA, colorA, 0);
  drawArc(muzzleB, colorB, 2.1);

  // Fusion core: radial gradient blending both weapon colors through a
  // white-hot center, breathing in size/opacity with `pulse`.
  rc.globalAlpha = 0.7 + pulse * 0.3;
  const grad = rc.createRadialGradient(core.x, core.y, 0, core.x, core.y, coreR);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.45, colorA);
  grad.addColorStop(1, colorB);
  rc.fillStyle = grad;
  rc.beginPath(); rc.arc(core.x, core.y, coreR, 0, Math.PI * 2); rc.fill();

  // Two sparks per weapon color, orbiting the core on opposite sides.
  const drawSpark = (color: string, angle: number) => {
    const orbitR = coreR + 5;
    const sx = core.x + Math.cos(angle) * orbitR;
    const sy = core.y + Math.sin(angle) * orbitR * 0.6;   // flattened orbit (foreshortened, ship-facing view)
    rc.fillStyle = color;
    rc.globalAlpha = 0.6 + pulse * 0.4;
    rc.beginPath(); rc.arc(sx, sy, 1.4, 0, Math.PI * 2); rc.fill();
  };
  drawSpark(colorA, t * 3);
  drawSpark(colorA, t * 3 + Math.PI);
  drawSpark(colorB, t * 3 + Math.PI / 2);
  drawSpark(colorB, t * 3 + Math.PI * 1.5);

  rc.restore();
}

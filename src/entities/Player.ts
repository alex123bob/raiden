import { W, H, CHARGE_DURATION, STATE } from '../config.js';
import type { GameContext } from '../core/GameContext.js';
import type { RenderContext } from '../core/Renderer.js';
import { Entity } from '../core/Entity.js';
import { WEAPON_COLORS, getFireRate, firePlayer, fireSuper } from './Bullet.js';

export interface WeaponSlot { type: number; lv: number; }

export class Player extends Entity {
  speed = 280;
  lives = 3;
  bombs = 3;
  invTimer = 0;
  weapons: WeaponSlot[] = [{ type: 0, lv: 1 }];
  shootTimer = 0;
  dead = false;
  respawnTimer = 0;
  gameOverTimer?: number;
  chargeTime = 0;
  charging = false;
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
    p.x += ctx.moveVec.x * spd;
    p.y += ctx.moveVec.y * spd;
    p.x = Math.max(p.r, Math.min(W - p.r, p.x));
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
          p.chargeTime -= CHARGE_DURATION;
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
      ctx.keys['_bombUsed'] = true;
      if (p.bombs > 0) {
        p.bombs--;
        ctx.spawnParticles('bombFlash', p.x, p.y);
        ctx.audio.play('bomb');
        ctx.enemyBullets.length = 0;
        ctx.enemies.forEach(e => { e.hp -= 60; });
        if (ctx.boss) ctx.boss.hp -= 250;
      }
    }
    if (!ctx.keys['KeyB']) ctx.keys['_bombUsed'] = false;
  }
  draw(rc: RenderContext, _ctx: GameContext): void {
    const p = this;
    if (p.dead) return;
    if (p.invTimer > 0 && Math.floor(p.invTimer * 10) % 2 === 0) return;

    rc.save();
    rc.translate(p.x, p.y);

    const glow = rc.createRadialGradient(0, 10, 0, 0, 10, 18);
    glow.addColorStop(0, 'rgba(0,180,255,0.85)');
    glow.addColorStop(1, 'rgba(0,80,200,0)');
    rc.fillStyle = glow;
    rc.beginPath(); rc.arc(0, 10, 18, 0, Math.PI * 2); rc.fill();

    rc.fillStyle = '#4488cc';
    rc.beginPath();
    rc.moveTo(-22, 10); rc.lineTo(-8, -2); rc.lineTo(-6, 14); rc.closePath();
    rc.fill();
    rc.beginPath();
    rc.moveTo(22, 10); rc.lineTo(8, -2); rc.lineTo(6, 14); rc.closePath();
    rc.fill();

    rc.fillStyle = '#88bbee';
    rc.beginPath();
    rc.moveTo(0, -22);
    rc.lineTo(12, 10); rc.lineTo(8, 18);
    rc.lineTo(-8, 18); rc.lineTo(-12, 10);
    rc.closePath();
    rc.fill();

    rc.fillStyle = '#ccffff';
    rc.beginPath(); rc.ellipse(0, -8, 5, 8, 0, 0, Math.PI * 2); rc.fill();

    rc.strokeStyle = '#aaddff';
    rc.lineWidth = 1;
    rc.beginPath(); rc.moveTo(-20, 8); rc.lineTo(-8, 0); rc.stroke();
    rc.beginPath(); rc.moveTo(20, 8); rc.lineTo(8, 0); rc.stroke();

    rc.restore();

    const ringSlot = p.weapons.find(s => s.lv === 5);
    if (ringSlot && p.charging && p.chargeTime > 0) {
      const frac = Math.min(1, p.chargeTime / CHARGE_DURATION);
      const ringR = 28 + frac * 8;
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + frac * Math.PI * 2;
      rc.save();
      rc.translate(p.x, p.y);
      const primaryColor = WEAPON_COLORS[ringSlot.type];
      rc.shadowColor = primaryColor;
      rc.shadowBlur = 12 + frac * 16;
      rc.strokeStyle = primaryColor;
      rc.lineWidth = 3;
      rc.globalAlpha = 0.55 + frac * 0.45;
      rc.beginPath();
      rc.arc(0, 0, ringR, startAngle, endAngle);
      rc.stroke();
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
    if (p.invTimer > 0 || p.dead) return;
    p.lives--;
    ctx.spawnParticles('explosion', p.x, p.y, { size: 3, color: '#88ccff' });
    ctx.playerBullets.length = 0;
    p.weapons = [{ type: 0, lv: 1 }];
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
export function respawnPlayer(p: Player, _ctx: GameContext): void {
  p.dead = false;
  p.x = W / 2; p.y = H - 100;
  p.invTimer = 3.0;
}

import { W, H } from '../config.js';
import { ctx } from '../canvas.js';
import { sfxShoot } from '../core/audio.js';

// === PLAYER BULLETS ===

// Returns seconds between shots for weapon/level combo
export function getFireRate(weapon, lv) {
  if (weapon === 1) return Math.max(0.18, 0.30 - lv * 0.025); // spread: medium fire rate
  return Math.max(0.05, 0.13 - lv * 0.015);   // vulcan/missile
}

// Elongated capsule pellet (vulcan) — looks like real arcade vulcan rounds
export function mkVulcanBullet(x, y, angle) {
  const spd = 680;
  return {
    type: 'bullet',
    x, y,
    vx: Math.cos(angle) * spd,
    vy: Math.sin(angle) * spd,
    // store angle for drawing the elongated capsule shape
    angle,
    r: 4, dmg: 5, life: 2.0,
    lv: 1,   // overwritten by caller for correct trail/spark behavior
    pierce: false,
    trail: [],
  };
}

// Returns angle offset (radians) for a weapon slot in a combo
export function comboOffset(slotIndex, totalSlots) {
  if (totalSlots === 1) return 0;
  return slotIndex === 0 ? -0.26 : 0.26;
}

export function mkSpreadBullet(x, y, angle, lv) {
  const spd = 380;
  return {
    type: 'spread',
    x, y,
    vx: Math.cos(angle) * spd,
    vy: Math.sin(angle) * spd,
    angle,
    r: 5 + lv,
    dmg: 10 + lv * 3,
    life: 2.0,
    lv,
    pierce: false,
  };
}

// Called once per fire-rate tick when SPACE held
export function firePlayer(p, g) {
  const total = p.weapons.length;
  p.weapons.forEach((slot, idx) => {
    const lv  = slot.lv;
    const off = comboOffset(idx, total);
    const UP  = -Math.PI / 2;

    if (slot.type === 0) {
      const spread = lv >= 3 ? 0.18 : 0;
      const pushV = (x, y, a) => {
        const b = mkVulcanBullet(x, y, a);
        b.lv = lv;
        g.playerBullets.push(b);
      };
      pushV(p.x - 8, p.y - 20, UP + off - spread);
      pushV(p.x + 8, p.y - 20, UP + off + spread);
      if (lv >= 4) {
        pushV(p.x - 18, p.y - 8, UP + off - 0.38);
        pushV(p.x + 18, p.y - 8, UP + off + 0.38);
      }
      if (lv >= 5) pushV(p.x, p.y - 22, UP + off);
      sfxShoot(0, g);

    } else if (slot.type === 1) {
      if (lv === 1) {
        [UP+off-0.30, UP+off, UP+off+0.30].forEach(a =>
          g.playerBullets.push(mkSpreadBullet(p.x, p.y-20, a, lv)));
      } else if (lv === 2) {
        const half = 0.35;
        for (let i = 0; i < 4; i++) {
          g.playerBullets.push(mkSpreadBullet(p.x, p.y-20, UP+off-half+(i/3)*(half*2), lv));
        }
      } else if (lv === 3) {
        const half = 0.40;
        for (let i = 0; i < 5; i++) {
          g.playerBullets.push(mkSpreadBullet(p.x, p.y-20, UP+off-half+(i/4)*(half*2), lv));
        }
      } else if (lv === 4) {
        const half = 0.40;
        for (let i = 0; i < 5; i++) {
          g.playerBullets.push(mkSpreadBullet(p.x, p.y-20, UP+off-half+(i/4)*(half*2), lv));
        }
        g.playerBullets.push(mkSpreadBullet(p.x-12, p.y-14, UP+off-0.70, lv));
        g.playerBullets.push(mkSpreadBullet(p.x+12, p.y-14, UP+off+0.70, lv));
      } else {
        const half = 0.50;
        for (let i = 0; i < 7; i++) {
          g.playerBullets.push(mkSpreadBullet(p.x, p.y-20, UP+off-half+(i/6)*(half*2), lv));
        }
      }
      sfxShoot(1, g);

    } else if (slot.type === 2) {
      const missileSpread = total > 1 ? 1.6 : 1.0;
      const counts = [2, 2, 3, 4, 5];
      const count  = counts[lv - 1];
      for (let i = 0; i < count; i++) {
        const offset = (i - (count-1)/2) * 16 * missileSpread;
        g.playerBullets.push({
          type: 'missile', x: p.x+offset, y: p.y-20,
          vx: offset*0.6 + Math.sin(off)*80, vy: -320,
          r: 5, dmg: 8, life: 2.2, homingDelay: 0.15+i*0.04, pierce: false,
        });
      }
      sfxShoot(2, g);
    }
  });
}

export function fireSuper(p, g) {
  const total = p.weapons.length;
  p.weapons.forEach((slot, idx) => {
    const off = comboOffset(idx, total);
    const UP  = -Math.PI / 2;

    if (slot.type === 0) {
      const halfArc = Math.PI * 2 / 3;
      const count = 12;
      for (let i = 0; i < count; i++) {
        const a = UP + off - halfArc + (i/(count-1))*(halfArc*2);
        const b = mkVulcanBullet(p.x, p.y-22, a);
        b.r = 6; b.dmg = 15; b.lv = slot.lv;
        g.playerBullets.push(b);
      }
      sfxShoot(0, g);
    } else if (slot.type === 1) {
      const count = 16;
      for (let i = 0; i < count; i++) {
        const a = off + (i/count)*Math.PI*2;
        const b = mkSpreadBullet(p.x, p.y, a, 5);
        b.r = 7; b.dmg = 18;
        g.playerBullets.push(b);
      }
      sfxShoot(1, g);
    } else if (slot.type === 2) {
      const count = 8;
      const spreadMul = total > 1 ? 1.8 : 1.0;
      for (let i = 0; i < count; i++) {
        const offset = (i-(count-1)/2)*20*spreadMul;
        g.playerBullets.push({
          type: 'missile', x: p.x+offset, y: p.y-20,
          vx: offset*0.5 + Math.sin(off)*80, vy: -320,
          r: 6, dmg: 20, life: 2.5, homingDelay: 0, pierce: false,
        });
      }
      sfxShoot(2, g);
    }
  });
}

export function updatePlayerBullets(dt, g) {
  for (let i = g.playerBullets.length - 1; i >= 0; i--) {
    const b = g.playerBullets[i];
    b.life -= dt;
    if (b.life <= 0 || b.y < -80 || b.x < -40 || b.x > W + 40) {
      g.playerBullets.splice(i, 1); continue;
    }
    if (b.type === 'missile') {
      // Homing: after delay, steer toward nearest enemy/boss
      b.homingDelay -= dt;
      if (b.homingDelay <= 0) {
        let nearX = null, nearY = null, nearD = Infinity;
        if (typeof g.enemies !== 'undefined') g.enemies.forEach(e => {
          const d2 = (e.x - b.x) ** 2 + (e.y - b.y) ** 2;
          if (d2 < nearD) { nearD = d2; nearX = e.x; nearY = e.y; }
        });
        if (typeof g.boss !== 'undefined' && g.boss) {
          const d2 = (g.boss.x - b.x) ** 2 + (g.boss.y - b.y) ** 2;
          if (d2 < nearD) { nearX = g.boss.x; nearY = g.boss.y; }
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
      // Record trail before moving
      if (b.trail) {
        b.trail.unshift({ x: b.x, y: b.y });
        if (b.trail.length > 5) b.trail.length = 5;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
  }
}

export function drawLaserBeam(p) { /* replaced by plasma — kept as no-op so call site compiles */ }

export function drawPlayerBullets(g) {
  g.playerBullets.forEach(b => {
    if (b.type === 'spread') {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle + Math.PI / 2);
      const lv = b.lv;
      if (lv <= 2) {
        const w = 4 + lv * 1, h = 8 + lv * 2;
        ctx.fillStyle = '#ff8800';
        ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffcc44';
        ctx.beginPath(); ctx.ellipse(0, -h * 0.45, w * 0.5, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      } else if (lv === 3) {
        const w = 6, h = 11;
        ctx.fillStyle = '#ff7700';
        ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffee00';
        ctx.beginPath(); ctx.ellipse(0, -h * 0.25, w * 0.55, h * 0.45, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, -h * 0.6, 2, 0, Math.PI * 2); ctx.fill();
      } else if (lv === 4) {
        const w = 7, h = 12;
        ctx.strokeStyle = 'rgba(255,140,0,0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, h * 0.3); ctx.lineTo(0, h * 1.1); ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-w * 0.5, h * 0.6); ctx.lineTo(-w * 0.3, h * 1.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo( w * 0.5, h * 0.6); ctx.lineTo( w * 0.3, h * 1.2); ctx.stroke();
        ctx.fillStyle = '#ff7700';
        ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath(); ctx.ellipse(0, -h * 0.25, w * 0.6, h * 0.45, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, -h * 0.6, 2, 0, Math.PI * 2); ctx.fill();
      } else {
        const w = 9, h = 15;
        ctx.strokeStyle = 'rgba(255,100,0,0.35)';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(0, 0, w + 5, h + 5, 0, 0, Math.PI * 2); ctx.stroke();
        const grad = ctx.createRadialGradient(0, -h * 0.2, 1, 0, 0, h);
        grad.addColorStop(0,   '#ffff88');
        grad.addColorStop(0.3, '#ff8800');
        grad.addColorStop(1,   '#cc2200');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, -h * 0.45, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
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
      // Vulcan bullet — draw trail for lv3+, then capsule
      if (b.trail && b.trail.length > 0 && b.lv >= 3) {
        const trailLen = b.lv >= 4 ? 5 : 3;
        const pts = b.trail.slice(0, trailLen);
        for (let t = 0; t < pts.length; t++) {
          const alpha = (1 - (t + 1) / (trailLen + 1)) * 0.55;
          ctx.strokeStyle = `rgba(200,240,255,${alpha})`;
          ctx.lineWidth = Math.max(0.5, 2.5 - t * 0.4);
          ctx.beginPath();
          if (t === 0) {
            ctx.moveTo(b.x, b.y);
            ctx.lineTo(pts[t].x, pts[t].y);
          } else {
            ctx.moveTo(pts[t - 1].x, pts[t - 1].y);
            ctx.lineTo(pts[t].x, pts[t].y);
          }
          ctx.stroke();
        }
      }
      // Capsule
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle !== undefined ? b.angle + Math.PI/2 : 0);
      ctx.fillStyle = 'rgba(100,220,255,0.5)';
      ctx.beginPath(); ctx.ellipse(0, 0, 3, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(0, 0, 1.5, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  });
}

// === ENEMY BULLETS ===

export function updateEnemyBullets(dt, g) {
  for (let i = g.enemyBullets.length - 1; i >= 0; i--) {
    const b = g.enemyBullets[i];
    // Delayed spawn (turret burst) — count down before the bullet becomes active
    if (b.delay) {
      b.delay -= dt;
      if (b.delay <= 0) delete b.delay;
      else continue;
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y > H + 20 || b.y < -20 || b.x < -20 || b.x > W + 20) {
      g.enemyBullets.splice(i, 1);
    }
  }
}

export function drawEnemyBullets(g) {
  g.enemyBullets.forEach(b => {
    ctx.fillStyle = b.clr;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.45, 0, Math.PI*2); ctx.fill();
  });
}

export const WEAPON_NAMES  = ['VULCAN', 'SPREAD', 'MISSILE'];
export const WEAPON_COLORS = ['#ffaa00', '#ff8800', '#ff4488'];

import { W, H } from '../config.js';
import { ctx } from '../canvas.js';

// === ENEMIES ===

// diffMult is owned by Game and accessed via g.diffMult (raised by stage and each loop iteration).

export const ENEMY_CFG = [
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
export function mkEnemy(type, x, y, path) {
  return Object.assign(
    { type, x, y, path, pathT: 0, alive: true, fireTimer: 1.2 + Math.random(), angle: 0 },
    ENEMY_CFG[type]
  );
}

export function drawEnemy(e) {
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

export function updateEnemyMovement(e, dt, g) {
  if (e.path) {
    e.pathT += dt;
    const pos = e.path(e.pathT);
    e.x = pos.x; e.y = pos.y;
  } else if (e.type !== 3) {
    // straight down (used for enemies without a path function)
    e.y += e.spd * g.diffMult * dt;
  }
  // Turret barrel tracks player
  if (e.type === 3 && g.player && !g.player.dead) {
    const dx = g.player.x - e.x, dy = g.player.y - e.y;
    e.angle = Math.atan2(dx, -dy); // atan2(x,−y) = angle from north
  }
}

export function fireEnemy(e, g) {
  if (!g.player || g.player.dead) return;
  const dx = g.player.x - e.x, dy = g.player.y - e.y;
  const d  = Math.sqrt(dx*dx + dy*dy) || 1;
  const spd = 190 * g.diffMult;

  const mkEB = (vx, vy, clr) =>
    g.enemyBullets.push({ x: e.x, y: e.y, vx, vy, r: 4, clr });

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
    case 3: // aimed burst — 3 shots with slight speed variation + staggered spawn delay
      for (let j = 0; j < 3; j++) {
        const ang  = Math.atan2(dy, dx);
        const bspd = spd * (0.85 + j * 0.1);
        // delay each shot by 80 ms (respected by gameSpeed and bomb-clear via delay field)
        g.enemyBullets.push({ x: e.x, y: e.y,
          vx: Math.cos(ang)*bspd, vy: Math.sin(ang)*bspd,
          r: 4, clr: '#ff66ff', delay: j * 0.08 });
      }
      break;
  }
}

export function updateEnemies(dt, g) {
  for (let i = g.enemies.length - 1; i >= 0; i--) {
    const e = g.enemies[i];
    updateEnemyMovement(e, dt, g);

    // Cull off-screen (generous margin for path enemies)
    if (e.y > H + 60 || e.x < -60 || e.x > W + 60) {
      g.enemies.splice(i, 1); continue;
    }

    // Fire timer
    const fireInterval = (e.type === 3 ? 1.6 : 2.2) / g.diffMult;
    e.fireTimer -= dt;
    if (e.fireTimer <= 0) {
      if (e.type === 3) {
        // [ARCADE] Turret stationary relative to scroll, fires only when player in range
        if (g.player && !g.player.dead) {
          const dx = g.player.x - e.x, dy = g.player.y - e.y;
          if (dx*dx + dy*dy < 260*260) fireEnemy(e, g);
        }
      } else {
        fireEnemy(e, g);
      }
      e.fireTimer = fireInterval + Math.random() * 0.5;
    }
  }
}

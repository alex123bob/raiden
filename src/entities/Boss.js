import { W, H, STATE, STAGE_COUNT } from '../config.js';
import { ctx } from '../canvas.js';
import { spawnExplosion } from '../core/particles.js';
import { mkEnemy, ENEMY_CFG } from './Enemy.js';
import { STAGES } from '../stages/stageData.js';

// === BOSS ===

export function createBoss(g) {
  const def = STAGES[g.currentStage - 1].boss;
  g.bossMaxHp = def.hp;
  g.bossPhase = 0;
  g.bossTimer = 0;
  g.bossAngle = 0;
  return {
    stageNum: g.currentStage,
    archetype: def.archetype,
    tint: def.tint || null,
    x: W/2, y: 130,
    r: def.r,
    hp: def.hp,
    targetX: W/2, targetY: 130,
    spd: def.speed || 58,
    fireTimer: 1.8,
    phaseCount: def.phaseCount,
    spawnMinions: def.spawnMinions || false,
    patterns: def.patterns,
    minionTimer: 3.0,
    phantomAlpha: 1.0,
  };
}

const offCanvas = document.createElement('canvas');

function drawBossArchetype(c, b, angle, timer) {
  switch (b.archetype) {
    case 1: drawBoss1(c, b, angle, timer); break;
    case 2: drawBoss2(c, b, angle, timer); break;
    case 3: drawBoss3(c, b, angle, timer); break;
    case 4: drawBoss4(c, b, angle, timer); break;
    case 5: drawBoss5(c, b, angle, timer); break;
    case 6: drawBoss6(c, b, angle, timer); break;
    case 7: drawBoss7(c, b, angle, timer); break;
    case 8: drawBoss8(c, b, angle, timer); break;
  }
}

export function drawBoss(g) {
  const b = g.boss;
  if (!b) return;
  const R = Math.ceil(b.r * 2.0) + 8;          // fits boss5's r*1.8 glow and boss8's pulsing outer
  offCanvas.width = offCanvas.height = R * 2;
  const oc = offCanvas.getContext('2d');
  oc.setTransform(1, 0, 0, 1, 0, 0);
  oc.clearRect(0, 0, R * 2, R * 2);
  drawBossArchetype(oc, { ...b, x: R, y: R }, g.bossAngle, g.bossTimer);
  if (b.tint) {
    oc.globalCompositeOperation = 'source-atop';
    oc.fillStyle = b.tint;
    oc.fillRect(0, 0, R * 2, R * 2);
    oc.globalCompositeOperation = 'source-over';
  }
  ctx.drawImage(offCanvas, b.x - R, b.y - R);
  drawBossHpBar(g);
}

export function drawBossHpBar(g) {
  const bw = 200, bh = 10;
  const bx = (W - bw) / 2, by = H - 28;
  ctx.fillStyle = '#222';
  ctx.fillRect(bx, by, bw, bh);
  const frac    = Math.max(0, g.boss.hp / g.bossMaxHp);
  const hpColor = frac > 0.5 ? '#00ee44' : frac > 0.25 ? '#ffaa00' : '#ff2200';
  ctx.fillStyle = hpColor;
  ctx.fillRect(bx, by, bw * frac, bh);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, bw, bh);
  ctx.fillStyle = '#fff';
  ctx.font = '8px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('BOSS', W/2, by - 3);
}

function drawBoss1(c, b, angle, timer) {
  c.save();
  c.translate(b.x, b.y);
  const grad = c.createRadialGradient(0, 0, 8, 0, 0, b.r);
  grad.addColorStop(0, '#ff6622'); grad.addColorStop(0.5, '#882211'); grad.addColorStop(1, '#330800');
  c.fillStyle = grad;
  c.beginPath(); c.arc(0, 0, b.r, 0, Math.PI*2); c.fill();
  c.save(); c.rotate(angle);
  for (let i = 0; i < 4; i++) {
    c.save(); c.rotate(i * Math.PI/2);
    c.fillStyle = '#bb3300';
    c.fillRect(-4, 0, 8, b.r * 0.88);
    c.fillStyle = '#ff7700';
    c.beginPath(); c.arc(0, b.r * 0.82, 9, 0, Math.PI*2); c.fill();
    c.restore();
  }
  c.restore();
  c.fillStyle = '#ffff00'; c.beginPath(); c.arc(0, 0, 13, 0, Math.PI*2); c.fill();
  c.fillStyle = '#ff0000'; c.beginPath(); c.arc(0, 0,  8, 0, Math.PI*2); c.fill();
  c.fillStyle = '#000';    c.beginPath(); c.arc(0, 0,  3, 0, Math.PI*2); c.fill();
  c.restore();
}

function drawBoss2(c, b, angle, timer) {
  c.save();
  c.translate(b.x, b.y);
  c.fillStyle = '#334455';
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 - Math.PI / 6;
    i === 0 ? c.moveTo(Math.cos(a)*b.r, Math.sin(a)*b.r)
            : c.lineTo(Math.cos(a)*b.r, Math.sin(a)*b.r);
  }
  c.closePath(); c.fill();
  c.strokeStyle = '#8899bb'; c.lineWidth = 2; c.stroke();
  c.save(); c.rotate(angle * 0.6);
  for (let i = 0; i < 6; i++) {
    c.save(); c.rotate(i * Math.PI / 3);
    c.fillStyle = '#5566aa';
    c.fillRect(-5, 0, 10, b.r * 0.9);
    c.fillStyle = '#aabbff';
    c.beginPath(); c.arc(0, b.r * 0.85, 8, 0, Math.PI*2); c.fill();
    c.restore();
  }
  c.restore();
  c.fillStyle = '#2244ff'; c.beginPath(); c.arc(0, 0, 14, 0, Math.PI*2); c.fill();
  c.fillStyle = '#88aaff'; c.beginPath(); c.arc(0, 0,  8, 0, Math.PI*2); c.fill();
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, 0,  3, 0, Math.PI*2); c.fill();
  c.restore();
}

function drawBoss3(c, b, angle, timer) {
  c.save();
  c.translate(b.x, b.y);
  c.fillStyle = '#443300';
  c.fillRect(-b.r, -b.r * 0.6, b.r * 2, b.r * 1.2);
  c.strokeStyle = '#aa6600'; c.lineWidth = 2;
  c.strokeRect(-b.r, -b.r * 0.6, b.r * 2, b.r * 1.2);
  c.fillStyle = '#664400';
  c.fillRect(-b.r - 22, -8, 22, 16);
  c.fillStyle = '#aa7700';
  c.fillRect(-b.r - 28, -5, 8, 10);
  c.fillStyle = '#664400';
  c.fillRect(b.r, -8, 22, 16);
  c.fillStyle = '#aa7700';
  c.fillRect(b.r + 20, -5, 8, 10);
  c.strokeStyle = '#ffaa00'; c.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    c.beginPath(); c.moveTo(i * b.r * 0.55, -b.r * 0.6);
    c.lineTo(i * b.r * 0.55, -b.r * 0.6 - 12); c.stroke();
  }
  c.fillStyle = '#ffcc00'; c.beginPath(); c.arc(0, 0, 12, 0, Math.PI*2); c.fill();
  c.fillStyle = '#ff4400'; c.beginPath(); c.arc(0, 0,  7, 0, Math.PI*2); c.fill();
  c.restore();
}

function drawBoss4(c, b, angle, timer) {
  c.save();
  c.translate(b.x, b.y);
  const grad = c.createRadialGradient(0, 0, 4, 0, 0, b.r);
  grad.addColorStop(0, '#44aa44'); grad.addColorStop(0.6, '#226622'); grad.addColorStop(1, '#112211');
  c.fillStyle = grad;
  c.beginPath(); c.arc(0, 0, b.r, 0, Math.PI*2); c.fill();
  c.strokeStyle = '#66ee44'; c.lineWidth = 2; c.stroke();
  c.save(); c.rotate(angle * 0.4);
  for (let i = 0; i < 4; i++) {
    c.save(); c.rotate(i * Math.PI / 2);
    c.fillStyle = '#88cc22';
    c.beginPath();
    c.moveTo(0, b.r); c.lineTo(6, b.r + 16);
    c.lineTo(0, b.r + 24); c.lineTo(-6, b.r + 16);
    c.closePath(); c.fill();
    c.restore();
  }
  c.restore();
  c.fillStyle = '#ccff00'; c.beginPath(); c.arc(0, 0, 12, 0, Math.PI*2); c.fill();
  c.fillStyle = '#446600'; c.beginPath(); c.arc(0, 0,  6, 0, Math.PI*2); c.fill();
  c.restore();
}

function drawBoss5(c, b, angle, timer) {
  c.save();
  c.translate(b.x, b.y);
  const glow = c.createRadialGradient(0, 0, b.r * 0.5, 0, 0, b.r * 1.8);
  glow.addColorStop(0, 'rgba(255,200,0,0.3)');
  glow.addColorStop(1, 'rgba(255,80,0,0)');
  c.fillStyle = glow;
  c.beginPath(); c.arc(0, 0, b.r * 1.8, 0, Math.PI*2); c.fill();
  c.save(); c.rotate(angle * 0.7);
  for (let i = 0; i < 8; i++) {
    c.save(); c.rotate(i * Math.PI / 4);
    c.fillStyle = '#ffaa00';
    c.beginPath();
    c.moveTo(-5, b.r * 0.8); c.lineTo(0, b.r * 1.5); c.lineTo(5, b.r * 0.8);
    c.closePath(); c.fill();
    c.restore();
  }
  c.restore();
  const solarGrad = c.createRadialGradient(-8, -8, 4, 0, 0, b.r);
  solarGrad.addColorStop(0, '#ffffff'); solarGrad.addColorStop(0.3, '#ffee44');
  solarGrad.addColorStop(0.8, '#ff8800'); solarGrad.addColorStop(1, '#cc2200');
  c.fillStyle = solarGrad;
  c.beginPath(); c.arc(0, 0, b.r, 0, Math.PI*2); c.fill();
  c.fillStyle = '#cc4400'; c.beginPath(); c.arc(8, -6, 7, 0, Math.PI*2); c.fill();
  c.fillStyle = '#882200'; c.beginPath(); c.arc(8, -6, 4, 0, Math.PI*2); c.fill();
  c.restore();
}

function drawBoss6(c, b, angle, timer) {
  c.save();
  c.translate(b.x, b.y);
  c.fillStyle = '#223344';
  c.fillRect(-b.r, -b.r * 0.7, b.r * 2, b.r * 1.4);
  c.strokeStyle = '#334466'; c.lineWidth = 2;
  for (let row = -1; row <= 1; row++) {
    c.beginPath();
    c.moveTo(-b.r + 4, row * b.r * 0.3);
    c.lineTo( b.r - 4, row * b.r * 0.3);
    c.stroke();
  }
  c.fillStyle = '#112233';
  c.fillRect(-b.r - 20, -15, 20, 30);
  c.strokeStyle = '#4466aa'; c.lineWidth = 1;
  c.strokeRect(-b.r - 20, -15, 20, 30);
  c.fillStyle = '#112233';
  c.fillRect(b.r, -15, 20, 30);
  c.strokeRect(b.r, -15, 20, 30);
  for (const side of [-1, 1]) {
    c.fillStyle = '#334455';
    c.beginPath(); c.arc(side * b.r * 0.6, b.r * 0.5, 8, 0, Math.PI*2); c.fill();
    c.fillStyle = '#6688aa';
    c.beginPath(); c.arc(side * b.r * 0.6, b.r * 0.5, 5, 0, Math.PI*2); c.fill();
  }
  c.fillStyle = '#4455aa'; c.fillRect(-18, -b.r * 0.7 - 14, 36, 14);
  c.fillStyle = '#00ccff'; c.beginPath(); c.arc(0, 0, 10, 0, Math.PI*2); c.fill();
  c.fillStyle = '#ffffff'; c.beginPath(); c.arc(0, 0,  5, 0, Math.PI*2); c.fill();
  c.restore();
}

function drawBoss7(c, b, angle, timer) {
  c.save();
  c.translate(b.x, b.y);
  c.globalAlpha = b.phantomAlpha;
  c.fillStyle = '#220044';
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 - Math.PI / 8;
    i === 0 ? c.moveTo(Math.cos(a)*b.r, Math.sin(a)*b.r)
            : c.lineTo(Math.cos(a)*b.r, Math.sin(a)*b.r);
  }
  c.closePath(); c.fill();
  c.strokeStyle = '#9933ff'; c.lineWidth = 2; c.stroke();
  c.save(); c.rotate(-angle * 1.2);
  for (let i = 0; i < 4; i++) {
    c.save(); c.rotate(i * Math.PI / 2);
    c.strokeStyle = 'rgba(180,60,255,0.6)';
    c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(0, 10); c.lineTo(0, b.r * 0.75); c.stroke();
    c.fillStyle = '#aa44ff';
    c.beginPath(); c.arc(0, b.r * 0.7, 5, 0, Math.PI*2); c.fill();
    c.restore();
  }
  c.restore();
  c.fillStyle = '#cc00ff'; c.beginPath(); c.arc(0, 0, 12, 0, Math.PI*2); c.fill();
  c.fillStyle = '#440088'; c.beginPath(); c.arc(0, 0,  7, 0, Math.PI*2); c.fill();
  c.fillStyle = '#ff88ff'; c.beginPath(); c.arc(0, 0,  3, 0, Math.PI*2); c.fill();
  c.restore();
  c.globalAlpha = 1;
}

function drawBoss8(c, b, angle, timer) {
  const pulse = 0.85 + Math.sin(timer * 2.2) * 0.15;
  c.save();
  c.translate(b.x, b.y);
  const outerR = b.r * pulse;
  const outerGlow = c.createRadialGradient(0, 0, outerR * 0.5, 0, 0, outerR * 1.4);
  outerGlow.addColorStop(0, 'rgba(180,0,20,0.2)');
  outerGlow.addColorStop(1, 'rgba(80,0,10,0)');
  c.fillStyle = outerGlow;
  c.beginPath(); c.arc(0, 0, outerR * 1.4, 0, Math.PI*2); c.fill();
  c.beginPath();
  for (let a = 0; a < Math.PI * 2; a += 0.1) {
    const distort = 1 + Math.sin(a * 5 + timer) * 0.08;
    const rx = Math.cos(a) * outerR * distort;
    const ry = Math.sin(a) * outerR * distort;
    a === 0 ? c.moveTo(rx, ry) : c.lineTo(rx, ry);
  }
  c.closePath();
  c.fillStyle = '#550010'; c.fill();
  c.strokeStyle = '#bb0022'; c.lineWidth = 2; c.stroke();
  c.save(); c.rotate(-angle * 0.5);
  c.fillStyle = '#880022';
  c.beginPath(); c.arc(0, 0, b.r * 0.7, 0, Math.PI*2); c.fill();
  for (let i = 0; i < 6; i++) {
    c.save(); c.rotate(i * Math.PI / 3);
    c.fillStyle = '#aa0033';
    c.beginPath();
    c.moveTo(-4, b.r * 0.5); c.lineTo(0, b.r * 0.72); c.lineTo(4, b.r * 0.5);
    c.closePath(); c.fill();
    c.restore();
  }
  c.restore();
  const coreR = b.r * 0.4 * pulse;
  const coreGrad = c.createRadialGradient(0, 0, 2, 0, 0, coreR);
  coreGrad.addColorStop(0, '#ffffff'); coreGrad.addColorStop(0.4, '#ff4444'); coreGrad.addColorStop(1, '#880000');
  c.fillStyle = coreGrad;
  c.beginPath(); c.arc(0, 0, coreR, 0, Math.PI*2); c.fill();
  c.restore();
}

function mkEB(b, g, vx, vy, clr, r = 5, ox = 0) {
  g.enemyBullets.push({ x: b.x + ox, y: b.y, vx, vy, r, clr });
}

export function firePattern(name, b, g, opts) {
  const dx = g.player.x - b.x, dy = g.player.y - b.y;
  const d  = Math.sqrt(dx*dx + dy*dy) || 1;
  const spd = (opts.spdBase + g.bossPhase * opts.spdPhase) * g.diffMult;
  switch (name) {
    case 'aimSpread': {
      const { count, gap, clr } = opts;
      for (let i = -(count - 1) / 2; i <= (count - 1) / 2; i++) {
        const a = Math.atan2(dy, dx) + i * gap;
        mkEB(b, g, Math.cos(a) * spd, Math.sin(a) * spd, clr);
      }
      break;
    }
    case 'ring': {
      const { count, clr, spdF = 1 } = opts;
      for (let i = 0; i < count; i++) {
        const a = g.bossAngle + (i / count) * Math.PI * 2;
        mkEB(b, g, Math.cos(a) * spd * spdF, Math.sin(a) * spd * spdF, clr);
      }
      break;
    }
    case 'aimBurst': {
      opts.offsets.forEach(off => {
        const a = Math.atan2(dy, dx) + off;
        mkEB(b, g, Math.cos(a) * spd, Math.sin(a) * spd, opts.clr);
      });
      break;
    }
    case 'sideAlternate': {
      const side = Math.floor(g.bossTimer * 2) % 2 === 0 ? -1 : 1;
      const ox = side * (b.r + 14);
      const baseA = Math.atan2(dy, dx);
      for (let j = 0; j < 3; j++) {
        const a = baseA + (j - 1) * 0.08;
        mkEB(b, g, Math.cos(a) * spd, Math.sin(a) * spd, opts.clr || '#ff8800', 5, ox);
      }
      break;
    }
    case 'laserSweep': {
      const { count, halfSpan, clr, spdF = 1 } = opts;
      for (let i = 0; i < count; i++) {
        const a = g.bossAngle + (-halfSpan + (i / (count - 1)) * halfSpan * 2);
        mkEB(b, g, Math.cos(a) * spd * spdF, Math.sin(a) * spd * spdF, clr);
      }
      mkEB(b, g, dx / d * spd, dy / d * spd, '#ffff44');
      break;
    }
    case 'scatter': {
      const { count, clr, spdF = 1 } = opts;
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        mkEB(b, g, Math.cos(a) * spd * spdF, Math.sin(a) * spd * spdF, clr);
      }
      break;
    }
    case 'jitter': {
      mkEB(b, g, (Math.random() - 0.5) * 20, 12, opts.clr, 7);
      break;
    }
  }
}

export function fireBoss(g) {
  const b = g.boss;
  if (!g.player || g.player.dead || !b) return;
  if (!b.patterns?.length) return;
  const phasePatterns = b.patterns[g.bossPhase % b.patterns.length];
  const list = Array.isArray(phasePatterns) ? phasePatterns : [phasePatterns];
  list.forEach(p => firePattern(p.name, b, g, p));
}

export function updateBoss(dt, g) {
  if (!g.boss) return;
  g.bossTimer += dt;
  g.bossAngle += dt * 0.85;

  const dx = g.boss.targetX - g.boss.x, dy = g.boss.targetY - g.boss.y;
  const d  = Math.sqrt(dx*dx + dy*dy) || 1;
  if (d > 5) {
    g.boss.x += dx/d * g.boss.spd * dt;
    g.boss.y += dy/d * g.boss.spd * dt;
  } else {
    g.boss.targetX = 80 + Math.random() * (W - 160);
    g.boss.targetY = 60 + Math.random() * 140;
  }

  const hpPct = g.boss.hp / g.bossMaxHp;
  g.bossPhase = g.boss.phaseCount - 1 - Math.floor(hpPct * g.boss.phaseCount);
  g.bossPhase = Math.max(0, Math.min(g.boss.phaseCount - 1, g.bossPhase));

  if (g.boss.archetype === 7) {
    g.boss.phantomAlpha = 0.65 + Math.sin(g.bossTimer * 1.5) * 0.35;
  }

  if (g.boss.spawnMinions) {
    g.boss.minionTimer -= dt;
    if (g.boss.minionTimer <= 0) {
      spawnMinion(g);
      g.boss.minionTimer = 3.0 / g.diffMult;
    }
  }

  g.boss.fireTimer -= dt;
  if (g.boss.fireTimer <= 0) {
    fireBoss(g);
    const rate = [1.2, 0.85, 0.55, 0.38, 0.28][Math.min(g.bossPhase, 4)];
    g.boss.fireTimer = (rate / g.diffMult) + Math.random() * 0.25;
  }
}

export function spawnMinion(g) {
  const b = g.boss;
  if (!b) return;
  const e = mkEnemy(0, b.x + (Math.random()-0.5)*40, b.y + 20, null);
  e.spd = ENEMY_CFG[0].spd * g.diffMult * 1.2;
  g.enemies.push(e);
}

export function onBossDeath(g) {
  const bossStage = g.boss.stageNum || g.boss.num || 1;
  const explosionCount = 2 + Math.floor(bossStage * 0.5);
  spawnExplosion(g.boss.x,      g.boss.y,      6, '#ffaa00', g);
  spawnExplosion(g.boss.x + 35, g.boss.y - 25, 4, '#ff4400', g);
  spawnExplosion(g.boss.x - 35, g.boss.y + 15, 4, '#ffcc00', g);
  for (let i = 0; i < explosionCount - 3; i++) {
    const ox = (Math.random() - 0.5) * g.boss.r * 2;
    const oy = (Math.random() - 0.5) * g.boss.r * 2;
    spawnExplosion(g.boss.x + ox, g.boss.y + oy, 3, '#ff8800', g);
  }
  const bossScore = 5000 + bossStage * 2000;
  g.score += bossScore * g.loopMult;
  g.saveHS();
  g.boss = null;

  if (g.currentStage < STAGE_COUNT) {
    g.state = STATE.STAGECLEAR;
    g.stageClearTimer = 3.0;
  } else {
    if (g.loopMult === 1) {
      g.state = STATE.VICTORY;
      g.victoryTimer = 0;
    } else {
      g.loopMult++;
      g.startStage(1);
      g.state = STATE.PLAYING;
    }
  }
}

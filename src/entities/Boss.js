import { W, H, STATE, STAGE_COUNT } from '../config.js';
import { ctx } from '../canvas.js';
import { spawnExplosion } from '../core/particles.js';
import { mkEnemy, ENEMY_CFG } from './Enemy.js';
import { STAGES } from '../stages/stageData.js';

// === BOSS ===

// TEMPORARY (Phase A scaffolding; Task 24 removes these aliases and
// parameterizes drawBossN with explicit (ctx, boss, angle, timer)):
// Module-level aliases mirroring the shared boss draw state. drawBoss copies
// g.* into the aliases before dispatching so the drawBossN bodies below stay
// byte-identical to the source (they reference the bare names).
let boss = null, bossAngle = 0, bossTimer = 0;

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

export function drawBoss(g) {
  if (!g.boss) return;
  boss = g.boss; bossAngle = g.bossAngle; bossTimer = g.bossTimer;
  switch (boss.stageNum) {
    case 1: drawBoss1(); break;
    case 2: drawBoss2(); break;
    case 3: drawBoss3(); break;
    case 4: drawBoss4(); break;
    case 5: drawBoss5(); break;
    case 6: drawBoss6(); break;
    case 7: drawBoss7(); break;
    case 8: drawBoss8(); break;
  }
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

function drawBoss1() {
  ctx.save();
  ctx.translate(boss.x, boss.y);
  const grad = ctx.createRadialGradient(0, 0, 8, 0, 0, boss.r);
  grad.addColorStop(0, '#ff6622'); grad.addColorStop(0.5, '#882211'); grad.addColorStop(1, '#330800');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 0, boss.r, 0, Math.PI*2); ctx.fill();
  ctx.save(); ctx.rotate(bossAngle);
  for (let i = 0; i < 4; i++) {
    ctx.save(); ctx.rotate(i * Math.PI/2);
    ctx.fillStyle = '#bb3300';
    ctx.fillRect(-4, 0, 8, boss.r * 0.88);
    ctx.fillStyle = '#ff7700';
    ctx.beginPath(); ctx.arc(0, boss.r * 0.82, 9, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  ctx.fillStyle = '#ffff00'; ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ff0000'; ctx.beginPath(); ctx.arc(0, 0,  8, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#000';    ctx.beginPath(); ctx.arc(0, 0,  3, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawBoss2() {
  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.fillStyle = '#334455';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 - Math.PI / 6;
    i === 0 ? ctx.moveTo(Math.cos(a)*boss.r, Math.sin(a)*boss.r)
            : ctx.lineTo(Math.cos(a)*boss.r, Math.sin(a)*boss.r);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#8899bb'; ctx.lineWidth = 2; ctx.stroke();
  ctx.save(); ctx.rotate(bossAngle * 0.6);
  for (let i = 0; i < 6; i++) {
    ctx.save(); ctx.rotate(i * Math.PI / 3);
    ctx.fillStyle = '#5566aa';
    ctx.fillRect(-5, 0, 10, boss.r * 0.9);
    ctx.fillStyle = '#aabbff';
    ctx.beginPath(); ctx.arc(0, boss.r * 0.85, 8, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  ctx.fillStyle = '#2244ff'; ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#88aaff'; ctx.beginPath(); ctx.arc(0, 0,  8, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0,  3, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawBoss3() {
  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.fillStyle = '#443300';
  ctx.fillRect(-boss.r, -boss.r * 0.6, boss.r * 2, boss.r * 1.2);
  ctx.strokeStyle = '#aa6600'; ctx.lineWidth = 2;
  ctx.strokeRect(-boss.r, -boss.r * 0.6, boss.r * 2, boss.r * 1.2);
  ctx.fillStyle = '#664400';
  ctx.fillRect(-boss.r - 22, -8, 22, 16);
  ctx.fillStyle = '#aa7700';
  ctx.fillRect(-boss.r - 28, -5, 8, 10);
  ctx.fillStyle = '#664400';
  ctx.fillRect(boss.r, -8, 22, 16);
  ctx.fillStyle = '#aa7700';
  ctx.fillRect(boss.r + 20, -5, 8, 10);
  ctx.strokeStyle = '#ffaa00'; ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath(); ctx.moveTo(i * boss.r * 0.55, -boss.r * 0.6);
    ctx.lineTo(i * boss.r * 0.55, -boss.r * 0.6 - 12); ctx.stroke();
  }
  ctx.fillStyle = '#ffcc00'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ff4400'; ctx.beginPath(); ctx.arc(0, 0,  7, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawBoss4() {
  ctx.save();
  ctx.translate(boss.x, boss.y);
  const grad = ctx.createRadialGradient(0, 0, 4, 0, 0, boss.r);
  grad.addColorStop(0, '#44aa44'); grad.addColorStop(0.6, '#226622'); grad.addColorStop(1, '#112211');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 0, boss.r, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#66ee44'; ctx.lineWidth = 2; ctx.stroke();
  ctx.save(); ctx.rotate(bossAngle * 0.4);
  for (let i = 0; i < 4; i++) {
    ctx.save(); ctx.rotate(i * Math.PI / 2);
    ctx.fillStyle = '#88cc22';
    ctx.beginPath();
    ctx.moveTo(0, boss.r); ctx.lineTo(6, boss.r + 16);
    ctx.lineTo(0, boss.r + 24); ctx.lineTo(-6, boss.r + 16);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  ctx.fillStyle = '#ccff00'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#446600'; ctx.beginPath(); ctx.arc(0, 0,  6, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawBoss5() {
  ctx.save();
  ctx.translate(boss.x, boss.y);
  const glow = ctx.createRadialGradient(0, 0, boss.r * 0.5, 0, 0, boss.r * 1.8);
  glow.addColorStop(0, 'rgba(255,200,0,0.3)');
  glow.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, boss.r * 1.8, 0, Math.PI*2); ctx.fill();
  ctx.save(); ctx.rotate(bossAngle * 0.7);
  for (let i = 0; i < 8; i++) {
    ctx.save(); ctx.rotate(i * Math.PI / 4);
    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.moveTo(-5, boss.r * 0.8); ctx.lineTo(0, boss.r * 1.5); ctx.lineTo(5, boss.r * 0.8);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  const solarGrad = ctx.createRadialGradient(-8, -8, 4, 0, 0, boss.r);
  solarGrad.addColorStop(0, '#ffffff'); solarGrad.addColorStop(0.3, '#ffee44');
  solarGrad.addColorStop(0.8, '#ff8800'); solarGrad.addColorStop(1, '#cc2200');
  ctx.fillStyle = solarGrad;
  ctx.beginPath(); ctx.arc(0, 0, boss.r, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#cc4400'; ctx.beginPath(); ctx.arc(8, -6, 7, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#882200'; ctx.beginPath(); ctx.arc(8, -6, 4, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawBoss6() {
  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.fillStyle = '#223344';
  ctx.fillRect(-boss.r, -boss.r * 0.7, boss.r * 2, boss.r * 1.4);
  ctx.strokeStyle = '#334466'; ctx.lineWidth = 2;
  for (let row = -1; row <= 1; row++) {
    ctx.beginPath();
    ctx.moveTo(-boss.r + 4, row * boss.r * 0.3);
    ctx.lineTo( boss.r - 4, row * boss.r * 0.3);
    ctx.stroke();
  }
  ctx.fillStyle = '#112233';
  ctx.fillRect(-boss.r - 20, -15, 20, 30);
  ctx.strokeStyle = '#4466aa'; ctx.lineWidth = 1;
  ctx.strokeRect(-boss.r - 20, -15, 20, 30);
  ctx.fillStyle = '#112233';
  ctx.fillRect(boss.r, -15, 20, 30);
  ctx.strokeRect(boss.r, -15, 20, 30);
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#334455';
    ctx.beginPath(); ctx.arc(side * boss.r * 0.6, boss.r * 0.5, 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#6688aa';
    ctx.beginPath(); ctx.arc(side * boss.r * 0.6, boss.r * 0.5, 5, 0, Math.PI*2); ctx.fill();
  }
  ctx.fillStyle = '#4455aa'; ctx.fillRect(-18, -boss.r * 0.7 - 14, 36, 14);
  ctx.fillStyle = '#00ccff'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, 0,  5, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawBoss7() {
  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.globalAlpha = boss.phantomAlpha;
  ctx.fillStyle = '#220044';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 - Math.PI / 8;
    i === 0 ? ctx.moveTo(Math.cos(a)*boss.r, Math.sin(a)*boss.r)
            : ctx.lineTo(Math.cos(a)*boss.r, Math.sin(a)*boss.r);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#9933ff'; ctx.lineWidth = 2; ctx.stroke();
  ctx.save(); ctx.rotate(-bossAngle * 1.2);
  for (let i = 0; i < 4; i++) {
    ctx.save(); ctx.rotate(i * Math.PI / 2);
    ctx.strokeStyle = 'rgba(180,60,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, boss.r * 0.75); ctx.stroke();
    ctx.fillStyle = '#aa44ff';
    ctx.beginPath(); ctx.arc(0, boss.r * 0.7, 5, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  ctx.fillStyle = '#cc00ff'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#440088'; ctx.beginPath(); ctx.arc(0, 0,  7, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ff88ff'; ctx.beginPath(); ctx.arc(0, 0,  3, 0, Math.PI*2); ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawBoss8() {
  const pulse = 0.85 + Math.sin(bossTimer * 2.2) * 0.15;
  ctx.save();
  ctx.translate(boss.x, boss.y);
  const outerR = boss.r * pulse;
  const outerGlow = ctx.createRadialGradient(0, 0, outerR * 0.5, 0, 0, outerR * 1.4);
  outerGlow.addColorStop(0, 'rgba(180,0,20,0.2)');
  outerGlow.addColorStop(1, 'rgba(80,0,10,0)');
  ctx.fillStyle = outerGlow;
  ctx.beginPath(); ctx.arc(0, 0, outerR * 1.4, 0, Math.PI*2); ctx.fill();
  ctx.beginPath();
  for (let a = 0; a < Math.PI * 2; a += 0.1) {
    const distort = 1 + Math.sin(a * 5 + bossTimer) * 0.08;
    const rx = Math.cos(a) * outerR * distort;
    const ry = Math.sin(a) * outerR * distort;
    a === 0 ? ctx.moveTo(rx, ry) : ctx.lineTo(rx, ry);
  }
  ctx.closePath();
  ctx.fillStyle = '#550010'; ctx.fill();
  ctx.strokeStyle = '#bb0022'; ctx.lineWidth = 2; ctx.stroke();
  ctx.save(); ctx.rotate(-bossAngle * 0.5);
  ctx.fillStyle = '#880022';
  ctx.beginPath(); ctx.arc(0, 0, boss.r * 0.7, 0, Math.PI*2); ctx.fill();
  for (let i = 0; i < 6; i++) {
    ctx.save(); ctx.rotate(i * Math.PI / 3);
    ctx.fillStyle = '#aa0033';
    ctx.beginPath();
    ctx.moveTo(-4, boss.r * 0.5); ctx.lineTo(0, boss.r * 0.72); ctx.lineTo(4, boss.r * 0.5);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  const coreR = boss.r * 0.4 * pulse;
  const coreGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, coreR);
  coreGrad.addColorStop(0, '#ffffff'); coreGrad.addColorStop(0.4, '#ff4444'); coreGrad.addColorStop(1, '#880000');
  ctx.fillStyle = coreGrad;
  ctx.beginPath(); ctx.arc(0, 0, coreR, 0, Math.PI*2); ctx.fill();
  ctx.restore();
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

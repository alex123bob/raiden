import { W } from '../config.js';
import { mkEnemy } from '../entities/Enemy.js';
import { createBoss } from '../entities/Boss.js'; // Task 14

// === WAVE TABLES ===
// Path functions return {x, y} given elapsed time t (seconds)

export function pathDown(sx, sy, spd) {
  return t => ({ x: sx, y: sy + t * spd });
}

export function pathSin(sx, sy, spd, amp, freq) {
  return t => ({ x: sx + Math.sin(t * freq) * amp, y: sy + t * spd });
}

// Formation: N ships evenly spaced horizontally, centered on cx
export function pathFormation(cx, sy, spd, idx, total) {
  const offset = (idx - (total - 1) / 2) * 36;
  return t => ({ x: cx + offset, y: sy + t * spd });
}

// Returns array of spawn entries sorted by trigger time t
export function buildWaveTable(stage, diffMult) {
  const entries = [];
  const add = obj => entries.push(obj);

  switch (stage) {
    case 1: {
      const fS = 105 * diffMult, bS = 62 * diffMult;
      for (let i = 0; i < 5; i++)
        add({ t: 0.5 + i*0.28, type: 0, path: pathFormation(W/2, -20, fS, i, 5) });
      add({ t: 3.5, type: 1, path: pathDown(W*0.25, -30, bS) });
      add({ t: 3.5, type: 1, path: pathDown(W*0.75, -30, bS) });
      for (let i = 0; i < 4; i++)
        add({ t: 5.5 + i*0.35, type: 0, path: pathSin(W*0.18 + i*90, -20, fS*0.9, 45, 1.6) });
      add({ t: 8, type: 3, x: 80,  y: 290 });
      add({ t: 8, type: 3, x: 240, y: 240 });
      add({ t: 8, type: 3, x: 400, y: 290 });
      add({ t: 10, type: 2, path: pathDown(W/2, -40, 44 * diffMult) });
      for (let i = 0; i < 6; i++)
        add({ t: 12 + i*0.22, type: 0, path: pathFormation(W/2, -20, fS*1.15, i, 6) });
      add({ t: 14, type: 1, path: pathSin(W*0.5, -30, bS, 65, 1.9) });
      for (let i = 0; i < 3; i++)
        add({ t: 17 + i*1.4, type: 1, path: pathDown(80 + i*160, -30, bS) });
      add({ t: 20, type: 3, x: 150, y: 200 });
      add({ t: 20, type: 3, x: 330, y: 215 });
      add({ t: 22, type: 2, path: pathDown(W*0.33, -40, 40*diffMult) });
      add({ t: 22, type: 2, path: pathDown(W*0.67, -40, 40*diffMult) });
      for (let i = 0; i < 8; i++)
        add({ t: 26 + i*0.18, type: 0, path: pathFormation(W/2, -20, fS*1.3, i, 8) });
      add({ t: 30, boss: 1 });
      break;
    }
    case 2: {
      const fS = 145 * diffMult, bS = 88 * diffMult;
      for (let i = 0; i < 5; i++)
        add({ t: 0.5 + i*0.28, type: 0, path: pathFormation(W/2, -20, fS, i, 5) });
      add({ t: 3.5, type: 1, path: pathDown(W*0.25, -30, bS) });
      add({ t: 3.5, type: 1, path: pathDown(W*0.75, -30, bS) });
      for (let i = 0; i < 4; i++)
        add({ t: 5.5 + i*0.35, type: 0, path: pathSin(W*0.18 + i*90, -20, fS*0.9, 45, 1.6) });
      add({ t: 8, type: 3, x: 80,  y: 290 });
      add({ t: 8, type: 3, x: 240, y: 240 });
      add({ t: 8, type: 3, x: 400, y: 290 });
      add({ t: 10, type: 2, path: pathDown(W/2, -40, 44 * diffMult) });
      for (let i = 0; i < 6; i++)
        add({ t: 12 + i*0.22, type: 0, path: pathFormation(W/2, -20, fS*1.15, i, 6) });
      add({ t: 14, type: 1, path: pathSin(W*0.5, -30, bS, 65, 1.9) });
      for (let i = 0; i < 3; i++)
        add({ t: 17 + i*1.4, type: 1, path: pathDown(80 + i*160, -30, bS) });
      add({ t: 20, type: 3, x: 150, y: 200 });
      add({ t: 20, type: 3, x: 330, y: 215 });
      add({ t: 22, type: 2, path: pathDown(W*0.33, -40, 40*diffMult) });
      add({ t: 22, type: 2, path: pathDown(W*0.67, -40, 40*diffMult) });
      for (let i = 0; i < 8; i++)
        add({ t: 26 + i*0.18, type: 0, path: pathFormation(W/2, -20, fS*1.3, i, 8) });
      add({ t: 30, boss: 2 });
      break;
    }
    case 3: {
      const fS = 160 * diffMult, bS = 95 * diffMult;
      for (let i = 0; i < 6; i++)
        add({ t: 0.5 + i*0.20, type: 0, path: pathFormation(W/2, -20, fS, i, 6) });
      add({ t: 2.5, type: 1, path: pathDown(W*0.20, -30, bS) });
      add({ t: 2.5, type: 1, path: pathDown(W*0.80, -30, bS) });
      for (let i = 0; i < 6; i++)
        add({ t: 3.0 + i*0.18, type: 0, path: pathSin(W*0.15 + i*60, -20, fS*0.85, 38, 2.0) });
      add({ t: 4.0, type: 1, path: pathDown(W*0.35, -30, bS) });
      add({ t: 4.0, type: 1, path: pathDown(W*0.65, -30, bS) });
      for (let i = 0; i < 6; i++)
        add({ t: 6.0 + i*0.18, type: 0, path: pathFormation(W/2, -20, fS*1.1, i, 6) });
      add({ t: 7.0, type: 1, path: pathSin(W*0.3, -30, bS, 55, 1.6) });
      add({ t: 7.0, type: 1, path: pathSin(W*0.7, -30, bS, 55, 1.6) });
      add({ t: 10, type: 3, x: 120, y: 260 });
      add({ t: 10, type: 3, x: 240, y: 220 });
      add({ t: 10, type: 3, x: 360, y: 260 });
      for (let i = 0; i < 8; i++)
        add({ t: 17 + i*0.15, type: 0, path: pathFormation(W/2, -20, fS*1.2, i, 8) });
      add({ t: 25, boss: 3 });
      break;
    }
    case 4: {
      const fS = 130 * diffMult, bS = 80 * diffMult;
      add({ t: 2, type: 3, x: 100, y: 280 });
      add({ t: 2, type: 3, x: 240, y: 250 });
      add({ t: 2, type: 3, x: 380, y: 280 });
      add({ t: 2.5, type: 3, x: 170, y: 310 });
      add({ t: 5, type: 2, path: pathDown(W*0.5, -40, 40*diffMult) });
      for (let i = 0; i < 5; i++)
        add({ t: 7 + i*0.25, type: 0, path: pathFormation(W/2, -20, fS, i, 5) });
      add({ t: 8, type: 3, x: 80,  y: 240 });
      add({ t: 8, type: 3, x: 200, y: 210 });
      add({ t: 8, type: 3, x: 320, y: 210 });
      add({ t: 8, type: 3, x: 440, y: 240 });
      add({ t: 11, type: 2, path: pathDown(W*0.3, -40, 36*diffMult) });
      add({ t: 11.5, type: 2, path: pathDown(W*0.7, -40, 36*diffMult) });
      for (let i = 0; i < 6; i++)
        add({ t: 13 + i*0.22, type: 0, path: pathSin(W*0.15 + i*60, -20, fS*0.9, 40, 1.8) });
      add({ t: 15, type: 3, x: 140, y: 270 });
      add({ t: 15, type: 3, x: 240, y: 230 });
      add({ t: 15, type: 3, x: 340, y: 270 });
      add({ t: 15.5, type: 3, x: 80, y: 310 });
      add({ t: 18, type: 2, path: pathDown(W*0.5, -40, 38*diffMult) });
      for (let i = 0; i < 7; i++)
        add({ t: 23 + i*0.18, type: 0, path: pathFormation(W/2, -20, fS*1.2, i, 7) });
      add({ t: 28, boss: 4 });
      break;
    }
    case 5: {
      const fS = 175 * diffMult, bS = 105 * diffMult;
      for (let i = 0; i < 8; i++)
        add({ t: 0.5 + i*0.15, type: 0, path: pathFormation(W/2, -20, fS, i, 8) });
      add({ t: 3.0, type: 1, path: pathDown(W*0.25, -30, bS) });
      add({ t: 3.0, type: 1, path: pathDown(W*0.75, -30, bS) });
      for (let i = 0; i < 8; i++)
        add({ t: 4.0 + i*0.14, type: 0, path: pathSin(W*0.1 + i*55, -20, fS*0.9, 35, 2.2) });
      add({ t: 7.0, type: 1, path: pathDown(W*0.3, -30, bS*1.1) });
      add({ t: 7.0, type: 1, path: pathDown(W*0.7, -30, bS*1.1) });
      for (let i = 0; i < 8; i++)
        add({ t: 8.0 + i*0.14, type: 0, path: pathFormation(W/2, -20, fS*1.1, i, 8) });
      add({ t: 11, type: 1, path: pathSin(W*0.4, -30, bS, 50, 1.7) });
      add({ t: 11, type: 1, path: pathSin(W*0.6, -30, bS, 50, 1.7) });
      add({ t: 11.0, type: 1, path: pathDown(W*0.2, -30, bS*1.2) });
      add({ t: 11.0, type: 1, path: pathDown(W*0.8, -30, bS*1.2) });
      for (let i = 0; i < 8; i++)
        add({ t: 12.0 + i*0.14, type: 0, path: pathSin(W*0.1 + i*55, -20, fS*1.1, 40, 2.0) });
      add({ t: 14, type: 2, path: pathDown(W*0.35, -40, 45*diffMult) });
      add({ t: 14, type: 2, path: pathDown(W*0.65, -40, 45*diffMult) });
      for (let i = 0; i < 8; i++)
        add({ t: 21 + i*0.12, type: 0, path: pathFormation(W/2, -20, fS*1.3, i, 8) });
      add({ t: 26, boss: 5 });
      break;
    }
    case 6: {
      const fS = 130 * diffMult, bS = 90 * diffMult;
      for (let i = 0; i < 3; i++)
        add({ t: 1 + i*0.7, type: 1, path: pathDown(W*0.25, -30, bS) });
      for (let i = 0; i < 3; i++)
        add({ t: 2 + i*0.7, type: 1, path: pathDown(W*0.75, -30, bS) });
      add({ t: 7, type: 2, path: pathDown(W*0.5, -40, 42*diffMult) });
      for (let i = 0; i < 3; i++)
        add({ t: 5 + i*0.6, type: 1, path: pathDown(W*0.40, -30, bS*1.1) });
      for (let i = 0; i < 3; i++)
        add({ t: 6 + i*0.6, type: 1, path: pathDown(W*0.60, -30, bS*1.1) });
      add({ t: 10, type: 3, x: 160, y: 230 });
      add({ t: 10, type: 3, x: 320, y: 230 });
      add({ t: 12, type: 2, path: pathDown(W*0.3, -40, 40*diffMult) });
      add({ t: 12.5, type: 2, path: pathDown(W*0.7, -40, 40*diffMult) });
      for (let i = 0; i < 5; i++)
        add({ t: 9 + i*0.25, type: 0, path: pathFormation(W/2, -20, fS, i, 5) });
      for (let i = 0; i < 3; i++)
        add({ t: 13 + i*0.5, type: 1, path: pathSin(W*0.35, -30, bS, 45, 1.5) });
      add({ t: 17, type: 2, path: pathDown(W*0.5, -40, 38*diffMult) });
      for (let i = 0; i < 4; i++)
        add({ t: 22 + i*0.5, type: 1, path: pathFormation(W/2, -30, bS*1.2, i, 4) });
      add({ t: 28, boss: 6 });
      break;
    }
    case 7: {
      const fS = 190 * diffMult, bS = 110 * diffMult;
      for (let i = 0; i < 8; i++)
        add({ t: 0.5 + i*0.13, type: 0, path: pathFormation(W/2, -20, fS, i, 8) });
      add({ t: 2.0, type: 1, path: pathDown(W*0.2, -30, bS) });
      add({ t: 2.0, type: 1, path: pathDown(W*0.8, -30, bS) });
      add({ t: 3, type: 3, x: 100, y: 250 });
      add({ t: 3, type: 3, x: 240, y: 210 });
      add({ t: 3, type: 3, x: 380, y: 250 });
      for (let i = 0; i < 6; i++)
        add({ t: 4.0 + i*0.16, type: 0, path: pathSin(W*0.1 + i*65, -20, fS*0.9, 38, 2.0) });
      add({ t: 5.0, type: 1, path: pathSin(W*0.5, -30, bS, 60, 1.8) });
      add({ t: 6, type: 2, path: pathDown(W*0.4, -40, 50*diffMult) });
      add({ t: 6, type: 2, path: pathDown(W*0.6, -40, 50*diffMult) });
      add({ t: 8, type: 3, x: 80,  y: 270 });
      add({ t: 8, type: 3, x: 200, y: 240 });
      add({ t: 8, type: 3, x: 320, y: 240 });
      add({ t: 8, type: 3, x: 440, y: 270 });
      for (let i = 0; i < 8; i++)
        add({ t: 10 + i*0.12, type: 0, path: pathFormation(W/2, -20, fS*1.15, i, 8) });
      for (let i = 0; i < 3; i++)
        add({ t: 12 + i*0.6, type: 1, path: pathDown(W*0.3, -30, bS*1.1) });
      for (let i = 0; i < 3; i++)
        add({ t: 12 + i*0.6, type: 1, path: pathDown(W*0.7, -30, bS*1.1) });
      add({ t: 14, type: 2, path: pathDown(W*0.5, -40, 48*diffMult) });
      add({ t: 16, type: 3, x: 120, y: 260 });
      add({ t: 16, type: 3, x: 240, y: 225 });
      add({ t: 16, type: 3, x: 360, y: 260 });
      for (let i = 0; i < 8; i++)
        add({ t: 22 + i*0.12, type: 0, path: pathFormation(W/2, -20, fS*1.2, i, 8) });
      for (let i = 0; i < 3; i++)
        add({ t: 23 + i*0.5, type: 1, path: pathDown(80 + i*160, -30, bS*1.2) });
      add({ t: 30, boss: 7 });
      break;
    }
    case 8: {
      const fS = 200 * diffMult, bS = 115 * diffMult;
      const addElite = obj => entries.push({ ...obj, eliteHp: true });
      for (let i = 0; i < 8; i++)
        addElite({ t: 0.5 + i*0.12, type: 0, path: pathFormation(W/2, -20, fS, i, 8) });
      for (let i = 0; i < 4; i++)
        addElite({ t: 2 + i*0.5, type: 1, path: pathDown(W*0.25, -30, bS) });
      for (let i = 0; i < 4; i++)
        addElite({ t: 2 + i*0.5, type: 1, path: pathDown(W*0.75, -30, bS) });
      addElite({ t: 4, type: 3, x: 80,  y: 280 });
      addElite({ t: 4, type: 3, x: 200, y: 240 });
      addElite({ t: 4, type: 3, x: 320, y: 240 });
      addElite({ t: 4, type: 3, x: 440, y: 280 });
      addElite({ t: 6, type: 2, path: pathDown(W*0.33, -40, 52*diffMult) });
      addElite({ t: 6.5, type: 2, path: pathDown(W*0.67, -40, 52*diffMult) });
      for (let i = 0; i < 8; i++)
        addElite({ t: 8 + i*0.12, type: 0, path: pathSin(W*0.1 + i*55, -20, fS*0.95, 35, 2.2) });
      addElite({ t: 11, type: 3, x: 120, y: 260 });
      addElite({ t: 11, type: 3, x: 240, y: 220 });
      addElite({ t: 11, type: 3, x: 360, y: 260 });
      for (let i = 0; i < 4; i++)
        addElite({ t: 12 + i*0.4, type: 1, path: pathDown(W*0.4, -30, bS*1.1) });
      for (let i = 0; i < 4; i++)
        addElite({ t: 12 + i*0.4, type: 1, path: pathDown(W*0.6, -30, bS*1.1) });
      addElite({ t: 16, type: 2, path: pathDown(W*0.2, -40, 48*diffMult) });
      addElite({ t: 16, type: 2, path: pathDown(W*0.5, -40, 48*diffMult) });
      addElite({ t: 16, type: 2, path: pathDown(W*0.8, -40, 48*diffMult) });
      addElite({ t: 19, type: 3, x: 100, y: 270 });
      addElite({ t: 19, type: 3, x: 240, y: 235 });
      addElite({ t: 19, type: 3, x: 380, y: 270 });
      for (let i = 0; i < 8; i++)
        addElite({ t: 25 + i*0.11, type: 0, path: pathFormation(W/2, -20, fS*1.2, i, 8) });
      for (let i = 0; i < 4; i++)
        addElite({ t: 26 + i*0.4, type: 1, path: pathFormation(W/2, -30, bS*1.2, i, 4) });
      add({ t: 32, boss: 8 });
      break;
    }
    default: break;
  }

  return entries.sort((a, b) => a.t - b.t);
}

export function updateWaves(dt, g) {
  if (g.boss) return; // don't advance wave clock while boss is alive
  g.stageTimer += dt;

  while (g.waveIndex < g.waveTable.length) {
    const entry = g.waveTable[g.waveIndex];
    if (g.stageTimer < entry.t) break;
    g.waveIndex++;

    if (entry.boss) {
      // [ARCADE] Boss spawns only after all regular enemies are cleared
      // Force-clear any remaining enemies (turrets may never scroll off)
      g.enemies.length = 0;
      g.enemyBullets.length = 0;
      g.boss = createBoss(entry.boss, g);
      g.bossSpawned = true;
    } else if (entry.type === 3) {
      const e = mkEnemy(3, entry.x, entry.y, null);
      if (entry.eliteHp) e.hp = Math.ceil(e.hp * 1.5);
      g.enemies.push(e);
    } else {
      const e = mkEnemy(entry.type, 0, 0, entry.path);
      if (entry.path) { const p0 = entry.path(0); e.x = p0.x; e.y = p0.y; }
      if (entry.eliteHp) e.hp = Math.ceil(e.hp * 1.5);
      g.enemies.push(e);
    }
  }
}

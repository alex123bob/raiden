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

// Descriptor path: ['down', sx, sy, spd] | ['sin', sx, sy, spd, amp, freq] | ['form', cx, sy, spd, idx, total]
// spd is the raw factor; waveGen multiplies by diffMult (matches the old X*diffMult constants).
function expandPath(desc, diffMult) {
  const kind = desc[0];
  const spd = desc[3] * diffMult;
  switch (kind) {
    case 'down': return pathDown(desc[1], desc[2], spd);
    case 'sin':  return pathSin(desc[1], desc[2], spd, desc[4], desc[5]);
    case 'form': return pathFormation(desc[1], desc[2], spd, desc[4], desc[5]);
    default: throw new Error('unknown path kind: ' + kind);
  }
}

// Returns array of spawn entries sorted by trigger time t
export function buildWaveTable(stageDef, diffMult) {
  const entries = [];
  for (const d of stageDef.waves) {
    if (d.boss) {
      entries.push({ t: d.t, boss: d.boss });
    } else if (d.type === 3) {
      entries.push({ t: d.t, type: 3, x: d.x, y: d.y, ...(d.elite ? { eliteHp: true } : {}) });
    } else {
      entries.push({ t: d.t, type: d.type, path: expandPath(d.path, diffMult), ...(d.elite ? { eliteHp: true } : {}) });
    }
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

import { Enemy, type PathFn } from '../entities/Enemy.js';
import { createBoss } from '../entities/Boss.js';
import { ENEMY_TYPES } from '../registries/enemies/index.js';
import type { GameContext } from '../core/GameContext.js';

export function pathDown(sx: number, sy: number, spd: number): PathFn {
  return t => ({ x: sx, y: sy + t * spd });
}

export function pathSin(sx: number, sy: number, spd: number, amp: number, freq: number): PathFn {
  return t => ({ x: sx + Math.sin(t * freq) * amp, y: sy + t * spd });
}

export function pathFormation(cx: number, sy: number, spd: number, idx: number, total: number): PathFn {
  const offset = (idx - (total - 1) / 2) * 36;
  return t => ({ x: cx + offset, y: sy + t * spd });
}

// Motion registry: descriptor -> path builder (generalizes the old expandPath switch).
export const MOTION = new Map<string, (desc: number[], diffMult: number) => PathFn>();
export function registerMotion(kind: string, builder: (desc: number[], diffMult: number) => PathFn): void {
  MOTION.set(kind, builder);
}
registerMotion('down', (desc, diffMult) => pathDown(desc[1], desc[2], desc[3] * diffMult));
registerMotion('sin',  (desc, diffMult) => pathSin(desc[1], desc[2], desc[3] * diffMult, desc[4], desc[5]));
registerMotion('form', (desc, diffMult) => pathFormation(desc[1], desc[2], desc[3] * diffMult, desc[4], desc[5]));

interface WaveDescriptor {
  t: number;
  boss?: number;
  type?: string;
  x?: number;
  y?: number;
  path?: number[];
  elite?: boolean;
}

function expandPath(desc: number[], diffMult: number): PathFn {
  if (!Array.isArray(desc) || desc.length < 4) throw new Error('bad path descriptor: ' + JSON.stringify(desc));
  const builder = MOTION.get(desc[0]);
  if (!builder) throw new Error('unknown path kind: ' + desc[0]);
  return builder(desc, diffMult);
}

export interface WaveEntry {
  t: number;
  boss?: number;
  type?: string;
  x?: number;
  y?: number;
  path?: PathFn | null;
  eliteHp?: boolean;
}

export function buildWaveTable(stageDef: { waves: WaveDescriptor[] }, diffMult: number): WaveEntry[] {
  const entries: WaveEntry[] = [];
  for (const d of stageDef.waves) {
    if (d.boss) {
      entries.push({ t: d.t, boss: d.boss });
    } else if (d.type === 'turret') {
      entries.push({ t: d.t, type: d.type, x: d.x, y: d.y, ...(d.elite ? { eliteHp: true } : {}) });
    } else {
      entries.push({ t: d.t, type: d.type, path: expandPath(d.path!, diffMult), ...(d.elite ? { eliteHp: true } : {}) });
    }
  }
  return entries.sort((a, b) => a.t - b.t);
}

export function updateWaves(dt: number, ctx: GameContext): void {
  if (ctx.boss) return;
  ctx.stageTimer += dt;

  const waveTable = (ctx as GameContext & { waveTable: WaveEntry[] }).waveTable;
  while (ctx.waveIndex < waveTable.length) {
    const entry = waveTable[ctx.waveIndex];
    if (ctx.stageTimer < entry.t) break;
    ctx.waveIndex++;

    if (entry.boss) {
      ctx.enemies.length = 0;
      ctx.enemyBullets.length = 0;
      ctx.boss = createBoss(ctx);
      ctx.bossSpawned = true;
    } else if (entry.type === 'turret') {
      const e = new Enemy(ENEMY_TYPES.get('turret')!, entry.x ?? 0, entry.y ?? 0, null, ctx);
      if (entry.eliteHp) e.hp = Math.ceil(e.hp * 1.5);
      ctx.enemies.push(e);
    } else {
      const e = new Enemy(ENEMY_TYPES.get(entry.type!)!, 0, 0, entry.path ?? null, ctx);
      if (entry.path) { const p0 = entry.path(0); e.x = p0.x; e.y = p0.y; }
      if (entry.eliteHp) e.hp = Math.ceil(e.hp * 1.5);
      ctx.enemies.push(e);
    }
  }
}

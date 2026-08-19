import type { GameContext } from '../../core/GameContext.js';
import type { Boss } from '../../entities/Boss.js';
import { spawnEnemyBullet } from '../../entities/Bullet.js';
import { makeRegistry } from '../../core/registry.js';

export interface PatternOpts {
  spdBase: number;
  spdPhase: number;
  count?: number;
  gap?: number;
  clr?: string;
  offsets?: number[];
  halfSpan?: number;
  spdF?: number;
}

export interface BulletPattern {
  readonly key: string;
  fire(boss: Boss, ctx: GameContext, opts: PatternOpts): void;
}

export const BULLET_PATTERNS = makeRegistry<BulletPattern>();
export const registerBulletPattern = BULLET_PATTERNS.register;

function speedFor(boss: Boss, ctx: GameContext, opts: PatternOpts): { dx: number; dy: number; d: number; spd: number } {
  const dx = ctx.player!.x - boss.x, dy = ctx.player!.y - boss.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  return { dx, dy, d, spd: (opts.spdBase + ctx.bossPhase * opts.spdPhase) * ctx.diffMult };
}

registerBulletPattern({
  key: 'aimSpread',
  fire(boss, ctx, opts) {
    const { dx, dy, d, spd } = speedFor(boss, ctx, opts);
    const { count = 0, gap = 0, clr = '#ff4444' } = opts;
    for (let i = -(count - 1) / 2; i <= (count - 1) / 2; i++) {
      const a = Math.atan2(dy, dx) + i * gap;
      spawnEnemyBullet(ctx, boss.x, boss.y, Math.cos(a) * spd, Math.sin(a) * spd, clr);
    }
  },
});

registerBulletPattern({
  key: 'ring',
  fire(boss, ctx, opts) {
    const { spd, spdF = 1 } = speedFor(boss, ctx, opts);
    const { count = 0, clr = '#ff4444' } = opts;
    for (let i = 0; i < count; i++) {
      const a = ctx.bossAngle + (i / count) * Math.PI * 2;
      spawnEnemyBullet(ctx, boss.x, boss.y, Math.cos(a) * spd * spdF, Math.sin(a) * spd * spdF, clr);
    }
  },
});

registerBulletPattern({
  key: 'aimBurst',
  fire(boss, ctx, opts) {
    const { dx, dy, spd } = speedFor(boss, ctx, opts);
    (opts.offsets ?? []).forEach(off => {
      const a = Math.atan2(dy, dx) + off;
      spawnEnemyBullet(ctx, boss.x, boss.y, Math.cos(a) * spd, Math.sin(a) * spd, opts.clr ?? '#ff8800');
    });
  },
});

registerBulletPattern({
  key: 'sideAlternate',
  fire(boss, ctx, opts) {
    const { dx, dy, spd } = speedFor(boss, ctx, opts);
    const side = Math.floor(ctx.bossTimer * 2) % 2 === 0 ? -1 : 1;
    const ox = side * (boss.r + 14);
    const baseA = Math.atan2(dy, dx);
    for (let j = 0; j < 3; j++) {
      const a = baseA + (j - 1) * 0.08;
      spawnEnemyBullet(ctx, boss.x + ox, boss.y, Math.cos(a) * spd, Math.sin(a) * spd, opts.clr || '#ff8800', 5);
    }
  },
});

registerBulletPattern({
  key: 'laserSweep',
  fire(boss, ctx, opts) {
    const { dx, dy, d, spd, spdF = 1 } = speedFor(boss, ctx, opts);
    const { count = 0, halfSpan = 0, clr = '#ff8800' } = opts;
    for (let i = 0; i < count; i++) {
      const a = ctx.bossAngle + (-halfSpan + (i / (count - 1)) * halfSpan * 2);
      spawnEnemyBullet(ctx, boss.x, boss.y, Math.cos(a) * spd * spdF, Math.sin(a) * spd * spdF, clr);
    }
    spawnEnemyBullet(ctx, boss.x, boss.y, (dx / d) * spd, (dy / d) * spd, '#ffff44');
  },
});

registerBulletPattern({
  key: 'scatter',
  fire(boss, ctx, opts) {
    const { spd, spdF = 1 } = speedFor(boss, ctx, opts);
    const { count = 0, clr = '#ff8800' } = opts;
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      spawnEnemyBullet(ctx, boss.x, boss.y, Math.cos(a) * spd * spdF, Math.sin(a) * spd * spdF, clr);
    }
  },
});

registerBulletPattern({
  key: 'jitter',
  fire(boss, ctx, opts) {
    spawnEnemyBullet(ctx, boss.x, boss.y, (Math.random() - 0.5) * 20, 12, opts.clr ?? '#ff4444', 7);
  },
});

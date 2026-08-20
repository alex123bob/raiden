import type { Enemy } from '../../entities/Enemy.js';
import type { GameContext } from '../../core/GameContext.js';

// Follow the path function, or scroll straight down.
/**
 * Shared EnemyType.movement implementation used by fighter/gunship/bomber:
 * if the enemy has a path, advance along it (pathT accumulates elapsed
 * seconds); otherwise fall straight down at spd, scaled by diffMult.
 */
export function movePathOrDown(e: Enemy, dt: number, ctx: GameContext): void {
  if (e.path) {
    e.pathT += dt;
    const pos = e.path(e.pathT);
    e.x = pos.x; e.y = pos.y;
  } else {
    e.y += e.spd * ctx.diffMult * dt;
  }
}

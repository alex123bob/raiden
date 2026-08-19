import type { GameContext } from './GameContext.js';
import type { RenderContext } from './Renderer.js';

export abstract class Entity {
  x: number;
  y: number;
  r: number;
  alive = true;
  constructor(x = 0, y = 0, r = 0) { this.x = x; this.y = y; this.r = r; }
  abstract update(dt: number, ctx: GameContext): void;
  abstract draw(rc: RenderContext, ctx: GameContext): void;
}

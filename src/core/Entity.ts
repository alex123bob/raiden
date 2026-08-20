import type { GameContext } from './GameContext.js';
import type { RenderContext } from './Renderer.js';

/**
 * Base class for every in-world object (player, enemies, bullets, powerups,
 * particles). Holds the shared spatial state and the per-frame update/draw
 * contract; concrete subclasses supply the behavior.
 */
export abstract class Entity {
  x: number;              // center X in canvas px (0..480), origin top-left, +x right
  y: number;              // center Y in canvas px (0..640), origin top-left, +y down
  r: number;              // collision/draw radius in px (used for circle-vs-circle hits)
  /** Liveness flag; owning array culls the entity once this goes false. */
  alive = true;
  constructor(x = 0, y = 0, r = 0) { this.x = x; this.y = y; this.r = r; }
  /** Advance one frame. dt is delta-time in SECONDS; ctx is the shared game state. */
  abstract update(dt: number, ctx: GameContext): void;
  /** Render this frame via the abstract RenderContext (no direct canvas access). */
  abstract draw(rc: RenderContext, ctx: GameContext): void;
}

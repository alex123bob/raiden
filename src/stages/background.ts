import { W, H } from '../config.js';
import type { GameContext } from '../core/GameContext.js';
import type { RenderContext } from '../core/Renderer.js';
import { STAGES } from './stageData.js';
import { BG_FEATURES } from '../registries/background/index.js';

/**
 * One kind of parallax background layer (rocks/clouds/bubbles/…), held in the
 * BG_FEATURES registry. Behavior is stateless template code; per-instance
 * particle state is created by build() and threaded back through update/render.
 */
export interface BgFeature {
  /** Registry key, e.g. 'stars' | 'rocks' | 'clouds' | 'walls'. */
  readonly key: string;
  /** Create this feature's opaque particle state (returns whatever the feature needs). */
  build(): unknown;
  /** Advance the layer's particles by `dt` seconds (scroll, wobble, wrap). */
  update(state: unknown, dt: number, ctx: GameContext): void;
  /** Draw the layer given its state. */
  render(rc: RenderContext, state: unknown, ctx: GameContext): void;
}

/**
 * A live instance of a background feature for the current stage: pairs a shared
 * BgFeature `def` (behavior) with its own mutable particle `state`.
 */
export class BackgroundFeature {
  /** Opaque per-instance particle state produced by def.build(). */
  state: unknown;
  constructor(public readonly def: BgFeature, _stage: number) {
    this.state = def.build();
  }
  /** Step this feature's particles for the frame. */
  update(dt: number, ctx: GameContext): void { this.def.update(this.state, dt, ctx); }
  /** Render this feature's particles for the frame. */
  draw(rc: RenderContext, ctx: GameContext): void { this.def.render(rc, this.state, ctx); }
}

// Stars are a singleton feature: always present, tinted per-stage in drawBackground.
/** Lazy lookup of the shared stars feature def from the registry. */
const starsDef = () => BG_FEATURES.get('stars')!;
/** The single, persistent star-field state, reused across all stages. */
const starsState = starsDef().build();

/** Advance the always-on star field by `dt` seconds. */
export function updateStars(dt: number, ctx: GameContext): void {
  starsDef().update(starsState, dt, ctx);
}

/** Draw the always-on star field (untinted, e.g. for menus). */
export function drawStars(rc: RenderContext, ctx: GameContext): void {
  starsDef().render(rc, starsState, ctx);
}

/** Feature instances active for the current stage (stars excluded — see above). */
let activeFeatures: BackgroundFeature[] = [];

/**
 * Rebuild the active feature list for `stage` from its stageData bg.features.
 * Clamps the 1-based stage to a valid index; skips (with a warning) any key
 * not found in the registry so an unknown feature can't crash the stage.
 */
export function initBackground(stage: number, _ctx: GameContext): void {
  const stageDef = STAGES[Math.max(0, Math.min(STAGES.length - 1, stage - 1))]; // clamp 1-based → index
  const featKeys = stageDef.bg.features || [];
  activeFeatures = featKeys.flatMap(k => {
    const def = BG_FEATURES.get(k);
    if (!def) { console.warn('unknown background feature: ' + k); return []; } // defensive: skip unknown
    return [new BackgroundFeature(def, stage)];
  });
}

/** Step every active stage feature for the frame. */
export function updateBackground(dt: number, ctx: GameContext): void {
  activeFeatures.forEach(f => f.update(dt, ctx));
}

/**
 * Paint the full background for the frame: flat base fill, then the per-stage
 * tinted star field, then each active parallax feature (painter's order).
 */
export function drawBackground(rc: RenderContext, ctx: GameContext): void {
  const cfg = STAGES[Math.max(0, Math.min(STAGES.length - 1, ctx.currentStage - 1))].bg; // clamp → index
  rc.fillStyle = cfg.baseFill;
  rc.fillRect(0, 0, W, H);

  if (cfg.starColor) {
    // Temporarily apply the stage's star tint, render, then clear it so the
    // shared star state stays untinted for any other caller (e.g. drawStars).
    (starsState as { tint: unknown }).tint = cfg.starColor;
    starsDef().render(rc, starsState, ctx);
    (starsState as { tint: unknown }).tint = null;
  }

  activeFeatures.forEach(f => f.draw(rc, ctx));
}

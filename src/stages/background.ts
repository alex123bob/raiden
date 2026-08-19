import { W, H } from '../config.js';
import type { GameContext } from '../core/GameContext.js';
import type { RenderContext } from '../core/Renderer.js';
import { STAGES } from './stageData.js';
import { BG_FEATURES } from '../registries/background/index.js';

export interface BgFeature {
  readonly key: string;
  build(): unknown;
  update(state: unknown, dt: number, ctx: GameContext): void;
  render(rc: RenderContext, state: unknown, ctx: GameContext): void;
}

export class BackgroundFeature {
  state: unknown;
  constructor(public readonly def: BgFeature, _stage: number) {
    this.state = def.build();
  }
  update(dt: number, ctx: GameContext): void { this.def.update(this.state, dt, ctx); }
  draw(rc: RenderContext, ctx: GameContext): void { this.def.render(rc, this.state, ctx); }
}

// Stars are a singleton feature: always present, tinted per-stage in drawBackground.
const starsDef = () => BG_FEATURES.get('stars')!;
const starsState = starsDef().build();

export function updateStars(dt: number, ctx: GameContext): void {
  starsDef().update(starsState, dt, ctx);
}

export function drawStars(rc: RenderContext, ctx: GameContext): void {
  starsDef().render(rc, starsState, ctx);
}

let activeFeatures: BackgroundFeature[] = [];

export function initBackground(stage: number, _ctx: GameContext): void {
  const stageDef = STAGES[Math.max(0, Math.min(STAGES.length - 1, stage - 1))];
  const featKeys = stageDef.bg.features || [];
  activeFeatures = featKeys.map(k => new BackgroundFeature(BG_FEATURES.get(k)!, stage));
}

export function updateBackground(dt: number, ctx: GameContext): void {
  activeFeatures.forEach(f => f.update(dt, ctx));
}

export function drawBackground(rc: RenderContext, ctx: GameContext): void {
  const cfg = STAGES[Math.max(0, Math.min(STAGES.length - 1, ctx.currentStage - 1))].bg;
  rc.fillStyle = cfg.baseFill;
  rc.fillRect(0, 0, W, H);

  if (cfg.starColor) {
    (starsState as { tint: unknown }).tint = cfg.starColor;
    starsDef().render(rc, starsState, ctx);
    (starsState as { tint: unknown }).tint = null;
  }

  activeFeatures.forEach(f => f.draw(rc, ctx));
}

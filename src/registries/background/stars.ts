import { W, H } from '../../config.js';
import type { BgFeature } from '../../stages/background.js';

/** One star point, in world/screen coordinates (no parallax offset stored — belongs to a StarLayer). */
interface Star { x: number; y: number; }
/** One parallax depth layer: its own stars, scroll speed, dot size, and default (untinted) color. */
interface StarLayer { stars: Star[]; speed: number; size: number; color: string; }
/** Full star-field state: the 3 depth layers plus an optional per-stage tint override (see drawBackground). */
interface StarState { layers: StarLayer[]; tint: [string, string, string] | null; }

/**
 * Stars — the always-on background layer (see background.ts's starsState
 * singleton). Three depth layers of 60 stars each, scrolling straight down
 * at increasing speed/size for a simple parallax effect. `tint` lets the
 * per-stage background override the layer colors without touching state.
 */
export const stars: BgFeature = {
  key: 'stars',
  build(): StarState {
    const layers: StarLayer[] = [
      { stars: [], speed: 60,  size: 1.0, color: 'rgba(255,255,255,0.4)' },   // far/dim/slow
      { stars: [], speed: 120, size: 1.5, color: 'rgba(255,255,255,0.7)' },   // mid
      { stars: [], speed: 200, size: 2.0, color: 'rgba(200,220,255,1.0)' },   // near/bright/fast
    ];
    layers.forEach(layer => {
      for (let i = 0; i < 60; i++) layer.stars.push({ x: Math.random() * W, y: Math.random() * H });
    });
    return { layers, tint: null };
  },
  update(state, dt) {
    const s = state as StarState;
    s.layers.forEach(layer => {
      layer.stars.forEach(star => {
        star.y += layer.speed * dt;
        if (star.y > H) { star.y = 0; star.x = Math.random() * W; }   // wrap to the top at a random x
      });
    });
  },
  render(rc, state) {
    const s = state as StarState;
    s.layers.forEach((layer, i) => {
      rc.fillStyle = s.tint ? s.tint[i] : layer.color;   // tint (if set) overrides this layer's default color
      layer.stars.forEach(star => rc.fillRect(star.x, star.y, layer.size, layer.size));
    });
  },
};

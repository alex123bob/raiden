import { W, H } from '../../config.js';
import type { BgFeature } from '../../stages/background.js';

interface Star { x: number; y: number; }
interface StarLayer { stars: Star[]; speed: number; size: number; color: string; }
interface StarState { layers: StarLayer[]; tint: [string, string, string] | null; }

export const stars: BgFeature = {
  key: 'stars',
  build(): StarState {
    const layers: StarLayer[] = [
      { stars: [], speed: 60,  size: 1.0, color: 'rgba(255,255,255,0.4)' },
      { stars: [], speed: 120, size: 1.5, color: 'rgba(255,255,255,0.7)' },
      { stars: [], speed: 200, size: 2.0, color: 'rgba(200,220,255,1.0)' },
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
        if (star.y > H) { star.y = 0; star.x = Math.random() * W; }
      });
    });
  },
  render(rc, state) {
    const s = state as StarState;
    s.layers.forEach((layer, i) => {
      rc.fillStyle = s.tint ? s.tint[i] : layer.color;
      layer.stars.forEach(star => rc.fillRect(star.x, star.y, layer.size, layer.size));
    });
  },
};

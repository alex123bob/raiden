import { describe, it, expect } from 'vitest';
import { BG_FEATURES } from '../src/registries/background/index.js';
import { CanvasRenderer, type RenderContext } from '../src/core/Renderer.js';
import { noopCtx } from './dom-setup.js';
import { stubContext } from './context-stub.js';
import { initBackground, updateBackground, drawBackground, drawStars } from '../src/stages/background.js';

const ALL_KEYS = ['rocks', 'clouds', 'bubbles', 'streaks', 'hulls', 'wisps', 'walls', 'stars'];

describe('background features', () => {
  const rc: RenderContext = new CanvasRenderer(noopCtx);

  it('registers all eight features', () => {
    expect(BG_FEATURES.all().map(k => k.key).sort()).toEqual([...ALL_KEYS].sort());
  });

  it('every feature builds, updates, and renders without throwing', () => {
    const g = stubContext({ currentStage: 8 });   // walls stage (reads stageTimer)
    for (const key of ALL_KEYS) {
      const def = BG_FEATURES.get(key)!;
      const state = def.build();
      expect(state).toBeDefined();
      expect(() => def.update(state, 1 / 60, g), key).not.toThrow();
      expect(() => def.render(rc, state, g), key).not.toThrow();
    }
  });

  it('initBackground/updateBackground/drawBackground work for every stage', () => {
    for (let s = 1; s <= 18; s++) {
      const g = stubContext({ currentStage: s });
      initBackground(s, g);
      updateBackground(1 / 60, g);
      expect(() => drawBackground(rc, g), `stage ${s}`).not.toThrow();
    }
  });

  it('drawStars works after drawBackground on a tinted stage (tint does not leak)', () => {
    const g = stubContext({ currentStage: 2 });   // stage 2 has starColor + rocks
    drawBackground(rc, g);
    expect(() => drawStars(rc, g)).not.toThrow();
  });
});

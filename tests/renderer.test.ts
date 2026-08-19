import { describe, it, expect } from 'vitest';
import { CanvasRenderer, type RenderContext } from '../src/core/Renderer.js';
import { noopCtx } from './dom-setup.js';

function makeSpyContext() {
  const calls: string[] = [];
  const c = new Proxy({}, {
    get(t, prop) {
      if (prop in t) return (t as Record<PropertyKey, unknown>)[prop];
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient')
        return () => ({ addColorStop() {} });
      return (..._args: unknown[]) => { calls.push(String(prop)); return undefined; };
    },
    set(t, prop, value) { calls.push('set:' + String(prop)); return true; },
  }) as unknown as CanvasRenderingContext2D;
  return { calls, c };
}

describe('CanvasRenderer', () => {
  it('forwards drawing calls to the underlying context', () => {
    const { calls, c } = makeSpyContext();
    const rc: RenderContext = new CanvasRenderer(c);
    rc.fillStyle = '#fff';
    rc.fillRect(1, 2, 3, 4);
    rc.beginPath();
    expect(calls).toContain('set:fillStyle');
    expect(calls).toContain('fillRect');
    expect(calls).toContain('beginPath');
  });

  it('withTint on an untinted def translates, draws, and restores', () => {
    const { calls, c } = makeSpyContext();
    const rc: RenderContext = new CanvasRenderer(c);
    let drew = false;
    rc.withTint(null, 50, 100, 200, () => { drew = true; });
    expect(drew).toBe(true);
    expect(calls).toEqual(['save', 'translate', 'restore']);
  });

  it('withTint on a tinted def blits through drawImage without throwing', () => {
    const rc: RenderContext = new CanvasRenderer(noopCtx);
    expect(() => rc.withTint('#ff0000', 50, 100, 200, () => {})).not.toThrow();
  });
});

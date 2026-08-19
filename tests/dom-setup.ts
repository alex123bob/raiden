// Minimal browser-DOM stub so module-graph imports (which pull in canvas.js)
// can evaluate in vitest's node environment. Runs before every test file.
const gradient = { addColorStop() {} };
const ctxStub = new Proxy({}, {
  get(t, prop) {
    if (prop in t) return (t as Record<PropertyKey, unknown>)[prop];
    if (prop === 'createRadialGradient' || prop === 'createLinearGradient')
      return () => gradient;
    if (prop === 'canvas') return {};
    return typeof prop === 'string' ? (() => {}) : undefined;
  },
  set() { return true; },
});

export const noopCtx = ctxStub as unknown as CanvasRenderingContext2D;

const canvasEl = {
  width: 0, height: 0,
  style: {},
  getContext: () => ctxStub,
  addEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 640 }),
};

(globalThis as unknown as { document: unknown }).document = {
  getElementById: (id: string) => (id === 'c' ? canvasEl : null),
  createElement: () => canvasEl,
  addEventListener() {},
};
(globalThis as unknown as { window: unknown }).window = {
  innerWidth: 1024, innerHeight: 768,
  addEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  AudioContext: undefined,
};
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
(globalThis as unknown as { localStorage: unknown }).localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
let rafCb: ((ts: number) => void) | null = null;
globalThis.requestAnimationFrame = (cb: (ts: number) => void) => { rafCb = cb; return 1; };
globalThis.cancelAnimationFrame = () => {};

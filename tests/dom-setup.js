// Minimal browser-DOM stub so module-graph imports (which pull in canvas.js)
// can evaluate in vitest's node environment. Runs before every test file.
const gradient = { addColorStop() {} };
const ctxStub = new Proxy({}, {
  get(t, prop) {
    if (prop in t) return t[prop];
    if (prop === 'createRadialGradient' || prop === 'createLinearGradient')
      return () => gradient;
    if (prop === 'canvas') return {};
    return typeof prop === 'string' ? (() => {}) : undefined;
  },
  set() { return true; },
});

const canvasEl = {
  width: 0, height: 0,
  style: {},
  getContext: () => ctxStub,
  addEventListener() {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 480, height: 640 }),
};

globalThis.document = {
  getElementById: (id) => (id === 'c' ? canvasEl : null),
  addEventListener() {},
};
globalThis.window = {
  innerWidth: 1024, innerHeight: 768,
  addEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  AudioContext: undefined,
};
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
let rafCb = null;
globalThis.requestAnimationFrame = (cb) => { rafCb = cb; return 1; };
globalThis.cancelAnimationFrame = () => {};

import { W, H } from './config.js';

/** The single `<canvas id="c">` element the game renders into. */
export const canvas = document.getElementById('c') as HTMLCanvasElement;
/** Shared 2D drawing context for the canvas; all rendering goes through this. */
export const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
// Fix the backing-store resolution to the logical playfield size (see config.ts).
canvas.width = W;
canvas.height = H;

/**
 * Scale the canvas's CSS size to fit the window while preserving aspect ratio.
 * Only the display size changes — the drawing resolution stays W×H — so game
 * coordinates are unaffected. Called on load and on every window resize.
 */
export function resize() {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H); // largest uniform fit
  canvas.style.width  = (W * scale) + 'px';
  canvas.style.height = (H * scale) + 'px';
}
window.addEventListener('resize', resize);
resize();

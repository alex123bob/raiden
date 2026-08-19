import { W, H } from './config.js';

export const canvas = document.getElementById('c') as HTMLCanvasElement;
export const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
canvas.width = W;
canvas.height = H;

export function resize() {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  canvas.style.width  = (W * scale) + 'px';
  canvas.style.height = (H * scale) + 'px';
}
window.addEventListener('resize', resize);
resize();

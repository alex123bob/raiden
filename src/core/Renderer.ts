/**
 * Abstract drawing surface used by every entity's draw() method. It mirrors the
 * subset of CanvasRenderingContext2D the game needs, plus the `withTint` helper,
 * so rendering can be swapped/stubbed (e.g. headless tests) without touching a
 * real canvas. Coordinates are canvas px (origin top-left, +y down); angles are
 * radians. Methods forward 1:1 to the underlying context unless noted.
 */
export interface RenderContext {
  /**
   * Draw `drawLocal` translated to world point (bx,by). When `tint` is set, the
   * shape is rendered to an offscreen buffer and recolored to `tint` (used for
   * hit-flash / damage flashes); `radius` sizes that buffer. tint=null draws
   * straight to the main canvas with no recolor.
   */
  withTint(tint: string | null, radius: number, bx: number, by: number,
          drawLocal: (c: CanvasRenderingContext2D) => void): void;
  save(): void;                                   // push canvas state (transform, styles)
  restore(): void;                                // pop canvas state
  translate(x: number, y: number): void;          // move origin by (x,y) px
  rotate(angle: number): void;                    // rotate coord system by `angle` radians
  beginPath(): void;                              // start a new path
  moveTo(x: number, y: number): void;             // move path cursor without drawing
  lineTo(x: number, y: number): void;             // add a line segment to (x,y)
  closePath(): void;                              // close current subpath back to start
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;  // circular arc, angles in radians
  ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number,
          startAngle: number, endAngle: number): void;   // elliptical arc, angles/rotation in radians
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;  // cubic Bézier to (x,y)
  fill(): void;                                   // fill current path with fillStyle
  stroke(): void;                                 // stroke current path with strokeStyle
  fillRect(x: number, y: number, w: number, h: number): void;    // filled rectangle
  strokeRect(x: number, y: number, w: number, h: number): void;  // outlined rectangle
  drawImage(img: CanvasImageSource, dx: number, dy: number): void;  // blit image at (dx,dy)
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradient;  // radial gradient between two circles
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient;  // linear gradient from (x0,y0) to (x1,y1)
  fillText(text: string, x: number, y: number): void;  // draw text at (x,y) using font/textAlign
  fillStyle: string | CanvasGradient | CanvasPattern;   // current fill paint
  strokeStyle: string | CanvasGradient | CanvasPattern; // current stroke paint
  lineWidth: number;                              // stroke width in px
  globalAlpha: number;                            // global opacity 0..1
  shadowColor: string;                            // glow/shadow color (CSS color)
  shadowBlur: number;                             // glow/shadow blur radius in px
  font: string;                                   // CSS font shorthand for fillText
  textAlign: CanvasTextAlign;                     // horizontal text anchor
  textBaseline: CanvasTextBaseline;               // vertical text anchor
}

/**
 * Concrete RenderContext backed by a real 2D canvas. Most methods delegate
 * straight to the wrapped CanvasRenderingContext2D; the only real logic is
 * `withTint`, which reuses a lazily-created offscreen canvas for recoloring.
 */
export class CanvasRenderer implements RenderContext {
  private offCanvas: HTMLCanvasElement | null = null;  // reused offscreen buffer for tinting; null until first use
  private offSize = 0;                                  // current side length (px) of offCanvas; drives re-alloc
  constructor(private readonly c: CanvasRenderingContext2D) {}  // wrapped real 2D context
  withTint(tint: string | null, radius: number, bx: number, by: number,
           drawLocal: (c: CanvasRenderingContext2D) => void): void {
    if (!tint) {
      // Fast path: no recolor — draw directly at (bx,by).
      this.c.save(); this.c.translate(bx, by); drawLocal(this.c); this.c.restore();
      return;
    }
    const R = Math.ceil(radius * 2.0) + 8;   // half-size of buffer: generous margin around the shape
    const size = R * 2;                      // full offscreen buffer side length in px
    if (!this.offCanvas) this.offCanvas = document.createElement('canvas');
    // Only resize (and clear intrinsic pixels) when the required size changes.
    if (this.offSize !== size) { this.offCanvas.width = this.offCanvas.height = size; this.offSize = size; }
    const oc = this.offCanvas.getContext('2d')!;
    oc.setTransform(1, 0, 0, 1, 0, 0);       // reset any prior transform
    oc.clearRect(0, 0, size, size);
    oc.save(); oc.translate(R, R); drawLocal(oc); oc.restore();  // draw shape centered in buffer
    oc.globalCompositeOperation = 'source-atop';  // recolor only where the shape already painted
    oc.fillStyle = tint;
    oc.fillRect(0, 0, size, size);
    oc.globalCompositeOperation = 'source-over';  // restore default for next use
    this.c.drawImage(this.offCanvas, bx - R, by - R);  // blit tinted shape back, centered on (bx,by)
  }
  save(): void { this.c.save(); }
  restore(): void { this.c.restore(); }
  translate(x: number, y: number): void { this.c.translate(x, y); }
  rotate(a: number): void { this.c.rotate(a); }
  beginPath(): void { this.c.beginPath(); }
  moveTo(x: number, y: number): void { this.c.moveTo(x, y); }
  lineTo(x: number, y: number): void { this.c.lineTo(x, y); }
  closePath(): void { this.c.closePath(); }
  arc(x: number, y: number, r: number, s: number, e: number): void { this.c.arc(x, y, r, s, e); }
  ellipse(x: number, y: number, rx: number, ry: number, rot: number, s: number, e: number): void { this.c.ellipse(x, y, rx, ry, rot, s, e); }
  bezierCurveTo(a: number, b: number, c2: number, d: number, e: number, f: number): void { this.c.bezierCurveTo(a, b, c2, d, e, f); }
  fill(): void { this.c.fill(); }
  stroke(): void { this.c.stroke(); }
  fillRect(x: number, y: number, w: number, h: number): void { this.c.fillRect(x, y, w, h); }
  strokeRect(x: number, y: number, w: number, h: number): void { this.c.strokeRect(x, y, w, h); }
  drawImage(img: CanvasImageSource, dx: number, dy: number): void { this.c.drawImage(img, dx, dy); }
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradient { return this.c.createRadialGradient(x0, y0, r0, x1, y1, r1); }
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient { return this.c.createLinearGradient(x0, y0, x1, y1); }
  fillText(t: string, x: number, y: number): void { this.c.fillText(t, x, y); }
  get fillStyle() { return this.c.fillStyle; }
  set fillStyle(v: string | CanvasGradient | CanvasPattern) { this.c.fillStyle = v; }
  get strokeStyle() { return this.c.strokeStyle; }
  set strokeStyle(v: string | CanvasGradient | CanvasPattern) { this.c.strokeStyle = v; }
  get lineWidth() { return this.c.lineWidth; }
  set lineWidth(v: number) { this.c.lineWidth = v; }
  get globalAlpha() { return this.c.globalAlpha; }
  set globalAlpha(v: number) { this.c.globalAlpha = v; }
  get shadowColor() { return this.c.shadowColor; }
  set shadowColor(v: string) { this.c.shadowColor = v; }
  get shadowBlur() { return this.c.shadowBlur; }
  set shadowBlur(v: number) { this.c.shadowBlur = v; }
  get font() { return this.c.font; }
  set font(v: string) { this.c.font = v; }
  get textAlign() { return this.c.textAlign; }
  set textAlign(v: CanvasTextAlign) { this.c.textAlign = v; }
  get textBaseline() { return this.c.textBaseline; }
  set textBaseline(v: CanvasTextBaseline) { this.c.textBaseline = v; }
}

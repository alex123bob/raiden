export interface RenderContext {
  withTint(tint: string | null, radius: number, bx: number, by: number,
          drawLocal: (c: CanvasRenderingContext2D) => void): void;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number,
          startAngle: number, endAngle: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  fill(): void;
  stroke(): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  drawImage(img: CanvasImageSource, dx: number, dy: number): void;
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradient;
  createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient;
  fillText(text: string, x: number, y: number): void;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  globalAlpha: number;
  shadowColor: string;
  shadowBlur: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
}

export class CanvasRenderer implements RenderContext {
  private offCanvas: HTMLCanvasElement | null = null;
  private offSize = 0;
  constructor(private readonly c: CanvasRenderingContext2D) {}
  withTint(tint: string | null, radius: number, bx: number, by: number,
           drawLocal: (c: CanvasRenderingContext2D) => void): void {
    if (!tint) {
      this.c.save(); this.c.translate(bx, by); drawLocal(this.c); this.c.restore();
      return;
    }
    const R = Math.ceil(radius * 2.0) + 8;
    const size = R * 2;
    if (!this.offCanvas) this.offCanvas = document.createElement('canvas');
    if (this.offSize !== size) { this.offCanvas.width = this.offCanvas.height = size; this.offSize = size; }
    const oc = this.offCanvas.getContext('2d')!;
    oc.setTransform(1, 0, 0, 1, 0, 0);
    oc.clearRect(0, 0, size, size);
    oc.save(); oc.translate(R, R); drawLocal(oc); oc.restore();
    oc.globalCompositeOperation = 'source-atop';
    oc.fillStyle = tint;
    oc.fillRect(0, 0, size, size);
    oc.globalCompositeOperation = 'source-over';
    this.c.drawImage(this.offCanvas, bx - R, by - R);
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

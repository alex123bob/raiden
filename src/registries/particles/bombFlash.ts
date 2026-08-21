import { W, H } from '../../config.js';
import { Particle, type ParticleKind } from '../../entities/Particle.js';

// A crack is a jagged polyline radiating from the origin, plus optional forks.
/** One jagged crack line radiating from the bomb's origin, plus any branching forks off its midpoints. */
interface Crack { pts: { x: number; y: number }[]; forks: { x: number; y: number }[][]; width: number; }
/** Per-instance state stashed in Particle.data: the origin point and the precomputed crack geometry. */
interface BombData { ox: number; oy: number; cracks: Crack[]; }

const DUR = 0.85;   // total lifetime in seconds (life 1 -> 0 at decay 1/DUR)

/**
 * Precompute a fixed set of jagged crack lines radiating from (ox,oy), each
 * with a random reach/segment-count and a chance of branching forks partway
 * along. Called once at spawn (not every frame) — the result is stored on
 * Particle.data and just drawn incrementally by render().
 */
function buildCracks(ox: number, oy: number): Crack[] {
  const maxReach = Math.hypot(W, H);   // longest a crack could need to span the screen
  const count = 22;
  const cracks: Crack[] = [];
  for (let i = 0; i < count; i++) {
    const baseAngle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;   // evenly spaced + jitter
    const reach = maxReach * (0.6 + Math.random() * 0.5);
    const segs = 6 + Math.floor(Math.random() * 4);
    const pts = [{ x: ox, y: oy }];
    let a = baseAngle;
    for (let s = 1; s <= segs; s++) {
      a += (Math.random() - 0.5) * 0.5;   // jagged wander
      const d = (reach / segs) * s;
      pts.push({ x: ox + Math.cos(a) * d, y: oy + Math.sin(a) * d });
    }
    // A couple of forks branching off mid-crack.
    const forks: { x: number; y: number }[][] = [];
    const forkCount = Math.random() < 0.7 ? 1 + Math.floor(Math.random() * 2) : 0;
    for (let f = 0; f < forkCount; f++) {
      const startIdx = 2 + Math.floor(Math.random() * (pts.length - 3));   // branch from an interior point
      const start = pts[startIdx];
      let fa = a + (Math.random() - 0.5) * 1.6;   // fork angle diverges from the main crack's final direction
      const fpts = [{ x: start.x, y: start.y }];
      const flen = reach * (0.2 + Math.random() * 0.25);   // forks are shorter than the main crack
      const fsegs = 3 + Math.floor(Math.random() * 3);
      for (let s = 1; s <= fsegs; s++) {
        fa += (Math.random() - 0.5) * 0.6;
        const d = (flen / fsegs) * s;
        fpts.push({ x: start.x + Math.cos(fa) * d, y: start.y + Math.sin(fa) * d });
      }
      forks.push(fpts);
    }
    cracks.push({ pts, forks, width: 0.7 + Math.random() * 1.3 });
  }
  return cracks;
}

/**
 * Bomb flash — the "screen cracks" effect triggered when the player uses a
 * bomb. A single long-lived (DUR=0.85s) particle drives three overlapping
 * phases via its `life`/`decay`: (1) a blinding full-screen white/gold flash
 * over the first ~35%, (2) an expanding golden shockwave ring out to ~55%,
 * and (3) 22 jagged cracks (with forks) that draw in progressively, hold,
 * then fade over the final 30%. Also triggers a screen shake on spawn.
 */
export const bombFlash: ParticleKind = {
  key: 'bombFlash',
  spawn(ctx, x, y) {
    const ox = x || W / 2;   // falsy x/y (e.g. legacy callers passing 0,0) recenters on screen middle
    const oy = y || H / 2;
    const p = new Particle(bombFlash, ox, oy);
    p.life = 1.0;
    p.decay = 1 / DUR;
    p.data = { ox, oy, cracks: buildCracks(ox, oy) } as BombData;   // geometry computed once at spawn
    ctx.particles.push(p);
    ctx.shake(14, 0.5);
  },
  update() {},   // purely time-driven; all visual state is computed in render() from p.life
  render(rc, p) {
    const d = p.data as BombData;
    const t = 1 - p.life;   // 0 -> 1 over the effect's life

    // 1) Blinding white/gold flash, decays over the first ~35% of the effect.
    const flash = Math.max(0, 1 - t / 0.35);
    if (flash > 0) {
      rc.fillStyle = `rgba(255,255,235,${flash * 0.9})`;
      rc.fillRect(0, 0, W, H);
    }

    // 2) Expanding shockwave ring sweeping outward from the origin.
    const ringT = Math.min(1, t / 0.55);
    if (ringT < 1) {
      const maxR = Math.hypot(W, H) * 0.75;
      const rr = maxR * ringT;
      rc.save();
      rc.globalAlpha = (1 - ringT) * 0.8;
      rc.strokeStyle = '#ffee99';
      rc.lineWidth = 6 * (1 - ringT) + 2;
      rc.beginPath(); rc.arc(d.ox, d.oy, rr, 0, Math.PI * 2); rc.stroke();
      // Thin white inner ring, slightly inside the main ring.
      rc.globalAlpha = (1 - ringT) * 0.5;
      rc.strokeStyle = '#ffffff';
      rc.lineWidth = 2;
      rc.beginPath(); rc.arc(d.ox, d.oy, rr * 0.82, 0, Math.PI * 2); rc.stroke();
      rc.restore();
    }

    // 3) Screen cracks: draw in progressively from the origin, hold, then fade.
    const grow = Math.min(1, t / 0.25);           // fraction of each crack revealed
    const crackAlpha = t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3);   // holds fully visible until 70%, then fades
    if (crackAlpha > 0) {
      rc.save();
      rc.shadowColor = '#cceeff';
      rc.shadowBlur = 8;
      // Draw only the leading `grow` fraction of a polyline's points, at `alpha`/`w`.
      const drawPath = (pts: { x: number; y: number }[], w: number, alpha: number) => {
        const last = Math.max(1, Math.floor((pts.length - 1) * grow));
        rc.lineWidth = w;
        rc.globalAlpha = alpha;
        rc.beginPath();
        rc.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i <= last && i < pts.length; i++) rc.lineTo(pts[i].x, pts[i].y);
        rc.stroke();
      };
      d.cracks.forEach(c => {
        // Layered white core + blue mid-line for a glassy fracture look, plus lighter forks.
        rc.strokeStyle = '#ffffff';
        drawPath(c.pts, c.width, crackAlpha);
        rc.strokeStyle = '#88ccff';
        drawPath(c.pts, c.width * 0.4, crackAlpha * 0.9);
        c.forks.forEach(f => {
          rc.strokeStyle = '#cceeff';
          drawPath(f, c.width * 0.6, crackAlpha * 0.8);
        });
      });
      rc.restore();
      rc.globalAlpha = 1;
      rc.shadowBlur = 0;
      rc.shadowColor = 'transparent';
    }
  },
};

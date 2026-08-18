# Plan 04 — Stage Backgrounds (8 Distinct Themes)

**Date:** 2026-08-18  
**Goal:** Replace single starfield with 8 unique per-stage backgrounds. Each stage gets a base fill color and scrolling theme elements drawn procedurally.  
**Architecture:** Single-file `index.html`. New BACKGROUNDS section inserted after STARFIELD. Render loop updated.  
**Tech Stack:** Vanilla JS, HTML5 Canvas 2D API.  
**Builds on:** Plans 01–03 (weapon system). Plan 05 adds stages 3–8 wave tables but both plans can be developed in parallel since they touch different sections.  
**Required by:** Plan 05 (calls `initBackground` from `startStage`).

---

## Step 1 — Add `STAGE_BG` config array

Add immediately after the `STAR_LAYERS` / `initStars` block (after the closing `})();` of `initStars`, around line ~214):

```js
// === STAGE BACKGROUNDS ===
// Per-stage background configuration
const STAGE_BG = [
  // Stage 1 — Deep Space
  { baseFill: '#020208', starColor: ['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.7)', 'rgba(200,220,255,1.0)'] },
  // Stage 2 — Asteroid Belt
  { baseFill: '#0f0c08', starColor: ['rgba(200,190,170,0.3)', 'rgba(210,200,180,0.5)', 'rgba(220,210,190,0.8)'] },
  // Stage 3 — Red Nebula
  { baseFill: '#1a0005', starColor: ['rgba(255,160,160,0.35)', 'rgba(255,120,120,0.6)', 'rgba(255,200,200,0.9)'] },
  // Stage 4 — Acid Planet
  { baseFill: '#051005', starColor: null },
  // Stage 5 — Solar Storm
  { baseFill: '#1a0800', starColor: null },
  // Stage 6 — Enemy Fleet
  { baseFill: '#080810', starColor: ['rgba(180,180,200,0.25)', 'rgba(190,190,210,0.45)', 'rgba(210,210,230,0.7)'] },
  // Stage 7 — The Void
  { baseFill: '#000000', starColor: ['rgba(160,80,255,0.3)', 'rgba(180,100,255,0.5)', 'rgba(200,140,255,0.8)'] },
  // Stage 8 — Mothership Interior
  { baseFill: '#100005', starColor: null },
];
```

---

## Step 2 — Add background scroll state variables

After the `STAGE_BG` array, add all background element arrays:

```js
// Background scroll elements — populated by initBackground(), scrolled by updateBackground()
let bgRocks     = [];  // stage 2: grey oval rocks
let bgClouds    = [];  // stage 3: nebula cloud ellipses
let bgBubbles   = [];  // stage 4: toxic bubbles
let bgStreaks   = [];  // stage 5: energy streaks
let bgHulls     = [];  // stage 6: hull segments
let bgWisps     = [];  // stage 7: void wisps
let bgParticles = [];  // stage 8: red energy particles
let bgWalls     = [];  // stage 8: organic wall segments (sine-wave animated)
let bgStage     = 1;   // current stage index, set by initBackground
```

---

## Step 3 — Add `initBackground(stage)` function

Add the full initialization function:

```js
function initBackground(stage) {
  bgStage = stage;
  // Clear all arrays
  bgRocks.length = 0; bgClouds.length = 0; bgBubbles.length = 0;
  bgStreaks.length = 0; bgHulls.length = 0; bgWisps.length = 0;
  bgParticles.length = 0; bgWalls.length = 0;

  if (stage === 1 || stage === 7) {
    // Stars only — STAR_LAYERS already initialized, just re-tint via STAGE_BG
    return;
  }

  if (stage === 2) {
    // Asteroid Belt: 2 rock layers (slow + fast)
    for (let i = 0; i < 14; i++) {
      bgRocks.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 8 + Math.random() * 12,     // r: 8–20
        spd: 60 + Math.random() * 40,  // layer 1: ~60–100 px/s
        rot: Math.random() * Math.PI * 2,
        rotSpd: (Math.random() - 0.5) * 0.8,
        layer: 0,
      });
    }
    for (let i = 0; i < 8; i++) {
      bgRocks.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 5 + Math.random() * 8,
        spd: 100 + Math.random() * 40, // layer 2: ~100–140 px/s
        rot: Math.random() * Math.PI * 2,
        rotSpd: (Math.random() - 0.5) * 1.2,
        layer: 1,
      });
    }
    return;
  }

  if (stage === 3) {
    // Red Nebula: large soft cloud ellipses + tinted stars (handled by drawBackground)
    for (let i = 0; i < 12; i++) {
      bgClouds.push({
        x: Math.random() * W,
        y: Math.random() * H,
        w: 80 + Math.random() * 80,    // w: 80–160
        h: 40 + Math.random() * 40,    // h: 40–80
        alpha: 0.06 + Math.random() * 0.06, // 0.06–0.12
        spd: 20 + Math.random() * 20,  // 20–40 px/s
        hue: Math.random() < 0.5 ? '#cc2244' : '#aa1133',
      });
    }
    return;
  }

  if (stage === 4) {
    // Acid Planet: toxic bubbles — drift upward + horizontal wobble
    for (let i = 0; i < 40; i++) {
      bgBubbles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 4 + Math.random() * 8,       // r: 4–12
        alpha: 0.08 + Math.random() * 0.12,
        spd: 18 + Math.random() * 22,   // upward drift px/s
        wobbleAmp: 8 + Math.random() * 14,
        wobbleFreq: 0.6 + Math.random() * 0.8,
        wobbleOff: Math.random() * Math.PI * 2,
        color: Math.random() < 0.6 ? '#44ee44' : '#aaee00',
        t: Math.random() * 100,         // time offset for wobble
      });
    }
    return;
  }

  if (stage === 5) {
    // Solar Storm: fast horizontal energy streaks scrolling downward
    for (let i = 0; i < 30; i++) {
      bgStreaks.push({
        x: Math.random() * W,
        y: Math.random() * H,
        w: 40 + Math.random() * 80,     // w: 40–120 px
        h: 1 + Math.floor(Math.random() * 2), // 1–2 px tall
        spd: 300 + Math.random() * 200, // 300–500 px/s
        alpha: 0.18 + Math.random() * 0.25,
        color: Math.random() < 0.7 ? '#ff8800' : '#ffcc44',
      });
    }
    return;
  }

  if (stage === 6) {
    // Enemy Fleet: large hull segment rectangles scrolling slowly
    for (let i = 0; i < 10; i++) {
      bgHulls.push({
        x: Math.random() * (W - 120),
        y: Math.random() * H,
        w: 60 + Math.random() * 60,    // w: 60–120 px
        h: 12 + Math.random() * 14,    // h: 12–26 px
        spd: 25 + Math.random() * 15,  // ~25–40 px/s
        alpha: 0.18 + Math.random() * 0.12,
      });
    }
    return;
  }

  if (stage === 8) {
    // Mothership Interior: organic wall segments + upward red particles
    // Wall segments: left and right edge
    for (let i = 0; i < 8; i++) {
      // Left wall segments
      bgWalls.push({
        side: 'left',
        y: i * (H / 8),
        baseX: 30 + Math.random() * 20,
        h: H / 8 + 4,
        sineAmp: 14 + Math.random() * 10,
        sineFreq: 0.4 + Math.random() * 0.4,
        sineOff: Math.random() * Math.PI * 2,
        color: '#550011',
      });
      // Right wall segments
      bgWalls.push({
        side: 'right',
        y: i * (H / 8),
        baseX: W - 30 - Math.random() * 20,
        h: H / 8 + 4,
        sineAmp: 14 + Math.random() * 10,
        sineFreq: 0.4 + Math.random() * 0.4,
        sineOff: Math.random() * Math.PI * 2,
        color: '#550011',
      });
    }
    // Red energy particles drifting upward
    for (let i = 0; i < 50; i++) {
      bgParticles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: 1 + Math.random() * 2,
        spd: 30 + Math.random() * 50,  // upward px/s
        alpha: 0.3 + Math.random() * 0.4,
        color: Math.random() < 0.7 ? '#ff2200' : '#ff6600',
      });
    }
    return;
  }
}
```

---

## Step 4 — Add `updateBackground(dt)` function

```js
function updateBackground(dt) {
  const stage = bgStage;
  const t     = stageTimer;  // use global stageTimer for wall oscillation

  if (stage === 2) {
    bgRocks.forEach(r => {
      r.y   += r.spd * dt;
      r.rot += r.rotSpd * dt;
      if (r.y > H + r.r * 2) { r.y = -r.r * 2; r.x = Math.random() * W; }
    });
  }

  if (stage === 3) {
    bgClouds.forEach(c => {
      c.y += c.spd * dt;
      if (c.y > H + c.h) { c.y = -c.h; c.x = Math.random() * W; }
    });
  }

  if (stage === 4) {
    bgBubbles.forEach(b => {
      b.t   += dt;
      b.y   -= b.spd * dt;  // drift upward
      b.x   += Math.sin(b.t * b.wobbleFreq + b.wobbleOff) * b.wobbleAmp * dt;
      if (b.y < -b.r * 2) { b.y = H + b.r * 2; b.x = Math.random() * W; }
    });
  }

  if (stage === 5) {
    bgStreaks.forEach(s => {
      s.y += s.spd * dt;
      if (s.y > H + 4) { s.y = -4; s.x = Math.random() * (W - s.w); }
    });
  }

  if (stage === 6) {
    bgHulls.forEach(h => {
      h.y += h.spd * dt;
      if (h.y > H + h.h) { h.y = -h.h; h.x = Math.random() * (W - h.w); }
    });
  }

  // Stage 8: walls use stageTimer (no scrolling — sine animation only)
  // Particles drift upward
  if (stage === 8) {
    bgParticles.forEach(p => {
      p.y -= p.spd * dt;
      if (p.y < -p.r * 2) { p.y = H + p.r * 2; p.x = Math.random() * W; }
    });
    // bgWalls oscillate in drawBackground using stageTimer — no update needed
  }
}
```

---

## Step 5 — Add `drawBackground(stage)` function

```js
function drawBackground(stage) {
  const cfg = STAGE_BG[stage - 1];

  // Base fill
  ctx.fillStyle = cfg.baseFill;
  ctx.fillRect(0, 0, W, H);

  // Stars (stages 1, 2, 3, 6, 7 use tinted stars from STAR_LAYERS)
  if (cfg.starColor) {
    // Override STAR_LAYERS colors for this stage
    STAR_LAYERS[0].color = cfg.starColor[0];
    STAR_LAYERS[1].color = cfg.starColor[1];
    STAR_LAYERS[2].color = cfg.starColor[2];
    STAR_LAYERS.forEach(layer => {
      ctx.fillStyle = layer.color;
      layer.stars.forEach(s => ctx.fillRect(s.x, s.y, layer.size, layer.size));
    });
  }

  // --- Stage-specific elements ---

  if (stage === 2) {
    // Grey oval rocks
    bgRocks.forEach(r => {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.rotate(r.rot);
      ctx.fillStyle = r.layer === 0 ? 'rgba(130,120,110,0.5)' : 'rgba(100,95,85,0.45)';
      ctx.beginPath();
      ctx.ellipse(0, 0, r.r * 1.4, r.r, 0, 0, Math.PI * 2);
      ctx.fill();
      // Highlight edge
      ctx.strokeStyle = 'rgba(180,170,155,0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    });
  }

  if (stage === 3) {
    // Nebula cloud ellipses — large soft shapes, low alpha
    bgClouds.forEach(c => {
      ctx.save();
      ctx.globalAlpha = c.alpha;
      ctx.fillStyle = c.hue;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  if (stage === 4) {
    // Toxic bubbles: green/yellow circles with soft glow
    bgBubbles.forEach(b => {
      ctx.save();
      ctx.globalAlpha = b.alpha;
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      // Inner highlight
      ctx.globalAlpha = b.alpha * 0.5;
      ctx.fillStyle = '#ccffcc';
      ctx.beginPath(); ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  if (stage === 5) {
    // Energy streaks: thin horizontal orange lines
    bgStreaks.forEach(s => {
      ctx.save();
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      // Fading left edge
      const grad = ctx.createLinearGradient(s.x, s.y, s.x + s.w * 0.3, s.y);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, s.color);
      ctx.fillStyle = grad;
      ctx.fillRect(s.x, s.y, s.w * 0.3, s.h);
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  if (stage === 6) {
    // Hull segments: dark grey rectangles with faint detail lines
    bgHulls.forEach(h => {
      ctx.save();
      ctx.globalAlpha = h.alpha;
      ctx.fillStyle = '#1a1a28';
      ctx.fillRect(h.x, h.y, h.w, h.h);
      // Rivet row
      ctx.fillStyle = 'rgba(100,100,140,0.6)';
      const rivets = Math.floor(h.w / 14);
      for (let i = 0; i < rivets; i++) {
        ctx.beginPath();
        ctx.arc(h.x + 8 + i * 14, h.y + h.h / 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Horizontal accent line
      ctx.strokeStyle = 'rgba(80,80,120,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(h.x, h.y + 3); ctx.lineTo(h.x + h.w, h.y + 3);
      ctx.stroke();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  if (stage === 7) {
    // Void wisps: faint purple bezier arcs
    bgWisps.forEach(w => {
      ctx.save();
      ctx.globalAlpha = w.alpha;
      ctx.strokeStyle = w.color;
      ctx.lineWidth = w.width;
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.bezierCurveTo(w.cx1, w.cy1, w.cx2, w.cy2, w.x2, w.y2);
      ctx.stroke();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  if (stage === 8) {
    // Organic wall segments: sine-wave animated on left/right edges
    const t = stageTimer;
    bgWalls.forEach(w => {
      const xOff = Math.sin(t * w.sineFreq + w.sineOff) * w.sineAmp;
      const drawX = w.side === 'left' ? w.baseX + xOff : w.baseX - xOff;
      const segW  = w.side === 'left' ? drawX : W - drawX;

      ctx.save();
      ctx.fillStyle = w.color;
      if (w.side === 'left') {
        ctx.fillRect(0, w.y, drawX, w.h);
      } else {
        ctx.fillRect(drawX, w.y, W - drawX, w.h);
      }
      // Edge highlight
      ctx.strokeStyle = '#aa0022';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (w.side === 'left') {
        ctx.moveTo(drawX, w.y);
        ctx.lineTo(drawX, w.y + w.h);
      } else {
        ctx.moveTo(drawX, w.y);
        ctx.lineTo(drawX, w.y + w.h);
      }
      ctx.stroke();
      ctx.restore();
    });

    // Upward red energy particles
    bgParticles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }
}
```

**Note on stage 7 wisps:** `bgWisps` is populated separately. Add a static initialization for wisps at the end of `initBackground` stage 7 branch, because wisps don't scroll — they drift very slowly. Add to `initBackground` stage 7 section (replace `return;` with):

```js
  if (stage === 7) {
    for (let i = 0; i < 8; i++) {
      const x1 = Math.random() * W, y1 = Math.random() * H;
      bgWisps.push({
        x1, y1,
        x2:  x1 + (Math.random() - 0.5) * 160,
        y2:  y1 + (Math.random() - 0.5) * 100,
        cx1: x1 + (Math.random() - 0.5) * 80,
        cy1: y1 + (Math.random() - 0.5) * 80,
        cx2: x1 + (Math.random() - 0.5) * 80,
        cy2: y1 + (Math.random() - 0.5) * 80,
        alpha: 0.04 + Math.random() * 0.06,
        color: Math.random() < 0.5 ? '#9944ff' : '#cc88ff',
        width: 1 + Math.random() * 2,
      });
    }
    return;
  }
```

---

## Step 6 — Wire into `startStage` and main loop

### 6a. Call `initBackground` from `startStage`

In `startStage(stage)` (line ~1034), add after `currentStage = stage;`:

```js
function startStage(stage) {
  currentStage  = stage;
  initBackground(stage);   // <-- add this line
  waveTable     = buildWaveTable(stage);
  // ... rest unchanged ...
}
```

### 6b. Replace `updateStars` with `updateBackground` in main loop

In the main loop `loop(ts)` (line ~1397):

Replace:
```js
  updateStars(dt);
```
With:
```js
  updateBackground(dt);
  updateStars(dt);   // keep for backward-compat during title/gameover (no bgStage set)
```

> **Note:** `updateStars` still runs for the title screen which uses the original star layers. `updateBackground` only modifies stage-specific elements and is safe to call when arrays are empty.

### 6c. Replace `drawStars` call and base fill in render section

In the render block of `loop(ts)` (lines ~1413–1418):

Replace:
```js
  ctx.fillStyle = '#020208';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'left';
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  drawStars();
```
With:
```js
  ctx.textAlign = 'left';
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  if (state === STATE.PLAYING || state === STATE.STAGECLEAR || state === STATE.PAUSED) {
    drawBackground(currentStage);
  } else {
    // Title / game-over: use classic deep space look
    ctx.fillStyle = '#020208';
    ctx.fillRect(0, 0, W, H);
    drawStars();
  }
```

### Verification

1. **Stage 1:** Dark blue-black with white/blue stars — identical to original.
2. **Stage 2:** Brownish backdrop, drifting grey oval rocks at two speeds.
3. **Stage 3:** Deep crimson base, large soft red cloud blobs drifting down, red-tinted stars.
4. **Stage 4:** Dark green, small green/yellow bubbles drifting upward with wobble.
5. **Stage 5:** Dark orange, fast horizontal orange streaks flying down.
6. **Stage 6:** Dark grey-blue, wide rectangle panels scrolling down with rivet dots.
7. **Stage 7:** Pure black, faint purple bezier wisps.
8. **Stage 8:** Dark maroon, left/right organic wall segments pulsing in and out, red particles drifting up.

### Commit

```
git add index.html
git commit -m "feat: 8 distinct stage backgrounds with scrolling elements"
```

---

## Summary of all changes in this plan

| File | Location | Description |
|------|----------|-------------|
| `index.html` | After STARFIELD section | Add `STAGE_BG`, `bgRocks/Clouds/Bubbles/Streaks/Hulls/Wisps/Particles/Walls`, `bgStage` |
| `index.html` | New function | `initBackground(stage)` |
| `index.html` | New function | `updateBackground(dt)` |
| `index.html` | New function | `drawBackground(stage)` |
| `index.html` | `startStage` | Call `initBackground(stage)` |
| `index.html` | Main loop update | Add `updateBackground(dt)` call |
| `index.html` | Main loop render | Replace `fillRect+drawStars` with `drawBackground` in-game |

**Backward compatible:** Title screen and game-over screen continue to use the original star draw.

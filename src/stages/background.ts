import { W, H } from '../config.js';
import { ctx } from '../canvas.js';
import { STAGES } from './stageData.js';

// === STARFIELD ===
const STAR_LAYERS = [
  { stars: [], speed: 60,  size: 1.0, color: 'rgba(255,255,255,0.4)' },
  { stars: [], speed: 120, size: 1.5, color: 'rgba(255,255,255,0.7)' },
  { stars: [], speed: 200, size: 2.0, color: 'rgba(200,220,255,1.0)' },
];
(function initStars() {
  STAR_LAYERS.forEach(layer => {
    for (let i = 0; i < 60; i++)
      layer.stars.push({ x: Math.random() * W, y: Math.random() * H });
  });
})();

function updateStars(dt) {
  STAR_LAYERS.forEach(layer => {
    layer.stars.forEach(s => {
      s.y += layer.speed * dt;
      if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    });
  });
}

function drawStars() {
  STAR_LAYERS.forEach(layer => {
    ctx.fillStyle = layer.color;
    layer.stars.forEach(s => ctx.fillRect(s.x, s.y, layer.size, layer.size));
  });
}

// === STAGE BACKGROUNDS ===
let bgRocks     = [];
let bgClouds    = [];
let bgBubbles   = [];
let bgStreaks    = [];
let bgHulls     = [];
let bgWisps     = [];
let bgParticles = [];
let bgWalls     = [];
let bgStage     = 1;

function buildRocks() {
  for (let i = 0; i < 14; i++) {
    bgRocks.push({ x: Math.random()*W, y: Math.random()*H, r: 8+Math.random()*12,
      spd: 60+Math.random()*40, rot: Math.random()*Math.PI*2,
      rotSpd: (Math.random()-0.5)*0.8, layer: 0 });
  }
  for (let i = 0; i < 8; i++) {
    bgRocks.push({ x: Math.random()*W, y: Math.random()*H, r: 5+Math.random()*8,
      spd: 100+Math.random()*40, rot: Math.random()*Math.PI*2,
      rotSpd: (Math.random()-0.5)*1.2, layer: 1 });
  }
}

function buildClouds() {
  for (let i = 0; i < 12; i++) {
    bgClouds.push({ x: Math.random()*W, y: Math.random()*H,
      w: 80+Math.random()*80, h: 40+Math.random()*40,
      alpha: 0.06+Math.random()*0.06, spd: 20+Math.random()*20,
      hue: Math.random()<0.5 ? '#cc2244' : '#aa1133' });
  }
}

function buildBubbles() {
  for (let i = 0; i < 40; i++) {
    bgBubbles.push({ x: Math.random()*W, y: Math.random()*H,
      r: 4+Math.random()*8, alpha: 0.08+Math.random()*0.12,
      spd: 18+Math.random()*22, wobbleAmp: 8+Math.random()*14,
      wobbleFreq: 0.6+Math.random()*0.8, wobbleOff: Math.random()*Math.PI*2,
      color: Math.random()<0.6 ? '#44ee44' : '#aaee00',
      t: Math.random()*100 });
  }
}

function buildStreaks() {
  for (let i = 0; i < 30; i++) {
    bgStreaks.push({ x: Math.random()*W, y: Math.random()*H,
      w: 40+Math.random()*80, h: 1+Math.floor(Math.random()*2),
      spd: 300+Math.random()*200, alpha: 0.18+Math.random()*0.25,
      color: Math.random()<0.7 ? '#ff8800' : '#ffcc44' });
  }
}

function buildHulls() {
  for (let i = 0; i < 10; i++) {
    bgHulls.push({
      x: Math.random() * (W - 120),
      y: Math.random() * H,
      w: 60 + Math.random() * 60,
      h: 12 + Math.random() * 14,
      spd: 25 + Math.random() * 15,
      alpha: 0.18 + Math.random() * 0.12,
    });
  }
}

function buildWisps() {
  for (let i = 0; i < 8; i++) {
    const x1 = Math.random()*W, y1 = Math.random()*H;
    bgWisps.push({ x1, y1,
      x2: x1+(Math.random()-0.5)*160, y2: y1+(Math.random()-0.5)*100,
      cx1: x1+(Math.random()-0.5)*80, cy1: y1+(Math.random()-0.5)*80,
      cx2: x1+(Math.random()-0.5)*80, cy2: y1+(Math.random()-0.5)*80,
      alpha: 0.04+Math.random()*0.06,
      color: Math.random()<0.5 ? '#9944ff' : '#cc88ff',
      width: 1+Math.random()*2 });
  }
}

function buildWalls() {
  for (let i = 0; i < 8; i++) {
    bgWalls.push({ side:'left', y: i*(H/8), baseX: 30+Math.random()*20,
      h: H/8+4, sineAmp: 14+Math.random()*10,
      sineFreq: 0.4+Math.random()*0.4, sineOff: Math.random()*Math.PI*2, color:'#550011' });
    bgWalls.push({ side:'right', y: i*(H/8), baseX: W-30-Math.random()*20,
      h: H/8+4, sineAmp: 14+Math.random()*10,
      sineFreq: 0.4+Math.random()*0.4, sineOff: Math.random()*Math.PI*2, color:'#550011' });
  }
  for (let i = 0; i < 50; i++) {
    bgParticles.push({ x: Math.random()*W, y: Math.random()*H,
      r: 1+Math.random()*2, spd: 30+Math.random()*50,
      alpha: 0.3+Math.random()*0.4,
      color: Math.random()<0.7 ? '#ff2200' : '#ff6600' });
  }
}

function stageFeatures(stage) {
  return STAGES[Math.max(0, Math.min(STAGES.length - 1, stage - 1))].bg.features || [];
}

export function initBackground(stage) {
  bgStage = stage;
  bgRocks.length = 0; bgClouds.length = 0; bgBubbles.length = 0;
  bgStreaks.length = 0; bgHulls.length = 0; bgWisps.length = 0;
  bgParticles.length = 0; bgWalls.length = 0;

  const feat = stageFeatures(stage);
  if (feat.includes('rocks'))   buildRocks();
  if (feat.includes('clouds'))  buildClouds();
  if (feat.includes('bubbles')) buildBubbles();
  if (feat.includes('streaks')) buildStreaks();
  if (feat.includes('hulls'))   buildHulls();
  if (feat.includes('wisps'))   buildWisps();
  if (feat.includes('walls'))   buildWalls();
}

export function updateBackground(dt) {
  const stage = bgStage;
  const feat = stageFeatures(stage);
  if (feat.includes('rocks')) {
    bgRocks.forEach(r => {
      r.y += r.spd * dt; r.rot += r.rotSpd * dt;
      if (r.y > H + r.r*2) { r.y = -r.r*2; r.x = Math.random()*W; }
    });
  }
  if (feat.includes('clouds')) {
    bgClouds.forEach(c => {
      c.y += c.spd * dt;
      if (c.y > H + c.h) { c.y = -c.h; c.x = Math.random()*W; }
    });
  }
  if (feat.includes('bubbles')) {
    bgBubbles.forEach(b => {
      b.t += dt; b.y -= b.spd * dt;
      b.x += Math.sin(b.t * b.wobbleFreq + b.wobbleOff) * b.wobbleAmp * dt;
      if (b.y < -b.r*2) { b.y = H+b.r*2; b.x = Math.random()*W; }
    });
  }
  if (feat.includes('streaks')) {
    bgStreaks.forEach(s => {
      s.y += s.spd * dt;
      if (s.y > H+4) { s.y = -4; s.x = Math.random()*(W-s.w); }
    });
  }
  if (feat.includes('hulls')) {
    bgHulls.forEach(h => {
      h.y += h.spd * dt;
      if (h.y > H+h.h) { h.y = -h.h; h.x = Math.random()*(W-h.w); }
    });
  }
  if (feat.includes('walls')) {
    bgParticles.forEach(p => {
      p.y -= p.spd * dt;
      if (p.y < -p.r*2) { p.y = H+p.r*2; p.x = Math.random()*W; }
    });
  }
}

export function drawBackground(g) {
  const stage = g.currentStage;
  const cfg = STAGES[Math.max(0, Math.min(STAGES.length - 1, stage - 1))].bg;
  const feat = cfg.features || [];
  ctx.fillStyle = cfg.baseFill;
  ctx.fillRect(0, 0, W, H);

  if (cfg.starColor) {
    // Save current colors so the title screen's classic starfield isn't left tinted
    const savedColors = STAR_LAYERS.map(l => l.color);
    STAR_LAYERS[0].color = cfg.starColor[0];
    STAR_LAYERS[1].color = cfg.starColor[1];
    STAR_LAYERS[2].color = cfg.starColor[2];
    STAR_LAYERS.forEach(layer => {
      ctx.fillStyle = layer.color;
      layer.stars.forEach(s => ctx.fillRect(s.x, s.y, layer.size, layer.size));
    });
    STAR_LAYERS.forEach((l, i) => { l.color = savedColors[i]; });
  }

  if (feat.includes('rocks')) {
    bgRocks.forEach(r => {
      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
      ctx.fillStyle = r.layer===0 ? 'rgba(130,120,110,0.5)' : 'rgba(100,95,85,0.45)';
      ctx.beginPath(); ctx.ellipse(0, 0, r.r*1.4, r.r, 0, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(180,170,155,0.2)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    });
  }

  if (feat.includes('clouds')) {
    bgClouds.forEach(c => {
      ctx.save(); ctx.globalAlpha = c.alpha; ctx.fillStyle = c.hue;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, c.w/2, c.h/2, 0, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  if (feat.includes('bubbles')) {
    bgBubbles.forEach(b => {
      ctx.save(); ctx.globalAlpha = b.alpha; ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = b.alpha * 0.5; ctx.fillStyle = '#ccffcc';
      ctx.beginPath(); ctx.arc(b.x-b.r*0.3, b.y-b.r*0.3, b.r*0.4, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  if (feat.includes('streaks')) {
    bgStreaks.forEach(s => {
      ctx.save(); ctx.globalAlpha = s.alpha; ctx.fillStyle = s.color;
      ctx.fillRect(s.x, s.y, s.w, s.h);
      const grad = ctx.createLinearGradient(s.x, s.y, s.x+s.w*0.3, s.y);
      grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, s.color);
      ctx.fillStyle = grad; ctx.fillRect(s.x, s.y, s.w*0.3, s.h);
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  if (feat.includes('hulls')) {
    bgHulls.forEach(h => {
      ctx.save(); ctx.globalAlpha = h.alpha;
      ctx.fillStyle = '#1a1a28'; ctx.fillRect(h.x, h.y, h.w, h.h);
      ctx.fillStyle = 'rgba(100,100,140,0.6)';
      const rivets = Math.floor(h.w/14);
      for (let i = 0; i < rivets; i++) {
        ctx.beginPath(); ctx.arc(h.x+8+i*14, h.y+h.h/2, 1.5, 0, Math.PI*2); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(80,80,120,0.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(h.x, h.y+3); ctx.lineTo(h.x+h.w, h.y+3); ctx.stroke();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  if (feat.includes('wisps')) {
    bgWisps.forEach(w => {
      ctx.save(); ctx.globalAlpha = w.alpha; ctx.strokeStyle = w.color; ctx.lineWidth = w.width;
      ctx.beginPath(); ctx.moveTo(w.x1, w.y1);
      ctx.bezierCurveTo(w.cx1, w.cy1, w.cx2, w.cy2, w.x2, w.y2);
      ctx.stroke(); ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  if (feat.includes('walls')) {
    const t = g.stageTimer;
    bgWalls.forEach(w => {
      const xOff = Math.sin(t * w.sineFreq + w.sineOff) * w.sineAmp;
      const drawX = w.side === 'left' ? w.baseX + xOff : w.baseX - xOff;
      ctx.save(); ctx.fillStyle = w.color;
      if (w.side === 'left') {
        ctx.fillRect(0, w.y, drawX, w.h);
      } else {
        ctx.fillRect(drawX, w.y, W - drawX, w.h);
      }
      ctx.strokeStyle = '#aa0022'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(drawX, w.y); ctx.lineTo(drawX, w.y + w.h); ctx.stroke();
      ctx.restore();
    });
    bgParticles.forEach(p => {
      ctx.save(); ctx.globalAlpha = p.alpha; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }
}

export { updateStars, drawStars };

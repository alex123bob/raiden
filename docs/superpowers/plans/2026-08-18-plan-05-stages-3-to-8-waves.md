# Plan 05 — Stages 3–8 Wave Tables, Stage Flow, Victory Screen

**Date:** 2026-08-18  
**Goal:** Add `STAGE_COUNT=8`, per-stage `STAGE_DIFF` array, wave tables for stages 3–8, update stage-clear flow from hardcoded 2-stage loop to 8-stage campaign with victory screen.  
**Architecture:** Single-file `index.html`. Changes in CONSTANTS, WAVE TABLES, BOSS, and STATE MACHINE sections.  
**Tech Stack:** Vanilla JS, HTML5 Canvas 2D API.  
**Builds on:** Plans 01–04 (weapon + background systems).  
**Required by:** Plan 06 (boss stageNum system).

---

## Step 1 — Add constants

In the CONSTANTS section (after `const STEP = 1 / FPS;`, around line ~27), add:

```js
const STAGE_COUNT = 8;
const STAGE_DIFF  = [1.0, 1.15, 1.30, 1.45, 1.60, 1.80, 2.00, 2.25];
```

### Verification

`STAGE_COUNT` and `STAGE_DIFF` are defined at module scope. No visible change yet.

---

## Step 2 — Modify `startStage` to use `STAGE_DIFF`

In `startStage(stage)` (line ~1034), the difficulty was previously hard-coded in `updateStageClear`. Now set it here:

```js
function startStage(stage) {
  currentStage  = stage;
  // Per-stage difficulty multiplier, scaled by loop number
  diffMult = STAGE_DIFF[stage - 1] * (1 + (loopMult - 1) * 0.2);
  initBackground(stage);   // from Plan 04
  waveTable     = buildWaveTable(stage);
  waveIndex     = 0;
  stageTimer    = 0;
  bossSpawned   = false;
  boss          = null;
  enemies.length       = 0;
  enemyBullets.length  = 0;
  playerBullets.length = 0;
  powerups.length      = 0;
}
```

Also update `startGame()` — remove manual `diffMult = 1.0` (it will be set by `startStage(1)`), or keep it as a no-op since `startStage(1)` will immediately overwrite it. Either is fine; for clarity remove the redundant line:

```js
function startGame() {
  score     = 0;
  loopMult  = 1;
  player    = createPlayer();
  particles.length = 0;
  powerups.length  = 0;
  startStage(1);
  state = STATE.PLAYING;
}
```

### Commit

```
git add index.html
git commit -m "feat: startStage sets diffMult from STAGE_DIFF array"
```

---

## Step 3 — Extend `buildWaveTable` to a switch(stage) block

Replace the entire `buildWaveTable(stage)` function body with a `switch(stage)` structure. Stages 1 and 2 keep existing entries; stages 3–8 are new.

```js
function buildWaveTable(stage) {
  const fSpd = ENEMY_CFG[0].spd * diffMult;  // fighter base speed scaled
  const bSpd = ENEMY_CFG[1].spd * diffMult;  // gunship base speed scaled
  const entries = [];
  const add = obj => entries.push(obj);

  switch (stage) {

    case 1: {
      // --- Stage 1: Deep Space — tutorial density ---
      const fS = 105 * diffMult, bS = 62 * diffMult;
      for (let i = 0; i < 5; i++)
        add({ t: 0.5 + i*0.28, type: 0, path: pathFormation(W/2, -20, fS, i, 5) });
      add({ t: 3.5, type: 1, path: pathDown(W*0.25, -30, bS) });
      add({ t: 3.5, type: 1, path: pathDown(W*0.75, -30, bS) });
      for (let i = 0; i < 4; i++)
        add({ t: 5.5 + i*0.35, type: 0, path: pathSin(W*0.18 + i*90, -20, fS*0.9, 45, 1.6) });
      add({ t: 8, type: 3, x: 80,  y: 290 });
      add({ t: 8, type: 3, x: 240, y: 240 });
      add({ t: 8, type: 3, x: 400, y: 290 });
      add({ t: 10, type: 2, path: pathDown(W/2, -40, 44 * diffMult) });
      for (let i = 0; i < 6; i++)
        add({ t: 12 + i*0.22, type: 0, path: pathFormation(W/2, -20, fS*1.15, i, 6) });
      add({ t: 14, type: 1, path: pathSin(W*0.5, -30, bS, 65, 1.9) });
      for (let i = 0; i < 3; i++)
        add({ t: 17 + i*1.4, type: 1, path: pathDown(80 + i*160, -30, bS) });
      add({ t: 20, type: 3, x: 150, y: 200 });
      add({ t: 20, type: 3, x: 330, y: 215 });
      add({ t: 22, type: 2, path: pathDown(W*0.33, -40, 40*diffMult) });
      add({ t: 22, type: 2, path: pathDown(W*0.67, -40, 40*diffMult) });
      for (let i = 0; i < 8; i++)
        add({ t: 26 + i*0.18, type: 0, path: pathFormation(W/2, -20, fS*1.3, i, 8) });
      add({ t: 30, boss: 1 });
      break;
    }

    case 2: {
      // --- Stage 2: Asteroid Belt — bomber + turret heavy ---
      const fS = 145 * diffMult, bS = 88 * diffMult;
      for (let i = 0; i < 5; i++)
        add({ t: 0.5 + i*0.28, type: 0, path: pathFormation(W/2, -20, fS, i, 5) });
      add({ t: 3.5, type: 1, path: pathDown(W*0.25, -30, bS) });
      add({ t: 3.5, type: 1, path: pathDown(W*0.75, -30, bS) });
      for (let i = 0; i < 4; i++)
        add({ t: 5.5 + i*0.35, type: 0, path: pathSin(W*0.18 + i*90, -20, fS*0.9, 45, 1.6) });
      add({ t: 8, type: 3, x: 80,  y: 290 });
      add({ t: 8, type: 3, x: 240, y: 240 });
      add({ t: 8, type: 3, x: 400, y: 290 });
      add({ t: 10, type: 2, path: pathDown(W/2, -40, 44 * diffMult) });
      for (let i = 0; i < 6; i++)
        add({ t: 12 + i*0.22, type: 0, path: pathFormation(W/2, -20, fS*1.15, i, 6) });
      add({ t: 14, type: 1, path: pathSin(W*0.5, -30, bS, 65, 1.9) });
      for (let i = 0; i < 3; i++)
        add({ t: 17 + i*1.4, type: 1, path: pathDown(80 + i*160, -30, bS) });
      add({ t: 20, type: 3, x: 150, y: 200 });
      add({ t: 20, type: 3, x: 330, y: 215 });
      add({ t: 22, type: 2, path: pathDown(W*0.33, -40, 40*diffMult) });
      add({ t: 22, type: 2, path: pathDown(W*0.67, -40, 40*diffMult) });
      for (let i = 0; i < 8; i++)
        add({ t: 26 + i*0.18, type: 0, path: pathFormation(W/2, -20, fS*1.3, i, 8) });
      add({ t: 30, boss: 2 });
      break;
    }

    case 3: {
      // --- Stage 3: Red Nebula — fast fighter swarms + gunship pairs ---
      const fS = 160 * diffMult, bS = 95 * diffMult;
      // Wave 1: 6 fighters formation (t=0.5)
      for (let i = 0; i < 6; i++)
        add({ t: 0.5 + i*0.20, type: 0, path: pathFormation(W/2, -20, fS, i, 6) });
      // Gunship pair flanks (t=2.5)
      add({ t: 2.5, type: 1, path: pathDown(W*0.20, -30, bS) });
      add({ t: 2.5, type: 1, path: pathDown(W*0.80, -30, bS) });
      // Wave 2: 6 fighters sinusoidal (t=3.0)
      for (let i = 0; i < 6; i++)
        add({ t: 3.0 + i*0.18, type: 0, path: pathSin(W*0.15 + i*60, -20, fS*0.85, 38, 2.0) });
      // Gunship pair center (t=4.0)
      add({ t: 4.0, type: 1, path: pathDown(W*0.35, -30, bS) });
      add({ t: 4.0, type: 1, path: pathDown(W*0.65, -30, bS) });
      // Wave 3: 6 fighters tight formation (t=6.0)
      for (let i = 0; i < 6; i++)
        add({ t: 6.0 + i*0.18, type: 0, path: pathFormation(W/2, -20, fS*1.1, i, 6) });
      // Gunship pair from t=7.0
      add({ t: 7.0, type: 1, path: pathSin(W*0.3, -30, bS, 55, 1.6) });
      add({ t: 7.0, type: 1, path: pathSin(W*0.7, -30, bS, 55, 1.6) });
      // Mid-stage turret cluster (t=10)
      add({ t: 10, type: 3, x: 120, y: 260 });
      add({ t: 10, type: 3, x: 240, y: 220 });
      add({ t: 10, type: 3, x: 360, y: 260 });
      // Dense fighter rush before boss (t=17)
      for (let i = 0; i < 8; i++)
        add({ t: 17 + i*0.15, type: 0, path: pathFormation(W/2, -20, fS*1.2, i, 8) });
      // Boss (t=25)
      add({ t: 25, boss: 3 });
      break;
    }

    case 4: {
      // --- Stage 4: Acid Planet — turret clusters + bombers ---
      const fS = 130 * diffMult, bS = 80 * diffMult;
      // Turret cluster 1 (t=2)
      add({ t: 2, type: 3, x: 100, y: 280 });
      add({ t: 2, type: 3, x: 240, y: 250 });
      add({ t: 2, type: 3, x: 380, y: 280 });
      add({ t: 2.5, type: 3, x: 170, y: 310 });
      // Bomber 1 (t=5)
      add({ t: 5, type: 2, path: pathDown(W*0.5, -40, 40*diffMult) });
      // Light fighter wave (t=7)
      for (let i = 0; i < 5; i++)
        add({ t: 7 + i*0.25, type: 0, path: pathFormation(W/2, -20, fS, i, 5) });
      // Turret cluster 2 (t=8)
      add({ t: 8, type: 3, x: 80,  y: 240 });
      add({ t: 8, type: 3, x: 200, y: 210 });
      add({ t: 8, type: 3, x: 320, y: 210 });
      add({ t: 8, type: 3, x: 440, y: 240 });
      // Bomber 2 (t=11)
      add({ t: 11, type: 2, path: pathDown(W*0.3, -40, 36*diffMult) });
      add({ t: 11.5, type: 2, path: pathDown(W*0.7, -40, 36*diffMult) });
      // Fighter wave (t=13)
      for (let i = 0; i < 6; i++)
        add({ t: 13 + i*0.22, type: 0, path: pathSin(W*0.15 + i*60, -20, fS*0.9, 40, 1.8) });
      // Turret cluster 3 (t=15)
      add({ t: 15, type: 3, x: 140, y: 270 });
      add({ t: 15, type: 3, x: 240, y: 230 });
      add({ t: 15, type: 3, x: 340, y: 270 });
      add({ t: 15.5, type: 3, x: 80, y: 310 });
      // Bomber 3 (t=18)
      add({ t: 18, type: 2, path: pathDown(W*0.5, -40, 38*diffMult) });
      // Final rush (t=23)
      for (let i = 0; i < 7; i++)
        add({ t: 23 + i*0.18, type: 0, path: pathFormation(W/2, -20, fS*1.2, i, 7) });
      // Boss (t=28)
      add({ t: 28, boss: 4 });
      break;
    }

    case 5: {
      // --- Stage 5: Solar Storm — dense fighter rushes + fast gunships ---
      const fS = 175 * diffMult, bS = 105 * diffMult;
      // Fighter formation 1 (t=0.5, 8 ships)
      for (let i = 0; i < 8; i++)
        add({ t: 0.5 + i*0.15, type: 0, path: pathFormation(W/2, -20, fS, i, 8) });
      // Fast gunship pair (t=3.0)
      add({ t: 3.0, type: 1, path: pathDown(W*0.25, -30, bS) });
      add({ t: 3.0, type: 1, path: pathDown(W*0.75, -30, bS) });
      // Fighter formation 2 (t=4.0, 8 ships sinusoidal)
      for (let i = 0; i < 8; i++)
        add({ t: 4.0 + i*0.14, type: 0, path: pathSin(W*0.1 + i*55, -20, fS*0.9, 35, 2.2) });
      // Fast gunship pair (t=7.0)
      add({ t: 7.0, type: 1, path: pathDown(W*0.3, -30, bS*1.1) });
      add({ t: 7.0, type: 1, path: pathDown(W*0.7, -30, bS*1.1) });
      // Fighter formation 3 (t=8.0, 8 ships)
      for (let i = 0; i < 8; i++)
        add({ t: 8.0 + i*0.14, type: 0, path: pathFormation(W/2, -20, fS*1.1, i, 8) });
      // Bomber pair (t=11)
      add({ t: 11, type: 1, path: pathSin(W*0.4, -30, bS, 50, 1.7) });
      add({ t: 11, type: 1, path: pathSin(W*0.6, -30, bS, 50, 1.7) });
      // Fast gunship pair (t=11.0)
      add({ t: 11.0, type: 1, path: pathDown(W*0.2, -30, bS*1.2) });
      add({ t: 11.0, type: 1, path: pathDown(W*0.8, -30, bS*1.2) });
      // Fighter formation 4 (t=12.0, 8 ships)
      for (let i = 0; i < 8; i++)
        add({ t: 12.0 + i*0.14, type: 0, path: pathSin(W*0.1 + i*55, -20, fS*1.1, 40, 2.0) });
      // Bombers (t=14)
      add({ t: 14, type: 2, path: pathDown(W*0.35, -40, 45*diffMult) });
      add({ t: 14, type: 2, path: pathDown(W*0.65, -40, 45*diffMult) });
      // Final rush (t=21)
      for (let i = 0; i < 8; i++)
        add({ t: 21 + i*0.12, type: 0, path: pathFormation(W/2, -20, fS*1.3, i, 8) });
      // Boss (t=26)
      add({ t: 26, boss: 5 });
      break;
    }

    case 6: {
      // --- Stage 6: Enemy Fleet — heavy gunships + bombers ---
      const fS = 130 * diffMult, bS = 90 * diffMult;
      // Gunship column 1: 3 ships (t=1)
      for (let i = 0; i < 3; i++)
        add({ t: 1 + i*0.7, type: 1, path: pathDown(W*0.25, -30, bS) });
      // Gunship column 2 (t=2)
      for (let i = 0; i < 3; i++)
        add({ t: 2 + i*0.7, type: 1, path: pathDown(W*0.75, -30, bS) });
      // Bomber (t=7)
      add({ t: 7, type: 2, path: pathDown(W*0.5, -40, 42*diffMult) });
      // Gunship column 3 (t=5)
      for (let i = 0; i < 3; i++)
        add({ t: 5 + i*0.6, type: 1, path: pathDown(W*0.40, -30, bS*1.1) });
      // Gunship column 4 (t=6)
      for (let i = 0; i < 3; i++)
        add({ t: 6 + i*0.6, type: 1, path: pathDown(W*0.60, -30, bS*1.1) });
      // Turret pair (t=10)
      add({ t: 10, type: 3, x: 160, y: 230 });
      add({ t: 10, type: 3, x: 320, y: 230 });
      // Bomber pair (t=12)
      add({ t: 12, type: 2, path: pathDown(W*0.3, -40, 40*diffMult) });
      add({ t: 12.5, type: 2, path: pathDown(W*0.7, -40, 40*diffMult) });
      // Fighter wave (t=9)
      for (let i = 0; i < 5; i++)
        add({ t: 9 + i*0.25, type: 0, path: pathFormation(W/2, -20, fS, i, 5) });
      // Gunship columns 5-6 (t=13, t=17)
      for (let i = 0; i < 3; i++)
        add({ t: 13 + i*0.5, type: 1, path: pathSin(W*0.35, -30, bS, 45, 1.5) });
      // Bomber 3 (t=17)
      add({ t: 17, type: 2, path: pathDown(W*0.5, -40, 38*diffMult) });
      // Final gunship rush (t=22)
      for (let i = 0; i < 4; i++)
        add({ t: 22 + i*0.5, type: 1, path: pathFormation(W/2, -30, bS*1.2, i, 4) });
      // Boss (t=28)
      add({ t: 28, boss: 6 });
      break;
    }

    case 7: {
      // --- Stage 7: The Void — all types, faster + denser ---
      const fS = 190 * diffMult, bS = 110 * diffMult;
      // Dense fighter opening (t=0.5, 8 ships)
      for (let i = 0; i < 8; i++)
        add({ t: 0.5 + i*0.13, type: 0, path: pathFormation(W/2, -20, fS, i, 8) });
      // Gunship pair (t=2.0)
      add({ t: 2.0, type: 1, path: pathDown(W*0.2, -30, bS) });
      add({ t: 2.0, type: 1, path: pathDown(W*0.8, -30, bS) });
      // Turret cluster 1 (t=3)
      add({ t: 3, type: 3, x: 100, y: 250 });
      add({ t: 3, type: 3, x: 240, y: 210 });
      add({ t: 3, type: 3, x: 380, y: 250 });
      // Fighter + gunship mix (t=4.0)
      for (let i = 0; i < 6; i++)
        add({ t: 4.0 + i*0.16, type: 0, path: pathSin(W*0.1 + i*65, -20, fS*0.9, 38, 2.0) });
      add({ t: 5.0, type: 1, path: pathSin(W*0.5, -30, bS, 60, 1.8) });
      // Bomber (t=6)
      add({ t: 6, type: 2, path: pathDown(W*0.4, -40, 50*diffMult) });
      add({ t: 6, type: 2, path: pathDown(W*0.6, -40, 50*diffMult) });
      // Turret cluster 2 (t=8)
      add({ t: 8, type: 3, x: 80,  y: 270 });
      add({ t: 8, type: 3, x: 200, y: 240 });
      add({ t: 8, type: 3, x: 320, y: 240 });
      add({ t: 8, type: 3, x: 440, y: 270 });
      // Dense fighter rush (t=10)
      for (let i = 0; i < 8; i++)
        add({ t: 10 + i*0.12, type: 0, path: pathFormation(W/2, -20, fS*1.15, i, 8) });
      // Gunship column (t=12)
      for (let i = 0; i < 3; i++)
        add({ t: 12 + i*0.6, type: 1, path: pathDown(W*0.3, -30, bS*1.1) });
      for (let i = 0; i < 3; i++)
        add({ t: 12 + i*0.6, type: 1, path: pathDown(W*0.7, -30, bS*1.1) });
      // Bombers (t=14)
      add({ t: 14, type: 2, path: pathDown(W*0.5, -40, 48*diffMult) });
      // Turret cluster 3 (t=16)
      add({ t: 16, type: 3, x: 120, y: 260 });
      add({ t: 16, type: 3, x: 240, y: 225 });
      add({ t: 16, type: 3, x: 360, y: 260 });
      // Final dense mixed rush (t=22)
      for (let i = 0; i < 8; i++)
        add({ t: 22 + i*0.12, type: 0, path: pathFormation(W/2, -20, fS*1.2, i, 8) });
      for (let i = 0; i < 3; i++)
        add({ t: 23 + i*0.5, type: 1, path: pathDown(80 + i*160, -30, bS*1.2) });
      // Boss (t=30)
      add({ t: 30, boss: 7 });
      break;
    }

    case 8: {
      // --- Stage 8: Mothership Interior — elite enemies (1.5× HP), dense ---
      const fS = 200 * diffMult, bS = 115 * diffMult;
      // All enemies in stage 8 get 1.5× HP — applied at spawn via a wrapper
      const addElite = obj => {
        // Store hp override multiplier on entry; applied in updateWaves
        entries.push({ ...obj, eliteHp: true });
      };
      // Opening fighter storm (t=0.5)
      for (let i = 0; i < 8; i++)
        addElite({ t: 0.5 + i*0.12, type: 0, path: pathFormation(W/2, -20, fS, i, 8) });
      // Gunship column pair (t=2)
      for (let i = 0; i < 4; i++)
        addElite({ t: 2 + i*0.5, type: 1, path: pathDown(W*0.25, -30, bS) });
      for (let i = 0; i < 4; i++)
        addElite({ t: 2 + i*0.5, type: 1, path: pathDown(W*0.75, -30, bS) });
      // Turret cluster (t=4)
      addElite({ t: 4, type: 3, x: 80,  y: 280 });
      addElite({ t: 4, type: 3, x: 200, y: 240 });
      addElite({ t: 4, type: 3, x: 320, y: 240 });
      addElite({ t: 4, type: 3, x: 440, y: 280 });
      // Bombers (t=6)
      addElite({ t: 6, type: 2, path: pathDown(W*0.33, -40, 52*diffMult) });
      addElite({ t: 6.5, type: 2, path: pathDown(W*0.67, -40, 52*diffMult) });
      // Dense fighter rush (t=8)
      for (let i = 0; i < 8; i++)
        addElite({ t: 8 + i*0.12, type: 0, path: pathSin(W*0.1 + i*55, -20, fS*0.95, 35, 2.2) });
      // Turret cluster 2 (t=11)
      addElite({ t: 11, type: 3, x: 120, y: 260 });
      addElite({ t: 11, type: 3, x: 240, y: 220 });
      addElite({ t: 11, type: 3, x: 360, y: 260 });
      // Gunship columns (t=12)
      for (let i = 0; i < 4; i++)
        addElite({ t: 12 + i*0.4, type: 1, path: pathDown(W*0.4, -30, bS*1.1) });
      for (let i = 0; i < 4; i++)
        addElite({ t: 12 + i*0.4, type: 1, path: pathDown(W*0.6, -30, bS*1.1) });
      // Bomber trio (t=16)
      addElite({ t: 16, type: 2, path: pathDown(W*0.2, -40, 48*diffMult) });
      addElite({ t: 16, type: 2, path: pathDown(W*0.5, -40, 48*diffMult) });
      addElite({ t: 16, type: 2, path: pathDown(W*0.8, -40, 48*diffMult) });
      // Turret cluster 3 (t=19)
      addElite({ t: 19, type: 3, x: 100, y: 270 });
      addElite({ t: 19, type: 3, x: 240, y: 235 });
      addElite({ t: 19, type: 3, x: 380, y: 270 });
      // Final elite storm (t=25)
      for (let i = 0; i < 8; i++)
        addElite({ t: 25 + i*0.11, type: 0, path: pathFormation(W/2, -20, fS*1.2, i, 8) });
      for (let i = 0; i < 4; i++)
        addElite({ t: 26 + i*0.4, type: 1, path: pathFormation(W/2, -30, bS*1.2, i, 4) });
      // Boss (t=32)
      add({ t: 32, boss: 8 });
      break;
    }

    default:
      // Fallback: empty wave table
      break;
  }

  return entries.sort((a, b) => a.t - b.t);
}
```

### 3b. Apply elite HP in `updateWaves`

In `updateWaves(dt)`, in the branch that spawns a regular enemy, apply the `eliteHp` flag:

```js
    } else if (entry.type === 3) {
      const e = mkEnemy(3, entry.x, entry.y, null);
      if (entry.eliteHp) e.hp = Math.ceil(e.hp * 1.5);
      enemies.push(e);
    } else {
      const e = mkEnemy(entry.type, 0, 0, entry.path);
      if (entry.path) { const p0 = entry.path(0); e.x = p0.x; e.y = p0.y; }
      if (entry.eliteHp) e.hp = Math.ceil(e.hp * 1.5);
      enemies.push(e);
    }
```

### Commit

```
git add index.html
git commit -m "feat: wave tables for stages 3-8 with eliteHp flag for stage 8"
```

---

## Step 4 — Add `STATE.VICTORY` and victory variables

### 4a. Add to STATE enum (line ~43):

```js
const STATE = { TITLE: 0, PLAYING: 1, PAUSED: 2, GAMEOVER: 3, STAGECLEAR: 4, VICTORY: 5 };
```

### 4b. Add victory timer variable (after `let stageClearTimer = 0;`):

```js
let victoryTimer = 0;
```

### Commit

```
git add index.html
git commit -m "feat: add STATE.VICTORY and victoryTimer"
```

---

## Step 5 — Update `onBossDeath` for 8-stage flow

Replace the entire `onBossDeath` function:

```js
function onBossDeath() {
  const bossStage = boss.stageNum;  // from Plan 06; for now works if boss.stageNum is set
  // Scale explosion count with boss stage (later stages = more explosions)
  const explosionCount = 2 + Math.floor(bossStage * 0.5);
  spawnExplosion(boss.x,          boss.y,          6, '#ffaa00');
  spawnExplosion(boss.x + 35,     boss.y - 25,     4, '#ff4400');
  spawnExplosion(boss.x - 35,     boss.y + 15,     4, '#ffcc00');
  for (let i = 0; i < explosionCount - 3; i++) {
    const ox = (Math.random() - 0.5) * boss.r * 2;
    const oy = (Math.random() - 0.5) * boss.r * 2;
    spawnExplosion(boss.x + ox, boss.y + oy, 3, '#ff8800');
  }

  const bossScore = 5000 + bossStage * 2000;
  score += bossScore * loopMult;
  saveHS();
  boss = null;

  if (currentStage < STAGE_COUNT) {
    // Not the last stage — show stage clear banner
    state = STATE.STAGECLEAR;
    stageClearTimer = 3.0;
  } else {
    // Stage 8 boss dead
    if (loopMult === 1) {
      // First clear: show victory screen
      state = STATE.VICTORY;
      victoryTimer = 0;   // victory screen stays until Enter pressed
    } else {
      // Subsequent clears: loop back to stage 1 with increased difficulty
      loopMult++;
      startStage(1);
      state = STATE.PLAYING;
    }
  }
}
```

> **Note:** `boss.stageNum` is set by `createBoss` in Plan 06. For this plan, temporarily use `boss.num` if Plan 06 hasn't been applied yet: replace `boss.stageNum` with `boss.num || boss.stageNum`.

---

## Step 6 — Update `updateStageClear` and `drawStageClear`

### 6a. `updateStageClear`

Replace the body:

```js
function updateStageClear(dt) {
  stageClearTimer -= dt;
  if (stageClearTimer <= 0) {
    startStage(currentStage + 1);
    state = STATE.PLAYING;
  }
}
```

### 6b. `drawStageClear`

Update the "incoming" text to show the correct next stage number:

```js
function drawStageClear() {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffff44';
  ctx.shadowColor = '#ffaa00';
  ctx.shadowBlur = 20;
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('STAGE CLEAR!', W/2, H/2 - 10);
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  ctx.fillText('STAGE ' + (currentStage + 1) + ' INCOMING...', W/2, H/2 + 30);
}
```

---

## Step 7 — Add `updateVictory` and `drawVictory`

### 7a. `updateVictory(dt)` — add near the other update functions:

```js
function updateVictory(dt) {
  // Victory screen — no auto-advance; player presses Enter to return to title
  // (victoryTimer is unused here; kept for potential future countdown)
}
```

### 7b. `drawVictory()`:

```js
function drawVictory() {
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(0, 0, W, H);

  ctx.shadowColor = '#ffcc00';
  ctx.shadowBlur  = 40;
  ctx.fillStyle   = '#ffd700';
  ctx.font = 'bold 42px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('MISSION', W/2, H/2 - 70);
  ctx.fillText('COMPLETE', W/2, H/2 - 22);
  ctx.shadowBlur  = 0;
  ctx.shadowColor = 'transparent';

  ctx.fillStyle = '#ffffff';
  ctx.font = '18px monospace';
  ctx.fillText('SCORE: ' + score, W/2, H/2 + 30);
  ctx.fillText('HI-SCORE: ' + highScore, W/2, H/2 + 58);

  ctx.fillStyle = '#ffff44';
  ctx.font = '14px monospace';
  if (Math.floor(Date.now() / 500) % 2)
    ctx.fillText('PRESS ENTER', W/2, H/2 + 100);
}
```

### 7c. Wire `drawVictory` into main loop render block and handle Enter in `handleKeyPress`:

In the render section of `loop(ts)`, add after `else if (state === STATE.GAMEOVER) drawGameOver();`:

```js
  else if (state === STATE.VICTORY)  drawVictory();
```

In `handleKeyPress(code)`, after the `STATE.GAMEOVER` Enter handler:

```js
  if (code === 'Enter') {
    if (state === STATE.TITLE)    startGame();
    if (state === STATE.GAMEOVER) state = STATE.TITLE;
    if (state === STATE.VICTORY)  state = STATE.TITLE;   // <-- add this
  }
```

Also add victory update call in main loop (though it's empty, keep consistent):

```js
  if (state === STATE.VICTORY) updateVictory(dt);
```

### Commit

```
git add index.html
git commit -m "feat: 8-stage flow — updateStageClear, onBossDeath, victory screen"
```

---

## Summary of all changes in this plan

| File | Location | Description |
|------|----------|-------------|
| `index.html` | CONSTANTS | Add `STAGE_COUNT`, `STAGE_DIFF` |
| `index.html` | `startStage` | Set `diffMult` from `STAGE_DIFF` |
| `index.html` | `startGame` | Remove redundant `diffMult = 1.0` |
| `index.html` | `buildWaveTable` | Replace with 8-case switch; add `eliteHp` for stage 8 |
| `index.html` | `updateWaves` | Apply `eliteHp` at spawn time |
| `index.html` | STATE enum | Add `VICTORY: 5` |
| `index.html` | After `stageClearTimer` | Add `let victoryTimer = 0` |
| `index.html` | `onBossDeath` | Rewrite for 8-stage flow + scaled explosions |
| `index.html` | `updateStageClear` | Use `currentStage + 1` |
| `index.html` | `drawStageClear` | Show dynamic next stage number |
| `index.html` | New functions | `updateVictory`, `drawVictory` |
| `index.html` | `handleKeyPress` | Enter advances from VICTORY to TITLE |
| `index.html` | Main loop | Wire victory update + draw |

# Plan 01 — Death Reset & Vulcan Level Visuals

**Date:** 2026-08-18  
**Goal:** On death reset weapon to Vulcan Lv1. Add per-level visual changes to Vulcan bullets (trail at lv3-4, impact spark at lv5).  
**Architecture:** Single-file `index.html`. All changes are in the PLAYER, PLAYER BULLETS, and COLLISION sections.  
**Tech Stack:** Vanilla JS, HTML5 Canvas 2D API.  
**Builds on:** Existing code only — no prior plan required.  
**Required by:** Plan 03 (charge state checks weapon level).

---

## Step 1 — Death Reset: modify `killPlayer()`

### What to change

In `killPlayer()` (line ~406), after decrementing `p.lives`, reset the weapon to Vulcan Lv1. This must happen on every death — including the final life — before the game-over branch.

### Current code (lines 406–422)

```js
function killPlayer() {
  const p = player;
  if (p.invTimer > 0 || p.dead) return;
  p.lives--;
  spawnExplosion(p.x, p.y, 3, '#88ccff');
  // [ARCADE] Player bullets cleared on death
  playerBullets.length = 0;
  laserActive = false;
  if (p.lives <= 0) {
    p.dead = true;
    saveHS();
    p.gameOverTimer = 1.8;
  } else {
    p.dead = true;
    p.respawnTimer = 2.0;
  }
}
```

### New code

```js
function killPlayer() {
  const p = player;
  if (p.invTimer > 0 || p.dead) return;
  p.lives--;
  spawnExplosion(p.x, p.y, 3, '#88ccff');
  // [ARCADE] Player bullets cleared on death
  playerBullets.length = 0;
  laserActive = false;
  // [ARCADE] Weapon resets to Vulcan Lv1 on any death
  p.weapon    = 0;
  p.weaponLv  = 1;
  if (p.lives <= 0) {
    p.dead = true;
    saveHS();
    p.gameOverTimer = 1.8;
  } else {
    p.dead = true;
    p.respawnTimer = 2.0;
  }
}
```

### Verification

1. Start game, pick up a weapon orb to reach Spread or Missile, level it up.
2. Let an enemy bullet hit the player.
3. After respawn, HUD bottom-right should display `VULCAN Lv1`.
4. Confirm the same reset happens on the final life (game over path).

### Commit

```
git add index.html
git commit -m "feat: reset weapon to Vulcan Lv1 on death"
```

---

## Step 2 — Vulcan Lv1–2: verify current visual

### What to check

The existing `drawPlayerBullets()` draws all non-plasma, non-missile bullets (the `else` branch at line ~595) as an elongated capsule: cyan outer ellipse (3×8) with white inner ellipse (1.5×5), rotated along `b.angle`.

Lv1 and Lv2 bullets are visually identical white capsules — this matches the spec. **No code change required.**

Fire a few shots at lv1 and lv2 and confirm the white capsule pellets appear.

---

## Step 3 — Vulcan Lv3: short white trail (3-position)

### Changes required

**3a. Add `trail` array to `mkVulcanBullet`:**

Current `mkVulcanBullet` (line ~441):

```js
function mkVulcanBullet(x, y, angle) {
  const spd = 680;
  return {
    type: 'bullet',
    x, y,
    vx: Math.cos(angle) * spd,
    vy: Math.sin(angle) * spd,
    angle,
    r: 4, dmg: 5, life: 2.0,
    pierce: false,
  };
}
```

New `mkVulcanBullet`:

```js
function mkVulcanBullet(x, y, angle) {
  const spd = 680;
  return {
    type: 'bullet',
    x, y,
    vx: Math.cos(angle) * spd,
    vy: Math.sin(angle) * spd,
    angle,
    r: 4, dmg: 5, life: 2.0,
    pierce: false,
    trail: [],   // array of {x,y} past positions for lv3+ trail drawing
  };
}
```

**3b. Record trail positions in `updatePlayerBullets`:**

In `updatePlayerBullets` (line ~525), after moving the bullet (`b.x += b.vx * dt; b.y += b.vy * dt;` in the `else` branch for non-missile), prepend the current position to the trail and trim to 5:

```js
function updatePlayerBullets(dt) {
  for (let i = playerBullets.length - 1; i >= 0; i--) {
    const b = playerBullets[i];
    b.life -= dt;
    if (b.life <= 0 || b.y < -80 || b.x < -40 || b.x > W + 40) {
      playerBullets.splice(i, 1); continue;
    }
    if (b.type === 'missile') {
      // ... homing code unchanged ...
      b.homingDelay -= dt;
      if (b.homingDelay <= 0) {
        let nearX = null, nearY = null, nearD = Infinity;
        if (typeof enemies !== 'undefined') enemies.forEach(e => {
          const d2 = (e.x - b.x) ** 2 + (e.y - b.y) ** 2;
          if (d2 < nearD) { nearD = d2; nearX = e.x; nearY = e.y; }
        });
        if (typeof boss !== 'undefined' && boss) {
          const d2 = (boss.x - b.x) ** 2 + (boss.y - b.y) ** 2;
          if (d2 < nearD) { nearX = boss.x; nearY = boss.y; }
        }
        if (nearX !== null) {
          const dx = nearX - b.x, dy = nearY - b.y;
          const d  = Math.sqrt(dx*dx + dy*dy) || 1;
          b.vx += (dx/d * 340 - b.vx) * dt * 5;
          b.vy += (dy/d * 340 - b.vy) * dt * 5;
        }
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
    } else {
      // Record trail before moving
      if (b.trail) {
        b.trail.unshift({ x: b.x, y: b.y });
        if (b.trail.length > 5) b.trail.length = 5;
      }
      b.x += b.vx * dt; b.y += b.vy * dt;
    }
  }
}
```

**3c. Draw trail for lv3 in `drawPlayerBullets`:**

Replace the existing `else` block (vulcan capsule drawing) with a version that checks `player.weaponLv` and draws a trail for lv3+:

```js
    } else {
      // Vulcan bullet — elongated capsule pellet
      // Draw trail first (behind bullet) for lv3+
      if (b.trail && b.trail.length > 0 && player && player.weaponLv >= 3) {
        const trailLen = player.weaponLv >= 4 ? 5 : 3;
        const pts = b.trail.slice(0, trailLen);
        for (let t = 0; t < pts.length; t++) {
          const alpha = (1 - (t + 1) / (trailLen + 1)) * 0.55;
          ctx.strokeStyle = `rgba(200,240,255,${alpha})`;
          ctx.lineWidth = 2.5 - t * 0.4;
          ctx.beginPath();
          if (t === 0) {
            ctx.moveTo(b.x, b.y);
            ctx.lineTo(pts[t].x, pts[t].y);
          } else {
            ctx.moveTo(pts[t - 1].x, pts[t - 1].y);
            ctx.lineTo(pts[t].x, pts[t].y);
          }
          ctx.stroke();
        }
      }
      // Capsule
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle !== undefined ? b.angle + Math.PI/2 : 0);
      ctx.fillStyle = 'rgba(100,220,255,0.5)';
      ctx.beginPath(); ctx.ellipse(0, 0, 3, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(0, 0, 1.5, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
```

### Verification

1. Level vulcan to lv3 (3 weapon orbs of type VULCAN).
2. Fire and observe: each capsule should have a short fading white-blue line trail behind it (3 segments).
3. At lv1 and lv2 no trail should appear.

### Commit

```
git add index.html
git commit -m "feat: vulcan lv3 short trail, lv4 longer trail (trail array on bullets)"
```

---

## Step 4 — Vulcan Lv4: longer trail (5 positions)

The trail length is already controlled by `trailLen = player.weaponLv >= 4 ? 5 : 3` in the draw code added in Step 3c, and the `trail` array is capped at 5 in Step 3b.

**No additional code change is needed** — lv4 automatically uses 5 trail points.

### Verification

1. Level vulcan to lv4.
2. Fire: trail should be visibly longer than lv3 (5 segments vs 3).

---

## Step 5 — Vulcan Lv5: impact spark on hit

### Changes required

**5a. Detect vulcan bullet–enemy collision and spawn mini-explosion:**

In `checkPlayerBulletsVsEnemies()` (line ~857), add a mini-explosion spawn when a non-piercing vulcan bullet hits, but only when `player.weaponLv === 5`:

```js
function checkPlayerBulletsVsEnemies() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    for (let j = playerBullets.length - 1; j >= 0; j--) {
      const b = playerBullets[j];
      if (circleHit(e.x, e.y, e.r, b.x, b.y, b.r)) {
        e.hp -= b.dmg;
        // [ARCADE] Lv5 Vulcan: spawn impact spark at hit point
        if (b.type === 'bullet' && player && player.weaponLv === 5) {
          spawnExplosion(b.x, b.y, 0.5, '#ffffff');
        }
        if (!b.pierce) { playerBullets.splice(j, 1); j--; }
      }
    }
    if (e.hp <= 0) {
      score += e.score * loopMult;
      saveHS();
      spawnExplosion(e.x, e.y, e.type + 1, e.color);
      tryDropPowerup(e);
      enemies.splice(i, 1);
    }
  }
}
```

**5b. Also add impact spark for vulcan vs boss:**

In `checkPlayerBulletsVsBoss()` (line ~899):

```js
function checkPlayerBulletsVsBoss() {
  if (!boss) return;
  for (let j = playerBullets.length - 1; j >= 0; j--) {
    const b = playerBullets[j];
    if (circleHit(boss.x, boss.y, boss.r, b.x, b.y, b.r)) {
      boss.hp -= b.dmg;
      // [ARCADE] Lv5 Vulcan: impact spark on boss hit
      if (b.type === 'bullet' && player && player.weaponLv === 5) {
        spawnExplosion(b.x, b.y, 0.5, '#ffffff');
      }
      if (!b.pierce) { playerBullets.splice(j, 1); j--; }
    }
  }
  if (boss && boss.hp <= 0) onBossDeath();
}
```

### Verification

1. Level vulcan to lv5 (5 same-type orbs).
2. Shoot enemies: each hit should produce a small white 3-particle flash at the impact point.
3. At lv1–4 no spark should appear.
4. Confirm `spawnExplosion` with size 0.5 produces a small burst (particle count = `6 + 0.5*4 = 8` particles).

### Commit

```
git add index.html
git commit -m "feat: vulcan lv5 impact spark on enemy/boss hit"
```

---

## Summary of all changes in this plan

| File | Lines changed | Description |
|------|--------------|-------------|
| `index.html` | `killPlayer` | Add weapon reset lines |
| `index.html` | `mkVulcanBullet` | Add `trail: []` field |
| `index.html` | `updatePlayerBullets` | Record trail positions |
| `index.html` | `drawPlayerBullets` | Draw trail for lv3+ |
| `index.html` | `checkPlayerBulletsVsEnemies` | Lv5 impact spark |
| `index.html` | `checkPlayerBulletsVsBoss` | Lv5 impact spark |

**No new functions needed.** All changes are additive modifications to existing functions.

# Plan 03 — Lv5 Charged Super-Shot

**Date:** 2026-08-18  
**Goal:** Hold Space ~1 second at lv5 to charge a super-shot. Visual charge ring on player. Three unique super-shot patterns per weapon type. Charge resets on death.  
**Architecture:** Single-file `index.html`. Changes in PLAYER, PLAYER BULLETS sections.  
**Tech Stack:** Vanilla JS, HTML5 Canvas 2D API.  
**Builds on:** Plan 01 (death reset), Plan 02 (spread weapon as weapon 1).  
**Required by:** Plan 06 (boss patterns reference `fireSuper` indirectly — no direct dependency, but consistent naming needed).

---

## Step 1 — Add charge state constants and player fields

### 1a. Add constant (place in CONSTANTS section, after `const STEP = 1 / FPS;`):

```js
const CHARGE_DURATION = 1.0;  // seconds to hold Space for super-shot
```

### 1b. Extend `createPlayer()` return object

Current `createPlayer` (line ~294):

```js
function createPlayer() {
  return {
    x: W / 2, y: H - 100,
    r: 14,
    speed: 280,
    lives: 3,
    bombs: 3,
    invTimer: 0,
    weapon: 0,
    weaponLv: 1,
    shootTimer: 0,
    dead: false,
    respawnTimer: 0,
    gameOverTimer: undefined,
  };
}
```

New `createPlayer`:

```js
function createPlayer() {
  return {
    x: W / 2, y: H - 100,
    r: 14,
    speed: 280,
    lives: 3,
    bombs: 3,
    invTimer: 0,
    weapon: 0,
    weaponLv: 1,
    shootTimer: 0,
    dead: false,
    respawnTimer: 0,
    gameOverTimer: undefined,
    // Charged super-shot state (lv5 only)
    chargeTime:  0,      // seconds Space has been held this charge cycle
    charging:    false,  // true while building up charge
    chargeFired: false,  // true for one frame after super fires (prevents re-trigger)
  };
}
```

### Verification

No visible change. Confirm `player.chargeTime` exists after `startGame()`.

### Commit

```
git add index.html
git commit -m "feat: add charge state fields to player and CHARGE_DURATION constant"
```

---

## Step 2 — Modify `updatePlayer` shooting block

Replace the shooting block in `updatePlayer` (lines ~382–388):

**Current:**

```js
  laserActive = false;
  p.shootTimer -= dt;
  if (keys['Space'] && p.shootTimer <= 0) {
    p.shootTimer = getFireRate(p.weapon, p.weaponLv);
    firePlayer(p);
  }
```

**New:**

```js
  laserActive = false;
  p.shootTimer -= dt;

  if (p.weaponLv === 5) {
    // --- Charged super-shot logic ---
    if (keys['Space']) {
      if (!p.charging) p.charging = true;
      p.chargeTime += dt;
      // Auto-fire when fully charged
      if (p.chargeTime >= CHARGE_DURATION && !p.chargeFired) {
        p.chargeFired = true;
        fireSuper(p);
        p.chargeTime  = 0;
        p.charging    = false;
        p.shootTimer  = 0.3;  // brief cooldown after super
      }
    } else {
      // Space released
      if (p.charging) {
        if (p.chargeTime >= CHARGE_DURATION && !p.chargeFired) {
          // Full charge released
          fireSuper(p);
          p.chargeTime  = 0;
          p.charging    = false;
          p.chargeFired = false;
          p.shootTimer  = 0.3;
        } else if (!p.chargeFired) {
          // Partial release — fire normal shot
          if (p.shootTimer <= 0) {
            p.shootTimer = getFireRate(p.weapon, p.weaponLv);
            firePlayer(p);
          }
          p.chargeTime = 0;
          p.charging   = false;
        }
      } else if (p.shootTimer <= 0) {
        // Normal non-charged fire
        p.shootTimer = getFireRate(p.weapon, p.weaponLv);
        firePlayer(p);
      }
      p.chargeFired = false;  // reset each frame when Space is up
    }
  } else {
    // --- Normal fire (lv1-4) ---
    // Cancel any charge if weapon level dropped below 5
    p.chargeTime = 0;
    p.charging   = false;
    p.chargeFired = false;
    if (keys['Space'] && p.shootTimer <= 0) {
      p.shootTimer = getFireRate(p.weapon, p.weaponLv);
      firePlayer(p);
    }
  }
```

### Verification

1. Level to lv5, hold Space: no normal shots fire while holding.
2. Hold for ~1 second: super fires.
3. Hold briefly and release: normal shot fires.
4. Level down to lv4: normal fire resumes.

### Commit

```
git add index.html
git commit -m "feat: charge shot input logic in updatePlayer for lv5"
```

---

## Step 3 — Add charge ring indicator in `drawPlayer`

Inside `drawPlayer(p)`, after `ctx.restore();` at the end (line ~357), add:

```js
  // Charge ring: shown at weaponLv 5 when charging
  if (p.weaponLv === 5 && p.charging && p.chargeTime > 0) {
    const frac  = Math.min(1, p.chargeTime / CHARGE_DURATION);
    const ringR = 28 + frac * 8;  // ring expands as it fills
    const startAngle = -Math.PI / 2;         // top
    const endAngle   = startAngle + frac * Math.PI * 2;

    // Outer glow
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.shadowColor = WEAPON_COLORS[p.weapon];
    ctx.shadowBlur  = 12 + frac * 16;
    ctx.strokeStyle = WEAPON_COLORS[p.weapon];
    ctx.lineWidth   = 3;
    ctx.globalAlpha = 0.55 + frac * 0.45;
    ctx.beginPath();
    ctx.arc(0, 0, ringR, startAngle, endAngle);
    ctx.stroke();
    // Inner bright arc
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 1.2;
    ctx.globalAlpha = 0.7 * frac;
    ctx.beginPath();
    ctx.arc(0, 0, ringR - 3, startAngle, endAngle);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.shadowBlur  = 0;
    ctx.shadowColor = 'transparent';
  }
```

> **Note:** This block is placed **after** the `ctx.restore()` that closes the player sprite's `ctx.save()`, so it uses canvas coordinates rather than the translated coordinate system.

### Verification

1. At lv5, hold Space: a colored arc appears around the plane, growing clockwise over 1 second.
2. Color matches weapon: orange for Vulcan (#ffaa00), orange for Spread (#ff8800), pink for Missile (#ff4488).
3. At lv1–4: no ring appears.

### Commit

```
git add index.html
git commit -m "feat: charge ring indicator on player sprite at weaponLv 5"
```

---

## Step 4 — Add `fireSuper(p)` function

Add `fireSuper` immediately after `firePlayer` (after line ~523). This function has three weapon branches:

```js
function fireSuper(p) {
  // Super-shot: different pattern per weapon type, all very powerful
  if (p.weapon === 0) {
    // Vulcan super: 12 bullets spanning -120° to +120° (every 20°) from nose
    // -120° to +120° maps to: from -Math.PI*2/3 to +Math.PI*2/3 relative to straight-up
    const UP = -Math.PI / 2;
    const halfArc = Math.PI * 2 / 3;   // 120° in radians
    const count   = 12;
    for (let i = 0; i < count; i++) {
      const a = UP - halfArc + (i / (count - 1)) * (halfArc * 2);
      const b = mkVulcanBullet(p.x, p.y - 22, a);
      b.r   = 6;
      b.dmg = 15;
      playerBullets.push(b);
    }
    sfxShoot(0);
  } else if (p.weapon === 1) {
    // Spread super: 16 bullets in full 360° ring from plane center
    const count = 16;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const b = mkSpreadBullet(p.x, p.y, a, 5);
      b.r   = 7;
      b.dmg = 18;
      playerBullets.push(b);
    }
    sfxShoot(1);
  } else if (p.weapon === 2) {
    // Missile super: 8 homing missiles in a spread, all home immediately (homingDelay: 0)
    const count = 8;
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * 20;
      playerBullets.push({
        type: 'missile',
        x: p.x + offset, y: p.y - 20,
        vx: offset * 0.5, vy: -320,
        r: 6, dmg: 20, life: 2.5,
        homingDelay: 0,  // home immediately
        pierce: false,
      });
    }
    sfxShoot(2);
  }
}
```

### Verification

1. **Vulcan lv5 super:** 12 bullets fan outward in a 240° arc from the nose. Each is slightly larger than normal.
2. **Spread lv5 super:** 16 bullets explode outward in a perfect circle — visible in all directions.
3. **Missile lv5 super:** 8 missiles launch in a spread and immediately home on the nearest enemy/boss.

### Commit

```
git add index.html
git commit -m "feat: fireSuper() for vulcan/spread/missile lv5 charged super-shot"
```

---

## Step 5 — Reset charge state on death

In `killPlayer()` (modified in Plan 01), add charge reset alongside the weapon reset:

```js
function killPlayer() {
  const p = player;
  if (p.invTimer > 0 || p.dead) return;
  p.lives--;
  spawnExplosion(p.x, p.y, 3, '#88ccff');
  playerBullets.length = 0;
  laserActive = false;
  // [ARCADE] Weapon resets to Vulcan Lv1 on any death
  p.weapon    = 0;
  p.weaponLv  = 1;
  // Reset charge state
  p.chargeTime  = 0;
  p.charging    = false;
  p.chargeFired = false;
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

While charging at lv5, let an enemy hit the player. The charge ring should disappear immediately. After respawn, player is at Vulcan lv1 with no charge state.

### Commit

```
git add index.html
git commit -m "feat: reset charge state on death in killPlayer"
```

---

## Summary of all changes in this plan

| File | Location | Description |
|------|----------|-------------|
| `index.html` | CONSTANTS | Add `CHARGE_DURATION = 1.0` |
| `index.html` | `createPlayer` | Add `chargeTime`, `charging`, `chargeFired` fields |
| `index.html` | `updatePlayer` shooting block | Replace simple fire with charge/normal split |
| `index.html` | `drawPlayer` | Add charge ring arc after sprite draw |
| `index.html` | After `firePlayer` | Add `fireSuper(p)` — 3 weapon branches |
| `index.html` | `killPlayer` | Add charge state reset |

**New function:** `fireSuper(p)`.  
**Naming contract:** `fireSuper` is the canonical name used by Plan 06 as well.

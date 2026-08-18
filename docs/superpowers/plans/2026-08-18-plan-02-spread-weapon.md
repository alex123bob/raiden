# Plan 02 — Spread Shot Weapon (Replace Plasma)

**Date:** 2026-08-18  
**Goal:** Replace weapon 1 (Plasma) with Spread Shot. Per-level visual transformation from narrow orange teardrops to wide glowing fan.  
**Architecture:** Single-file `index.html`. Changes in AUDIO, PLAYER BULLETS, and POWERUPS sections.  
**Tech Stack:** Vanilla JS, HTML5 Canvas 2D API, Web Audio API.  
**Builds on:** Plan 01 (death reset already in place).  
**Required by:** Plan 03 (super-shot weapon===1 branch).

---

## Step 1 — Remove Plasma; rename weapon 1 constants

### 1a. Update `WEAPON_NAMES` and `WEAPON_COLORS`

Current (line ~789):

```js
const WEAPON_NAMES  = ['VULCAN', 'PLASMA', 'MISSILE'];
const WEAPON_COLORS = ['#ffaa00', '#cc44ff', '#ff4488'];
```

New:

```js
const WEAPON_NAMES  = ['VULCAN', 'SPREAD', 'MISSILE'];
const WEAPON_COLORS = ['#ffaa00', '#ff8800', '#ff4488'];
```

### 1b. Update `sfxShoot` — replace plasma branch with spread sound

Current plasma branch in `sfxShoot` (line ~120):

```js
if (weapon === 1) {
  // Plasma: deep whomp — sine wave, low freq, longer decay
  osc.type = 'sine';
  osc.frequency.setValueAtTime(180, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(60, ac.currentTime + 0.18);
  gain.gain.setValueAtTime(0.22, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.22);
  osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.22);
}
```

Replace with spread sound (medium-pitch square wave, slightly longer than vulcan):

```js
if (weapon === 1) {
  // Spread: medium-pitch square wave burst, slightly longer than vulcan
  osc.type = 'square';
  osc.frequency.setValueAtTime(520 + Math.random() * 60, ac.currentTime);
  osc.frequency.exponentialRampToValueAtTime(260, ac.currentTime + 0.14);
  gain.gain.setValueAtTime(0.10, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
  osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.15);
}
```

### Verification

Open the game, collect a weapon orb of type index 1 (labeled `S`). HUD should display `SPREAD Lv1` in orange. Sound when firing should be a mid-pitched burst.

### Commit

```
git add index.html
git commit -m "feat: rename weapon 1 from PLASMA to SPREAD, update sfx"
```

---

## Step 2 — Add `mkSpreadBullet(x, y, angle, lv)` factory

Add this function immediately after `mkVulcanBullet` (after line ~453):

```js
function mkSpreadBullet(x, y, angle, lv) {
  const spd = 380;
  return {
    type: 'spread',
    x, y,
    vx: Math.cos(angle) * spd,
    vy: Math.sin(angle) * spd,
    angle,         // store for oriented teardrop drawing
    r: 5 + lv,    // r=6 at lv1 ... r=10 at lv5
    dmg: 10 + lv * 3,  // 13 at lv1 ... 25 at lv5
    life: 2.0,
    lv,
    pierce: false,
  };
}
```

### Verification

No visible change yet — factory added, not yet called.

---

## Step 3 — Add Spread firing in `firePlayer` (weapon===1 branch)

Replace the entire `else if (p.weapon === 1)` block in `firePlayer` (lines ~475–505):

```js
  } else if (p.weapon === 1) {
    // Spread Shot — fan of bullets, count and spread angle grow with level
    const lv = p.weaponLv;
    // Bullet counts per level: 3, 4, 5, 5+2side, 7
    const UP = -Math.PI / 2;  // straight up direction

    if (lv === 1) {
      // 3 bullets, fan ±0.30 rad
      const angles = [UP - 0.30, UP, UP + 0.30];
      angles.forEach(a => playerBullets.push(mkSpreadBullet(p.x, p.y - 20, a, lv)));
    } else if (lv === 2) {
      // 4 bullets, fan ±0.35 rad (evenly spaced)
      const half = 0.35;
      for (let i = 0; i < 4; i++) {
        const a = UP - half + (i / 3) * (half * 2);
        playerBullets.push(mkSpreadBullet(p.x, p.y - 20, a, lv));
      }
    } else if (lv === 3) {
      // 5 bullets, fan ±0.40 rad (evenly spaced)
      const half = 0.40;
      for (let i = 0; i < 5; i++) {
        const a = UP - half + (i / 4) * (half * 2);
        playerBullets.push(mkSpreadBullet(p.x, p.y - 20, a, lv));
      }
    } else if (lv === 4) {
      // 5 bullets fan ±0.40 rad + 2 wide diagonal side shots at ±0.70 rad
      const half = 0.40;
      for (let i = 0; i < 5; i++) {
        const a = UP - half + (i / 4) * (half * 2);
        playerBullets.push(mkSpreadBullet(p.x, p.y - 20, a, lv));
      }
      playerBullets.push(mkSpreadBullet(p.x - 12, p.y - 14, UP - 0.70, lv));
      playerBullets.push(mkSpreadBullet(p.x + 12, p.y - 14, UP + 0.70, lv));
    } else { // lv === 5
      // 7 bullets, wide fan ±0.50 rad (evenly spaced)
      const half = 0.50;
      for (let i = 0; i < 7; i++) {
        const a = UP - half + (i / 6) * (half * 2);
        playerBullets.push(mkSpreadBullet(p.x, p.y - 20, a, lv));
      }
    }
    sfxShoot(1);
  }
```

### Verification

1. Collect SPREAD orb (labeled `S`), fire at lv1: 3 orange bullets in a narrow fan.
2. Level up to lv4: 7 total bullets, two obvious diagonal outliers.
3. Level up to lv5: 7 bullets in wider arc.

### Commit

```
git add index.html
git commit -m "feat: spread shot firing logic lv1-5"
```

---

## Step 4 — Draw spread bullets in `drawPlayerBullets`

Replace the `if (b.type === 'plasma')` block in `drawPlayerBullets`. The new spread drawing block should be placed first in the `forEach` callback:

```js
  playerBullets.forEach(b => {
    if (b.type === 'spread') {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle + Math.PI / 2);  // point elongated axis along travel

      const lv = b.lv;

      if (lv <= 2) {
        // Lv1-2: small orange teardrop (elongated ellipse)
        const w = 4 + lv * 1, h = 8 + lv * 2;
        ctx.fillStyle = '#ff8800';
        ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); ctx.fill();
        // Small bright tip
        ctx.fillStyle = '#ffcc44';
        ctx.beginPath(); ctx.ellipse(0, -h * 0.45, w * 0.5, h * 0.3, 0, 0, Math.PI * 2); ctx.fill();
      } else if (lv === 3) {
        // Lv3: orange/yellow teardrop with bright yellow core
        const w = 6, h = 11;
        ctx.fillStyle = '#ff7700';
        ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); ctx.fill();
        // Yellow core
        ctx.fillStyle = '#ffee00';
        ctx.beginPath(); ctx.ellipse(0, -h * 0.25, w * 0.55, h * 0.45, 0, 0, Math.PI * 2); ctx.fill();
        // White tip spark
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, -h * 0.6, 2, 0, Math.PI * 2); ctx.fill();
      } else if (lv === 4) {
        // Lv4: orange/yellow teardrop with short orange trail lines
        const w = 7, h = 12;
        // Trail
        ctx.strokeStyle = 'rgba(255,140,0,0.4)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, h * 0.3); ctx.lineTo(0, h * 1.1); ctx.stroke();
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-w * 0.5, h * 0.6); ctx.lineTo(-w * 0.3, h * 1.2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo( w * 0.5, h * 0.6); ctx.lineTo( w * 0.3, h * 1.2); ctx.stroke();
        // Body
        ctx.fillStyle = '#ff7700';
        ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath(); ctx.ellipse(0, -h * 0.25, w * 0.6, h * 0.45, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, -h * 0.6, 2, 0, Math.PI * 2); ctx.fill();
      } else { // lv === 5
        // Lv5: large orange/red teardrop with outer glow ring
        const w = 9, h = 15;
        // Outer glow ring
        ctx.strokeStyle = 'rgba(255,100,0,0.35)';
        ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(0, 0, w + 5, h + 5, 0, 0, Math.PI * 2); ctx.stroke();
        // Main body
        const grad = ctx.createRadialGradient(0, -h * 0.2, 1, 0, 0, h);
        grad.addColorStop(0,   '#ffff88');
        grad.addColorStop(0.3, '#ff8800');
        grad.addColorStop(1,   '#cc2200');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2); ctx.fill();
        // Bright core
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, -h * 0.45, 3, 0, Math.PI * 2); ctx.fill();
      }

      ctx.restore();
    } else if (b.type === 'missile') {
```

> **Note:** The `} else if (b.type === 'missile')` continues the existing missile draw block unchanged. The old `if (b.type === 'plasma')` block is removed.

### Verification

1. Lv1: small orange teardrop bullets in a fan.
2. Lv3: orange bullets with a visible yellow-white core.
3. Lv4: trail lines visible behind the teardrop.
4. Lv5: larger bullets with a glowing orange ring aura.

### Commit

```
git add index.html
git commit -m "feat: spread bullet visual drawing lv1-5 (teardrop gradient)"
```

---

## Step 5 — Verify collision works for spread

Spread bullets use `type: 'spread'` but `circleHit` in `checkPlayerBulletsVsEnemies` and `checkPlayerBulletsVsBoss` tests `b.x, b.y, b.r` — it does not branch on `b.type`. **No changes needed.**

Confirm by shooting spread bullets at an enemy: they should deal damage and disappear on hit (since `pierce: false`).

---

## Step 6 — Confirm `getFireRate` for weapon 1

Current (line ~435):

```js
function getFireRate(weapon, lv) {
  if (weapon === 1) return Math.max(0.18, 0.30 - lv * 0.025); // plasma: slow but hard-hitting
  return Math.max(0.05, 0.13 - lv * 0.015);
}
```

The comment says "plasma" but the fire rate values (0.18–0.30s) are appropriate for Spread Shot as well (medium fire rate). Update the comment only:

```js
function getFireRate(weapon, lv) {
  if (weapon === 1) return Math.max(0.18, 0.30 - lv * 0.025); // spread: medium fire rate
  return Math.max(0.05, 0.13 - lv * 0.015);   // vulcan/missile
}
```

### Commit

```
git add index.html
git commit -m "docs: update getFireRate comment for spread weapon"
```

---

## Summary of all changes in this plan

| File | Location | Description |
|------|----------|-------------|
| `index.html` | `WEAPON_NAMES` / `WEAPON_COLORS` | Rename PLASMA→SPREAD, recolor |
| `index.html` | `sfxShoot` weapon===1 branch | Replace plasma whomp with spread burst |
| `index.html` | After `mkVulcanBullet` | Add `mkSpreadBullet(x, y, angle, lv)` |
| `index.html` | `firePlayer` weapon===1 block | Replace plasma with spread fan firing |
| `index.html` | `drawPlayerBullets` plasma block | Replace plasma draw with spread teardrop draw |
| `index.html` | `getFireRate` comment | Update comment only |

**Removed:** All plasma bullet spawn and draw code.  
**Added:** `mkSpreadBullet`, spread fan firing (5 level variants), spread teardrop drawing (5 level variants), spread sfx.

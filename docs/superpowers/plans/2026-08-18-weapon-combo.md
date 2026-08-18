# Weapon Combo System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single `weapon`/`weaponLv` fields with a FIFO weapon slot system holding up to 2 weapons simultaneously; all active weapons fire together with combo-adjusted angles; each weapon keeps its own level independently; death resets to Vulcan Lv1 solo.

**Architecture:** Single file `index.html`. Player object gets `weapons: [{type, lv}]` array (FIFO, max 2) replacing `weapon`/`weaponLv`. `firePlayer` fires all slots. `checkPlayerVsPowerups` manages FIFO insertion. All references to `player.weapon` and `player.weaponLv` updated throughout. Charge ring uses primary (first) weapon color.

**Tech Stack:** Vanilla JS, HTML5 Canvas 2D API.

---

## Combo angle rules

When 2 weapons are active, each fires at an **offset from straight-up** (`-Math.PI/2`):

| Slot position | Solo angle offset | Combo angle offset |
|---|---|---|
| Weapon in slot 0 (oldest) | 0 (straight up) | −0.26 rad (≈ −15°, angled left) |
| Weapon in slot 1 (newest) | 0 (straight up) | +0.26 rad (≈ +15°, angled right) |

Special case — **Spread + anything**: spread's fan base angle shifts by the offset (the whole fan tilts), making it cover the left or right half instead of centered.

Special case — **Missile + anything**: missiles' initial spread offset doubles (wider initial spread) so they don't cluster with the other weapon's bullets.

A helper `comboOffset(slotIndex, totalSlots)` returns the angle offset:
- `totalSlots === 1`: returns `0`
- `totalSlots === 2` and `slotIndex === 0`: returns `-0.26`
- `totalSlots === 2` and `slotIndex === 1`: returns `+0.26`

---

## HUD changes

Bottom-right: show all active weapons. If 2 weapons:
```
VULCAN Lv2 + SPREAD Lv1
```
Colors: each weapon name uses its own `WEAPON_COLORS[type]`.

Charge ring: uses `WEAPON_COLORS[p.weapons[0].type]` (primary weapon = oldest slot).

---

## Task 1: Replace weapon fields in player object

**Files:**
- Modify: `index.html` — `createPlayer`, `killPlayer`, `drawPlayer` (charge ring), `drawHUD`, `updatePlayer` (charge logic), `checkPlayerVsPowerups`

- [ ] **Step 1: Update `createPlayer`**

Find `createPlayer()` and replace `weapon: 0, weaponLv: 1,` with:

```js
    weapons: [{ type: 0, lv: 1 }],  // FIFO queue, max 2. Each: {type:0-2, lv:1-5}
```

Remove `weapon: 0,` and `weaponLv: 1,` entirely.

- [ ] **Step 2: Update `killPlayer` — reset to Vulcan Lv1 solo**

Find these two lines in `killPlayer`:
```js
  p.weapon    = 0;
  p.weaponLv  = 1;
```
Replace with:
```js
  p.weapons = [{ type: 0, lv: 1 }];
```

- [ ] **Step 3: Add `comboOffset` helper**

Add immediately after `mkSpreadBullet`:

```js
// Returns the angle offset (radians) for a weapon at slotIndex in a combo of totalSlots
function comboOffset(slotIndex, totalSlots) {
  if (totalSlots === 1) return 0;
  return slotIndex === 0 ? -0.26 : 0.26;
}
```

- [ ] **Step 4: Verify syntax**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('/Users/jiali/personal_github_repos/raiden/index.html', 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
try { new Function(m[1]); console.log('syntax OK'); } catch(e) { console.error('SYNTAX ERROR:', e.message); }
"
```

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: replace weapon/weaponLv with weapons[] FIFO array, add comboOffset helper"
```

---

## Task 2: Update firePlayer to fire all slots with combo angles

**Files:**
- Modify: `index.html` — `firePlayer`, `getFireRate`

- [ ] **Step 1: Rewrite `firePlayer`**

Replace the entire `firePlayer(p)` function with:

```js
// Called once per fire-rate tick when SPACE held — fires all active weapon slots
function firePlayer(p) {
  const total = p.weapons.length;
  p.weapons.forEach((slot, idx) => {
    const lv  = slot.lv;
    const off = comboOffset(idx, total);  // angle offset for this slot
    const UP  = -Math.PI / 2;

    if (slot.type === 0) {
      // --- VULCAN ---
      // In combo: whole pair shifts left/right by off
      const spread = lv >= 3 ? 0.18 : 0;
      playerBullets.push(mkVulcanBullet(p.x - 8, p.y - 20, UP + off - spread));
      playerBullets.push(mkVulcanBullet(p.x + 8, p.y - 20, UP + off + spread));
      if (lv >= 4) {
        playerBullets.push(mkVulcanBullet(p.x - 18, p.y - 8, UP + off - 0.38));
        playerBullets.push(mkVulcanBullet(p.x + 18, p.y - 8, UP + off + 0.38));
      }
      if (lv >= 5) {
        playerBullets.push(mkVulcanBullet(p.x, p.y - 22, UP + off));
      }
      sfxShoot(0);

    } else if (slot.type === 1) {
      // --- SPREAD ---
      // In combo: whole fan base angle shifts by off (fan tilts left or right)
      if (lv === 1) {
        const angles = [UP + off - 0.30, UP + off, UP + off + 0.30];
        angles.forEach(a => playerBullets.push(mkSpreadBullet(p.x, p.y - 20, a, lv)));
      } else if (lv === 2) {
        const half = 0.35;
        for (let i = 0; i < 4; i++) {
          const a = UP + off - half + (i / 3) * (half * 2);
          playerBullets.push(mkSpreadBullet(p.x, p.y - 20, a, lv));
        }
      } else if (lv === 3) {
        const half = 0.40;
        for (let i = 0; i < 5; i++) {
          const a = UP + off - half + (i / 4) * (half * 2);
          playerBullets.push(mkSpreadBullet(p.x, p.y - 20, a, lv));
        }
      } else if (lv === 4) {
        const half = 0.40;
        for (let i = 0; i < 5; i++) {
          const a = UP + off - half + (i / 4) * (half * 2);
          playerBullets.push(mkSpreadBullet(p.x, p.y - 20, a, lv));
        }
        playerBullets.push(mkSpreadBullet(p.x - 12, p.y - 14, UP + off - 0.70, lv));
        playerBullets.push(mkSpreadBullet(p.x + 12, p.y - 14, UP + off + 0.70, lv));
      } else {
        const half = 0.50;
        for (let i = 0; i < 7; i++) {
          const a = UP + off - half + (i / 6) * (half * 2);
          playerBullets.push(mkSpreadBullet(p.x, p.y - 20, a, lv));
        }
      }
      sfxShoot(1);

    } else if (slot.type === 2) {
      // --- MISSILE ---
      // In combo: initial spread widens (missiles offset further outward)
      const missileSpread = total > 1 ? 1.6 : 1.0; // wider spread in combo
      const counts = [2, 2, 3, 4, 5];
      const count  = counts[lv - 1];
      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * 16 * missileSpread;
        playerBullets.push({
          type: 'missile',
          x: p.x + offset, y: p.y - 20,
          vx: offset * 0.6 + Math.sin(off) * 80,  // slight directional bias from combo offset
          vy: -320,
          r: 5, dmg: 8, life: 2.2,
          homingDelay: 0.15 + i * 0.04,
          pierce: false,
        });
      }
      sfxShoot(2);
    }
  });
}
```

- [ ] **Step 2: Update `getFireRate` to use primary weapon (slot 0)**

Replace `getFireRate(weapon, lv)` call sites in `updatePlayer`. The fire rate is driven by the **primary** (oldest) weapon:

Find all calls like `getFireRate(p.weapon, p.weaponLv)` and replace with `getFireRate(p.weapons[0].type, p.weapons[0].lv)`.

There are 3 such calls in `updatePlayer`. Replace all three.

- [ ] **Step 3: Verify syntax**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('/Users/jiali/personal_github_repos/raiden/index.html', 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
try { new Function(m[1]); console.log('syntax OK'); } catch(e) { console.error('SYNTAX ERROR:', e.message); }
"
```

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: firePlayer fires all weapon slots with combo angle offsets"
```

---

## Task 3: Update fireSuper to use all slots

**Files:**
- Modify: `index.html` — `fireSuper(p)`

- [ ] **Step 1: Rewrite `fireSuper`**

Replace the entire `fireSuper(p)` function with:

```js
function fireSuper(p) {
  const total = p.weapons.length;
  p.weapons.forEach((slot, idx) => {
    const off = comboOffset(idx, total);
    const UP  = -Math.PI / 2;

    if (slot.type === 0) {
      // Vulcan super: 12 bullets in 240° arc, tilted by combo offset
      const halfArc = Math.PI * 2 / 3;
      const count   = 12;
      for (let i = 0; i < count; i++) {
        const a = UP + off - halfArc + (i / (count - 1)) * (halfArc * 2);
        const b = mkVulcanBullet(p.x, p.y - 22, a);
        b.r = 6; b.dmg = 15;
        playerBullets.push(b);
      }
      sfxShoot(0);
    } else if (slot.type === 1) {
      // Spread super: 16 bullets in full 360° ring, rotated by combo offset
      const count = 16;
      for (let i = 0; i < count; i++) {
        const a = off + (i / count) * Math.PI * 2;
        const b = mkSpreadBullet(p.x, p.y, a, 5);
        b.r = 7; b.dmg = 18;
        playerBullets.push(b);
      }
      sfxShoot(1);
    } else if (slot.type === 2) {
      // Missile super: 8 homing missiles, wider spread in combo
      const count = 8;
      const spreadMul = total > 1 ? 1.8 : 1.0;
      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * 20 * spreadMul;
        playerBullets.push({
          type: 'missile',
          x: p.x + offset, y: p.y - 20,
          vx: offset * 0.5 + Math.sin(off) * 80,
          vy: -320,
          r: 6, dmg: 20, life: 2.5,
          homingDelay: 0,
          pierce: false,
        });
      }
      sfxShoot(2);
    }
  });
}
```

- [ ] **Step 2: Update charge ring to use primary weapon color**

In `drawPlayer`, find:
```js
    ctx.shadowColor = WEAPON_COLORS[p.weapon];
    ctx.strokeStyle = WEAPON_COLORS[p.weapon];
```
Replace with:
```js
    const primaryColor = WEAPON_COLORS[p.weapons[0].type];
    ctx.shadowColor = primaryColor;
    ctx.strokeStyle = primaryColor;
```

Also fix the charge condition — currently checks `p.weaponLv === 5`. Change to check the **primary** slot:
```js
  if (p.weapons[0].lv === 5 && p.charging && p.chargeTime > 0) {
```

- [ ] **Step 3: Update charge logic in updatePlayer**

The charge condition currently checks `p.weaponLv === 5`. Replace all `p.weaponLv === 5` in `updatePlayer` with `p.weapons[0].lv === 5`.

Also replace `getFireRate(p.weapon, p.weaponLv)` with `getFireRate(p.weapons[0].type, p.weapons[0].lv)` (already done in Task 2 Step 2 — confirm no remaining references).

Also replace the trail check in `drawPlayerBullets`:
```js
      if (b.trail && b.trail.length > 0 && player && player.weaponLv >= 3) {
        const trailLen = player.weaponLv >= 4 ? 5 : 3;
```
The trail level is stored on the bullet itself (`b` comes from `mkVulcanBullet` which uses the level at time of fire). But we need the level — it's not on the bullet. Fix: store `lv` on vulcan bullets too. In `mkVulcanBullet`, add `lv: 1` as a default, and in `firePlayer` set `b.lv = lv` on each bullet after creation. Then in `drawPlayerBullets` use `b.lv`:
```js
      if (b.trail && b.trail.length > 0 && b.lv >= 3) {
        const trailLen = b.lv >= 4 ? 5 : 3;
```

Also fix the impact spark checks in both collision functions:
```js
        if (b.type === 'bullet' && player && player.weaponLv === 5) {
```
Replace with:
```js
        if (b.type === 'bullet' && b.lv === 5) {
```

- [ ] **Step 4: Verify syntax**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('/Users/jiali/personal_github_repos/raiden/index.html', 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
try { new Function(m[1]); console.log('syntax OK'); } catch(e) { console.error('SYNTAX ERROR:', e.message); }
"
```

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: fireSuper uses all weapon slots, fix lv references on bullets"
```

---

## Task 4: Update pickup logic (FIFO queue management)

**Files:**
- Modify: `index.html` — `checkPlayerVsPowerups`

- [ ] **Step 1: Rewrite `checkPlayerVsPowerups`**

Replace the entire function:

```js
function checkPlayerVsPowerups() {
  if (!player || player.dead) return;
  for (let i = powerups.length - 1; i >= 0; i--) {
    const pw = powerups[i];
    if (!circleHit(pw.x, pw.y, pw.r, player.x, player.y, player.r + 10)) continue;

    sfxPowerup();

    if (pw.isBomb) {
      player.bombs = Math.min(3, player.bombs + 1);
    } else {
      const slots = player.weapons;
      // Find if this weapon type is already in a slot
      const existing = slots.findIndex(s => s.type === pw.type);

      if (existing !== -1) {
        // [ARCADE] Same type already held: level up that slot (cap 5)
        slots[existing].lv = Math.min(5, slots[existing].lv + 1);
      } else {
        // New weapon type — add to FIFO queue
        if (slots.length >= 2) {
          // [COMBO] At max slots: evict the oldest (index 0)
          slots.shift();
        }
        // New weapon enters at Lv1
        slots.push({ type: pw.type, lv: 1 });
      }
    }

    powerups.splice(i, 1);
  }
}
```

- [ ] **Step 2: Verify syntax**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('/Users/jiali/personal_github_repos/raiden/index.html', 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
try { new Function(m[1]); console.log('syntax OK'); } catch(e) { console.error('SYNTAX ERROR:', e.message); }
"
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: weapon pickup FIFO — same type levels up, new type enters Lv1, evicts oldest at max 2"
```

---

## Task 5: Update HUD to show all active weapons

**Files:**
- Modify: `index.html` — `drawHUD`

- [ ] **Step 1: Update weapon display in `drawHUD`**

Find the weapon display block in `drawHUD` (bottom-right):
```js
  ctx.fillStyle = WEAPON_COLORS[player.weapon];
  ctx.textAlign = 'right';
  ctx.font = '12px monospace';
  ctx.fillText(WEAPON_NAMES[player.weapon] + ' Lv' + player.weaponLv, W - 8, H - 8);
```

Replace with:

```js
  // Weapon slots — show all active weapons (max 2), right-aligned, stacked if combo
  ctx.textAlign = 'right';
  ctx.font = '12px monospace';
  const slots = player.weapons;
  if (slots.length === 1) {
    ctx.fillStyle = WEAPON_COLORS[slots[0].type];
    ctx.fillText(WEAPON_NAMES[slots[0].type] + ' Lv' + slots[0].lv, W - 8, H - 8);
  } else {
    // Two weapons: show on two lines
    slots.forEach((slot, i) => {
      ctx.fillStyle = WEAPON_COLORS[slot.type];
      ctx.fillText(WEAPON_NAMES[slot.type] + ' Lv' + slot.lv, W - 8, H - 8 - i * 16);
    });
  }
```

- [ ] **Step 2: Verify syntax**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('/Users/jiali/personal_github_repos/raiden/index.html', 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
try { new Function(m[1]); console.log('syntax OK'); } catch(e) { console.error('SYNTAX ERROR:', e.message); }
"
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: HUD shows all active weapon slots with individual colors and levels"
```

---

## Task 6: Fix remaining player.weapon / player.weaponLv references

**Files:**
- Modify: `index.html` — scan and fix all remaining `player.weapon` / `player.weaponLv` / `p.weapon` / `p.weaponLv` references outside the functions already updated

- [ ] **Step 1: Search for remaining references**

```bash
grep -n "p\.weapon[^s]\\|player\.weapon[^s]\\|p\.weaponLv\\|player\.weaponLv" /Users/jiali/personal_github_repos/raiden/index.html
```

Common remaining locations:
- `drawPowerups`: uses `WEAPON_NAMES[pw.type]` — this is `pw.type`, not `player.weapon`, so already fine
- Any remaining `player.weaponLv === 5` checks in updatePlayer (should be `player.weapons[0].lv === 5`)
- Any `p.weapon` in `updatePlayer` not yet fixed

Fix each one found. Typical fixes:
- `p.weapon` → `p.weapons[0].type`
- `p.weaponLv` → `p.weapons[0].lv`
- `player.weapon` → `player.weapons[0].type`
- `player.weaponLv` → `player.weapons[0].lv`

- [ ] **Step 2: Verify syntax after all fixes**

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('/Users/jiali/personal_github_repos/raiden/index.html', 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
try { new Function(m[1]); console.log('syntax OK'); } catch(e) { console.error('SYNTAX ERROR:', e.message); }
"
```

- [ ] **Step 3: Confirm zero remaining bad references**

```bash
grep -n "p\.weapon[^s]\|player\.weapon[^s]\|p\.weaponLv\|player\.weaponLv" /Users/jiali/personal_github_repos/raiden/index.html
```

Expected output: empty (no matches).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "fix: remove all remaining player.weapon/weaponLv references, use weapons[] array"
```

---

## Self-review: spec coverage

| Requirement | Task |
|---|---|
| `weapons[]` FIFO array replaces `weapon`/`weaponLv` | Task 1 |
| Max 2 weapons, FIFO eviction of oldest | Task 4 |
| Same type → level up existing slot | Task 4 |
| New type → enters at Lv1 | Task 4 |
| Bomb pickup unchanged | Task 4 |
| `comboOffset` helper (0 for solo, ±0.26 for combo) | Task 1 |
| `firePlayer` fires all slots with combo offsets | Task 2 |
| Vulcan combo: whole pair tilts by offset | Task 2 |
| Spread combo: whole fan base angle shifts | Task 2 |
| Missile combo: wider initial spread + directional bias | Task 2 |
| `fireSuper` fires all slots with combo offsets | Task 3 |
| Charge ring uses primary weapon color | Task 3 |
| Charge condition uses primary slot lv | Task 3 |
| Vulcan trail/impact uses `b.lv` not `player.weaponLv` | Task 3 |
| HUD shows all active weapons with colors | Task 5 |
| Death resets to `weapons: [{type:0, lv:1}]` | Task 1 |
| No stale `player.weapon`/`weaponLv` refs | Task 6 |

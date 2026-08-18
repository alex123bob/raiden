# Raiden — Expanded Game Design Spec

Date: 2026-08-18

## Overview

Expand the existing Raiden clone (`index.html`) from a 2-stage loop into a full 8-stage arcade campaign with distinct visual themes, unique bosses, a reworked weapon system with per-level visual transformation and lv5 charged super-shots, a new spread-shot weapon replacing plasma, and weapon reset on death.

---

## 1. Stage Structure

8 stages in a linear progression. After Stage 8:
- **First clear:** "MISSION COMPLETE" victory screen with final score, then return to title.
- **Subsequent clears:** Loop restart from Stage 1 with a cumulative difficulty multiplier (loopMult++), matching classic arcade loop behavior. HUD shows "Loop N".

Stage clear banner appears between every stage (3 seconds), same as current.

---

## 2. Stage Themes

Each stage has: a background palette + scrolling element set, an enemy mix emphasis, and a unique boss.

### Stage 1 — Deep Space
- **Background:** Dark blue-black, 3-layer white/blue starfield (current)
- **Enemy mix:** Fighter formations, gunship pairs — tutorial feel, moderate density
- **Boss:** Rotating-arm boss (current Boss 1, 4 arms, 3 phases)

### Stage 2 — Asteroid Belt
- **Background:** Dark grey/brown; 2 layers of slowly drifting grey oval rocks + sparse stars
- **Enemy mix:** Bomber-heavy + turret clusters
- **Boss:** Heavy Crusher — 6-arm rotating boss, wide body (r=60), slower movement, 3 phases, fires dense slow bullet rings

### Stage 3 — Red Nebula
- **Background:** Deep crimson; wispy red/pink cloud streaks scrolling at medium speed + red-tinted stars
- **Enemy mix:** Fast fighter swarms, gunship pairs in tight formations
- **Boss:** Twin Cannon — two large cannons on either side of a central body, fires alternating aimed streams from each cannon, 3 phases

### Stage 4 — Acid Planet
- **Background:** Sickly green/yellow; drifting toxic bubble clusters + green-tinted debris particles
- **Enemy mix:** Dense turret clusters + bombers
- **Boss:** Mine Layer — slow-moving boss that periodically drops stationary mine bullets (linger on screen), plus aimed bursts, 3 phases

### Stage 5 — Solar Storm
- **Background:** Orange/amber; fast-scrolling horizontal energy streaks/flares across a deep orange sky
- **Enemy mix:** Dense fighter rushes, fast gunships
- **Boss:** Solar Core — fires rotating solar beam (wide sweeping line of bullets), plus aimed streams, 3 phases

### Stage 6 — Enemy Fleet
- **Background:** Dark industrial grey; large slow-scrolling ship hull segments (dark rectangles with rivets/ports drawn procedurally) + stars
- **Enemy mix:** Heavy gunships + bombers, few fighters
- **Boss:** Carrier — large boss (r=65) that spawns small fighter minions periodically in addition to its own attack patterns, 4 phases

### Stage 7 — The Void
- **Background:** Pure black; slow drifting purple energy wisps (faint arcs/curves) + occasional purple star clusters
- **Enemy mix:** Mixed all types, faster and denser than any previous stage
- **Boss:** Phantom — periodically turns semi-transparent (alpha 0.3) for 2 seconds making it hard to target, fast attack patterns, 4 phases

### Stage 8 — Mothership Interior
- **Background:** Dark red/maroon; pulsing organic wall segments on left and right edges (slow sine-wave animation) + red energy particles drifting upward
- **Enemy mix:** Elite versions of all enemy types (1.5× HP, faster fire), dense
- **Boss:** Mothership Core — largest boss (r=75), 5 phases, combines all previous attack patterns, spawns minions in final phase. On death: extended explosion sequence before victory screen.

---

## 3. Weapons

Three weapon types. Current weapon 0 (Vulcan) and weapon 2 (Missile) remain. Weapon 1 (Plasma) is replaced by **Spread Shot**.

### Weapon 0: Vulcan
Rapid-fire twin forward guns. Fast pellets, low damage per shot.

| Level | Behavior | Visual |
|-------|----------|--------|
| 1 | Twin forward pellets | White capsule pellets |
| 2 | Twin pellets, slightly faster fire rate | Cyan-tinted capsules |
| 3 | Twin + narrow spread (±0.18 rad) | Cyan capsules with short white trail |
| 4 | Twin + spread + outer pair | Cyan capsules with longer trail |
| 5 | All of above + center gun | Cyan capsules with trail + small impact spark on hit |

**Lv5 Super-shot (hold Space ~1s):** Giant spread burst — fires ~12 vulcan pellets in a wide 120° arc simultaneously.

### Weapon 1: Spread Shot
Wide fan of bullets. Medium speed, medium damage. Covers horizontal area.

| Level | Behavior | Visual |
|-------|----------|--------|
| 1 | 3-bullet fan, narrow spread | Small orange teardrop bullets |
| 2 | 4-bullet fan, slightly wider | Orange teardrops, slightly larger |
| 3 | 5-bullet fan, medium spread | Orange teardrops with yellow core |
| 4 | 5-bullet fan + 2 diagonal side shots | Orange/yellow teardrops |
| 5 | 7-bullet wide fan | Large orange/red teardrops with glow |

**Lv5 Super-shot (hold Space ~1s):** Full 360° ring — fires 16 small bullets in all directions simultaneously.

### Weapon 2: Missile
Homing missiles that curve toward nearest enemy. High damage per hit.

| Level | Behavior | Visual |
|-------|----------|--------|
| 1 | 2 missiles | Small orange dot with exhaust |
| 2 | 2 larger missiles | Orange dot, longer exhaust trail |
| 3 | 3 missiles | Orange dot, trail + faint smoke |
| 4 | 4 missiles | Elongated orange teardrop + trail |
| 5 | 5 missiles, faster homing | Elongated teardrop + trail + spark at tip |

**Lv5 Super-shot (hold Space ~1s):** 8 homing missiles fired simultaneously in a spread, all home on nearest enemies.

---

## 4. Upgrade System

### Pickup rules (existing, unchanged)
- Same-type orb: level up by 1 (cap lv5)
- Different-type orb: switch weapon, reset to lv1 (arcade-authentic downgrade-on-switch)
- Bomb orb: +1 bomb (cap 3)

### Charged super-shot (new)
- Only available at **lv5**
- Hold Space for **1.0 seconds** continuously to charge
- A **charge indicator** appears on the player sprite: a glowing ring that fills up around the plane over 1 second
- **Release Space** (or auto-fires at full charge) to fire the super-shot
- After firing, charge resets — can be charged again immediately
- If weapon level drops below 5 mid-charge, charge cancels
- Super-shot does NOT consume weapon level

### Death reset
- On death (any life lost): weapon resets to **Vulcan Lv1**
- Bomb count is NOT reset on individual death (only on new game)
- This applies even if the player had a different weapon type

---

## 5. Background System

Each stage background has:
1. A **base fill color** (replaces the current `#020208`)
2. **Layer set** — 2-3 scrolling element layers specific to the stage theme, drawn procedurally

### Background element types

**Stars** (stages 1, 2, 7): current 3-layer starfield, palette varies per stage

**Rocks** (stage 2): oval grey shapes, 2 layers at different speeds (60px/s, 100px/s), randomly sized (r: 8–20), slight rotation

**Nebula clouds** (stage 3): large soft ellipses (w:80–160, h:40–80), low alpha (0.06–0.12), scroll slowly (20–40px/s), red/pink palette

**Toxic bubbles** (stage 4): small circles (r: 4–12), green/yellow, low alpha, drift upward slowly + slight horizontal wobble

**Energy streaks** (stage 5): thin horizontal lines (h:1–2px, w:40–120px), orange/amber, scroll downward fast (300–500px/s)

**Hull segments** (stage 6): dark grey rectangles with faint detail lines, scroll slowly (30px/s), vary in width (60–120px)

**Void wisps** (stage 7): faint bezier arc shapes, purple, very slow drift, low alpha

**Organic walls** (stage 8): left and right edge segments, dark red, sine-wave animated (not scrolling), plus upward-drifting red energy particles

---

## 6. Boss System

Each boss is unique. All bosses show the HP bar. Common properties:
- Patrol movement between random targets in upper 40% of screen
- Phase transitions based on HP percentage
- `boss.num` replaced by `boss.stageNum` (1–8) to identify which boss

### Boss phase count by stage
| Stage | Phases | Notes |
|-------|--------|-------|
| 1 | 3 | Current |
| 2 | 3 | Slow dense rings |
| 3 | 3 | Alternating twin cannons |
| 4 | 3 | Mine drops + aimed |
| 5 | 3 | Sweeping beam arc |
| 6 | 4 | Minion spawning |
| 7 | 4 | Periodic transparency |
| 8 | 5 | Combined patterns + minion final phase |

### Minion spawning (stages 6 and 8)
Boss periodically calls `spawnMinion()` which pushes a type-0 enemy (small fighter) at the boss's position. Spawn interval decreases with phase.

---

## 7. Difficulty Scaling

`diffMult` per stage:

| Stage | diffMult base |
|-------|--------------|
| 1 | 1.0 |
| 2 | 1.15 |
| 3 | 1.30 |
| 4 | 1.45 |
| 5 | 1.60 |
| 6 | 1.80 |
| 7 | 2.00 |
| 8 | 2.25 |

On loop: `diffMult = stageDiffMult[stage] * (1 + (loopMult - 1) * 0.2)`

Enemy HP also scales: `e.hp * diffMult` at spawn time (stored on the enemy object, not recomputed each frame).

---

## 8. Victory Screen

Triggered after Stage 8 boss dies (first clear only, `loopMult === 1`).

Displays:
- "MISSION COMPLETE" in gold glow text
- Final score
- Hi-score
- "PRESS ENTER" to return to title

After subsequent clears (loopMult > 1): skip victory screen, go straight to Stage 1 with increased diffMult.

---

## 9. Wave Tables

Each of the 8 stages gets its own wave table in `buildWaveTable(stage)`. The existing table (used for stages 1 and 2) becomes the stage 1 table. Each new stage table follows the same time-scripted format, tuned for its enemy mix emphasis.

Stage wave tables are defined as a `switch(stage)` block inside `buildWaveTable`.

---

## 10. Code Organization

All changes stay within `index.html`. New/modified sections:

- **CONSTANTS:** add `STAGE_DIFF` array, `STAGE_COUNT = 8`
- **BACKGROUNDS:** new section with per-stage background draw functions and scroll state
- **PLAYER BULLETS:** extend `firePlayer` for spread shot and charged super-shot logic
- **ENEMIES:** extend boss draw/update to handle 8 boss types
- **WAVE TABLES:** extend `buildWaveTable` with stages 3–8
- **STATE MACHINE:** add `VICTORY` state, update `onBossDeath` for 8-stage flow
- **HUD:** add charge indicator rendering on player sprite

---

## Out of Scope

- No multiplayer
- No touch/mobile controls
- No online leaderboard
- No save/continue between sessions (hi-score only)
- No audio tracks (sfx only, as before)

# Raiden 1 Arcade Clone — Design Spec

Date: 2026-08-18

## Goal

Recreate the core gameplay of the classic Seibu Kaihatsu arcade game
Raiden 1 (1990) as a single self-contained HTML file: vanilla JS,
canvas rendering, Web Audio sound, zero external dependencies, zero
image/audio assets. Opening the file in a browser must be sufficient
to play.

## Deliverable

One file: `raiden.html`, containing embedded `<style>` and `<script>`.
No build step, no external network requests.

## Game Structure

State machine: `TITLE → PLAYING ⇄ PAUSED → GAMEOVER`, with `STAGECLEAR`
as a brief transitional state between stage 1 and stage 2. A
`SETTINGS` overlay flag can layer on top of `TITLE` or `PAUSED`.

Stage flow:

1. **Stage 1** — scripted enemy wave table (small fighters, gunships,
   bombers, turrets) recreating the opening of arcade stage 1.
2. **Boss 1** — multi-phase boss fight, HP bar shown in HUD.
3. **Stage clear** banner, brief pause, transition to stage 2.
4. **Stage 2** — same enemy types, denser/faster spawn tables, higher
   bullet speed.
5. **Boss 2** — same silhouette family as Boss 1, more HP, tighter/
   faster patterns, additional phase.
6. **Loop** — after Boss 2 dies, return to Stage 1's wave table with a
   cumulative difficulty multiplier (spawn rate, bullet speed, enemy
   HP each increase per loop). This repeats indefinitely for
   score-attack play, matching classic arcade "loop" behavior.

## Rendering

- Fixed logical canvas resolution 480×640 (vertical shooter aspect).
  Canvas is scaled via CSS (letterboxed, aspect-ratio preserved) to
  fit the browser window on resize — game logic always works in the
  480×640 coordinate space, decoupled from actual window size.
- All sprites are procedural canvas drawings (paths, gradients, no
  images):
  - Player: triangular jet fuselage with wing highlights and engine
    glow, recognizable as the Raiden fighter silhouette.
  - Small fighter: compact swept-wing silhouette.
  - Gunship: boxier, wider hull.
  - Bomber: elongated hull with visible turret nubs.
  - Turret: static base + rotating barrel, ground-anchored (scrolls
    with background, does not move independently).
  - Bosses: larger multi-segment sprites built from the same drawing
    primitives, with a distinct silhouette per boss.
- Parallax starfield background: 2–3 layers of scrolling dots/streaks
  at different speeds for depth, dark space palette.
- Explosions: particle burst (expanding circles/fragments with
  fade-out), sized by enemy tier.
- Bomb effect: full-screen radial white/yellow flash that fades,
  clears all enemy bullets on screen.

## Player & Controls

- Arrow keys: move (bounded to canvas). Speed tuned close to arcade
  feel (fast, precise).
- Space: fire current weapon. Held-key state (not keydown repeat) so
  fire rate is controlled purely by weapon fire-rate stat, avoiding
  input lag/stutter from OS key-repeat timing.
- B: deploy bomb (if stock > 0).
- P: pause/resume.
- S: open/close settings overlay.
- Enter: start game from title screen.
- All input read from a keydown/keyup boolean map, sampled once per
  fixed-timestep tick — never directly from key event handlers — to
  keep input response frame-consistent.
- 3 starting lives. On hit: lose a life, clear all player bullets on
  screen (arcade-authentic), brief invincibility + flicker, respawn at
  fixed start position. Game over at 0 lives.

## Weapons

Three types, cycling on pickup, each with 5 power levels:

- **Vulcan** (default, level 1 start): twin forward bullets. Fire rate
  increases and a narrow spread is added at higher levels.
- **Laser**: single piercing beam, pierces multiple enemies, widens/
  lengthens with level.
- **Spread/Missile**: homing missiles that curve toward the nearest
  enemy; missile count increases with level (2 → 5).

Pickup rules: destroyed enemies drop a colored orb at a tier-dependent
chance (turrets/bombers higher than small fighters). Picking an orb
matching your current weapon type levels it up by 1 (capped at 5).
Picking a different type switches weapon to that type at level 1
(arcade-authentic "downgrade on switch"). Separate, rarer bomb pickups
add to bomb stock (capped at 3).

## Enemies & Bullet Patterns

- **Small fighter**: fast, weaves in formation, fires single aimed
  shots.
- **Gunship**: slower, tougher, fires 3-way aimed spread.
- **Bomber**: high HP, large hitbox, fires arcing bullet fans while
  passing through.
- **Turret**: stationary relative to background scroll, fires aimed
  bursts when player is within range/angle.
- **Boss 1 / Boss 2**: fixed high-HP entities with 2–3 attack phases
  alternating between spread barrages and aimed streams; Boss 2 adds a
  faster/denser phase and higher HP.
- Wave tables are time-scripted spawn lists keyed to the stage's scroll
  clock, approximating the arrangement of arcade stage 1's opening
  sequence (fighter line → gunship pair → turret cluster → bomber).
  Stage 2 reuses the tables with tighter timing and a speed/HP
  multiplier. The loop multiplier (post-Boss 2) is applied on top of
  the stage 2 multiplier and increments each loop.

## Collision

Simple circle/rect hit-testing per frame between: player vs enemy
bullets, player vs enemy bodies, player bullets vs enemies, player vs
powerups. No spatial partitioning needed at this entity count.

## HUD & Screens

- **Title**: "RAIDEN" retro-glow logo text, "PRESS ENTER TO START",
  current high score.
- **In-game HUD**: score, high score, lives (icon count), bomb count,
  current weapon name + level. Boss fights add an HP bar.
- **Pause overlay** (P): dim screen, "PAUSED" text, resumes on P.
- **Settings overlay** (S): toggle sound on/off, game speed control
  (e.g. 0.75x / 1x / 1.25x steps as a time-scale multiplier on the
  fixed-timestep loop). Closes back to whichever screen/state it was
  opened from (title or paused).
- **Stage clear**: brief banner between stage 1 and stage 2.
- **Game over**: final score, high score, and a "Copy Score" action
  that writes a formatted summary (current score + high score) to the
  clipboard via `navigator.clipboard.writeText`.

## Audio (Web Audio API only)

Short synthesized effects, no audio files:
- Shoot: brief square/sawtooth blip, pitch varies slightly by weapon.
- Explosion: filtered noise burst with pitch/volume decay, scaled by
  enemy tier.
- Power-up: short ascending chime (2–3 note arpeggio).
- Bomb: longer noise sweep with low-frequency rumble.
All effects gated by the settings sound toggle; audio context created/
resumed on first user interaction (browser autoplay policy).

## Persistence

High score stored under a single `localStorage` key, loaded at page
load and written whenever the current run's score exceeds the stored
value.

## Code Organization (single file, commented)

Within the one `<script>` block, organize top-to-bottom as: constants/
config → input handling → audio synthesis helpers → starfield →
entity factory/update/draw functions (player, bullets, enemies,
powerups, particles) → wave/spawn tables per stage → collision →
state machine + screen rendering → main loop (`requestAnimationFrame`
with fixed-timestep accumulator) → bootstrap. Comments call out which
mechanics are direct references to original Raiden 1 arcade behavior
(e.g. weapon downgrade-on-switch, clearing player bullets on death,
loop-after-boss-2 difficulty scaling).

## Out of Scope

- No multiplayer, no online leaderboard.
- No additional stages beyond stage 1 + stage 2 (loop reuses them).
- No touch/mobile controls (keyboard only, per requirements).
- No image or audio asset files of any kind.

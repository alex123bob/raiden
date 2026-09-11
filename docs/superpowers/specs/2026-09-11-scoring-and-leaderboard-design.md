# Phase 2: Scoring & Leaderboard - Design

**Date:** 2026-09-11
**Status:** Implementing
**Goal:** Add a tighter arcade scoring loop on top of the Phase 1 feel work:
timed kill chains, graze points, stage performance bonuses, and a local top-10
leaderboard with three-letter initials.

## Background

Phase 1 intentionally stopped before scoring changes. It added the music system,
hit-stop, and graze detection/feedback, then left the next roadmap slice as
"scoring and leaderboard." The current code still awards score directly in
collision/boss handlers and persists only a single numeric `raidenHS` value.

## Goals

- Centralize score awards so enemy kills, boss kills, grazes, and bonuses follow
  one tested path.
- Add a timed combo chain for enemy/boss kills. Fast consecutive kills raise the
  multiplier; inactivity resets it.
- Award a small one-time graze score when the existing graze flag is first set.
- Track each stage's no-miss and no-bomb status, award clear bonuses, and show
  the awarded lines on the stage-clear overlay.
- Store a safe local top-10 leaderboard using three-character initials while
  preserving the existing numeric high-score key for compatibility.

## Non-goals

- No online leaderboard or server sync.
- No new art/audio assets; the single-file build remains intact.
- No broad rebalance of enemy HP, wave density, or boss patterns in this phase.
- No large menu restructure; leaderboard and initials entry fit into the current
  canvas screens.

## Scoring Rules

### Combo

- Combo applies only to enemy and boss kill score.
- A kill starts or continues a chain, setting the timer to `2.2s`.
- The first kill is `x1`; each chained kill raises the multiplier by 1, capped
  at `x9`.
- The timer decays only during active gameplay time, so hit-stop does not drain
  it.
- Player death and stage transition reset the active combo.

### Graze

- Each enemy bullet can award graze score once, using the existing `grazed` flag.
- A graze awards `25 * loopMult` points.
- Graze detection keeps its Phase 1 particle and rate-limited SFX behavior.

### Stage Bonuses

- Stage starts reset `stageNoMiss` and `stageNoBomb` to true.
- Losing a life marks `stageNoMiss = false`.
- Spending a bomb marks `stageNoBomb = false`.
- Boss defeat awards eligible bonuses immediately before the stage-clear or
  victory transition:
  - No-miss: `2000 + stage * 750`, scaled by `loopMult`.
  - No-bomb: `1000 + stage * 500`, scaled by `loopMult`.
- The most recent bonus result is retained for the stage-clear overlay.

## Leaderboard

- New key: `raidenLeaderboard`.
- Legacy key retained: `raidenHS`.
- Entries are sanitized before use:
  - `initials`: uppercase alphanumeric, exactly 3 characters.
  - `score`: positive finite integer.
  - `stage`: positive integer stage reached.
  - `loop`: positive integer loop reached.
  - `date`: Unix timestamp in milliseconds.
- Insertions sort by score descending and truncate to 10.
- High score remains compatible by taking the max of `raidenHS` and the top
  leaderboard score.
- If a game-over score qualifies, the game-over screen enters a three-letter
  initials mode. Letter keys set the active slot and advance; arrow keys edit;
  Enter saves the row.

## UI

- HUD shows the active combo and a compact timer bar when a chain is live.
- Stage-clear overlay lists no-miss/no-bomb bonus lines and the total bonus.
- Title and game-over screens show the local leaderboard without changing the
  current canvas resolution or requiring DOM UI.
- Touch users can submit the default initials with a tap/Enter equivalent; the
  richer initials flow is keyboard-first for this phase.

## Testing

- Pure leaderboard insertion, sanitization, truncation, persistence, and legacy
  high-score fallback.
- Combo increment, multiplier application, max cap, and timeout reset.
- Graze score awards exactly once per bullet.
- Player death and bomb usage update stage performance flags.
- Stage bonus calculation and award storage.
- Game-over initials entry qualifies, edits, saves, and updates high score.


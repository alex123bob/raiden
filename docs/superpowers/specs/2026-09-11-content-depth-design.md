# Phase 3: Content Depth - Design

**Date:** 2026-09-11
**Status:** Implementing
**Goal:** Make the second half of the 18-stage campaign feel less repetitive by
adding new regular enemy roles, richer movement descriptors, and focused
late-stage placements that build on the existing data-driven stage system.

## Background

Phase 1 added music and feel polish. Phase 2 added combo scoring, graze score,
stage bonuses, and the local leaderboard. The current campaign already spans 18
stages, but stages 9-18 mostly remix the same regular enemies (`fighter`,
`gunship`, `bomber`, `turret`, `swarmer`, `dropship`, `seeker`) on the same
three motion descriptors (`down`, `sin`, `form`).

## Goals

- Add two regular enemy roles that change player positioning without requiring
  image or audio assets.
- Add motion descriptors that support lateral sweeps and sharper lane changes
  from the existing declarative wave grammar.
- Seed the new enemies into stages 9-18, where repetition is most visible,
  while preserving boss order, power-up timing, and single-file build output.
- Cover the new content with registry, wave-generation, behavior, and render
  smoke tests.

## New Enemy Roles

### Interceptor

- Fast red-purple attacker with low-to-mid HP and high score value.
- Uses arc/zigzag paths to cut across lanes instead of only falling downward.
- Fires a compact crossing pair around the aimed vector, with delayed second
  pulses so its threat reads as a slash rather than another fighter shot.
- Opts into late-game extra aimed streams, matching fighter/gunship milestone
  scaling.

### Mine Layer

- Slow cyan support ship with bomber-adjacent durability.
- Drops slow delayed mines that drift downward from behind the ship, creating
  temporary space denial around the player's route.
- Does not opt into extra aimed streams; its pattern is area-control, not aimed
  density.

## New Motion Descriptors

- `arc`: curved side/top entry, useful for interceptors that sweep into and out
  of the player's lane.
- `zigzag`: descending path with deterministic lane switching, useful for
  enemies that need sharper, readable horizontal changes.

## Stage Placement

- Stages 9-12 introduce the new enemies singly and in mirrored pairs.
- Stages 13-14 mix interceptors with existing turrets/seekers for crossfire.
- Stages 15-18 use elite variants and more frequent mine-layer screens, but
  keep boss triggers as the final wave entries.

## Non-goals

- No new asset files; visuals remain procedural canvas shapes.
- No broad difficulty-curve retune in this phase.
- No changes to weapon progression, scoring rules, boss patterns, or stage
  clear/victory state transitions.

## Testing

- Registry tests assert both new enemies are registered and render safely.
- Behavior tests assert interceptor shots and mine-layer delayed mines.
- Wave-generation tests assert `arc`/`zigzag` scale with `diffMult` and stages
  9-18 contain Phase 3 content.
- Existing full-suite checks must continue to pass: unit tests, typecheck, and
  production build.

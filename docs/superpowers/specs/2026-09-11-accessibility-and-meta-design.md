# Phase 4: Accessibility & Meta - Design

**Date:** 2026-09-11
**Status:** Implementing
**Goal:** Add player-comfort and replayability polish on top of the now richer
18-stage campaign, without changing the core arcade loop or requiring external
assets.

## Background

Phase 1 added motion/audio feel, Phase 2 added scoring and leaderboard loops,
and Phase 3 added late-campaign content depth. The next gap is player comfort:
the game now has screen shake, hit-stop, haptics, dense late-stage bullets, and
longer play sessions, so settings need one more accessibility control.

## Phase 4 Slice A: Reduced Motion

- Add a persisted `reducedMotion` setting beside sound, speed, and volume.
- Expose it in the existing settings panel with keyboard and touch controls.
- Suppress screen shake and haptic buzzes when enabled.
- Cap hit-stop duration to a short readable pulse instead of long freezes.
- Preserve all gameplay mechanics, scoring, stages, and build constraints.

## Phase 4 Slice B: Hitbox Display

- Add a persisted `showHitbox` setting beside the existing comfort controls.
- Draw a small high-contrast ring at the player's true collision radius when
  enabled.
- Keep the default presentation unchanged for players who prefer the arcade
  look.
- Expose the toggle in the same keyboard/touch settings panel.

## Non-goals

- No DOM accessibility overlay; the project remains a single-canvas arcade game.
- No remapping UI or colorblind palette work in this slice.
- No save-game or online meta progression.

## Testing

- Settings persistence round-trips `reducedMotion` with existing settings.
- Toggling reduced motion clears active shake and persists immediately.
- Reduced motion suppresses new shake/haptic events and clamps hit-stop.
- Settings persistence round-trips `showHitbox`; the player renderer emits the
  extra hitbox ring only when the setting is enabled.
- Existing unit tests, typecheck, and single-file production build remain green.

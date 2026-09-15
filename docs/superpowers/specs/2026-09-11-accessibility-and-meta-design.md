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

## Phase 4 Slice C: Threat Contrast

- Add a persisted `threatContrast` setting for dense late-game bullet screens.
- Draw a neutral high-contrast outline around enemy bullets, missiles, and
  mines after their normal procedural render.
- Leave player bullets and enemy art unchanged, so the option specifically
  improves threat readability.

## Phase 4 Slice D: Keyboard Comfort Aliases

- Support arcade-style keyboard aliases without adding a full remapping UI:
  `Z` fires and `X` bombs alongside the existing `Space` and `B` controls.
- Keep held-fire and one-shot bomb latch semantics identical across aliases.
- Update keyboard hints so the extra controls are discoverable.

## Phase 4 Slice E: Local Campaign Progression

- Add a best-effort `localStorage['raidenProgress']` save with the highest
  unlocked stage, best reached loop, best reached stage, and update timestamp.
- Unlock the next stage when a boss clear is committed, before the stage-clear
  interlude advances to the next stage.
- Clamp title-screen stage select and `startGame(stage)` to unlocked stages, so
  replay starts remain campaign-progress gated.
- Surface progress on the title and stage-select screens without adding a new
  menu or changing the arcade run reset rules.
- Add a guarded settings-panel reset for campaign progress only, requiring a
  deliberate arm/confirm action and preserving leaderboard/high-score data.
- Keep the save scope meta-only: no mid-stage checkpoint, no player loadout
  restore, and no online/cloud sync.

## Non-goals

- No DOM accessibility overlay; the project remains a single-canvas arcade game.
- No remapping UI or colorblind palette work in this slice.
- No mid-run save-game, player loadout restore, or online meta progression.

## Testing

- Settings persistence round-trips `reducedMotion` with existing settings.
- Toggling reduced motion clears active shake and persists immediately.
- Reduced motion suppresses new shake/haptic events and clamps hit-stop.
- Settings persistence round-trips `showHitbox`; the player renderer emits the
  extra hitbox ring only when the setting is enabled.
- Settings persistence round-trips `threatContrast`; enemy bullet rendering
  emits the extra outline only when the setting is enabled.
- Fire/bomb aliases behave like the primary keys, including held fire and the
  one-bomb-per-press latch.
- Progress helpers sanitize corrupt storage, persist safe JSON, clamp stage
  unlocks to the authored campaign, and preserve best loop/stage reached.
- Boss clears update local campaign progress and make the next stage available
  through the title stage-select flow.
- Progress reset writes an explicit stage-1 save, does not delete leaderboard
  history, and remains gated by a second confirm action in settings.
- Existing unit tests, typecheck, and single-file production build remain green.

/**
 * Canvas / playfield dimensions in CSS pixels. Fixed logical resolution the
 * whole game is authored against; the DOM canvas is scaled to fit the window
 * (see canvas.ts) but all game math uses these values. Origin is top-left,
 * y increases downward. Portrait aspect (480x640) suits a vertical shmup.
 */
export const W = 480, H = 640;
/** Target simulation frame rate in frames per second. Drives the fixed step. */
export const FPS = 60;
/** Fixed physics/logic timestep in seconds (1/FPS ≈ 0.0167s per update). */
export const STEP = 1 / FPS;
/** Seconds of held fire needed to build a full charge (super) shot. */
export const CHARGE_DURATION = 1.0;
/** Total number of authored stages in a single loop of the campaign. */
export const STAGE_COUNT = 18;
/** Selectable game-speed multipliers (slow / normal / fast) cycled in settings. */
export const SPEED_STEPS = [0.75, 1.0, 1.25];
/** Selectable master-volume levels cycled in settings. */
export const VOLUME_STEPS = [0, 0.25, 0.5, 0.7, 1.0];
/** Enum of top-level game states; the loop switches behavior/rendering on these. */
export const STATE = { TITLE: 0, PLAYING: 1, PAUSED: 2, GAMEOVER: 3, STAGECLEAR: 4, VICTORY: 5, STAGESELECT: 6 };
/** Build version string, logged at startup and shown on screens. */
export const VERSION = '1.0.1';

import type { Player } from '../entities/Player.js';
import type { Enemy } from '../entities/Enemy.js';
import type { Boss } from '../entities/Boss.js';
import type { Bullet, EnemyBullet } from '../entities/Bullet.js';
import type { Powerup } from '../entities/Powerup.js';
import type { Particle } from '../entities/Particle.js';
import type { AudioBus } from './audio.js';
import type { WaveEntry } from '../stages/waveGen.js';

// The typed `g`: exactly the fields the current code reads, declared as a
// contract so Game implements it and test stubs are compiler-checked.
/**
 * The shared game state passed to nearly every update/draw/collision function
 * as `ctx` (or `g`). Game implements this; tests supply lightweight stubs.
 * All coordinates are canvas px (W=480 × H=640), origin top-left, +y downward.
 */
export interface GameContext {
  state: number;                          // current STATE.* enum value (title/playing/paused/…)
  keys: Record<string, boolean>;          // held-key map by KeyboardEvent.code (true = down)
  moveVec: { x: number; y: number };      // analog move input, each component -1..1 (touch stick)
  player: Player | null;                  // the ship, or null before spawn / after teardown
  enemies: Enemy[];                       // live regular enemies (not the boss)
  boss: Boss | null;                      // active boss, or null when none on screen
  playerBullets: Bullet[];                // bullets fired by the player
  enemyBullets: EnemyBullet[];            // bullets fired by enemies/boss (threaten the player)
  powerups: Powerup[];                    // floating pickups currently in the world
  particles: Particle[];                  // transient visual FX (explosions, sparks)
  currentStage: number;                   // 1-based stage number currently being played
  diffMult: number;                       // per-stage speed/difficulty multiplier (see diffMultFor)
  loopMult: number;                       // 1-based loop count; scales score, raises on each replay
  waveTable: WaveEntry[];                 // t-sorted spawn timeline for the current stage
  waveIndex: number;                      // index of next unspawned entry in waveTable
  bossSpawned: boolean;                   // true once this stage's boss has been triggered
  bossMaxHp: number;                      // boss HP at spawn (for the HUD health bar)
  bossPhase: number;                      // boss attack-phase index (0-based)
  bossAngle: number;                      // boss spin/aim angle in radians
  bossTimer: number;                      // boss's internal phase/attack countdown in seconds
  stageTimer: number;                     // seconds elapsed since stage start (drives waveTable)
  stageClearTimer: number;                // countdown (s) during the STAGECLEAR interlude
  victoryTimer: number;                   // countdown (s) used by the VICTORY sequence
  score: number;                          // current run score
  audio: AudioBus;                        // sound effect sink (WebAudioBus, or SilentBus in tests)
  /** Spawn a burst of particles of `kind` at (x,y); opts tune size/color/etc. */
  spawnParticles(kind: string, x: number, y: number, opts?: Record<string, unknown>): void;
  /** Trigger screen shake: `mag` amplitude in px, `dur` duration in seconds. */
  shake(mag: number, dur: number): void;
  /** Trigger a haptic buzz for `ms` milliseconds on touch devices that support it; no-op elsewhere. */
  vibrate(ms: number): void;
  /** Persist the high score if the current score beats it. */
  saveHS(): void;
  /** Reset per-stage state and begin stage `n` (1-based). */
  startStage(n: number): void;
}

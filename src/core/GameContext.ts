import type { Player } from '../entities/Player.js';
import type { Enemy } from '../entities/Enemy.js';
import type { Boss } from '../entities/Boss.js';
import type { Bullet, EnemyBullet } from '../entities/Bullet.js';
import type { Powerup } from '../entities/Powerup.js';
import type { Particle } from '../entities/Particle.js';
import type { AudioBus } from './audio.js';
import type { MusicSink } from './music.js';
import type { WaveEntry } from '../stages/waveGen.js';
import type { InitialsEntry, LeaderboardEntry } from './leaderboard.js';
import type { StageBonusAward } from './scoring.js';

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
  combo: number;                          // active kill-chain multiplier (0 = no active chain)
  comboTimer: number;                     // seconds remaining before the active combo expires
  maxCombo: number;                       // best combo reached during the current run
  stageNoMiss: boolean;                   // true until the player loses a life during this stage
  stageNoBomb: boolean;                   // true until the player spends a bomb during this stage
  showHitbox: boolean;                    // true when the player's exact collision ring should be drawn
  lastStageBonus: StageBonusAward | null; // most recent stage-clear bonus result, for the clear overlay
  leaderboard: LeaderboardEntry[];        // local top scores loaded from safe localStorage JSON
  initialsEntry: InitialsEntry | null;    // active game-over initials entry flow, if the score qualifies
  audio: AudioBus;                        // sound effect sink (WebAudioBus, or SilentBus in tests)
  music: MusicSink;                       // background-music sink (WebAudioMusic, or SilentMusic in tests)
  /** Spawn a burst of particles of `kind` at (x,y); opts tune size/color/etc. */
  spawnParticles(kind: string, x: number, y: number, opts?: Record<string, unknown>): void;
  /** Trigger screen shake: `mag` amplitude in px, `dur` duration in seconds. */
  shake(mag: number, dur: number): void;
  /** Freeze gameplay (dt=0) for `ms` milliseconds while rendering continues; extends any active freeze. */
  hitStop(ms: number): void;
  /** Trigger a haptic buzz for `ms` milliseconds on touch devices that support it; no-op elsewhere. */
  vibrate(ms: number): void;
  /** Persist the high score if the current score beats it. */
  saveHS(): void;
  /** Enter the GAMEOVER state and prepare leaderboard initials entry if needed. */
  enterGameOver(): void;
  /** Reset per-stage state and begin stage `n` (1-based). */
  startStage(n: number): void;
}

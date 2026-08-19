import type { Player } from '../entities/Player.js';
import type { Enemy } from '../entities/Enemy.js';
import type { Boss } from '../entities/Boss.js';
import type { Bullet, EnemyBullet } from '../entities/Bullet.js';
import type { Powerup } from '../entities/Powerup.js';
import type { Particle } from '../entities/Particle.js';
import type { AudioBus } from './audio.js';

// The typed `g`: exactly the fields the current code reads, declared as a
// contract so Game implements it and test stubs are compiler-checked.
export interface GameContext {
  state: number;
  keys: Record<string, boolean>;
  moveVec: { x: number; y: number };
  player: Player | null;
  enemies: Enemy[];
  boss: Boss | null;
  playerBullets: Bullet[];
  enemyBullets: EnemyBullet[];
  powerups: Powerup[];
  particles: Particle[];
  currentStage: number;
  diffMult: number;
  loopMult: number;
  bossMaxHp: number;
  bossPhase: number;
  bossAngle: number;
  bossTimer: number;
  stageTimer: number;
  stageClearTimer: number;
  victoryTimer: number;
  score: number;
  audio: AudioBus;
  spawnParticles(kind: string, x: number, y: number, opts?: Record<string, unknown>): void;
  saveHS(): void;
  startStage(n: number): void;
}

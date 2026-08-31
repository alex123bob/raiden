import type { GameContext } from '../src/core/GameContext.js';
import type { WaveEntry } from '../src/stages/waveGen.js';
import { SilentBus } from '../src/core/audio.js';
import { SilentMusic } from '../src/core/music.js';
import { Player } from '../src/entities/Player.js';
import { spawnParticleKind } from '../src/entities/Particle.js';

export function stubContext(overrides: Partial<GameContext> = {}): GameContext {
  const ctx: GameContext = {
    state: 1,
    keys: {},
    moveVec: { x: 0, y: 0 },
    player: new Player(),
    enemies: [],
    boss: null,
    playerBullets: [],
    enemyBullets: [],
    powerups: [],
    particles: [],
    currentStage: 1,
    diffMult: 1.0,
    loopMult: 1,
    waveTable: [] as WaveEntry[],
    waveIndex: 0,
    bossSpawned: false,
    bossMaxHp: 0,
    bossPhase: 0,
    bossAngle: 0,
    bossTimer: 0,
    stageTimer: 0,
    stageClearTimer: 0,
    victoryTimer: 0,
    score: 0,
    audio: new SilentBus(),
    music: new SilentMusic(),
    spawnParticles(kind, x, y, opts) { spawnParticleKind(kind, x, y, opts ?? {}, ctx); },
    shake() {},
    vibrate() {},
    saveHS() {},
    startStage() {},
    ...overrides,
  };
  return ctx;
}

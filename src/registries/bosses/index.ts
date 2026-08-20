import { makeRegistry } from '../../core/registry.js';
import type { GameContext } from '../../core/GameContext.js';
import type { Boss } from '../../entities/Boss.js';
import type { PatternOpts } from '../bullets/patterns.js';

/** One named bullet pattern (from BULLET_PATTERNS) plus its tuning opts, fired during a phase. */
export interface PhasePattern extends PatternOpts { name: string; }
/** A phase's fire behavior: a single pattern, or an array of patterns all fired together. */
export type PhaseEntry = PhasePattern | PhasePattern[];
/**
 * Behavioral definition of one boss kind, held in the BOSS_TYPES registry.
 * A single BossType is shared by reference and holds only the template: how to
 * draw the boss, which bullet patterns fire in each phase, and an optional
 * per-frame hook. Per-instance mutable state lives on the Boss entity.
 */
export interface BossType {
  /** Registry key, e.g. 'blaze' | 'hexa' | 'tyrant'. */
  readonly key: string;
  /** Optional whole-sprite tint color applied via rc.withTint; null = draw untinted. */
  tint: string | null;
  /** Collision/draw radius in pixels; defaults to 50 in the Boss constructor when omitted. */
  r?: number;
  /** Drift speed in pixels/second toward the wander target; defaults to 58 when omitted. */
  speed?: number;
  /** If true, the boss periodically spawns fighter minions (every ~3s / diffMult). */
  spawnMinions?: boolean;
  /**
   * Fire behavior indexed by boss phase (phase = HP band, 0 at full HP).
   * Selected as patterns[bossPhase % patterns.length]; each entry is one
   * pattern or an array of patterns fired in the same volley.
   */
  patterns: PhaseEntry[];
  /**
   * Draw the boss at the origin (caller has translated to its position).
   * @param angle ever-increasing spin angle in radians (ctx.bossAngle)
   * @param timer seconds since the fight started (ctx.bossTimer)
   */
  render(c: CanvasRenderingContext2D, boss: Boss, angle: number, timer: number): void;
  /** Optional per-frame hook (e.g. pulse an alpha); runs after phase is recomputed. */
  onUpdate?(boss: Boss, dt: number, ctx: GameContext): void;
}

/** Registry of all boss kinds, keyed by BossType.key. */
export const BOSS_TYPES = makeRegistry<BossType>();
/** Convenience alias for BOSS_TYPES.register. */
export const registerBossType = BOSS_TYPES.register;

// Deferred imports + explicit registration keep def files free of register*
// calls, avoiding circular-import TDZ issues (same pattern as particles/index).
import { blaze } from './blaze.js';
import { hexa } from './hexa.js';
import { dreadnaught } from './dreadnaught.js';
import { viper } from './viper.js';
import { solar } from './solar.js';
import { carrier } from './carrier.js';
import { phantom } from './phantom.js';
import { tyrant } from './tyrant.js';

registerBossType(blaze);
registerBossType(hexa);
registerBossType(dreadnaught);
registerBossType(viper);
registerBossType(solar);
registerBossType(carrier);
registerBossType(phantom);
registerBossType(tyrant);

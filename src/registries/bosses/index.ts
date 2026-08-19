import { makeRegistry } from '../../core/registry.js';
import type { GameContext } from '../../core/GameContext.js';
import type { Boss } from '../../entities/Boss.js';
import type { PatternOpts } from '../bullets/patterns.js';

export interface PhasePattern extends PatternOpts { name: string; }
export type PhaseEntry = PhasePattern | PhasePattern[];
export interface BossType {
  readonly key: string;
  tint: string | null;
  r?: number;
  speed?: number;
  spawnMinions?: boolean;
  patterns: PhaseEntry[];
  render(c: CanvasRenderingContext2D, boss: Boss, angle: number, timer: number): void;
  onUpdate?(boss: Boss, dt: number, ctx: GameContext): void;
}

export const BOSS_TYPES = makeRegistry<BossType>();
export const registerBossType = BOSS_TYPES.register;

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

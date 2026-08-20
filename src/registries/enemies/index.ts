import { makeRegistry } from '../../core/registry.js';
import type { EnemyType } from '../../entities/Enemy.js';
import { fighter } from './fighter.js';
import { gunship } from './gunship.js';
import { bomber } from './bomber.js';
import { turret } from './turret.js';

/** Registry of every enemy kind, keyed by EnemyType.key. */
export const ENEMY_TYPES = makeRegistry<EnemyType>();
/** Convenience alias for ENEMY_TYPES.register. */
export const registerEnemyType = ENEMY_TYPES.register;
registerEnemyType(fighter);   // fast, cheap, aimed single shot
registerEnemyType(gunship);   // tougher, 3-way aimed spread
registerEnemyType(bomber);    // slow tank, wide downward fan
registerEnemyType(turret);    // stationary, only fires when player is in range

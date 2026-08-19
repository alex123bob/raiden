import { makeRegistry } from '../../core/registry.js';
import type { EnemyType } from '../../entities/Enemy.js';
import { fighter } from './fighter.js';
import { gunship } from './gunship.js';
import { bomber } from './bomber.js';
import { turret } from './turret.js';

export const ENEMY_TYPES = makeRegistry<EnemyType>();
export const registerEnemyType = ENEMY_TYPES.register;
registerEnemyType(fighter);
registerEnemyType(gunship);
registerEnemyType(bomber);
registerEnemyType(turret);

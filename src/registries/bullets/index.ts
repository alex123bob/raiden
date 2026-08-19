import { makeRegistry } from '../../core/registry.js';
import type { BulletKind } from '../../entities/Bullet.js';
import { vulcan } from './vulcan.js';
import { spread } from './spread.js';
import { missile } from './missile.js';
import { enemyBullet } from './enemy.js';
import './patterns.js';

export const BULLET_KINDS = makeRegistry<BulletKind>();
export const registerBulletKind = BULLET_KINDS.register;
registerBulletKind(vulcan);
registerBulletKind(spread);
registerBulletKind(missile);
registerBulletKind(enemyBullet);

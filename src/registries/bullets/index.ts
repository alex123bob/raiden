import { makeRegistry } from '../../core/registry.js';
import type { BulletKind } from '../../entities/Bullet.js';
import { vulcan } from './vulcan.js';
import { spread } from './spread.js';
import { missile } from './missile.js';
import { enemyBullet } from './enemy.js';
// Side-effect import: registers the boss BULLET_PATTERNS into their registry.
import './patterns.js';

/** Registry of every player/enemy bullet visual+behavior kind, keyed by `key`. */
export const BULLET_KINDS = makeRegistry<BulletKind>();
/** Convenience alias for BULLET_KINDS.register. */
export const registerBulletKind = BULLET_KINDS.register;
registerBulletKind(vulcan);      // player primary: fast straight rounds w/ trail
registerBulletKind(spread);      // player shotgun-style fan
registerBulletKind(missile);     // player homing missiles
registerBulletKind(enemyBullet); // generic round used by all enemy/boss fire

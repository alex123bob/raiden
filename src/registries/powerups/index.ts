import { makeRegistry } from '../../core/registry.js';
import type { PowerupType } from '../../entities/Powerup.js';
import { weaponOrb } from './weaponOrb.js';
import { bomb } from './bomb.js';

/** Registry of all powerup kinds, keyed by PowerupType.key. */
export const POWERUP_TYPES = makeRegistry<PowerupType>();
/** Convenience alias for POWERUP_TYPES.register. */
export const registerPowerupType = POWERUP_TYPES.register;
registerPowerupType(weaponOrb);   // levels up or adds an equipped weapon
registerPowerupType(bomb);        // grants one extra bomb (capped at 3)

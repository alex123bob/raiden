import { makeRegistry } from '../../core/registry.js';
import type { PowerupType } from '../../entities/Powerup.js';
import { weaponOrb } from './weaponOrb.js';
import { bomb } from './bomb.js';

export const POWERUP_TYPES = makeRegistry<PowerupType>();
export const registerPowerupType = POWERUP_TYPES.register;
registerPowerupType(weaponOrb);
registerPowerupType(bomb);

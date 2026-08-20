import { makeRegistry } from '../../core/registry.js';
import type { ParticleKind } from '../../entities/Particle.js';
import { explosion } from './explosion.js';
import { bombFlash } from './bombFlash.js';
import { superFlash } from './superFlash.js';

// Def files only export objects and keep cross-module refs inside function
// bodies; they never call register* themselves (circular-import TDZ).
export const PARTICLE_KINDS = makeRegistry<ParticleKind>();
export const registerParticleKind = PARTICLE_KINDS.register;
registerParticleKind(explosion);
registerParticleKind(bombFlash);
registerParticleKind(superFlash);

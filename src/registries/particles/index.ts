import { makeRegistry } from '../../core/registry.js';
import type { ParticleKind } from '../../entities/Particle.js';
import { explosion } from './explosion.js';
import { bombFlash } from './bombFlash.js';
import { superFlash } from './superFlash.js';

// Def files only export objects and keep cross-module refs inside function
// bodies; they never call register* themselves (circular-import TDZ).
/** Registry of all particle kinds, keyed by ParticleKind.key. */
export const PARTICLE_KINDS = makeRegistry<ParticleKind>();
/** Convenience alias for PARTICLE_KINDS.register. */
export const registerParticleKind = PARTICLE_KINDS.register;
registerParticleKind(explosion);   // scattered debris/spark burst on any kill
registerParticleKind(bombFlash);   // full-screen crack effect on bomb use
registerParticleKind(superFlash);  // expanding ring on a max-level super burst

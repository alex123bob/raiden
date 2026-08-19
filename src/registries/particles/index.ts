import { makeRegistry } from '../../core/registry.js';
import type { ParticleKind } from '../../entities/Particle.js';
import { explosion } from './explosion.js';
import { bombFlash } from './bombFlash.js';

export const PARTICLE_KINDS = makeRegistry<ParticleKind>();
export const registerParticleKind = PARTICLE_KINDS.register;
registerParticleKind(explosion);
registerParticleKind(bombFlash);

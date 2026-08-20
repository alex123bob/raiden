import type { BossType } from './index.js';

/**
 * Blaze — a fiery molten-orb boss with four rotating cannon arms. Escalates
 * across three phases: an aimed 7-shot fan, a tight twin-shot burst at the
 * player, then an omnidirectional ring. Hot orange/red palette with a glowing
 * yellow core.
 */
export const blaze: BossType = {
  key: 'blaze',
  tint: null,               // no whole-sprite tint; colors baked into render
  spawnMinions: false,
  patterns: [
    // Phase 0: aimed fan of 7 bullets, 0.14 rad between adjacent shots.
    { name: 'aimSpread', spdBase: 175, spdPhase: 35, count: 7, gap: 0.14, clr: '#ff2200' },
    // Phase 1: twin shots offset +/-0.08 rad around the player-ward direction.
    { name: 'aimBurst',  spdBase: 175, spdPhase: 35, offsets: [-0.08, 0.08], clr: '#ff8800' },
    // Phase 2: 8-way ring at 0.7x speed (slower, screen-filling).
    { name: 'ring',      spdBase: 175, spdPhase: 35, count: 8, spdF: 0.7, clr: '#cc00ff' },
  ],
  render(c, b, angle) {
    // Radial gradient body: bright orange core fading to near-black rim.
    const grad = c.createRadialGradient(0, 0, 8, 0, 0, b.r);
    grad.addColorStop(0, '#ff6622'); grad.addColorStop(0.5, '#882211'); grad.addColorStop(1, '#330800');
    c.fillStyle = grad;
    c.beginPath(); c.arc(0, 0, b.r, 0, Math.PI * 2); c.fill();
    c.save(); c.rotate(angle);                    // whole cannon assembly spins with bossAngle
    for (let i = 0; i < 4; i++) {
      c.save(); c.rotate(i * Math.PI / 2);        // four arms at 90 deg apart
      c.fillStyle = '#bb3300';
      c.fillRect(-4, 0, 8, b.r * 0.88);           // arm: 8px-wide barrel out to 0.88r
      c.fillStyle = '#ff7700';
      c.beginPath(); c.arc(0, b.r * 0.82, 9, 0, Math.PI * 2); c.fill();   // muzzle glow at arm tip
      c.restore();
    }
    c.restore();
    // Concentric core: yellow -> red -> black pupil.
    c.fillStyle = '#ffff00'; c.beginPath(); c.arc(0, 0, 13, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#ff0000'; c.beginPath(); c.arc(0, 0, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#000';    c.beginPath(); c.arc(0, 0, 3, 0, Math.PI * 2); c.fill();
  },
};

let audioCtx = null;

function getAudio() {
  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export { getAudio };

export function sfxShoot(weapon, g) {
  if (!g.soundOn) return;
  try {
    const ac = getAudio();
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    if (weapon === 1) {
      osc.type = 'square';
      osc.frequency.setValueAtTime(520 + Math.random() * 60, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(260, ac.currentTime + 0.14);
      gain.gain.setValueAtTime(0.10, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.15);
      osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.15);
    } else {
      osc.type = weapon === 2 ? 'square' : 'square';
      const base = [880, 440, 660][weapon];
      osc.frequency.setValueAtTime(base + Math.random() * 40, ac.currentTime);
      osc.frequency.exponentialRampToValueAtTime(base * 0.5, ac.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.1);
      osc.start(ac.currentTime); osc.stop(ac.currentTime + 0.1);
    }
  } catch(e) {}
}

export function sfxExplosion(size, g) {
  if (!g.soundOn) return;
  try {
    const ac  = getAudio();
    const len = ac.sampleRate * 0.4;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * (1 - i/len);
    const src    = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    const gain   = ac.createGain();
    src.buffer = buf;
    filter.type = 'lowpass';
    filter.frequency.value = 300 + size * 200;
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
    gain.gain.setValueAtTime(Math.min(1, 0.15 + size * 0.1), ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.4);
    src.start(ac.currentTime);
  } catch(e) {}
}

export function sfxPowerup(g) {
  if (!g.soundOn) return;
  try {
    const ac = getAudio();
    [523, 659, 784].forEach((freq, i) => {
      const osc  = ac.createOscillator();
      const gain = ac.createGain();
      osc.connect(gain); gain.connect(ac.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = ac.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.start(t); osc.stop(t + 0.16);
    });
  } catch(e) {}
}

export function sfxBomb(g) {
  if (!g.soundOn) return;
  try {
    const ac  = getAudio();
    const len = ac.sampleRate * 1.0;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d   = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random()*2-1) * (1 - i/len);
    const src    = ac.createBufferSource();
    const filter = ac.createBiquadFilter();
    const gain   = ac.createGain();
    src.buffer = buf;
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(80, ac.currentTime);
    filter.frequency.linearRampToValueAtTime(900, ac.currentTime + 0.3);
    filter.frequency.exponentialRampToValueAtTime(50, ac.currentTime + 1.0);
    src.connect(filter); filter.connect(gain); gain.connect(ac.destination);
    gain.gain.setValueAtTime(0.6, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 1.0);
    src.start(ac.currentTime);
  } catch(e) {}
}

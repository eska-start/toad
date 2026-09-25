// Web Audio 기반 요리 효과음 (외부 오디오 파일 없이 합성, 단일 빌드 유지)
let ctx: AudioContext | null = null;
const master = 0.35;
const SOUND_KEY = 'toad-jjamppong-muted';
let muted = (() => {
  try { return localStorage.getItem(SOUND_KEY) === '1'; } catch { return false; }
})();

let musicWanted = false;
let musicBus: GainNode | null = null;
let musicTimer: number | null = null;
let nextNoteTime = 0;
let noteIndex = 0;
let visibilityHooked = false;

const STEP_SECONDS = 60 / 104 / 2;
// A-minor pentatonic, four bars of a light restaurant theme.
const MELODY = [
  440, 0, 523.25, 0, 659.25, 0, 587.33, 523.25,
  392, 0, 440, 0, 523.25, 587.33, 440, 0,
  440, 0, 523.25, 587.33, 659.25, 0, 783.99, 659.25,
  587.33, 0, 523.25, 440, 392, 0, 440, 0,
];
const BASS = [110, 130.81, 98, 110];

function musicNote(c: AudioContext, freq: number, at: number, length: number, level: number, type: OscillatorType) {
  if (!musicBus) return;
  const osc = c.createOscillator();
  const filter = c.createBiquadFilter();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(type === 'sine' ? 800 : 1900, at);
  osc.connect(filter); filter.connect(gain); gain.connect(musicBus);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(level, at + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.start(at);
  osc.stop(at + length + 0.02);
  osc.onended = () => { osc.disconnect(); filter.disconnect(); gain.disconnect(); };
}

function musicShaker(c: AudioContext, at: number) {
  if (!musicBus) return;
  const source = noise(c, 0.055);
  const highpass = c.createBiquadFilter();
  const gain = c.createGain();
  highpass.type = 'highpass'; highpass.frequency.value = 5400;
  source.connect(highpass); highpass.connect(gain); gain.connect(musicBus);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(0.07, at + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
  source.start(at); source.stop(at + 0.055);
  source.onended = () => { source.disconnect(); highpass.disconnect(); gain.disconnect(); };
}

function scheduleMusic(c: AudioContext) {
  if (!musicWanted || muted || document.hidden || c.state !== 'running') return;
  if (nextNoteTime < c.currentTime - 0.1) nextNoteTime = c.currentTime + 0.06;
  let scheduled = 0;
  while (nextNoteTime < c.currentTime + 0.3 && scheduled++ < 8) {
    const index = noteIndex % MELODY.length;
    const note = MELODY[index];
    if (note) musicNote(c, note, nextNoteTime, STEP_SECONDS * 1.35, 0.38, 'triangle');
    if (index % 8 === 0) {
      const bass = BASS[Math.floor(index / 8)];
      musicNote(c, bass, nextNoteTime, STEP_SECONDS * 3.4, 0.28, 'sine');
      musicNote(c, bass * 2, nextNoteTime, STEP_SECONDS * 1.6, 0.12, 'triangle');
    }
    if (index % 2 === 1) musicShaker(c, nextNoteTime);
    noteIndex++;
    nextNoteTime += STEP_SECONDS;
  }
}

function pauseMusic() {
  if (musicTimer !== null) { window.clearInterval(musicTimer); musicTimer = null; }
  if (musicBus && ctx) musicBus.gain.setTargetAtTime(0, ctx.currentTime, 0.035);
}

function playMusic() {
  if (!musicWanted || muted || document.hidden) return;
  const c = getCtx();
  if (!c) return;
  if (c.state !== 'running') {
    c.resume().then(playMusic).catch(() => {});
    return;
  }
  if (!musicBus) {
    musicBus = c.createGain();
    musicBus.gain.setValueAtTime(0, c.currentTime);
    musicBus.connect(c.destination);
  }
  musicBus.gain.setTargetAtTime(0.17, c.currentTime, 0.12);
  if (musicTimer !== null) return;
  nextNoteTime = c.currentTime + 0.07;
  scheduleMusic(c);
  musicTimer = window.setInterval(() => scheduleMusic(c), 90);
}

export const audio = {
  startMusic() { musicWanted = true; playMusic(); },
  setMuted(value: boolean) {
    muted = value;
    try { localStorage.setItem(SOUND_KEY, value ? '1' : '0'); } catch { /* storage unavailable */ }
    if (value) pauseMusic(); else playMusic();
  },
  isMuted() { return muted; },
};

function getCtx(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try {
      const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    } catch { return null; }
  }
  if (!visibilityHooked) {
    visibilityHooked = true;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pauseMusic(); else playMusic();
    });
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function env(gain: GainNode, t0: number, a: number, d: number, peak: number, end: number) {
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak * master, t0 + a);
  gain.gain.linearRampToValueAtTime(0, t0 + end);
  // release
  setTimeout(() => gain.disconnect(), (end + d) * 1000 + 50);
}

function noise(ctx: AudioContext, dur: number): AudioBufferSourceNode {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
  const s = ctx.createBufferSource();
  s.buffer = buf;
  return s;
}

export const sfx = {
  click() {
    const c = getCtx(); if (!c) return;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(520, c.currentTime); o.frequency.exponentialRampToValueAtTime(220, c.currentTime + 0.06);
    o.connect(g); g.connect(c.destination); env(g, c.currentTime, 0.004, 0.02, 0.5, 0.08); o.start(); o.stop(c.currentTime + 0.1);
  },
  chop() {
    const c = getCtx(); if (!c) return;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(160, c.currentTime); o.frequency.exponentialRampToValueAtTime(50, c.currentTime + 0.08);
    o.connect(g); g.connect(c.destination); env(g, c.currentTime, 0.003, 0.02, 0.7, 0.1); o.start(); o.stop(c.currentTime + 0.12);
  },
  stir(intensity = 0.5) {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    const n = noise(c, 0.3); const bp = c.createBiquadFilter(); const g = c.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.9;
    n.connect(bp); bp.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25 * Math.min(1, intensity) * master, t + 0.03);
    g.gain.linearRampToValueAtTime(0, t + 0.28);
    n.start(t); n.stop(t + 0.3);
  },
  sizzle() {
    const c = getCtx(); if (!c) return;
    const n = noise(c, 0.6); const hp = c.createBiquadFilter(); const g = c.createGain();
    hp.type = 'highpass'; hp.frequency.value = 1600;
    n.connect(hp); hp.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(0.25 * master, c.currentTime + 0.04);
    g.gain.linearRampToValueAtTime(0, c.currentTime + 0.55);
    n.start(); n.stop(c.currentTime + 0.6);
  },
  pour() {
    const c = getCtx(); if (!c) return;
    const n = noise(c, 0.8); const bp = c.createBiquadFilter(); const g = c.createGain();
    bp.type = 'bandpass'; bp.frequency.value = 600; bp.Q.value = 0.7;
    n.connect(bp); bp.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(0, c.currentTime);
    g.gain.linearRampToValueAtTime(0.22 * master, c.currentTime + 0.1);
    g.gain.linearRampToValueAtTime(0, c.currentTime + 0.7);
    n.start(); n.stop(c.currentTime + 0.75);
  },
  flip() {
    const c = getCtx(); if (!c) return;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(280, c.currentTime); o.frequency.linearRampToValueAtTime(520, c.currentTime + 0.18);
    o.connect(g); g.connect(c.destination); env(g, c.currentTime, 0.01, 0.05, 0.4, 0.22); o.start(); o.stop(c.currentTime + 0.25);
  },
  pop() {
    const c = getCtx(); if (!c) return;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(880, c.currentTime); o.frequency.exponentialRampToValueAtTime(440, c.currentTime + 0.1);
    o.connect(g); g.connect(c.destination); env(g, c.currentTime, 0.005, 0.02, 0.4, 0.14); o.start(); o.stop(c.currentTime + 0.18);
  },
  serve() {
    const c = getCtx(); if (!c) return;
    const t = c.currentTime;
    [660, 880, 1175].forEach((f, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.type = 'sine'; o.frequency.value = f;
      o.connect(g); g.connect(c.destination);
      g.gain.setValueAtTime(0, t + i * 0.08);
      g.gain.linearRampToValueAtTime(0.3 * master, t + i * 0.08 + 0.02);
      g.gain.linearRampToValueAtTime(0, t + i * 0.08 + 0.22);
      o.start(t + i * 0.08); o.stop(t + i * 0.08 + 0.25);
    });
  },
  burn() {
    const c = getCtx(); if (!c) return;
    const n = noise(c, 0.9); const lp = c.createBiquadFilter(); const g = c.createGain();
    lp.type = 'lowpass'; lp.frequency.value = 250;
    n.connect(lp); lp.connect(g); g.connect(c.destination);
    g.gain.setValueAtTime(0.3 * master, c.currentTime);
    g.gain.linearRampToValueAtTime(0, c.currentTime + 0.8);
    n.start(); n.stop(c.currentTime + 0.85);
  },
  angry() {
    const c = getCtx(); if (!c) return;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = 'square'; o.frequency.setValueAtTime(180, c.currentTime); o.frequency.linearRampToValueAtTime(90, c.currentTime + 0.3);
    o.connect(g); g.connect(c.destination); env(g, c.currentTime, 0.01, 0.05, 0.4, 0.4); o.start(); o.stop(c.currentTime + 0.45);
  },
};

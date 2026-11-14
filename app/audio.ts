import { MARTIAL_BEATS, MARTIAL_DURATION } from "./three/martial";
import { TEMPLE_LESSON_DURATION_MS } from "./templeSchedule";

export type TempleSound = "wood" | "prayer" | "bow" | "beads" | "meditate" | "incense" | "bell" | "water" | "release" | "martial" | "pagoda" | "drum" | "towerBell" | "lamp" | "flower" | "ritual";
export type TempleAmbienceRequest = { kind: "hall" } | { kind: "lesson"; start: number };

export type TempleAudio = {
  unlock: () => Promise<boolean>;
  play: (sound: TempleSound) => void;
  stop: (sound: TempleSound) => void;
  setAmbience: (request: TempleAmbienceRequest | null) => Promise<boolean>;
  ringTimeBell: () => boolean;
  setEnabled: (enabled: boolean) => void;
  setGameVolume: (volume: number) => void;
  setTempleVolume: (volume: number) => void;
  dispose: () => void;
};

type Mode = { frequency: number; amplitude: number; decay: number };
type Voice = { source: AudioBufferSourceNode; gain: GainNode; sound: TempleSound };
type AmbienceVoice = { source: AudioBufferSourceNode; gain: GainNode; nodes: AudioNode[]; endAt?: number };
type SynthSound = Exclude<TempleSound, "wood" | "release" | "pagoda">;
type AudioChannel = "game" | "temple";
const MASTER_GAIN = 1.1;
const CHANT_PLAYBACK_RATE = 0.91;

/** A diffuse, dark room tail softens syllables without adding another spoken voice. */
function createChantRoomBuffer(audioContext: AudioContext) {
  const sampleRate = audioContext.sampleRate;
  const duration = 2.8;
  const buffer = audioContext.createBuffer(2, Math.ceil(sampleRate * duration), sampleRate);
  const onset = .028;
  const damping = 1 - Math.exp(-2 * Math.PI * 1100 / sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const samples = buffer.getChannelData(channel);
    let random = 1709 + channel * 7919;
    let softened = 0;
    for (let index = Math.ceil(onset * sampleRate); index < samples.length; index++) {
      random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
      softened += (random / 2147483648 - 1 - softened) * damping;
      const time = index / sampleRate - onset;
      const attack = 1 - Math.exp(-time / .045);
      const decay = Math.exp(-time / .48);
      const release = Math.min(1, (samples.length - index - 1) / (sampleRate * .15));
      samples[index] = softened * attack * decay * release;
    }
    for (const [delay, level] of [[.047, .32], [.073, .23], [.113, .15]]) {
      const index = Math.round((delay + channel * .007) * sampleRate);
      samples[index] += level;
    }
    samples[samples.length - 1] = 0;
  }
  return buffer;
}

const soundProfiles: Record<SynthSound, { duration: number; peak: number; cutoff: number; room: number; fadeOut?: number }> = {
  prayer: { duration: 2.8, peak: 0.29, cutoff: 3200, room: 0.7 },
  bow: { duration: 0.95, peak: 0.23, cutoff: 2400, room: 0.35 },
  beads: { duration: 0.9, peak: 0.23, cutoff: 3900, room: 0.45 },
  meditate: { duration: 4.8, peak: 0.33, cutoff: 2600, room: 0.8 },
  incense: { duration: 2.5, peak: 0.27, cutoff: 3100, room: 0.6 },
  bell: { duration: 4.2, peak: 0.36, cutoff: 3300, room: 1.0 },
  water: { duration: 1.1, peak: 0.23, cutoff: 3800, room: 0.15 },
  martial: { duration: MARTIAL_DURATION, peak: 0.32, cutoff: 2700, room: 0.38, fadeOut: 0.6 },
  drum: { duration: 3.6, peak: 0.64, cutoff: 2100, room: 0.75, fadeOut: 0.22 },
  towerBell: { duration: 11.2, peak: 0.62, cutoff: 2800, room: 1.2, fadeOut: 0.65 },
  lamp: { duration: 12, peak: 0.25, cutoff: 2700, room: 1.0, fadeOut: 0.8 },
  flower: { duration: 2.6, peak: 0.28, cutoff: 3100, room: 0.55, fadeOut: 0.2 },
  ritual: { duration: 5.4, peak: 0.31, cutoff: 2900, room: 0.9, fadeOut: 0.45 },
};

function soundChannel(sound: TempleSound): AudioChannel {
  return sound === "water" || sound === "release" || sound === "martial" ? "game" : "temple";
}

// Damped, inharmonic modes give each instrument a physical body and a natural tail.
function addResonance(samples: Float32Array, sampleRate: number, offset: number, modes: Mode[], attack: number) {
  const start = Math.round(offset * sampleRate);
  for (let index = start; index < samples.length; index += 1) {
    const time = (index - start) / sampleRate;
    const onset = (1 - Math.exp(-time / attack)) ** 2;
    let value = 0;
    for (const mode of modes) {
      value += mode.amplitude * Math.exp(-time / mode.decay) * Math.sin(2 * Math.PI * mode.frequency * time);
    }
    samples[index] += value * onset;
  }
}

function addBrush(samples: Float32Array, sampleRate: number, offset: number, duration: number, amplitude: number, seed: number) {
  const start = Math.round(offset * sampleRate);
  const end = Math.min(samples.length, start + Math.round(duration * sampleRate));
  let filtered = 0;
  let low = 0;
  const filterAmount = 1 - Math.exp(-2 * Math.PI * 1800 / sampleRate);
  const lowAmount = 1 - Math.exp(-2 * Math.PI * 120 / sampleRate);
  let randomState = seed;
  for (let index = start; index < end; index += 1) {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    const noise = randomState / 2147483648 - 1;
    filtered += (noise - filtered) * filterAmount;
    low += (filtered - low) * lowAmount;
    const phase = (index - start) / (end - start);
    const envelope = Math.sin(Math.PI * phase) ** 2 * Math.exp(-phase * 2);
    samples[index] += (filtered - low) * amplitude * envelope;
  }
}

function addWood(samples: Float32Array, sampleRate: number, offset: number, strength = 1, pitch = 1, damping = 1) {
  addResonance(samples, sampleRate, offset, [
    { frequency: 506 * pitch, amplitude: 0.65 * strength, decay: 0.095 * damping },
    { frequency: 794 * pitch, amplitude: 0.28 * strength, decay: 0.066 * damping },
    { frequency: 1091 * pitch, amplitude: 0.16 * strength, decay: 0.047 * damping },
    { frequency: 1617 * pitch, amplitude: 0.06 * strength, decay: 0.028 * damping },
    { frequency: 2312 * pitch, amplitude: 0.018 * strength, decay: 0.017 * damping },
    { frequency: 218 * pitch, amplitude: 0.16 * strength, decay: 0.035 * damping },
  ], 0.0014);
  addBrush(samples, sampleRate, offset, 0.019, 0.22 * strength, Math.round(97 + pitch * 310));
}

function addBowl(samples: Float32Array, sampleRate: number, offset: number, frequency: number, strength: number, decay: number) {
  addResonance(samples, sampleRate, offset, [
    { frequency, amplitude: strength * 0.55, decay },
    { frequency: frequency * 1.0037, amplitude: strength * 0.11, decay: decay * 0.93 },
    { frequency: frequency * 2.756, amplitude: strength * 0.12, decay: decay * 0.62 },
    { frequency: frequency * 4.181, amplitude: strength * 0.045, decay: decay * 0.39 },
    { frequency: frequency * 5.393, amplitude: strength * 0.017, decay: decay * 0.24 },
  ], 0.006);
  addBrush(samples, sampleRate, offset, 0.028, strength * 0.065, Math.round(frequency));
}

function addWaterDrop(samples: Float32Array, sampleRate: number, offset: number, frequency: number, strength: number) {
  const start = Math.round(offset * sampleRate);
  const end = Math.min(samples.length, start + Math.round(0.22 * sampleRate));
  for (let index = start; index < end; index += 1) {
    const time = (index - start) / sampleRate;
    const phase = 2 * Math.PI * frequency * (0.72 * time + 0.28 * 0.021 * (1 - Math.exp(-time / 0.021)));
    const envelope = (1 - Math.exp(-time / 0.0025)) ** 2 * Math.exp(-time / 0.046);
    samples[index] += strength * envelope * (Math.sin(phase) + Math.sin(phase * 1.67) * 0.17);
  }
  addBrush(samples, sampleRate, offset, 0.075, strength * 0.45, Math.round(frequency));
}

function softenSamples(samples: Float32Array, sampleRate: number, cutoff: number, room: number, fadeIn: number, fadeOut: number) {
  let mean = 0;
  for (const sample of samples) mean += sample;
  mean /= Math.max(1, samples.length);
  const dcRetention = Math.exp(-2 * Math.PI * 14 / sampleRate);
  const angle = 2 * Math.PI * Math.min(cutoff, sampleRate * 0.42) / sampleRate;
  const cosine = Math.cos(angle);
  const alpha = Math.sin(angle) / Math.SQRT2;
  const denominator = 1 + alpha;
  const b0 = (1 - cosine) / (2 * denominator);
  const b1 = (1 - cosine) / denominator;
  const b2 = b0;
  const a1 = -2 * cosine / denominator;
  const a2 = (1 - alpha) / denominator;
  let previousInput = 0;
  let previousHighPass = 0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const input = samples[index] - mean;
    const highPass = input - previousInput + dcRetention * previousHighPass;
    const output = b0 * highPass + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    previousInput = input;
    previousHighPass = highPass;
    x2 = x1;
    x1 = highPass;
    y2 = y1;
    y1 = output;
    samples[index] = output;
  }
  // Sparse early reflections add the small hall's air without a continuous audio graph.
  const dry = samples.slice();
  for (const [delay, level] of [[0.019, 0.09], [0.039, 0.05], [0.068, 0.025]]) {
    const distance = Math.round(delay * sampleRate);
    for (let index = distance; index < samples.length; index += 1) samples[index] += dry[index - distance] * level * room;
  }
  const attackSamples = Math.max(1, Math.round(fadeIn * sampleRate));
  const releaseSamples = Math.max(1, Math.round(fadeOut * sampleRate));
  for (let index = 0; index < samples.length; index += 1) {
    const attack = Math.min(1, index / attackSamples);
    const release = Math.min(1, (samples.length - 1 - index) / releaseSamples);
    const envelope = (0.5 - Math.cos(Math.PI * attack) * 0.5) * (0.5 - Math.cos(Math.PI * release) * 0.5);
    samples[index] *= envelope;
  }
  samples[0] = 0;
  samples[samples.length - 1] = 0;
}

function normalizeChannels(channels: Float32Array[], peak: number) {
  let maximum = 0;
  for (const samples of channels) {
    for (const sample of samples) maximum = Math.max(maximum, Math.abs(sample));
  }
  const level = peak / Math.max(maximum, 0.000001);
  for (const samples of channels) {
    for (let index = 0; index < samples.length; index += 1) samples[index] *= level;
  }
}

function createSamples(sound: SynthSound, sampleRate: number) {
  const profile = soundProfiles[sound];
  const samples = new Float32Array(Math.ceil(profile.duration * sampleRate));
  switch (sound) {
    case "prayer":
      addBowl(samples, sampleRate, 0, 392, 0.65, 0.8);
      break;
    case "bow":
      addBrush(samples, sampleRate, 0, 0.32, 0.14, 71);
      addWood(samples, sampleRate, 0.43, 0.19, 0.42, 0.42);
      break;
    case "beads":
      [0, 0.21, 0.49].forEach((offset, index) => {
        addWood(samples, sampleRate, offset, 0.16, [1.48, 1.62, 1.43][index], 0.19);
      });
      addBrush(samples, sampleRate, 0.025, 0.70, 0.045, 83);
      break;
    case "meditate":
      addBowl(samples, sampleRate, 0, 220, 0.8, 1.4);
      break;
    case "incense":
      addBowl(samples, sampleRate, 0, 493.88, 0.6, 0.72);
      break;
    case "flower":
      addBrush(samples, sampleRate, 0, 0.28, 0.09, 613);
      addBowl(samples, sampleRate, 0.12, 659.25, 0.42, 0.65);
      addBowl(samples, sampleRate, 0.52, 783.99, 0.18, 0.55);
      break;
    case "ritual":
      addBowl(samples, sampleRate, 0, 261.63, 0.52, 1.65);
      [0.65, 1.35, 2.1].forEach((offset, index) => addWood(samples, sampleRate, offset, 0.13, 0.85 + index * 0.04, 0.6));
      addBowl(samples, sampleRate, 2.9, 392, 0.26, 0.9);
      break;
    case "bell":
      addBowl(samples, sampleRate, 0, 196, 0.8, 1.2);
      break;
    case "drum":
      // A stretched hide falls slightly in pitch after the padded beater lands.
      for (let index = 0; index < samples.length; index += 1) {
        const time = index / sampleRate;
        const phase = 2 * Math.PI * (64 * time + 12 * 0.045 * (1 - Math.exp(-time / 0.045)));
        const envelope = (1 - Math.exp(-time / 0.0035)) ** 2 * Math.exp(-time / 0.62);
        samples[index] += Math.sin(phase) * envelope * 0.7;
      }
      addResonance(samples, sampleRate, 0, [
        { frequency: 103, amplitude: 0.27, decay: 0.43 },
        { frequency: 136, amplitude: 0.19, decay: 0.36 },
        { frequency: 174, amplitude: 0.12, decay: 0.25 },
        { frequency: 220, amplitude: 0.07, decay: 0.19 },
        { frequency: 295, amplitude: 0.035, decay: 0.12 },
        { frequency: 388, amplitude: 0.012, decay: 0.075 },
      ], 0.0038);
      addBrush(samples, sampleRate, 0, 0.047, 0.2, 353);
      break;
    case "towerBell":
      // Nearby bronze modes beat gently, while high partials die away first.
      addResonance(samples, sampleRate, 0, [
        { frequency: 98, amplitude: 0.38, decay: 3.7 },
        { frequency: 196, amplitude: 0.5, decay: 3.8 },
        { frequency: 196.65, amplitude: 0.12, decay: 3.6 },
        { frequency: 263.3, amplitude: 0.16, decay: 2.8 },
        { frequency: 392.8, amplitude: 0.13, decay: 2.2 },
        { frequency: 539.5, amplitude: 0.06, decay: 1.6 },
        { frequency: 706, amplitude: 0.03, decay: 1.15 },
        { frequency: 1014, amplitude: 0.012, decay: 0.8 },
      ], 0.008);
      addBrush(samples, sampleRate, 0, 0.055, 0.085, 439);
      break;
    case "lamp":
      [0, 1.15, 2.55, 4.15, 6.05].forEach((offset, index) => {
        const frequency = [587.33, 739.99, 880, 1174.66, 1479.98][index];
        const strength = 0.5 - index * 0.065;
        addResonance(samples, sampleRate, offset, [
          { frequency, amplitude: strength, decay: 1.3 + index * 0.1 },
          { frequency: frequency * 1.0018, amplitude: strength * 0.14, decay: 1.2 },
          { frequency: frequency * 2.002, amplitude: strength * 0.085, decay: 0.7 },
          { frequency: frequency * 3.005, amplitude: strength * 0.02, decay: 0.35 },
        ], 0.014);
      });
      addBowl(samples, sampleRate, 0, 146.83, 0.19, 2.1);
      break;
    case "water":
      [0, 0.09, 0.25, 0.48].forEach((offset, index) => {
        addWaterDrop(samples, sampleRate, offset, [880, 620, 740, 1040][index], 0.4 - index * 0.045);
      });
      addBrush(samples, sampleRate, 0.035, 0.42, 0.16, 127);
      break;
    case "martial":
      addBrush(samples, sampleRate, 0.12, 0.62, 0.055, 179);
      MARTIAL_BEATS.forEach((beat, index) => {
        const kick = index === 3 || index === 4;
        const landing = index >= 5;
        const sweepDuration = kick ? 0.62 : landing ? 0.44 : 0.28;
        // Cloth and air lead each contact, while the low body pulse lands on its beat.
        addBrush(samples, sampleRate, beat - sweepDuration * 0.72, sweepDuration, kick ? 0.56 : 0.36, 193 + index * 37);
        const frequency = [108, 117, 101, 86, 94, 57, 73][index];
        const decay = landing ? 0.19 : kick ? 0.11 : 0.075;
        const strength = landing ? 0.48 : kick ? 0.3 : 0.21;
        // Short impact windows keep the first mobile synthesis proportional to the hits.
        const impactEnd = Math.min(samples.length, Math.ceil((beat + decay * 8) * sampleRate));
        addResonance(samples.subarray(0, impactEnd), sampleRate, beat, [
          { frequency, amplitude: strength, decay },
          { frequency: frequency * 1.71, amplitude: strength * 0.27, decay: decay * 0.6 },
          { frequency: frequency * 2.44, amplitude: strength * 0.075, decay: decay * 0.37 },
        ], 0.0045);
        addBrush(samples, sampleRate, beat + 0.01, landing ? 0.26 : 0.11, landing ? 0.12 : 0.055, 457 + index * 29);
      });
      addBrush(samples, sampleRate, 8.9, 0.68, 0.055, 809);
      break;
  }
  softenSamples(samples, sampleRate, profile.cutoff, profile.room, 0.003, profile.fadeOut ?? 0.075);
  normalizeChannels([samples], profile.peak);
  return samples;
}

export function createTempleAudio(): TempleAudio {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  const outputs: Partial<Record<AudioChannel, GainNode>> = {};
  const limiters: DynamicsCompressorNode[] = [];
  const volumes: Record<AudioChannel, number> = { game: 1, temple: 1 };
  let gestureUnlocked = false;
  let enabled = false;
  let disposed = false;
  let playbackGeneration = 0;
  let pendingWood: { generation: number; requestedAt: number } | null = null;
  let woodLoad: Promise<AudioBuffer | null> | null = null;
  let woodAbort: AbortController | null = null;
  const buffers = new Map<TempleSound, AudioBuffer>();
  const voices = new Set<Voice>();
  const ambienceBuffers = new Map<TempleAmbienceRequest["kind"], AudioBuffer>();
  const ambienceLoads = new Map<TempleAmbienceRequest["kind"], Promise<AudioBuffer | null>>();
  const ambienceAborts = new Set<AbortController>();
  const ambienceVoices = new Set<AmbienceVoice>();
  let chantRoomBuffer: AudioBuffer | null = null;
  let ambienceVoice: AmbienceVoice | null = null;
  let ambienceRequest: TempleAmbienceRequest | null = null;
  let ambienceGeneration = 0;
  let ambiencePending: Promise<boolean> | null = null;

  function ensureContext() {
    if (disposed || !enabled) return null;
    if (context) return context;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(context.destination);
    for (const channel of ["game", "temple"] as const) {
      const output = context.createGain();
      output.gain.value = volumes[channel];
      outputs[channel] = output;
      // Each channel limits only its own voices, so bells cannot duck water or movement.
      if (typeof context.createDynamicsCompressor === "function") {
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -3;
        limiter.knee.value = 2;
        limiter.ratio.value = 20;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.16;
        output.connect(limiter);
        limiter.connect(master);
        limiters.push(limiter);
      } else output.connect(master);
    }
    return context;
  }

  function stopVoice(voice: Voice, audioContext: AudioContext) {
    voice.gain.gain.cancelScheduledValues(audioContext.currentTime);
    voice.gain.gain.setTargetAtTime(0, audioContext.currentTime, 0.008);
    voice.source.stop(audioContext.currentTime + 0.04);
    voices.delete(voice);
  }

  function releaseVoice(voice: Voice) {
    voices.delete(voice);
    voice.source.disconnect();
    voice.gain.disconnect();
  }

  function startVoice(sound: TempleSound, buffer: AudioBuffer, audioContext: AudioContext, when = audioContext.currentTime, level = 1) {
    const channel = soundChannel(sound);
    const output = outputs[channel];
    if (!enabled || disposed || !output || volumes[channel] <= 0 || context !== audioContext) return;
    // A renewed long ceremony replaces its previous soundtrack with a short fade.
    if (sound === "lamp" || sound === "martial") {
      for (const voice of voices) if (voice.sound === sound) stopVoice(voice, audioContext);
    }
    // Bound overlapping voices even if someone taps rapidly for a long time.
    const channelVoices = [...voices].filter(voice => soundChannel(voice.sound) === channel);
    if (channelVoices.length >= 10) {
      const oldest = channelVoices[0];
      if (oldest) stopVoice(oldest, audioContext);
    }
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    source.buffer = buffer;
    source.playbackRate.value = sound === "beads" ? 0.99 + Math.random() * 0.02 : 1;
    gain.gain.value = (sound === "wood" ? 1 : 0.94 + Math.random() * 0.06) * level;
    source.connect(gain);
    gain.connect(output);
    const voice = { source, gain, sound };
    voices.add(voice);
    source.onended = () => releaseVoice(voice);
    source.start(when);
  }

  function synthBuffer(sound: SynthSound, audioContext: AudioContext) {
    let buffer = buffers.get(sound);
    if (!buffer) {
      const samples = createSamples(sound, audioContext.sampleRate);
      buffer = audioContext.createBuffer(1, samples.length, audioContext.sampleRate);
      buffer.getChannelData(0).set(samples);
      buffers.set(sound, buffer);
    }
    return buffer;
  }

  function ringTimeBell() {
    if (!enabled || disposed || volumes.temple <= 0 || !gestureUnlocked || context?.state !== "running") return false;
    try {
      const buffer = synthBuffer("towerBell", context);
      const start = context.currentTime;
      for (let strike = 0; strike < 4; strike++) startVoice("towerBell", buffer, context, start + strike * 1.8, 0.52);
      return true;
    } catch { return false; }
  }

  function stopAmbienceVoice() {
    const voice = ambienceVoice;
    ambienceVoice = null;
    if (!voice || !context) return;
    voice.gain.gain.cancelScheduledValues(context.currentTime);
    voice.gain.gain.setTargetAtTime(0, context.currentTime, 0.03);
    voice.source.stop(Math.min(voice.endAt ?? Infinity, context.currentTime + 0.18));
  }

  function loadAmbience(kind: TempleAmbienceRequest["kind"], audioContext: AudioContext) {
    const cached = ambienceBuffers.get(kind);
    if (cached) return Promise.resolve(cached);
    const pending = ambienceLoads.get(kind);
    if (pending) return pending;
    const controller = new AbortController();
    ambienceAborts.add(controller);
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const path = kind === "lesson" ? "/audio/heart-sutra.mp3" : "/audio/hall-heart-sutra.mp3";
    const loading = (async () => {
      const response = await fetch(path, { signal: controller.signal });
      if (!response.ok) return null;
      const buffer = await audioContext.decodeAudioData(await response.arrayBuffer());
      if (disposed || context !== audioContext) return null;
      const channels = Array.from({ length: buffer.numberOfChannels }, (_, channel) => buffer.getChannelData(channel));
      normalizeChannels(channels, kind === "lesson" ? 0.76 : 0.62);
      ambienceBuffers.set(kind, buffer);
      return buffer;
    })().catch(() => null).finally(() => {
      clearTimeout(timeout);
      ambienceLoads.delete(kind);
      ambienceAborts.delete(controller);
    });
    ambienceLoads.set(kind, loading);
    return loading;
  }

  function setAmbience(request: TempleAmbienceRequest | null): Promise<boolean> {
    const sameRequest = request?.kind === ambienceRequest?.kind &&
      (request?.kind !== "lesson" || (ambienceRequest?.kind === "lesson" && request.start === ambienceRequest.start));
    if (sameRequest && ambienceVoice && enabled && volumes.temple > 0 && context?.state === "running") return Promise.resolve(true);
    if (sameRequest && ambiencePending) return ambiencePending;
    const generation = ++ambienceGeneration;
    ambienceRequest = request;
    stopAmbienceVoice();
    if (!request) return Promise.resolve(true);
    if (!enabled || disposed || volumes.temple <= 0 || !gestureUnlocked || !context || !outputs.temple) return Promise.resolve(false);
    const audioContext = context;
    const pending = (async () => {
      if (audioContext.state !== "running") {
        try { await audioContext.resume(); } catch { return false; }
      }
      if (audioContext.state !== "running") return false;
      const buffer = await loadAmbience(request.kind, audioContext);
      if (!buffer || !enabled || disposed || volumes.temple <= 0 || generation !== ambienceGeneration || context !== audioContext || !outputs.temple) return false;
      const elapsed = request.kind === "lesson" ? Math.max(0, Date.now() - request.start) / 1000 : 0;
      const remaining = request.kind === "lesson" ? TEMPLE_LESSON_DURATION_MS / 1000 - elapsed : Infinity;
      if (remaining <= 0) return false;
      const source = audioContext.createBufferSource();
      const gain = audioContext.createGain();
      source.buffer = buffer;
      source.loop = true;
      // A small pitch reduction retains a human cadence while giving the male voice more body.
      source.playbackRate.value = CHANT_PLAYBACK_RATE;
      const highPass = audioContext.createBiquadFilter();
      highPass.type = "highpass";
      highPass.frequency.value = 72;
      highPass.Q.value = .6;
      const warmth = audioContext.createBiquadFilter();
      warmth.type = "lowshelf";
      warmth.frequency.value = 230;
      warmth.gain.value = 1.2;
      const softness = audioContext.createBiquadFilter();
      softness.type = "lowpass";
      softness.frequency.value = request.kind === "lesson" ? 1450 : 1300;
      softness.Q.value = .45;
      const room = audioContext.createConvolver();
      chantRoomBuffer ??= createChantRoomBuffer(audioContext);
      room.buffer = chantRoomBuffer;
      const direct = audioContext.createGain();
      direct.gain.value = .6;
      const reverberant = audioContext.createGain();
      reverberant.gain.value = request.kind === "lesson" ? .46 : .52;
      source.connect(highPass);
      highPass.connect(warmth);
      warmth.connect(softness);
      softness.connect(direct);
      softness.connect(room);
      room.connect(reverberant);
      direct.connect(gain);
      reverberant.connect(gain);
      const startsAt = audioContext.currentTime + Math.min(.2, remaining / 2);
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(request.kind === "lesson" ? 0.8 : 0.24, startsAt, 0.22);
      gain.connect(outputs.temple);
      const voice: AmbienceVoice = {
        source, gain,
        nodes: [source, highPass, warmth, softness, room, direct, reverberant, gain],
        endAt: request.kind === "lesson" ? audioContext.currentTime + remaining : undefined,
      };
      ambienceVoice = voice;
      ambienceVoices.add(voice);
      source.onended = () => {
        ambienceVoices.delete(voice);
        if (ambienceVoice === voice) ambienceVoice = null;
        voice.nodes.forEach(node => node.disconnect());
      };
      source.start(startsAt, ((elapsed + startsAt - audioContext.currentTime) * CHANT_PLAYBACK_RATE) % buffer.duration);
      if (voice.endAt !== undefined) {
        // The shared gain also silences the room tail at the scheduled five-minute boundary.
        gain.gain.setTargetAtTime(0, Math.max(startsAt, voice.endAt - .18), .025);
        gain.gain.setValueAtTime(0, voice.endAt);
        source.stop(voice.endAt);
      }
      return true;
    })().catch(() => false).finally(() => {
      if (ambiencePending === pending) ambiencePending = null;
    });
    ambiencePending = pending;
    return pending;
  }

  function loadWood(audioContext: AudioContext) {
    const cached = buffers.get("wood");
    if (cached) return Promise.resolve(cached);
    if (woodLoad) return woodLoad;
    const controller = new AbortController();
    woodAbort = controller;
    woodLoad = (async () => {
      // This same-origin asset is a real CC0 mokugyo recording. Keep its original pitch.
      const response = await fetch("/audio/mokugyo.mp3", { signal: controller.signal });
      if (!response.ok) throw new Error("木鱼录音暂时无法加载");
      const recorded = await audioContext.decodeAudioData(await response.arrayBuffer());
      if (disposed || context !== audioContext) return null;
      const channels: Float32Array[] = [];
      for (let channel = 0; channel < recorded.numberOfChannels; channel += 1) {
        const samples = recorded.getChannelData(channel);
        softenSamples(samples, audioContext.sampleRate, 4600, 0.2, 0.0015, 0.03);
        channels.push(samples);
      }
      normalizeChannels(channels, 0.68);
      buffers.set("wood", recorded);
      const pending = pendingWood;
      pendingWood = null;
      if (pending && pending.generation === playbackGeneration && Date.now() - pending.requestedAt < 5000 && audioContext.state === "running") {
        startVoice("wood", recorded, audioContext);
      }
      return recorded;
    })().catch(() => {
      pendingWood = null;
      return null;
    }).finally(() => {
      if (woodAbort === controller) {
        woodAbort = null;
        woodLoad = null;
      }
    });
    return woodLoad;
  }

  function unlock() {
    try {
      const audioContext = ensureContext();
      if (!audioContext) return Promise.resolve(false);
      // Call resume before returning from the user gesture, as required by mobile Safari.
      const resumed = audioContext.resume();
      void loadWood(audioContext);
      const silent = audioContext.createBufferSource();
      silent.buffer = audioContext.createBuffer(1, 1, audioContext.sampleRate);
      silent.connect(audioContext.destination);
      silent.onended = () => silent.disconnect();
      silent.start();
      return resumed.then(() => {
        gestureUnlocked = audioContext.state === "running";
        return gestureUnlocked;
      }).catch(() => false);
    } catch {
      return Promise.resolve(false);
    }
  }

  function play(requestedSound: TempleSound) {
    if (!enabled || disposed || volumes[soundChannel(requestedSound)] <= 0) return;
    try {
      let sound = requestedSound;
      if (sound === "release") sound = "water";
      if (sound === "pagoda") sound = "bell";
      const audioContext = ensureContext();
      if (!audioContext || !master) return;
      if (audioContext.state !== "running") void audioContext.resume().catch(() => {});
      let buffer = buffers.get(sound);
      if (sound === "wood" && !buffer) {
        pendingWood = { generation: playbackGeneration, requestedAt: Date.now() };
        void loadWood(audioContext);
        return;
      }
      if (!buffer) buffer = synthBuffer(sound as SynthSound, audioContext);
      startVoice(sound, buffer, audioContext);
    } catch {
      // A denied audio session must leave the temple's controls usable.
    }
  }

  function stop(requestedSound: TempleSound) {
    if (requestedSound === "wood") pendingWood = null;
    if (!context) return;
    let sound = requestedSound;
    if (sound === "release") sound = "water";
    if (sound === "pagoda") sound = "bell";
    for (const voice of voices) if (voice.sound === sound) stopVoice(voice, context);
  }

  function setEnabled(nextEnabled: boolean) {
    enabled = nextEnabled;
    if (!enabled) {
      playbackGeneration += 1;
      pendingWood = null;
      ambienceGeneration += 1;
      ambienceRequest = null;
      ambiencePending = null;
      stopAmbienceVoice();
    }
    if (!context || !master) return;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(enabled ? MASTER_GAIN : 0, context.currentTime, 0.012);
    if (!enabled) [...voices].forEach(voice => stopVoice(voice, context!));
  }

  function setVolume(channel: AudioChannel, value: number) {
    const volume = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
    volumes[channel] = volume;
    const output = outputs[channel];
    if (context && output) {
      output.gain.cancelScheduledValues(context.currentTime);
      output.gain.setTargetAtTime(volume, context.currentTime, 0.012);
    }
    if (volume > 0) return;
    if (channel === "temple") {
      playbackGeneration += 1;
      pendingWood = null;
      ambienceGeneration += 1;
      ambienceRequest = null;
      ambiencePending = null;
      stopAmbienceVoice();
    }
    if (context) for (const voice of [...voices]) {
      if (soundChannel(voice.sound) === channel) stopVoice(voice, context);
    }
  }

  function dispose() {
    disposed = true;
    enabled = false;
    playbackGeneration += 1;
    pendingWood = null;
    ambienceGeneration += 1;
    ambienceAborts.forEach(controller => controller.abort());
    ambienceVoices.forEach(voice => {
      voice.source.onended = null;
      voice.source.stop();
      voice.nodes.forEach(node => node.disconnect());
    });
    ambienceVoices.clear();
    ambienceBuffers.clear();
    chantRoomBuffer = null;
    ambienceVoice = null;
    woodAbort?.abort();
    voices.forEach(voice => {
      voice.source.onended = null;
      voice.source.stop();
      releaseVoice(voice);
    });
    buffers.clear();
    master?.disconnect();
    for (const output of Object.values(outputs)) output.disconnect();
    limiters.forEach(limiter => limiter.disconnect());
    limiters.length = 0;
    delete outputs.game;
    delete outputs.temple;
    if (context) void context.close().catch(() => {});
    context = null;
    master = null;
  }

  return { unlock, play, stop, setAmbience, ringTimeBell, setEnabled, setGameVolume: volume => setVolume("game", volume), setTempleVolume: volume => setVolume("temple", volume), dispose };
}

export type TempleSound = "wood" | "prayer" | "bow" | "beads" | "meditate" | "incense" | "bell" | "water" | "release" | "martial" | "pagoda" | "drum" | "towerBell" | "lamp";

export type TempleAudio = {
  unlock: () => Promise<boolean>;
  play: (sound: TempleSound) => void;
  setEnabled: (enabled: boolean) => void;
  dispose: () => void;
};

type Mode = { frequency: number; amplitude: number; decay: number };
type Voice = { source: AudioBufferSourceNode; gain: GainNode; sound: TempleSound };
type SynthSound = Exclude<TempleSound, "wood" | "release" | "pagoda">;

const soundProfiles: Record<SynthSound, { duration: number; peak: number; cutoff: number; room: number; fadeOut?: number }> = {
  prayer: { duration: 2.8, peak: 0.29, cutoff: 3200, room: 0.7 },
  bow: { duration: 0.95, peak: 0.23, cutoff: 2400, room: 0.35 },
  beads: { duration: 0.9, peak: 0.23, cutoff: 3900, room: 0.45 },
  meditate: { duration: 4.8, peak: 0.33, cutoff: 2600, room: 0.8 },
  incense: { duration: 2.5, peak: 0.27, cutoff: 3100, room: 0.6 },
  bell: { duration: 4.2, peak: 0.36, cutoff: 3300, room: 1.0 },
  water: { duration: 1.1, peak: 0.23, cutoff: 3800, room: 0.15 },
  martial: { duration: 1.2, peak: 0.29, cutoff: 2500, room: 0.3 },
  drum: { duration: 3.6, peak: 0.38, cutoff: 2100, room: 0.75, fadeOut: 0.22 },
  towerBell: { duration: 11.2, peak: 0.36, cutoff: 2800, room: 1.2, fadeOut: 0.65 },
  lamp: { duration: 12, peak: 0.25, cutoff: 2700, room: 1.0, fadeOut: 0.8 },
};

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
      [0, 0.28, 0.57].forEach((offset, index) => {
        addBrush(samples, sampleRate, offset, 0.20, 0.42, 193 + index * 13);
        addResonance(samples, sampleRate, offset + 0.12, [
          { frequency: 108 + index * 7, amplitude: 0.21, decay: 0.065 },
          { frequency: 177 + index * 9, amplitude: 0.06, decay: 0.04 },
        ], 0.0025);
      });
      break;
  }
  softenSamples(samples, sampleRate, profile.cutoff, profile.room, 0.003, profile.fadeOut ?? 0.075);
  normalizeChannels([samples], profile.peak);
  return samples;
}

export function createTempleAudio(): TempleAudio {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let enabled = false;
  let disposed = false;
  let playbackGeneration = 0;
  let pendingWood: { generation: number; requestedAt: number } | null = null;
  let woodLoad: Promise<AudioBuffer | null> | null = null;
  let woodAbort: AbortController | null = null;
  const buffers = new Map<TempleSound, AudioBuffer>();
  const voices = new Set<Voice>();

  function ensureContext() {
    if (disposed || !enabled) return null;
    if (context) return context;
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = 0.62;
    master.connect(context.destination);
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

  function startVoice(sound: TempleSound, buffer: AudioBuffer, audioContext: AudioContext) {
    if (!enabled || disposed || !master || context !== audioContext) return;
    // Repeated makeup lights renew one ceremony instead of stacking its whole melody.
    if (sound === "lamp") {
      for (const voice of voices) if (voice.sound === "lamp") stopVoice(voice, audioContext);
    }
    // Bound overlapping voices even if someone taps rapidly for a long time.
    if (voices.size >= 10) {
      const oldest = voices.values().next().value;
      if (oldest) stopVoice(oldest, audioContext);
    }
    const source = audioContext.createBufferSource();
    const gain = audioContext.createGain();
    source.buffer = buffer;
    source.playbackRate.value = sound === "beads" ? 0.99 + Math.random() * 0.02 : 1;
    gain.gain.value = sound === "wood" ? 1 : 0.94 + Math.random() * 0.06;
    source.connect(gain);
    gain.connect(master);
    const voice = { source, gain, sound };
    voices.add(voice);
    source.onended = () => releaseVoice(voice);
    source.start();
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
      return resumed.then(() => audioContext.state === "running").catch(() => false);
    } catch {
      return Promise.resolve(false);
    }
  }

  function play(requestedSound: TempleSound) {
    if (!enabled || disposed) return;
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
      if (!buffer) {
        const samples = createSamples(sound as SynthSound, audioContext.sampleRate);
        buffer = audioContext.createBuffer(1, samples.length, audioContext.sampleRate);
        buffer.getChannelData(0).set(samples);
        buffers.set(sound, buffer);
      }
      startVoice(sound, buffer, audioContext);
    } catch {
      // A denied audio session must leave the temple's controls usable.
    }
  }

  function setEnabled(nextEnabled: boolean) {
    enabled = nextEnabled;
    if (!enabled) {
      playbackGeneration += 1;
      pendingWood = null;
    }
    if (!context || !master) return;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(enabled ? 0.62 : 0, context.currentTime, 0.012);
    if (!enabled) [...voices].forEach(voice => stopVoice(voice, context!));
  }

  function dispose() {
    disposed = true;
    enabled = false;
    playbackGeneration += 1;
    pendingWood = null;
    woodAbort?.abort();
    voices.forEach(voice => {
      voice.source.onended = null;
      voice.source.stop();
      releaseVoice(voice);
    });
    buffers.clear();
    master?.disconnect();
    if (context) void context.close().catch(() => {});
    context = null;
    master = null;
  }

  return { unlock, play, setEnabled, dispose };
}

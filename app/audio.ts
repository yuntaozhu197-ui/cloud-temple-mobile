export type TempleSound = "wood" | "prayer" | "bow" | "beads" | "meditate" | "incense" | "bell" | "water";

export type TempleAudio = {
  unlock: () => Promise<boolean>;
  play: (sound: TempleSound) => void;
  setEnabled: (enabled: boolean) => void;
  dispose: () => void;
};

type Mode = { frequency: number; amplitude: number; decay: number };
type Voice = { source: AudioBufferSourceNode; gain: GainNode };
type SynthSound = Exclude<TempleSound, "wood">;

const durations: Record<SynthSound, number> = {
  prayer: 2.4,
  bow: 0.9,
  beads: 0.85,
  meditate: 3.8,
  incense: 2.2,
  bell: 3.2,
  water: 0.85,
};

const peaks: Record<SynthSound, number> = {
  prayer: 0.31,
  bow: 0.27,
  beads: 0.34,
  meditate: 0.37,
  incense: 0.30,
  bell: 0.40,
  water: 0.22,
};

// Damped, inharmonic modes give each instrument a physical body and a natural tail.
function addResonance(samples: Float32Array, sampleRate: number, offset: number, modes: Mode[], attack: number) {
  const start = Math.round(offset * sampleRate);
  for (let index = start; index < samples.length; index += 1) {
    const time = (index - start) / sampleRate;
    const onset = 1 - Math.exp(-time / attack);
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
  let randomState = seed;
  for (let index = start; index < end; index += 1) {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    const noise = randomState / 2147483648 - 1;
    filtered += (noise - filtered) * 0.17;
    const phase = (index - start) / (end - start);
    samples[index] += filtered * amplitude * Math.sin(Math.PI * phase) * Math.exp(-phase * 3);
  }
}

function addWood(samples: Float32Array, sampleRate: number, offset: number, strength = 1, pitch = 1, damping = 1) {
  addResonance(samples, sampleRate, offset, [
    { frequency: 506 * pitch, amplitude: 0.72 * strength, decay: 0.095 * damping },
    { frequency: 794 * pitch, amplitude: 0.42 * strength, decay: 0.066 * damping },
    { frequency: 1091 * pitch, amplitude: 0.22 * strength, decay: 0.047 * damping },
    { frequency: 1617 * pitch, amplitude: 0.10 * strength, decay: 0.028 * damping },
    { frequency: 2312 * pitch, amplitude: 0.035 * strength, decay: 0.017 * damping },
    { frequency: 218 * pitch, amplitude: 0.16 * strength, decay: 0.035 * damping },
  ], 0.0008);
  addBrush(samples, sampleRate, offset, 0.014, 0.44 * strength, Math.round(97 + pitch * 310));
}

function addBowl(samples: Float32Array, sampleRate: number, offset: number, frequency: number, strength: number, decay: number) {
  addResonance(samples, sampleRate, offset, [
    { frequency, amplitude: strength * 0.67, decay },
    { frequency: frequency * 2.013, amplitude: strength * 0.22, decay: decay * 0.70 },
    { frequency: frequency * 2.019, amplitude: strength * 0.075, decay: decay * 0.67 },
    { frequency: frequency * 2.682, amplitude: strength * 0.10, decay: decay * 0.43 },
    { frequency: frequency * 4.07, amplitude: strength * 0.025, decay: decay * 0.25 },
  ], 0.004);
}

function createSamples(sound: SynthSound, sampleRate: number) {
  const samples = new Float32Array(Math.ceil(durations[sound] * sampleRate));
  switch (sound) {
    case "prayer":
      addBowl(samples, sampleRate, 0, 587.33, 0.65, 0.70);
      break;
    case "bow":
      addBrush(samples, sampleRate, 0, 0.24, 0.18, 71);
      addWood(samples, sampleRate, 0.43, 0.23, 0.48, 0.48);
      break;
    case "beads":
      [0, 0.17, 0.37, 0.60].forEach((offset, index) => {
        addWood(samples, sampleRate, offset, 0.25, 2.05 + index * 0.07, 0.18);
      });
      addBrush(samples, sampleRate, 0.025, 0.70, 0.035, 83);
      break;
    case "meditate":
      addBowl(samples, sampleRate, 0, 220, 0.8, 1.25);
      break;
    case "incense":
      addBowl(samples, sampleRate, 0, 783.99, 0.6, 0.62);
      addBowl(samples, sampleRate, 0.23, 1046.5, 0.16, 0.48);
      break;
    case "bell":
      addBowl(samples, sampleRate, 0, 329.63, 0.8, 1.05);
      break;
    case "water":
      [0, 0.18, 0.4].forEach((offset, index) => {
        addResonance(samples, sampleRate, offset, [
          { frequency: 680 + index * 190, amplitude: 0.5, decay: 0.045 },
          { frequency: 1450 + index * 230, amplitude: 0.12, decay: 0.03 },
        ], 0.002);
        addBrush(samples, sampleRate, offset, 0.11, 0.13, 127 + index);
      });
      break;
  }
  let maximum = 0;
  for (const sample of samples) maximum = Math.max(maximum, Math.abs(sample));
  const level = peaks[sound] / Math.max(maximum, 0.0001);
  const fadeLength = Math.min(samples.length, Math.round(0.035 * sampleRate));
  for (let index = 0; index < samples.length; index += 1) {
    const fade = Math.min(1, (samples.length - 1 - index) / fadeLength);
    samples[index] *= level * fade;
  }
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
    const voice = { source, gain };
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
      let maximum = 0;
      for (let channel = 0; channel < recorded.numberOfChannels; channel += 1) {
        for (const sample of recorded.getChannelData(channel)) maximum = Math.max(maximum, Math.abs(sample));
      }
      const level = 0.68 / Math.max(maximum, 0.0001);
      for (let channel = 0; channel < recorded.numberOfChannels; channel += 1) {
        const samples = recorded.getChannelData(channel);
        for (let index = 0; index < samples.length; index += 1) samples[index] *= level;
      }
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

  function play(sound: TempleSound) {
    if (!enabled || disposed) return;
    try {
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

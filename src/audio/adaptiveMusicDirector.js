const MIN_GAIN = 0.0001;
const DEFAULT_FADE = 2.8;
const LOOP_SECONDS = 24;
const TAU = Math.PI * 2;

export const adaptiveMusicAssets = {
  base: '/assets/music/base_loop.mp3',
  pulse: '/assets/music/pulse_loop.mp3',
  threat: '/assets/music/threat_loop.mp3',
  ice: '/assets/music/ice_loop.mp3',
  extract: '/assets/music/extract_loop.mp3',
  success: '/assets/music/success_stinger.mp3',
  failure: '/assets/music/failure_stinger.mp3',
};

const LOOP_LAYERS = ['base', 'pulse', 'threat', 'ice', 'extract'];

export function createAdaptiveMusicDirector({ getContext, destination, getRunProfile, getHostProfile }) {
  const buffers = new Map();
  const layers = new Map();
  let enabled = false;
  let loadingPromise = null;
  let extractUntil = 0;
  let stopTimer = null;

  return {
    async start() {
      const context = getContext();
      if (!context || !destination) return false;
      enabled = true;
      if (stopTimer) {
        globalThis.clearTimeout(stopTimer);
        stopTimer = null;
      }
      await loadBuffers(context);
      startLayers(context);
      applyMix(DEFAULT_FADE);
      return true;
    },

    stop() {
      enabled = false;
      const context = getContext();
      fadeAll(context, MIN_GAIN, 0.18);
      const stopAt = context ? (context.currentTime ?? 0) + 0.24 : 0.24;
      if (stopTimer) globalThis.clearTimeout(stopTimer);
      stopTimer = globalThis.setTimeout(() => {
        stopTimer = null;
        if (!enabled) stopLayers(stopAt);
      }, 260);
    },

    update() {
      if (!enabled) return;
      applyMix(DEFAULT_FADE);
    },

    handleEvent(eventName) {
      if (!enabled) return;
      const context = getContext();
      if (!context) return;
      if (eventName === 'extract') {
        extractUntil = (context.currentTime ?? 0) + 10;
        applyMix(0.45);
      }
      if (eventName === 'success') playStinger('success');
      if (eventName === 'failure' || eventName === 'jackOut') playStinger(eventName === 'failure' ? 'failure' : 'success');
    },

    getDebugState() {
      const profile = getRunProfile();
      return {
        engine: 'adaptive-buffer-web-audio',
        enabled,
        loaded: LOOP_LAYERS.every((layer) => buffers.has(layer)),
        layers: Object.fromEntries([...layers.entries()].map(([key, layer]) => [key, Number(layer.gain?.gain?.value ?? 0)])),
        stage: profile?.stage ?? 0,
        iceActive: Boolean(profile?.iceActive),
      };
    },
  };

  async function loadBuffers(context) {
    if (loadingPromise) return loadingPromise;
    loadingPromise = Promise.all([
      ...LOOP_LAYERS.map(async (key) => {
        buffers.set(key, createProceduralLayerBuffer(context, key, getHostProfile()?.variant ?? 0));
      }),
      ...Object.entries(adaptiveMusicAssets)
        .filter(([key]) => !LOOP_LAYERS.includes(key))
        .map(async ([key, url]) => {
          const buffer = await loadAudioBuffer(context, url, key);
          buffers.set(key, buffer);
        }),
    ]);
    return loadingPromise;
  }

  function startLayers(context) {
    if (layers.size > 0) return;
    const startAt = (context.currentTime ?? 0) + 0.05;
    const variant = getHostProfile()?.variant ?? 0;

    LOOP_LAYERS.forEach((key, index) => {
      const source = context.createBufferSource();
      const gain = context.createGain();
      const delay = context.createDelay?.();
      const delayGain = context.createGain?.();
      const filter = context.createBiquadFilter?.();
      const saturator = createSoftClipper(context, key);

      source.buffer = buffers.get(key) ?? createFallbackBuffer(context, key);
      source.loop = true;
      if (source.playbackRate) {
        setParam(source.playbackRate, 1 + (((variant + index) % 7) - 3) * 0.0018, startAt);
      }

      setParam(gain.gain, MIN_GAIN, startAt);
      if (filter) {
        filter.type = key === 'base' || key === 'pulse' ? 'lowpass' : 'bandpass';
        setParam(filter.frequency, getLayerFilterFrequency(key, 0, 0), startAt);
        if (filter.Q) setParam(filter.Q, getLayerFilterQ(key), startAt);
        source.connect(filter);
        filter.connect(gain);
      } else {
        source.connect(gain);
      }

      if (saturator) {
        gain.connect(saturator);
        saturator.connect(destination);
      } else {
        gain.connect(destination);
      }

      if (delay && delayGain) {
        setParam(delay.delayTime, key === 'base' ? 0.38 : key === 'extract' ? 0.29 : 0.19, startAt);
        setParam(delayGain.gain, key === 'base' ? 0.07 : key === 'extract' ? 0.09 : 0.035, startAt);
        gain.connect(delay);
        delay.connect(delayGain);
        delayGain.connect(destination);
      }

      source.start(startAt);
      layers.set(key, { source, gain, filter, saturator, delay, delayGain });
    });
  }

  function applyMix(fadeSeconds) {
    const context = getContext();
    if (!context) return;
    const profile = getRunProfile();
    const stage = clamp(Math.round(profile?.stage ?? 0), 0, 3);
    const pressure = clamp(profile?.pressure ?? 0, 0, 1);
    const trace = clamp(profile?.trace ?? 0, 0, 1);
    const danger = Math.max(pressure, trace * 0.8);
    const extractActive = (context.currentTime ?? 0) < extractUntil || Boolean(profile?.hasPayload);

    const targets = {
      base: 0.27 + stage * 0.02,
      pulse: stage === 0 ? 0.018 + pressure * 0.024 : 0.045 + stage * 0.026 + pressure * 0.035,
      threat: stage >= 2 ? 0.052 + danger * 0.11 : stage === 1 ? 0.014 + pressure * 0.018 : MIN_GAIN,
      ice: profile?.iceActive ? 0.085 + danger * 0.075 : MIN_GAIN,
      extract: extractActive ? 0.16 + stage * 0.025 : MIN_GAIN,
    };

    LOOP_LAYERS.forEach((key) => {
      const layer = layers.get(key);
      if (!layer) return;
      rampParam(layer.gain.gain, Math.max(MIN_GAIN, targets[key]), context.currentTime ?? 0, fadeSeconds);
      if (layer.filter) {
        const filterTarget = getLayerFilterFrequency(key, stage, danger);
        rampParam(layer.filter.frequency, filterTarget, context.currentTime ?? 0, fadeSeconds * 1.2);
      }
    });
  }

  function playStinger(key) {
    const context = getContext();
    if (!context || !destination) return;
    const buffer = buffers.get(key) ?? createProceduralStingerBuffer(context, key);
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    setParam(gain.gain, key === 'failure' ? 0.58 : 0.42, context.currentTime ?? 0);
    source.connect(gain);
    gain.connect(destination);
    source.start((context.currentTime ?? 0) + 0.01);
  }

  function fadeAll(context, value, fadeSeconds) {
    if (!context) return;
    layers.forEach((layer) => rampParam(layer.gain.gain, value, context.currentTime ?? 0, fadeSeconds));
  }

  function stopLayers(stopAt) {
    layers.forEach((layer) => {
      try {
        layer.source.stop?.(stopAt);
      } catch {
        // Some browsers throw if a source has already ended; the next start rebuilds all layers.
      }
    });
    layers.clear();
  }
}

function getLayerFilterFrequency(key, stage, danger) {
  return {
    base: 1150 + danger * 520,
    pulse: 520 + stage * 90 + danger * 160,
    threat: 980 + stage * 120 + danger * 360,
    ice: 1240 + danger * 460,
    extract: 1560 + stage * 120,
  }[key] ?? 900;
}

function getLayerFilterQ(key) {
  return {
    base: 0.62,
    pulse: 0.9,
    threat: 1.35,
    ice: 1.6,
    extract: 1.05,
  }[key] ?? 1;
}

function createProceduralLayerBuffer(context, key, variant = 0) {
  const sampleRate = context.sampleRate ?? 44100;
  const length = Math.max(1, Math.floor(sampleRate * LOOP_SECONDS));
  const buffer = context.createBuffer(2, length, sampleRate);
  const root = getMoodRoot(variant);
  const tuning = getLayerTuning(key);

  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    const stereoPhase = channel === 0 ? 0.07 : 0.43;
    for (let index = 0; index < length; index += 1) {
      const time = index / sampleRate;
      data[index] = renderLayerSample(key, time, root, variant, stereoPhase) * tuning.gain;
    }
    applyLoopEdgeFade(data, sampleRate);
  }

  normalizeBuffer(buffer, tuning.peak);
  return buffer;
}

function createProceduralStingerBuffer(context, key) {
  const seconds = key === 'failure' ? 3.2 : 2.6;
  const sampleRate = context.sampleRate ?? 44100;
  const length = Math.max(1, Math.floor(sampleRate * seconds));
  const buffer = context.createBuffer(2, length, sampleRate);
  const root = key === 'failure' ? 43.65 : 65.41;

  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    const side = channel === 0 ? 0.96 : 1.04;
    for (let index = 0; index < length; index += 1) {
      const time = index / sampleRate;
      const progress = time / seconds;
      const env = Math.sin(Math.PI * Math.min(1, progress)) ** 0.7 * Math.exp(-progress * (key === 'failure' ? 2.4 : 1.8));
      const tone = key === 'failure'
        ? Math.sin(TAU * (root * side * (1 - progress * 0.26)) * time) + Math.sin(TAU * root * 2.93 * time) * 0.34
        : Math.sin(TAU * root * 2 * side * time) + Math.sin(TAU * root * 3 * side * time) * 0.42;
      const air = cyclicTexture(time, channel + (key === 'failure' ? 11 : 23), key === 'failure' ? [37, 61] : [71, 113]);
      data[index] = (tone * 0.22 + air * 0.05) * env;
    }
  }

  normalizeBuffer(buffer, key === 'failure' ? 0.78 : 0.62);
  return buffer;
}

function renderLayerSample(key, time, root, variant, stereoPhase) {
  if (key === 'pulse') return renderPulseLayer(time, root, variant, stereoPhase);
  if (key === 'threat') return renderThreatLayer(time, root, variant, stereoPhase);
  if (key === 'ice') return renderIceLayer(time, root, variant, stereoPhase);
  if (key === 'extract') return renderExtractLayer(time, root, variant, stereoPhase);
  return renderBaseLayer(time, root, variant, stereoPhase);
}

function renderBaseLayer(time, root, variant, phase) {
  const slow = 0.74 + sineCycle(time, 2, phase) * 0.1 + sineCycle(time, 5, phase + 0.2) * 0.06;
  const sub = Math.sin(TAU * root * 0.5 * time) * 0.34;
  const fifth = Math.sin(TAU * root * 1.5 * time + sineCycle(time, 1, phase) * 0.02) * 0.18;
  const minor = Math.sin(TAU * root * 2.378 * time + sineCycle(time, 3, phase + 0.11) * 0.05) * 0.09;
  const air = cyclicTexture(time, variant + phase * 100, [29, 47, 83]) * 0.075;
  return (sub + fifth + minor + air) * slow;
}

function renderPulseLayer(time, root, variant, phase) {
  const step = phraseStep(time, 16);
  const pattern = [0, 3, 7, 10, 14];
  const active = pattern.includes(step.index) ? 1 : 0;
  const ghost = [5, 12].includes(step.index) ? 0.42 : 0;
  const env = pulseEnvelope(step.position, 0.035, 0.34) * Math.max(active, ghost);
  const drift = 1 + sineCycle(time, 4, phase + 0.18) * 0.003;
  const bass = Math.sin(TAU * root * 0.75 * drift * time) + Math.sin(TAU * root * 1.5 * time) * 0.35;
  const tick = cyclicTexture(time, variant + 17, [97, 149]) * pulseEnvelope(step.position, 0.012, 0.06) * active;
  return bass * env * 0.74 + tick * 0.12;
}

function renderThreatLayer(time, root, variant, phase) {
  const swell = (0.46 + sineCycle(time, 1, phase + 0.33) * 0.28 + sineCycle(time, 4, phase + 0.61) * 0.12);
  const dissonance = Math.sin(TAU * root * 2.82 * time) * 0.14 + Math.sin(TAU * root * 3.97 * time + phase) * 0.11;
  const undertow = Math.sin(TAU * root * 0.375 * time + sineCycle(time, 2, phase) * 0.1) * 0.18;
  const staticBed = cyclicTexture(time, variant + 31, [43, 89, 157]) * 0.15;
  return (undertow + dissonance + staticBed) * swell;
}

function renderIceLayer(time, root, variant, phase) {
  const step = phraseStep(time, 16);
  const hit = [1, 6, 11, 15].includes(step.index) ? pulseEnvelope(step.position, 0.01, 0.18) : 0;
  const ring = Math.sin(TAU * root * 4.74 * time + phase) * 0.24 + Math.sin(TAU * root * 6.31 * time) * 0.16;
  const scrape = cyclicTexture(time, variant + 47, [113, 193, 251]) * 0.13;
  const drone = Math.sin(TAU * root * 1.125 * time + sineCycle(time, 3, phase) * 0.04) * 0.09;
  return drone + (ring + scrape) * hit;
}

function renderExtractLayer(time, root, variant, phase) {
  const step = phraseStep(time, 12);
  const pattern = [0, 2, 5, 7, 10];
  const hit = pattern.includes(step.index) ? pulseEnvelope(step.position, 0.025, 0.22) : 0;
  const degrees = [2, 5, 7, 10, 14];
  const degree = degrees[pattern.indexOf(step.index) >= 0 ? pattern.indexOf(step.index) : 0];
  const freq = root * 2 * (2 ** (degree / 12));
  const shimmer = Math.sin(TAU * freq * time + phase) * 0.26 + Math.sin(TAU * freq * 2.01 * time) * 0.08;
  const pad = Math.sin(TAU * root * 2.378 * time + sineCycle(time, 2, phase) * 0.08) * 0.08;
  const grain = cyclicTexture(time, variant + 73, [131, 211]) * 0.06;
  return shimmer * hit + pad + grain * (0.3 + hit);
}

function getLayerTuning(key) {
  return {
    base: { gain: 0.68, peak: 0.82 },
    pulse: { gain: 0.62, peak: 0.74 },
    threat: { gain: 0.46, peak: 0.62 },
    ice: { gain: 0.52, peak: 0.68 },
    extract: { gain: 0.48, peak: 0.66 },
  }[key] ?? { gain: 0.5, peak: 0.7 };
}

function getMoodRoot(variant) {
  const roots = [43.65, 46.25, 49.0, 51.91, 55.0];
  return roots[Math.abs(variant) % roots.length];
}

function phraseStep(time, steps) {
  const phraseSeconds = 6;
  const position = (time % phraseSeconds) / phraseSeconds;
  const raw = position * steps;
  return {
    index: Math.floor(raw) % steps,
    position: raw - Math.floor(raw),
  };
}

function pulseEnvelope(position, attack, release) {
  if (position < attack) return position / Math.max(attack, 0.001);
  return Math.exp(-(position - attack) / Math.max(release, 0.001));
}

function sineCycle(time, cycles, phase = 0) {
  return Math.sin(TAU * ((cycles * time) / LOOP_SECONDS + phase));
}

function cyclicTexture(time, seed, cycles) {
  const phase = (Math.sin(seed * 12.9898) * 43758.5453) % 1;
  return cycles.reduce((sum, cycle, index) => (
    sum + Math.sin(TAU * ((cycle * time) / LOOP_SECONDS + phase + index * 0.173)) / (index + 1)
  ), 0) / cycles.length;
}

function applyLoopEdgeFade(data, sampleRate) {
  const edge = Math.min(data.length >> 1, Math.floor(sampleRate * 0.012));
  for (let index = 0; index < edge; index += 1) {
    const fade = index / Math.max(1, edge - 1);
    data[index] *= fade;
    data[data.length - 1 - index] *= fade;
  }
}

function normalizeBuffer(buffer, targetPeak) {
  const channels = buffer.numberOfChannels ?? buffer.channels ?? 2;
  let peak = 0;
  for (let channel = 0; channel < channels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < data.length; index += 1) {
      peak = Math.max(peak, Math.abs(data[index]));
    }
  }
  if (!peak) return;
  const gain = targetPeak / peak;
  for (let channel = 0; channel < channels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = Math.tanh(data[index] * gain * 1.08) / Math.tanh(1.08);
    }
  }
}

async function loadAudioBuffer(context, url, key) {
  if (typeof fetch !== 'function' || typeof context.decodeAudioData !== 'function') {
    return createProceduralStingerBuffer(context, key);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return await context.decodeAudioData(arrayBuffer);
  } catch (error) {
    console.warn(`Adaptive music asset unavailable: ${url}`, error);
    return createProceduralStingerBuffer(context, key);
  }
}

function createFallbackBuffer(context, key, seconds = 12) {
  const sampleRate = context.sampleRate ?? 44100;
  const length = Math.max(1, Math.floor(sampleRate * seconds));
  const buffer = context.createBuffer(2, length, sampleRate);
  const baseFrequency = {
    base: 55,
    pulse: 82.41,
    threat: 110,
    ice: 146.83,
    extract: 196,
    success: 261.63,
    failure: 73.42,
  }[key] ?? 110;

  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      const time = index / sampleRate;
      const drift = Math.sin(time * 0.17 + channel) * 0.35;
      const pulse = key === 'pulse' || key === 'threat'
        ? Math.max(0, Math.sin(time * Math.PI * 2 * 2)) ** 6
        : 0.35;
      const tone = Math.sin((time * baseFrequency + drift) * Math.PI * 2);
      const overtone = Math.sin((time * baseFrequency * 2.01) * Math.PI * 2) * 0.24;
      data[index] = (tone + overtone) * (key === 'base' ? 0.055 : 0.035 + pulse * 0.055);
    }
  }
  return buffer;
}

function createSoftClipper(context, key) {
  if (typeof context.createWaveShaper !== 'function') return null;
  const shaper = context.createWaveShaper();
  const amount = key === 'threat' || key === 'ice' ? 1.8 : 1.15;
  const curve = new Float32Array(256);
  for (let index = 0; index < curve.length; index += 1) {
    const x = (index / (curve.length - 1)) * 2 - 1;
    curve[index] = Math.tanh(x * amount);
  }
  shaper.curve = curve;
  shaper.oversample = '2x';
  return shaper;
}

function setParam(param, value, time) {
  if (!param) return;
  if (typeof param.setValueAtTime === 'function') {
    param.setValueAtTime(Math.max(MIN_GAIN, value), time);
    return;
  }
  param.value = Math.max(MIN_GAIN, value);
}

function rampParam(param, value, startTime, duration) {
  if (!param) return;
  const safeValue = Math.max(MIN_GAIN, value);
  if (typeof param.cancelScheduledValues === 'function') param.cancelScheduledValues(startTime);
  if (typeof param.setValueAtTime === 'function') param.setValueAtTime(Math.max(MIN_GAIN, param.value || MIN_GAIN), startTime);
  if (typeof param.linearRampToValueAtTime === 'function') {
    param.linearRampToValueAtTime(safeValue, startTime + duration);
    return;
  }
  param.value = safeValue;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const MIN_GAIN = 0.0001;
const DEFAULT_FADE = 1.35;

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
    loadingPromise = Promise.all(
      Object.entries(adaptiveMusicAssets).map(async ([key, url]) => {
        const buffer = await loadAudioBuffer(context, url, key);
        buffers.set(key, buffer);
      }),
    );
    return loadingPromise;
  }

  function startLayers(context) {
    if (layers.size > 0) return;
    const startAt = (context.currentTime ?? 0) + 0.05;
    const variant = getHostProfile()?.variant ?? 0;

    LOOP_LAYERS.forEach((key, index) => {
      const source = context.createBufferSource();
      const gain = context.createGain();
      const filter = context.createBiquadFilter?.();
      const saturator = createSoftClipper(context, key);

      source.buffer = buffers.get(key) ?? createFallbackBuffer(context, key);
      source.loop = true;
      if (source.playbackRate) {
        setParam(source.playbackRate, 1 + (((variant + index) % 5) - 2) * 0.003, startAt);
      }

      setParam(gain.gain, MIN_GAIN, startAt);
      if (filter) {
        filter.type = key === 'base' ? 'lowpass' : 'bandpass';
        setParam(filter.frequency, key === 'base' ? 620 : 960 + index * 260, startAt);
        if (filter.Q) setParam(filter.Q, key === 'base' ? 0.7 : 1.8, startAt);
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
      source.start(startAt);
      layers.set(key, { source, gain, filter, saturator });
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
      base: 0.34 + stage * 0.035,
      pulse: stage === 0 ? 0.035 + pressure * 0.035 : 0.08 + stage * 0.065,
      threat: stage >= 2 ? 0.1 + danger * 0.2 : MIN_GAIN,
      ice: profile?.iceActive ? 0.22 + danger * 0.16 : MIN_GAIN,
      extract: extractActive ? 0.3 : MIN_GAIN,
    };

    LOOP_LAYERS.forEach((key) => {
      const layer = layers.get(key);
      if (!layer) return;
      rampParam(layer.gain.gain, Math.max(MIN_GAIN, targets[key]), context.currentTime ?? 0, fadeSeconds);
      if (layer.filter) {
        const filterTarget = key === 'base'
          ? 360 + pressure * 260
          : 620 + stage * 170 + danger * 340;
        rampParam(layer.filter.frequency, filterTarget, context.currentTime ?? 0, fadeSeconds * 1.2);
      }
    });
  }

  function playStinger(key) {
    const context = getContext();
    if (!context || !destination) return;
    const buffer = buffers.get(key) ?? createFallbackBuffer(context, key, 3);
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

async function loadAudioBuffer(context, url, key) {
  if (typeof fetch !== 'function' || typeof context.decodeAudioData !== 'function') {
    return createFallbackBuffer(context, key);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return await context.decodeAudioData(arrayBuffer);
  } catch (error) {
    console.warn(`Adaptive music asset unavailable: ${url}`, error);
    return createFallbackBuffer(context, key);
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

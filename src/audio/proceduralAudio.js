const AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext;

const SFX_VOLUME = 0.34;
const MIN_AUDIO_VALUE = 0.0001;

export function createAudioDirector() {
  let context = null;
  let master = null;
  let sfxBus = null;
  let enabled = false;
  let strudelApi = null;
  let strudelReady = null;
  let strudelPatternKey = '';
  let runProfile = createRunProfile();
  let hostProfile = createHostProfile('default');

  return {
    isEnabled() {
      return enabled;
    },

    updateRunState(run, system) {
      runProfile = createRunProfile(run);
      hostProfile = createHostProfile(system?.seedId ?? system?.alias ?? 'default');
      if (enabled) void updateStrudelPattern();
      return { ...runProfile, hostVariant: hostProfile.variant };
    },

    async toggle() {
      try {
        ensureContext();
        if (!context && !canUseStrudel()) return false;

        enabled = !enabled;
        if (enabled) {
          await resumeContext();
          await updateStrudelPattern(true);
          playUiBlip();
        } else {
          playPowerDown();
          stopStrudel();
        }
        return enabled;
      } catch (error) {
        console.warn('Audio unavailable', error);
        enabled = false;
        stopStrudel();
        return false;
      }
    },

    async play(eventName) {
      if (!enabled) return;

      try {
        ensureContext();
        await resumeContext();

        const sounds = {
          scan: playScan,
          move: playMove,
          selectProgram: playUiBlip,
          runProgram: playProgram,
          spike: playSpike,
          ghost: playGhost,
          shield: playShield,
          extract: playExtract,
          jackOut: playJackOut,
          openOverlay: playUiBlip,
          target: playTarget,
          scanner: playScanner,
          success: playSuccess,
          failure: playFailure,
        };

        sounds[eventName]?.();
      } catch (error) {
        console.warn(`Audio event failed: ${eventName}`, error);
      }
    },
  };

  function ensureContext() {
    if (!AudioContextCtor || context) return;

    context = new AudioContextCtor();
    master = context.createGain();
    master.gain.value = 0.72;
    master.connect(context.destination);

    sfxBus = context.createGain();
    sfxBus.gain.value = SFX_VOLUME;
    sfxBus.connect(master);
  }

  async function resumeContext() {
    if (context?.state === 'suspended') await context.resume();
  }

  async function ensureStrudel() {
    if (!canUseStrudel()) return null;
    if (strudelApi) return strudelApi;
    if (!strudelReady) {
      strudelReady = import('@strudel/web').then(async (api) => {
        await api.initStrudel();
        strudelApi = api;
        return api;
      });
    }
    return strudelReady;
  }

  async function updateStrudelPattern(force = false) {
    if (!enabled) return;
    const api = await ensureStrudel();
    if (!api) return;

    const code = createStrudelScore(runProfile, hostProfile);
    const key = `${runProfile.stage}:${runProfile.level}:${hostProfile.variant}`;
    if (!force && key === strudelPatternKey) return;
    strudelPatternKey = key;
    await api.evaluate(code, true);
  }

  function stopStrudel() {
    try {
      strudelApi?.hush();
    } catch (error) {
      console.warn('Strudel stop failed', error);
    }
    strudelPatternKey = '';
  }

  function playTone({ frequency, endFrequency = frequency, duration = 0.16, type = 'sine', volume = 0.24, destination = sfxBus }) {
    if (!context || !destination) return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), now);
    rampExponential(oscillator.frequency, Math.max(20, endFrequency), now + duration);
    gain.gain.setValueAtTime(MIN_AUDIO_VALUE, now);
    rampExponential(gain.gain, Math.max(MIN_AUDIO_VALUE, volume), now + 0.012);
    rampExponential(gain.gain, MIN_AUDIO_VALUE, now + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  function playNoise({ duration = 0.18, volume = 0.16, filterFrequency = 1200, filterType = 'highpass', destination = sfxBus } = {}) {
    if (!context || !destination) return;
    const bufferSize = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < bufferSize; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / bufferSize);
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = filterType;
    filter.frequency.value = filterFrequency;
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(destination);
    source.start();
  }

  function playScan() {
    playTone({ frequency: 420, endFrequency: 1560, duration: 0.22, type: 'sawtooth', volume: 0.12 });
    playNoise({ duration: 0.12, volume: 0.08, filterFrequency: 2200 });
  }

  function playMove() {
    playTone({ frequency: 220, endFrequency: 330, duration: 0.09, type: 'triangle', volume: 0.12 });
    globalThis.setTimeout(() => playTone({ frequency: 440, endFrequency: 392, duration: 0.08, type: 'triangle', volume: 0.09 }), 70);
  }

  function playUiBlip() {
    playTone({ frequency: 880, endFrequency: 660, duration: 0.08, type: 'sine', volume: 0.1 });
  }

  function playProgram() {
    playTone({ frequency: 130.81, endFrequency: 523.25, duration: 0.2, type: 'square', volume: 0.12 });
    playNoise({ duration: 0.08, volume: 0.07, filterFrequency: 1800 });
  }

  function playSpike() {
    playTone({ frequency: 98, endFrequency: 784, duration: 0.18, type: 'square', volume: 0.13 });
    playNoise({ duration: 0.1, volume: 0.08, filterFrequency: 1400, filterType: 'bandpass' });
  }

  function playGhost() {
    playTone({ frequency: 659.25, endFrequency: 246.94, duration: 0.24, type: 'sine', volume: 0.08 });
    globalThis.setTimeout(() => playTone({ frequency: 987.77, endFrequency: 493.88, duration: 0.18, type: 'triangle', volume: 0.055 }), 80);
  }

  function playShield() {
    [220, 330, 440].forEach((frequency, index) => {
      globalThis.setTimeout(() => playTone({ frequency, endFrequency: frequency * 0.99, duration: 0.16, type: 'triangle', volume: 0.075 }), index * 45);
    });
  }

  function playExtract() {
    [0, 90, 180].forEach((delayMs, index) => {
      globalThis.setTimeout(() => playTone({ frequency: 392 * (1 + index * 0.25), duration: 0.11, type: 'sine', volume: 0.11 }), delayMs);
    });
  }

  function playJackOut() {
    playTone({ frequency: 660, endFrequency: 82.41, duration: 0.32, type: 'triangle', volume: 0.13 });
  }

  function playTarget() {
    playTone({ frequency: 330, endFrequency: 495, duration: 0.12, type: 'sine', volume: 0.1 });
  }

  function playScanner() {
    playTone({ frequency: 196, endFrequency: 784, duration: 0.28, type: 'sawtooth', volume: 0.1 });
    playNoise({ duration: 0.18, volume: 0.06, filterFrequency: 2600 });
  }

  function playSuccess() {
    [261.63, 392, 523.25].forEach((frequency, index) => {
      globalThis.setTimeout(() => playTone({ frequency, duration: 0.18, type: 'sine', volume: 0.12 }), index * 90);
    });
  }

  function playFailure() {
    playTone({ frequency: 110, endFrequency: 55, duration: 0.42, type: 'sawtooth', volume: 0.17 });
    playNoise({ duration: 0.32, volume: 0.12, filterFrequency: 900, filterType: 'bandpass' });
  }

  function playPowerDown() {
    playTone({ frequency: 440, endFrequency: 70, duration: 0.28, type: 'triangle', volume: 0.1 });
  }
}

export function createStrudelScore(profile, host) {
  const music = createMusicProfile(profile, host);

  return `
setcps(${music.cps})
stack(
  note("${music.subDronePattern}").sound("sine").gain(${music.subDroneGain}).attack(.45).decay(.8).sustain(.68).release(1.8).lpf(${music.subDroneFilter}).room(${music.deepRoom}),
  note("${music.pulseBassPattern}").sound("${music.bassSound}").gain(${music.bassGain}).attack(.03).decay(.22).sustain(.28).release(.24).lpf(${music.bassFilter}).shape(${music.shape}),
  note("${music.padPattern}").sound("${music.padSound}").gain(${music.padGain}).attack(.35).decay(.7).sustain(.62).release(2.4).lpf(${music.padFilter}).room(${music.padRoom}).delay(${music.padDelay}),
  note("${music.glassArpPattern}").sound("${music.arpSound}").gain(${music.arpGain}).attack(.02).decay(.18).sustain(.2).release(.2).lpf(${music.arpFilter}).delay(${music.arpDelay}).room(${music.arpRoom}),
  sound("${music.texturePattern}").gain(${music.textureGain}).decay(${music.textureDecay}).sustain(0).hpf(${music.textureHighpass}).lpf(${music.textureLowpass}).room(.3),
  ${music.tensionLead}
)`;
}

function createMusicProfile(profile = createRunProfile(), host = createHostProfile('default')) {
  const variant = host.variant ?? 0;
  const stage = clamp(Math.round(profile.stage ?? 0), 0, 3);
  const roots = ['c2', 'd2', 'eb2', 'f2', 'g1'];
  const root = roots[variant % roots.length];
  const subRoot = transpose(root, -12);
  const padRoot = transpose(root, 12);
  const leadRoot = transpose(root, 24);
  const fifth = transpose(root, 7);
  const minorThird = transpose(root, 3);
  const leadMinorThird = transpose(leadRoot, 3);
  const leadFifth = transpose(leadRoot, 7);
  const leadSeventh = transpose(leadRoot, 10);
  const leadNinth = transpose(leadRoot, 14);
  const leadStepDown = transpose(leadNinth, -2);
  const stagePressure = clamp((profile.alert * 0.78) + (profile.pressure * 0.22), 0, 1);
  const cpsByStage = [0.42, 0.5, 0.56, 0.62];
  const cps = (cpsByStage[stage] + (host.tempoOffset ?? 0) + (stagePressure * 0.025)).toFixed(2);
  const motif = variant % 3;
  const arpPatterns = [
    [`~`, `<${leadRoot} ~ ${leadFifth} ~>/2`, `<${leadRoot} ${leadMinorThird} ~ ${leadFifth}>/2`, `<${leadRoot} ${leadFifth} ${leadMinorThird} ~>`],
    [`~`, `<${leadFifth} ~ ${leadRoot} ~>/2`, `<${leadFifth} ${leadRoot} ~ ${leadSeventh}>/2`, `<${leadFifth} ${leadRoot} ${leadSeventh} ~>`],
    [`~`, `<${leadMinorThird} ~ ${leadFifth} ~>/2`, `<${leadMinorThird} ${leadFifth} ~ ${leadRoot}>/2`, `<${leadMinorThird} ${leadFifth} ${leadNinth} ~>`],
  ];
  const padProgressions = [
    [makeChord(padRoot, [0, 3, 7]), makeChord(transpose(padRoot, -2), [0, 5, 7])],
    [makeChord(padRoot, [0, 2, 7]), makeChord(transpose(padRoot, -5), [0, 3, 10])],
    [makeChord(padRoot, [0, 3, 10]), makeChord(transpose(padRoot, 3), [0, 2, 7])],
  ];
  const padPair = padProgressions[motif];

  return {
    cps,
    subDronePattern: `<${subRoot} ~ ${root} ~>/8`,
    subDroneGain: formatGain(0.11 + stage * 0.015 + profile.pressure * 0.025),
    subDroneFilter: 180 + Math.round(stagePressure * 260),
    deepRoom: (0.45 + profile.trace * 0.12).toFixed(2),
    pulseBassPattern: [
      `${root} ~ ~ ~`,
      `${root} ~ ~ ${fifth}`,
      `${root} ~ ${minorThird} ~`,
      `${root} ~ ${fifth} ${minorThird} ~`,
    ][stage],
    bassSound: stage >= 2 && variant % 2 ? 'sawtooth' : 'triangle',
    bassGain: formatGain(0.13 + stage * 0.025 + profile.alert * 0.035),
    bassFilter: 320 + Math.round(stagePressure * 640),
    padPattern: `<${padPair[0]} ${padPair[1]}>/6`,
    padSound: variant % 2 ? 'sine' : 'triangle',
    padGain: formatGain(0.12 + profile.trace * 0.025 - stage * 0.006),
    padFilter: 520 + Math.round(stagePressure * 760),
    padDelay: [0.34, 0.32, 0.28, 0.24][stage].toFixed(2),
    padRoom: (0.62 - stage * 0.04 + profile.trace * 0.1).toFixed(2),
    glassArpPattern: arpPatterns[motif][stage],
    arpSound: stage >= 3 && variant % 2 ? 'triangle' : 'sine',
    arpGain: formatGain([0, 0.045, 0.065, 0.085][stage] + profile.pressure * 0.025),
    arpFilter: 900 + Math.round(stagePressure * 1500),
    arpDelay: [0.42, 0.38, 0.34, 0.3][stage].toFixed(2),
    arpRoom: (0.54 - stage * 0.04).toFixed(2),
    texturePattern: ['~', 'brown ~ ~ ~', 'brown ~ brown ~', 'brown ~ pink ~'][stage],
    textureGain: formatGain([0, 0.025, 0.035, 0.045][stage] + profile.alert * 0.012),
    textureDecay: [0.08, 0.16, 0.18, 0.22][stage].toFixed(2),
    textureHighpass: 1200 + Math.round(stagePressure * 1600),
    textureLowpass: 2800 + Math.round(stagePressure * 1800),
    shape: (0.04 + stagePressure * 0.16).toFixed(2),
    tensionLead: stage >= 3
      ? `note("<${leadNinth} ~ ${leadStepDown} ~>/2").sound("sine").gain(${formatGain(0.04 + profile.alert * 0.035)}).attack(.04).decay(.24).sustain(.12).release(.5).lpf(${1100 + Math.round(stagePressure * 1800)}).delay(.32).room(.35)`
      : 'note("~")',
  };
}

function createRunProfile(run = {}) {
  const alert = ratio(run.alert, run.maxAlert);
  const trace = ratio(run.trace, run.maxTrace);
  const damage = 1 - ratio(run.integrity ?? run.maxIntegrity, run.maxIntegrity);
  const pressure = clamp(Math.max(alert * 1.08, trace * 0.86, damage * 0.76), 0, 1);
  const stage = pressure >= 0.72 ? 3 : pressure >= 0.48 ? 2 : pressure >= 0.24 ? 1 : 0;
  return {
    alert,
    trace,
    damage,
    pressure,
    stage,
    level: stage >= 3 ? 'high' : stage >= 1 ? 'medium' : 'low',
  };
}

function createHostProfile(seedId) {
  const hash = hashString(String(seedId));
  return {
    variant: hash % 997,
    tempoOffset: ((hash % 7) - 3) * 0.01,
  };
}

function transpose(noteName, semitones) {
  const match = /^([a-g])([b#]?)(-?\d)$/i.exec(noteName);
  if (!match) return noteName;
  const names = ['c', 'db', 'd', 'eb', 'e', 'f', 'gb', 'g', 'ab', 'a', 'bb', 'b'];
  const [, note, accidental, octaveRaw] = match;
  const base = names.indexOf(`${note.toLowerCase()}${accidental.toLowerCase()}`);
  if (base < 0) return noteName;
  const total = base + semitones;
  const octave = Number(octaveRaw) + Math.floor(total / 12);
  return `${names[((total % 12) + 12) % 12]}${octave}`;
}

function makeChord(root, intervals) {
  return `[${intervals.map((interval) => transpose(root, interval)).join(',')}]`;
}

function formatGain(value) {
  return clamp(value, 0, 0.55).toFixed(2);
}

function canUseStrudel() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function ratio(value = 0, max = 1) {
  if (!Number.isFinite(max) || max <= 0) return 0;
  return clamp((value ?? 0) / max, 0, 1);
}

function hashString(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function rampExponential(audioParam, value, time) {
  const safeValue = Math.max(MIN_AUDIO_VALUE, value);
  if (audioParam.value <= 0) {
    audioParam.value = MIN_AUDIO_VALUE;
  }

  if (typeof audioParam.exponentialRampToValueAtTime === 'function') {
    audioParam.exponentialRampToValueAtTime(safeValue, time);
    return;
  }

  audioParam.value = safeValue;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

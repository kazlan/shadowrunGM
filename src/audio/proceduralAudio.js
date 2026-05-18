import { createAdaptiveMusicDirector } from './adaptiveMusicDirector.js';

const AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext;

const SFX_VOLUME = 0.34;
const MUSIC_VOLUME = 0.11;
const MIN_AUDIO_VALUE = 0.0001;

export function createAudioDirector() {
  let context = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let musicEnabled = false;
  let sfxEnabled = false;
  let musicVolume = MUSIC_VOLUME;
  let sfxVolume = SFX_VOLUME;
  let adaptiveMusic = null;
  let runProfile = createRunProfile();
  let hostProfile = createHostProfile('default');

  return {
    isEnabled() {
      return musicEnabled || sfxEnabled;
    },

    isMusicEnabled() {
      return musicEnabled;
    },

    isSfxEnabled() {
      return sfxEnabled;
    },

    getState() {
      return { music: musicEnabled, sfx: sfxEnabled, musicVolume, sfxVolume };
    },

    setMusicVolume(value) {
      musicVolume = clampVolume(value, MUSIC_VOLUME);
      if (musicBus) musicBus.gain.value = musicVolume;
      return musicVolume;
    },

    setSfxVolume(value) {
      sfxVolume = clampVolume(value, SFX_VOLUME);
      if (sfxBus) sfxBus.gain.value = sfxVolume;
      return sfxVolume;
    },

    updateRunState(run, system) {
      runProfile = createRunProfile(run, system);
      hostProfile = createHostProfile(system?.seedId ?? system?.alias ?? 'default');
      adaptiveMusic?.update(runProfile, hostProfile);
      return { ...runProfile, hostVariant: hostProfile.variant };
    },

    getMusicDebugState() {
      return adaptiveMusic?.getDebugState() ?? { engine: 'adaptive-buffer-web-audio', enabled: false, loaded: false, layers: {} };
    },

    async toggle() {
      return this.toggleMusic();
    },

    async toggleMusic() {
      try {
        ensureContext();
        if (!context) return false;

        musicEnabled = !musicEnabled;
        if (musicEnabled) {
          await resumeContext();
          await adaptiveMusic.start();
          if (sfxEnabled) playMusicOn();
        } else {
          if (sfxEnabled) playMusicOff();
          adaptiveMusic?.stop();
        }
        return musicEnabled;
      } catch (error) {
        console.warn('Audio unavailable', error);
        musicEnabled = false;
        adaptiveMusic?.stop();
        return false;
      }
    },

    async toggleSfx() {
      try {
        ensureContext();
        if (!context) return false;
        sfxEnabled = !sfxEnabled;
        if (sfxEnabled) {
          await resumeContext();
          playSfxOn();
        }
        return sfxEnabled;
      } catch (error) {
        console.warn('SFX unavailable', error);
        sfxEnabled = false;
        return false;
      }
    },

    async play(eventName) {
      adaptiveMusic?.handleEvent(eventName);
      if (!sfxEnabled) return;

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
    sfxBus.gain.value = sfxVolume;
    sfxBus.connect(master);

    musicBus = context.createGain();
    musicBus.gain.value = musicVolume;
    musicBus.connect(master);

    adaptiveMusic = createAdaptiveMusicDirector({
      getContext: () => context,
      destination: musicBus,
      getRunProfile: () => runProfile,
      getHostProfile: () => hostProfile,
    });
  }

  async function resumeContext() {
    if (context?.state === 'suspended') await context.resume();
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
    playTone({ frequency: 260, endFrequency: 1880, duration: 0.32, type: 'sawtooth', volume: 0.13 });
    globalThis.setTimeout(() => playTone({ frequency: 940, endFrequency: 1320, duration: 0.09, type: 'sine', volume: 0.08 }), 110);
    globalThis.setTimeout(() => playTone({ frequency: 1180, endFrequency: 1660, duration: 0.09, type: 'sine', volume: 0.07 }), 190);
    playNoise({ duration: 0.18, volume: 0.075, filterFrequency: 2600 });
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
    playTone({ frequency: 82.41, endFrequency: 110, duration: 0.16, type: 'square', volume: 0.18 });
    globalThis.setTimeout(() => playTone({ frequency: 740, endFrequency: 196, duration: 0.11, type: 'sawtooth', volume: 0.15 }), 55);
    globalThis.setTimeout(() => playTone({ frequency: 1480, endFrequency: 392, duration: 0.08, type: 'square', volume: 0.1 }), 115);
    playNoise({ duration: 0.16, volume: 0.12, filterFrequency: 1150, filterType: 'bandpass' });
  }

  function playGhost() {
    playTone({ frequency: 987.77, endFrequency: 246.94, duration: 0.34, type: 'sine', volume: 0.075 });
    globalThis.setTimeout(() => playTone({ frequency: 739.99, endFrequency: 184.99, duration: 0.28, type: 'triangle', volume: 0.055 }), 70);
    globalThis.setTimeout(() => playNoise({ duration: 0.2, volume: 0.035, filterFrequency: 3400, filterType: 'highpass' }), 35);
  }

  function playShield() {
    [196, 261.63, 329.63, 392].forEach((frequency, index) => {
      globalThis.setTimeout(() => playTone({ frequency, endFrequency: frequency * 1.01, duration: 0.24, type: 'triangle', volume: 0.075 }), index * 36);
    });
    globalThis.setTimeout(() => playNoise({ duration: 0.12, volume: 0.055, filterFrequency: 680, filterType: 'lowpass' }), 40);
  }

  function playExtract() {
    [0, 55, 110, 165, 240].forEach((delayMs, index) => {
      globalThis.setTimeout(() => playTone({ frequency: 392 + index * 116, endFrequency: 460 + index * 130, duration: 0.075, type: 'sine', volume: 0.095 }), delayMs);
    });
    globalThis.setTimeout(() => playTone({ frequency: 1046.5, endFrequency: 1318.5, duration: 0.18, type: 'triangle', volume: 0.08 }), 285);
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

  function playMusicOn() {
    playTone({ frequency: 330, endFrequency: 660, duration: 0.12, type: 'sine', volume: 0.08 });
  }

  function playMusicOff() {
    playTone({ frequency: 440, endFrequency: 70, duration: 0.28, type: 'triangle', volume: 0.1 });
  }

  function playSfxOn() {
    playTone({ frequency: 880, endFrequency: 1320, duration: 0.08, type: 'sine', volume: 0.1 });
    globalThis.setTimeout(() => playTone({ frequency: 1174.66, endFrequency: 1567.98, duration: 0.08, type: 'sine', volume: 0.08 }), 80);
  }
}

export function createNativeMusicDescriptor(profile, host) {
  const music = createMusicProfile(profile, host);
  return `adaptive-buffer-web-audio://${music.chordPattern}?cps=${music.cps}&stage=${profile?.stage ?? 0}`;
}

function createMusicProfile(profile = createRunProfile(), host = createHostProfile('default')) {
  const variant = host.variant ?? 0;
  const stage = clamp(Math.round(profile.stage ?? 0), 0, 3);
  const stagePressure = clamp((profile.alert * 0.78) + (profile.pressure * 0.22), 0, 1);
  const cpsByStage = [0.58, 0.64, 0.7, 0.76];
  const cps = (cpsByStage[stage] + (host.tempoOffset ?? 0) + (stagePressure * 0.02)).toFixed(2);
  const motif = variant % 3;
  const chordRoots = [
    ['Cm9', 'Gm9'],
    ['Ebm9', 'Bbm9'],
    ['Fm9', 'Cm9'],
    ['Gm9', 'Dm9'],
    ['Am9', 'Em9'],
  ];
  const chordPair = chordRoots[variant % chordRoots.length];
  const melodyMasks = ['<0 1 1 0>/16', '<0 1 0 1>/16', '<1 0 1 0>/16'];
  const melodyPatterns = [
    '[0 <4 3 <2 5>>*2](<2 4>,8)',
    '[0 <3 4 <1 5>>*2](<3 5>,8)',
    '[0 <5 3 <2 4>>*2](<2 5>,8)',
  ];
  const bassPatterns = ['<0!3 1*2>', '<0!2 1 0>', '<0 0 1*2>', '<0!2 1*2>'];
  const drumMasks = [
    '<0 0 1 0>/16',
    '<[0 1] 1 0 1>/16',
    '<[0 1] 1 1 0>/16',
    '<[0 1] 1 1 1>/16',
  ];

  return {
    cps,
    chordPattern: `<${chordPair[0]} ${chordPair[1]}>/4`,
    kickPattern: 'bd',
    kickStructure: ['<[~@3 x] ~>', '<[x ~@3] ~>', '<[x ~@2 x] ~>', '<[x*2 [~@3 x]] x>'][stage],
    kickGain: formatGain([0.14, 0.18, 0.22, 0.26][stage]),
    snarePattern: ['~', '~ rim', '~ [rim, sd:2]', '~ [rim, sd:3]'][stage],
    snareGain: formatGain([0, 0.13, 0.16, 0.19][stage]),
    drumRoom: (0.08 + stage * 0.04).toFixed(2),
    hatPattern: ['~', '[0 ~]*2', '[0 <1 3>]*2', '[0 <1 3>]*<2!3 4>'][stage],
    hatGain: formatGain([0, 0.08, 0.11, 0.14][stage]),
    ridePattern: ['~', '~', 'rd:1*2', 'rd:<1!3 2>*2'][stage],
    rideMask: '<0 0 1 1>/16',
    rideGain: formatGain([0, 0, 0.22, 0.28][stage]),
    drumMask: drumMasks[stage],
    chordSound: 'gm_epiano1:1',
    chordGain: formatGain(0.42 + profile.trace * 0.05),
    chordRoom: (0.44 + profile.trace * 0.1).toFixed(2),
    chordDelay: [0.16, 0.18, 0.2, 0.22][stage].toFixed(2),
    phaser: [2, 3, 4, 5][stage],
    bassPattern: bassPatterns[stage],
    bassAnchor: ['g1', 'g1', 'g2', 'g2'][stage],
    bassSound: 'gm_acoustic_bass',
    bassGain: formatGain(0.48 + stage * 0.04 + profile.alert * 0.04),
    bassFilter: 520 + Math.round(stagePressure * 520),
    shape: (0.06 + stagePressure * 0.12).toFixed(2),
    melodyPattern: melodyPatterns[motif],
    melodyAnchor: ['D5', 'Eb5', 'G5'][motif],
    melodySegment: [2, 3, 4, 4][stage],
    melodyClip: `rand.range(${[0.28, 0.34, 0.4, 0.46][stage]},${[0.52, 0.62, 0.72, 0.82][stage]})`,
    melodyRoom: (0.56 + stage * 0.05).toFixed(2),
    melodyShape: (0.12 + stagePressure * 0.16).toFixed(2),
    melodyDelay: (0.18 + stage * 0.025).toFixed(2),
    fmLow: [1.5, 2, 2.5, 3][stage],
    fmHigh: [4, 5, 6, 7][stage],
    filterLow: 420 + Math.round(stagePressure * 120),
    filterHigh: 820 + Math.round(stagePressure * 360),
    lpq: [3, 4, 5, 5][stage],
    melodyGain: `perlin.range(${[0.36, 0.42, 0.5, 0.56][stage]},${[0.58, 0.68, 0.78, 0.86][stage]})`,
    melodyMask: melodyMasks[motif],
    latePattern: '[0 .01]*4',
    size: [2, 3, 4, 4][stage],
  };
}

function createRunProfile(run = {}, system = null) {
  const alert = ratio(run.alert, run.maxAlert);
  const trace = ratio(run.trace, run.maxTrace);
  const damage = 1 - ratio(run.integrity ?? run.maxIntegrity, run.maxIntegrity);
  const pressure = clamp(Math.max(alert * 1.08, trace * 0.86, damage * 0.76), 0, 1);
  const stage = pressure >= 0.72 ? 3 : pressure >= 0.48 ? 2 : pressure >= 0.24 ? 1 : 0;
  const currentNode = system?.nodes?.find((node) => node.id === run.currentNodeId);
  const iceActive = Boolean(currentNode?.ice && !(run.neutralizedIce ?? []).includes(currentNode.id));
  return {
    alert,
    trace,
    damage,
    pressure,
    stage,
    iceActive,
    hasPayload: Boolean(run.hasPayload),
    status: run.status ?? 'exploring',
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

function clampVolume(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return clamp(number, 0, 1);
}

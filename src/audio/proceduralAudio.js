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
  return `
samples('github:eddyflux/crate')
setcps(.75)
let chords = chord("<Bbm9 Fm9>/4").dict('ireal')
stack(
  stack(
    s("bd").struct("<[x*<1 2> [~@3 x]] x>"),
    s("~ [rim, sd:<2 3>]").room("<0 .2>"),
    n("[0 <1 3>]*<2!3 4>").s("hh"),
    s("rd:<1!3 2>*2").mask("<0 0 1 1>/16").gain(.5)
  ).bank('crate')
  .mask("<[0 1] 1 1 1>/16".early(.5)),
  chords.offset(-1).voicing().s("gm_epiano1:1")
  .phaser(4).room(.5),
  n("<0!3 1*2>").set(chords).mode("root:g2")
  .voicing().s("gm_acoustic_bass"),
  chords.n("[0 <4 3 <2 5>>*2](<3 5>,8)")
  .anchor("D5").voicing()
  .segment(4).clip(rand.range(.4,.8))
  .room(.75).shape(.3).delay(.25)
  .fm(sine.range(3,8).slow(8))
  .lpf(sine.range(500,1000).slow(8)).lpq(5)
  .rarely(ply("2")).chunk(4, fast(2))
  .gain(perlin.range(.6, .9))
  .mask("<0 1 1 0>/16")
)
.late("[0 .01]*4").late("[0 .01]*2").size(4)`;
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

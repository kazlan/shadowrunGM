const AudioContextCtor = globalThis.AudioContext ?? globalThis.webkitAudioContext;

const MUSIC_SCALE = [55, 65.41, 73.42, 82.41, 98, 110, 130.81, 146.83, 164.81, 196, 220];
const SFX_VOLUME = 0.34;
const MIN_AUDIO_VALUE = 0.0001;

export function createAudioDirector() {
  let context = null;
  let master = null;
  let musicBus = null;
  let sfxBus = null;
  let delay = null;
  let delayFeedback = null;
  let droneNodes = [];
  let musicTimer = null;
  let enabled = false;
  let step = 0;

  return {
    isEnabled() {
      return enabled;
    },

    async toggle() {
      try {
        ensureContext();
        if (!context) return false;

        enabled = !enabled;
        if (enabled) {
          await resumeContext();
          ensureMusicPlaying();
          playUiBlip();
        } else {
          playPowerDown();
          stopMusic();
        }
        return enabled;
      } catch (error) {
        console.warn('Audio unavailable', error);
        enabled = false;
        stopMusic();
        return false;
      }
    },

    async play(eventName) {
      if (!enabled) return;

      try {
        ensureContext();
        if (!context) return;
        await resumeContext();

        ensureMusicPlaying();

        const sounds = {
          scan: playScan,
          move: playMove,
          selectProgram: playUiBlip,
          runProgram: playProgram,
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

    musicBus = context.createGain();
    musicBus.gain.value = 0.2;
    musicBus.connect(master);

    sfxBus = context.createGain();
    sfxBus.gain.value = SFX_VOLUME;
    sfxBus.connect(master);

    delay = context.createDelay(1.2);
    delay.delayTime.value = 0.34;
    delayFeedback = context.createGain();
    delayFeedback.gain.value = 0.28;
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(musicBus);
  }

  async function resumeContext() {
    if (context?.state === 'suspended') await context.resume();
  }

  function ensureMusicPlaying() {
    if (!enabled || !context) return;
    if (droneNodes.length === 0) startMusic();
    if (!musicTimer) musicTimer = globalThis.setInterval(scheduleMusicPulse, 1850);
  }

  function startMusic() {
    if (!context || droneNodes.length > 0) return;

    const now = context.currentTime;
    droneNodes = [55, 82.41, 110].flatMap((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const filter = context.createBiquadFilter();
      const lfo = context.createOscillator();
      const lfoGain = context.createGain();

      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      filter.type = 'lowpass';
      filter.frequency.value = 420 + index * 120;
      filter.Q.value = 4;
      gain.gain.value = MIN_AUDIO_VALUE;
      rampLinear(gain.gain, index === 0 ? 0.1 : 0.045, now + 2.2);
      lfo.frequency.value = 0.035 + index * 0.017;
      lfoGain.gain.value = 120 + index * 45;

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      oscillator.connect(filter);
      filter.connect(gain);
      gain.connect(musicBus);
      oscillator.start(now);
      lfo.start(now);

      return [oscillator, gain, filter, lfo, lfoGain];
    });

    if (!musicTimer) musicTimer = globalThis.setInterval(scheduleMusicPulse, 1850);
    scheduleMusicPulse();
  }

  function stopMusic() {
    if (!context) return;
    const now = context.currentTime;
    droneNodes.forEach((node) => {
      if (node.gain) rampExponential(node.gain, MIN_AUDIO_VALUE, now + 0.45);
      if (node.stop) globalThis.setTimeout(() => stopNode(node), 520);
    });
    droneNodes = [];
    if (musicTimer) globalThis.clearInterval(musicTimer);
    musicTimer = null;
  }

  function scheduleMusicPulse() {
    if (!context || !enabled) return;
    const now = context.currentTime;
    const frequency = MUSIC_SCALE[(step * 2 + Math.floor(step / 3)) % MUSIC_SCALE.length] * (step % 5 === 0 ? 2 : 1);
    step += 1;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    rampExponential(oscillator.frequency, frequency * 0.995, now + 1.4);
    filter.type = 'bandpass';
    filter.frequency.value = 680 + (step % 4) * 140;
    filter.Q.value = 7;
    gain.gain.setValueAtTime(MIN_AUDIO_VALUE, now);
    rampExponential(gain.gain, 0.055, now + 0.08);
    rampExponential(gain.gain, MIN_AUDIO_VALUE, now + 1.45);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(delay);
    oscillator.start(now);
    oscillator.stop(now + 1.55);
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

  function playNoise({ duration = 0.18, volume = 0.16, filterFrequency = 1200, filterType = 'highpass' } = {}) {
    if (!context || !sfxBus) return;
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
    gain.connect(sfxBus);
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

function rampLinear(audioParam, value, time) {
  if (typeof audioParam.linearRampToValueAtTime === 'function') {
    audioParam.linearRampToValueAtTime(Math.max(MIN_AUDIO_VALUE, value), time);
    return;
  }

  audioParam.value = Math.max(MIN_AUDIO_VALUE, value);
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

function stopNode(node) {
  try {
    node.stop();
  } catch (error) {
    if (error.name !== 'InvalidStateError') throw error;
  }
}

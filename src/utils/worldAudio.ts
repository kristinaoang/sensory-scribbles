import type { WildAnimalSpecies } from '../types';

export type AmbientAudioTrack = 'lofi_hearth' | 'lofi_rain' | 'lofi_stargaze' | 'nature';

export interface AmbientTrackOption {
  id: AmbientAudioTrack;
  label: string;
  subtitle: string;
}

export const AMBIENT_AUDIO_TRACKS: AmbientTrackOption[] = [
  {
    id: 'lofi_hearth',
    label: 'Campfire Lo-Fi',
    subtitle: 'Warm Rhodes chords, vinyl dust & soft hearth breeze',
  },
  {
    id: 'lofi_rain',
    label: 'Rainy Meadow Lo-Fi',
    subtitle: 'Mellow 9th chords, gentle rain trickle & brushed beat',
  },
  {
    id: 'lofi_stargaze',
    label: 'Stargaze Lo-Fi',
    subtitle: 'Slow midnight pads, twilight chimes & cozy tape warmth',
  },
  {
    id: 'nature',
    label: 'Nature Ambience',
    subtitle: 'Stage-adaptive wind, flowing creek & woodland birdsong',
  },
];

export function getSoundscapeLabel(
  level: number,
  muted: boolean,
  track: AmbientAudioTrack = 'lofi_hearth',
): string {
  if (muted) return 'Audio Off';
  if (track === 'lofi_hearth') return 'Campfire Lo-Fi';
  if (track === 'lofi_rain') return 'Rainy Lo-Fi';
  if (track === 'lofi_stargaze') return 'Stargaze Lo-Fi';
  if (level <= 1) return 'Wind & Chirps';
  if (level === 2) return 'Meadow Breeze';
  if (level === 3) return 'Creek & Wind';
  return 'Birdsong';
}

interface ChordProgression {
  bpm: number;
  chords: number[][];
  melodyNotes: number[];
  swingMs: number;
}

const TRACK_PROGRESSIONS: Record<Exclude<AmbientAudioTrack, 'nature'>, ChordProgression> = {
  // Campfire Lo-Fi: Fmaj7 -> Em7 -> Dm9 -> Cmaj9 (warm sunny 72 BPM)
  lofi_hearth: {
    bpm: 72,
    swingMs: 18,
    chords: [
      [174.61, 220.0, 261.63, 329.63],
      [164.81, 196.0, 246.94, 293.66],
      [146.83, 174.61, 220.0, 261.63, 329.63],
      [130.81, 196.0, 246.94, 293.66, 329.63],
    ],
    melodyNotes: [523.25, 659.25, 587.33, 440.0, 493.88, 659.25, 783.99, 523.25],
  },
  // Rainy Meadow Lo-Fi: Am9 -> Fmaj7 -> Dm9 -> Em7 (nostalgic 66 BPM)
  lofi_rain: {
    bpm: 66,
    swingMs: 22,
    chords: [
      [220.0, 261.63, 329.63, 392.0, 493.88],
      [174.61, 220.0, 261.63, 329.63],
      [146.83, 174.61, 220.0, 261.63, 329.63],
      [164.81, 196.0, 246.94, 293.66],
    ],
    melodyNotes: [659.25, 587.33, 523.25, 493.88, 440.0, 523.25, 659.25, 783.99],
  },
  // Stargaze Lo-Fi: Cmaj9 -> G6 -> Am9 -> Fmaj7#11 (dreamy 60 BPM)
  lofi_stargaze: {
    bpm: 60,
    swingMs: 14,
    chords: [
      [130.81, 196.0, 246.94, 293.66, 329.63],
      [196.0, 246.94, 293.66, 329.63],
      [220.0, 261.63, 329.63, 392.0, 493.88],
      [174.61, 220.0, 246.94, 329.63],
    ],
    melodyNotes: [783.99, 659.25, 587.33, 493.88, 659.25, 880.0, 783.99, 523.25],
  },
};

/**
 * 100% procedural Web Audio API soundscape, Lo-Fi music synthesizer, and animal voices.
 * Blends warm analog-filtered Rhodes chords, subtle brushed lo-fi drums, vinyl dust,
 * stage-adaptive nature layers, bird chirps, and species-specific animal noises.
 */
export class WorldAmbientAudio {
  private ctx: AudioContext | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private masterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private creekGain: GainNode | null = null;
  private birdsGain: GainNode | null = null;
  private animalFxGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private vinylGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private level = 1;
  private activeSpecies: WildAnimalSpecies[] = [];
  private track: AmbientAudioTrack = 'lofi_hearth';
  private muted = false;
  private started = false;
  private disposed = false;
  private birdTimer: number | null = null;
  private animalTimer: number | null = null;
  private lofiTimer: number | null = null;
  private crackleTimer: number | null = null;
  private stepIndex = 0;
  private lastStepPlayedAt = 0;
  private onStateChange?: (running: boolean) => void;

  constructor(onStateChange?: (running: boolean) => void) {
    this.onStateChange = onStateChange;
  }

  private ensureContext(): AudioContext | null {
    if (this.disposed || typeof window === 'undefined') return null;
    if (this.ctx) return this.ctx;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    ctx.onstatechange = () => {
      if (this.disposed) return;
      this.onStateChange?.(ctx.state === 'running');
      if (ctx.state === 'running' && !this.muted) {
        this.applyStageMix();
        if (this.track !== 'nature' && performance.now() - this.lastStepPlayedAt > 250) {
          this.triggerLofiStep();
        }
      }
    };

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 18;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.22;
    this.compressor = compressor;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.62;
    master.connect(compressor);
    compressor.connect(ctx.destination);
    this.masterGain = master;

    // Generate 3 seconds of warm pink-ish noise buffer
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 3;
    const noiseBuffer = ctx.createBuffer(1, length, sampleRate);
    const data = noiseBuffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      const pink = b0 + b1 + b2 + white * 0.1848;
      b3 = b3 * 0.985 + pink * 0.015;
      data[i] = Math.max(-1, Math.min(1, pink * 0.055 + b3 * 0.14));
    }
    this.noiseBuffer = noiseBuffer;

    // Layer 1: Island Wind
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noiseBuffer;
    windSrc.loop = true;

    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 340;
    windFilter.Q.value = 1.15;
    this.windFilter = windFilter;

    const gustLfo = ctx.createOscillator();
    gustLfo.type = 'sine';
    gustLfo.frequency.value = 0.11;
    const gustDepth = ctx.createGain();
    gustDepth.gain.value = 135;
    gustLfo.connect(gustDepth);
    gustDepth.connect(windFilter.frequency);

    const windGain = ctx.createGain();
    windGain.gain.value = 0.12;
    this.windGain = windGain;

    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    windSrc.start();
    gustLfo.start();

    // Layer 2: Gentle Creek Water / Rain Bed
    const creekSrc = ctx.createBufferSource();
    creekSrc.buffer = noiseBuffer;
    creekSrc.loop = true;

    const creekFilter = ctx.createBiquadFilter();
    creekFilter.type = 'bandpass';
    creekFilter.frequency.value = 1120;
    creekFilter.Q.value = 2.0;

    const creekLfo = ctx.createOscillator();
    creekLfo.type = 'sine';
    creekLfo.frequency.value = 0.34;
    const creekDepth = ctx.createGain();
    creekDepth.gain.value = 210;
    creekLfo.connect(creekDepth);
    creekDepth.connect(creekFilter.frequency);

    const creekGain = ctx.createGain();
    creekGain.gain.value = 0;
    this.creekGain = creekGain;

    creekSrc.connect(creekFilter);
    creekFilter.connect(creekGain);
    creekGain.connect(master);
    creekSrc.start();
    creekLfo.start();

    // Layer 3: Woodland Birdsong Bus
    const birdsGain = ctx.createGain();
    birdsGain.gain.value = 0.32;
    birdsGain.connect(master);
    this.birdsGain = birdsGain;

    // Layer 3b: Animal Voices Bus
    const animalFxGain = ctx.createGain();
    animalFxGain.gain.value = 0.72;
    animalFxGain.connect(master);
    this.animalFxGain = animalFxGain;

    // Layer 4: Warm Lo-Fi Music Bus (low-pass tape tone filter)
    const musicFilter = ctx.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = 1850;
    musicFilter.Q.value = 0.65;
    this.musicFilter = musicFilter;

    const musicBus = ctx.createGain();
    musicBus.gain.value = this.track === 'nature' ? 0 : 0.96;
    this.musicBus = musicBus;

    musicFilter.connect(musicBus);
    musicBus.connect(master);

    // Layer 5: Subtle Vinyl Dust / Tape Hiss Bed
    const vinylSrc = ctx.createBufferSource();
    vinylSrc.buffer = noiseBuffer;
    vinylSrc.loop = true;
    const vinylFilter = ctx.createBiquadFilter();
    vinylFilter.type = 'bandpass';
    vinylFilter.frequency.value = 2600;
    vinylFilter.Q.value = 1.4;
    const vinylGain = ctx.createGain();
    vinylGain.gain.value = this.track === 'nature' ? 0 : 0.028;
    this.vinylGain = vinylGain;
    vinylSrc.connect(vinylFilter);
    vinylFilter.connect(vinylGain);
    vinylGain.connect(master);
    vinylSrc.start();

    this.started = true;
    this.applyStageMix();
    this.scheduleNextBird();
    this.scheduleNextAnimalCall();
    this.restartLofiLoop();
    this.scheduleVinylCrackle();

    this.onStateChange?.(ctx.state === 'running');
    return ctx;
  }

  public isRunning(): boolean {
    return Boolean(this.ctx && this.ctx.state === 'running');
  }

  public unlock() {
    if (this.disposed) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => {
          if (this.disposed) return;
          this.onStateChange?.(ctx.state === 'running');
          if (!this.muted) {
            this.applyStageMix();
            if (this.track !== 'nature' && performance.now() - this.lastStepPlayedAt > 250) {
              this.triggerLofiStep();
            }
          }
        })
        .catch(() => {
          // Ignore browser restriction until next gesture
        });
    } else if (ctx.state === 'running') {
      this.onStateChange?.(true);
      if (!this.muted && this.track !== 'nature' && this.lofiTimer === null) {
        this.restartLofiLoop();
      }
    }
  }

  public setLevel(nextLevel: number) {
    this.level = Math.max(1, nextLevel);
    if (this.started) {
      this.applyStageMix();
    }
  }

  public setActiveSpecies(speciesList: WildAnimalSpecies[]) {
    this.activeSpecies = [...new Set(speciesList)];
    if (this.started) {
      this.applyStageMix();
    }
  }

  public setTrack(nextTrack: AmbientAudioTrack) {
    if (this.track === nextTrack) return;
    this.track = nextTrack;
    this.stepIndex = 0;
    if (this.started) {
      this.applyStageMix();
      this.restartLofiLoop();
    }
  }

  public getTrack(): AmbientAudioTrack {
    return this.track;
  }

  public setMuted(nextMuted: boolean) {
    this.muted = nextMuted;
    if (!nextMuted) {
      this.unlock();
    }
    if (this.ctx && this.masterGain) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setTargetAtTime(nextMuted ? 0 : 0.62, now, 0.12);
    }
  }

  private applyStageMix() {
    if (
      !this.ctx ||
      !this.windGain ||
      !this.windFilter ||
      !this.creekGain ||
      !this.birdsGain ||
      !this.musicBus ||
      !this.musicFilter ||
      !this.vinylGain
    ) {
      return;
    }
    const now = this.ctx.currentTime;
    const lvl = this.level;
    const isLofi = this.track !== 'nature';
    const hasBird = this.activeSpecies.includes('bird');

    // Keep nature subtle under lo-fi music so Rhodes & melody stay front and cozy
    const baseWind = lvl === 1 ? 0.22 : lvl === 2 ? 0.19 : lvl === 3 ? 0.15 : 0.12;
    const windLevel = isLofi ? baseWind * 0.35 : baseWind;
    const windFreq = lvl === 1 ? 310 : lvl === 2 ? 430 : 510;

    const rainOverride = this.track === 'lofi_rain' ? 0.14 : 0;
    const baseCreek = lvl >= 3 ? (lvl === 3 ? 0.18 : 0.15) : 0;
    const creekLevel = Math.max(rainOverride, isLofi ? baseCreek * 0.45 : baseCreek);

    // Birds chirp from Stage 1 gently, and noticeably whenever a bird companion is present or Stage 3+
    const baseBirds = hasBird ? 0.56 : lvl >= 4 ? 0.58 : lvl >= 2 ? 0.38 : 0.26;
    const birdsLevel = isLofi ? baseBirds * 0.68 : baseBirds;

    this.windGain.gain.setTargetAtTime(windLevel, now, 0.45);
    this.windFilter.frequency.setTargetAtTime(windFreq, now, 0.45);
    this.creekGain.gain.setTargetAtTime(creekLevel, now, 0.5);
    this.birdsGain.gain.setTargetAtTime(birdsLevel, now, 0.4);

    const targetMusicGain = !isLofi
      ? 0
      : this.track === 'lofi_stargaze'
        ? 0.88
        : this.track === 'lofi_rain'
          ? 0.92
          : 0.96;
    const targetMusicCutoff =
      this.track === 'lofi_stargaze' ? 1420 : this.track === 'lofi_rain' ? 1580 : 1880;

    this.musicBus.gain.setTargetAtTime(targetMusicGain, now, 0.24);
    this.musicFilter.frequency.setTargetAtTime(targetMusicCutoff, now, 0.3);
    this.vinylGain.gain.setTargetAtTime(isLofi ? 0.028 : 0, now, 0.3);
  }

  private restartLofiLoop() {
    if (this.lofiTimer !== null) {
      clearInterval(this.lofiTimer);
      this.lofiTimer = null;
    }
    if (this.disposed || this.track === 'nature') return;
    const prog = TRACK_PROGRESSIONS[this.track];
    const eighthNoteMs = Math.round((60 / prog.bpm / 2) * 1000);

    // Play opening chord shortly after starting/switching
    if (!this.muted && this.ctx && this.ctx.state === 'running') {
      this.triggerLofiStep();
    }

    this.lofiTimer = window.setInterval(() => {
      if (this.disposed || this.muted || this.track === 'nature') return;
      if (!this.ctx || this.ctx.state !== 'running') return;
      this.triggerLofiStep();
    }, eighthNoteMs);
  }

  private triggerLofiStep() {
    if (!this.ctx || !this.musicFilter || this.track === 'nature') return;
    this.lastStepPlayedAt = performance.now();
    const ctx = this.ctx;
    const prog = TRACK_PROGRESSIONS[this.track];
    const barStep = this.stepIndex % 8; // 8 eighth-notes per bar
    const chordIdx = Math.floor(this.stepIndex / 8) % prog.chords.length;
    const isOffbeat = barStep % 2 === 1;
    const swingSec = isOffbeat ? prog.swingMs / 1000 : 0;
    const t = ctx.currentTime + 0.02 + swingSec;

    // 1. Warm Rhodes / Pad chord on beat 1 (and soft bass pick-up on beat 3.5)
    if (barStep === 0) {
      const chord = prog.chords[chordIdx];
      this.playRhodesChord(chord, t, this.track === 'lofi_stargaze' ? 3.5 : 3.0);
      this.playWarmBass(chord[0] * 0.5, t, 1.55);
    } else if (barStep === 5 && this.track !== 'lofi_stargaze') {
      const chord = prog.chords[chordIdx];
      this.playWarmBass(chord[0] * 0.5, t, 0.8);
    }

    // 2. Gentle Lo-Fi Beat (muffled kick + soft brushed rim snare + faint hat)
    if (this.track !== 'lofi_stargaze') {
      if (barStep === 0 || barStep === 3 || (barStep === 5 && chordIdx % 2 === 1)) {
        this.playSoftKick(t, 0.22);
      }
      if (barStep === 2 || barStep === 6) {
        this.playBrushedRim(t);
      }
      if (barStep % 2 === 1 || barStep === 4) {
        this.playSoftHat(t, isOffbeat ? 0.032 : 0.044);
      }
    } else if (barStep === 0 || barStep === 4) {
      this.playSoftKick(t, 0.14);
    }

    // 3. Sparse Pentatonic / Bell Melody Phrase
    if (
      (barStep === 1 && (chordIdx === 0 || chordIdx === 2)) ||
      (barStep === 4 && chordIdx % 2 === 0) ||
      (barStep === 7 && chordIdx === 1)
    ) {
      const noteIdx = (chordIdx * 2 + barStep) % prog.melodyNotes.length;
      const freq = prog.melodyNotes[noteIdx];
      this.playPluckBell(freq, t, this.track === 'lofi_stargaze' ? 1.45 : 0.95);
    }

    this.stepIndex = (this.stepIndex + 1) % (prog.chords.length * 8);
  }

  private playRhodesChord(freqs: number[], startTime: number, duration: number) {
    if (!this.ctx || !this.musicFilter) return;
    const ctx = this.ctx;
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gain = ctx.createGain();
      const strum = idx * 0.022;
      const t0 = startTime + strum;

      const wobble = (Math.random() - 0.5) * 4.5;
      osc.type = this.track === 'lofi_stargaze' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      osc.detune.setValueAtTime(wobble, t0);

      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(freq * 2, t0);
      overtone.detune.setValueAtTime(wobble + 2, t0);

      const overtoneGain = ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.18, t0);

      const peak = (this.track === 'lofi_stargaze' ? 0.12 : 0.145) / Math.sqrt(freqs.length);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + 0.045);
      gain.gain.exponentialRampToValueAtTime(peak * 0.55, t0 + duration * 0.45);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

      osc.connect(gain);
      overtone.connect(overtoneGain);
      overtoneGain.connect(gain);
      gain.connect(this.musicFilter!);

      osc.start(t0);
      overtone.start(t0);
      osc.stop(t0 + duration + 0.05);
      overtone.stop(t0 + duration + 0.05);
    });
  }

  private playWarmBass(freq: number, startTime: number, duration: number) {
    if (!this.ctx || !this.musicFilter) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(0.22, startTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.musicFilter);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.04);
  }

  private playPluckBell(freq: number, startTime: number, duration: number) {
    if (!this.ctx || !this.musicFilter) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    osc.detune.setValueAtTime((Math.random() - 0.5) * 6, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(0.095, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.musicFilter);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.04);
  }

  private playSoftKick(startTime: number, volume = 0.22) {
    if (!this.ctx || !this.musicFilter) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(112, startTime);
    osc.frequency.exponentialRampToValueAtTime(46, startTime + 0.11);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.21);

    osc.connect(gain);
    gain.connect(this.musicFilter);
    osc.start(startTime);
    osc.stop(startTime + 0.23);
  }

  private playBrushedRim(startTime: number) {
    if (!this.ctx || !this.musicFilter || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1420, startTime);
    filter.Q.setValueAtTime(1.8, startTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(0.11, startTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.09);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicFilter);
    src.start(startTime, Math.random() * 1.5, 0.1);
  }

  private playSoftHat(startTime: number, volume = 0.04) {
    if (!this.ctx || !this.musicFilter || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(4200, startTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.045);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicFilter);
    src.start(startTime, Math.random() * 2.0, 0.055);
  }

  private scheduleVinylCrackle() {
    if (this.disposed) return;
    const delayMs = 360 + Math.random() * 980;
    this.crackleTimer = window.setTimeout(() => {
      if (this.disposed) return;
      if (
        !this.muted &&
        this.track !== 'nature' &&
        this.ctx &&
        this.ctx.state === 'running' &&
        this.vinylGain &&
        this.noiseBuffer
      ) {
        const ctx = this.ctx;
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'highpass';
        bp.frequency.value = 3400;
        const g = ctx.createGain();
        const t = ctx.currentTime;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.035, t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.018);
        src.connect(bp);
        bp.connect(g);
        g.connect(this.vinylGain);
        src.start(t, Math.random() * 2.5, 0.025);
      }
      this.scheduleVinylCrackle();
    }, delayMs);
  }

  private scheduleNextBird() {
    if (this.disposed) return;
    const hasBird = this.activeSpecies.includes('bird');
    const baseDelay = hasBird ? 2800 : 5200;
    const delayMs = baseDelay + Math.random() * 3800;
    this.birdTimer = window.setTimeout(() => {
      if (this.disposed) return;
      if (!this.muted && this.ctx && this.ctx.state === 'running' && this.birdsGain) {
        this.playBirdChirpOnBus(this.birdsGain, hasBird ? 0.16 : 0.1);
      }
      this.scheduleNextBird();
    }, delayMs);
  }

  private scheduleNextAnimalCall() {
    if (this.disposed) return;
    const delayMs = 6800 + Math.random() * 6400;
    this.animalTimer = window.setTimeout(() => {
      if (this.disposed) return;
      const nonBird = this.activeSpecies.filter((s) => s !== 'bird');
      if (
        !this.muted &&
        nonBird.length > 0 &&
        this.ctx &&
        this.ctx.state === 'running' &&
        this.animalFxGain
      ) {
        const chosen = nonBird[Math.floor(Math.random() * nonBird.length)];
        this.synthesizeSpeciesNoise(chosen, 'ambient', this.animalFxGain, 0.36);
      }
      this.scheduleNextAnimalCall();
    }, delayMs);
  }

  private playBirdChirpOnBus(dest: AudioNode, volume = 0.18) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const baseTime = ctx.currentTime + 0.015;
    const pattern = Math.random();
    const notes =
      pattern < 0.35
        ? [1980, 2480, 2240]
        : pattern < 0.7
          ? [2180, 2860, 2520]
          : [1760, 2217, 2637, 2349];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const vib = ctx.createOscillator();
      const vibGain = ctx.createGain();
      const env = ctx.createGain();
      const start = baseTime + i * (0.095 + Math.random() * 0.04);
      const dur = 0.085 + Math.random() * 0.045;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 0.86, start);
      osc.frequency.exponentialRampToValueAtTime(freq * (1.12 + Math.random() * 0.08), start + dur * 0.55);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.94, start + dur);

      vib.type = 'sine';
      vib.frequency.setValueAtTime(34, start);
      vibGain.gain.setValueAtTime(45, start);
      vib.connect(vibGain);
      vibGain.connect(osc.frequency);

      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(volume, start + 0.016);
      env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      osc.connect(env);
      env.connect(dest);
      osc.start(start);
      vib.start(start);
      osc.stop(start + dur + 0.02);
      vib.stop(start + dur + 0.02);
    });
  }

  private synthesizeSpeciesNoise(
    species: WildAnimalSpecies,
    mood: 'greet' | 'happy' | 'ambient',
    dest: AudioNode,
    scale = 1,
  ) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.015;

    if (species === 'bird') {
      const vol = mood === 'happy' ? 0.24 * scale : 0.19 * scale;
      this.playBirdChirpOnBus(dest, vol);
      if (mood === 'happy') {
        window.setTimeout(() => {
          if (!this.disposed && !this.muted && this.ctx && this.ctx.state === 'running' && this.animalFxGain) {
            this.playBirdChirpOnBus(this.animalFxGain, 0.18 * scale);
          }
        }, 280);
      }
      return;
    }

    if (species === 'cat') {
      // Soft musical "meow" glide through a warm formant bandpass filter
      const syllables = mood === 'happy' ? 2 : 1;
      for (let s = 0; s < syllables; s++) {
        const t0 = now + s * 0.28;
        const dur = s === 0 ? 0.34 : 0.24;
        const osc = ctx.createOscillator();
        const sub = ctx.createOscillator();
        const formant = ctx.createBiquadFilter();
        const env = ctx.createGain();

        osc.type = 'sawtooth';
        sub.type = 'triangle';
        const baseF = s === 0 ? 490 : 560;
        osc.frequency.setValueAtTime(baseF * 0.85, t0);
        osc.frequency.exponentialRampToValueAtTime(baseF * 1.38, t0 + dur * 0.36);
        osc.frequency.exponentialRampToValueAtTime(baseF * 0.78, t0 + dur);

        sub.frequency.setValueAtTime(baseF * 0.85, t0);
        sub.frequency.exponentialRampToValueAtTime(baseF * 1.38, t0 + dur * 0.36);
        sub.frequency.exponentialRampToValueAtTime(baseF * 0.78, t0 + dur);

        formant.type = 'bandpass';
        formant.frequency.setValueAtTime(980, t0);
        formant.frequency.linearRampToValueAtTime(1420, t0 + dur * 0.38);
        formant.frequency.linearRampToValueAtTime(840, t0 + dur);
        formant.Q.value = 2.6;

        env.gain.setValueAtTime(0.0001, t0);
        env.gain.linearRampToValueAtTime(0.16 * scale, t0 + 0.045);
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        osc.connect(formant);
        sub.connect(formant);
        formant.connect(env);
        env.connect(dest);

        osc.start(t0);
        sub.start(t0);
        osc.stop(t0 + dur + 0.02);
        sub.stop(t0 + dur + 0.02);
      }
      return;
    }

    if (species === 'dog') {
      // Friendly double "arf! woof!"
      const barks = mood === 'ambient' ? 1 : 2;
      for (let b = 0; b < barks; b++) {
        const t0 = now + b * 0.2;
        const dur = 0.14;
        const osc = ctx.createOscillator();
        const body = ctx.createOscillator();
        const lp = ctx.createBiquadFilter();
        const env = ctx.createGain();

        const startF = b === 0 ? 310 : 350;
        const endF = b === 0 ? 145 : 165;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(startF, t0);
        osc.frequency.exponentialRampToValueAtTime(endF, t0 + dur);

        body.type = 'triangle';
        body.frequency.setValueAtTime(startF * 0.5, t0);
        body.frequency.exponentialRampToValueAtTime(endF * 0.5, t0 + dur);

        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(1150, t0);
        lp.frequency.exponentialRampToValueAtTime(420, t0 + dur);
        lp.Q.value = 2.2;

        env.gain.setValueAtTime(0.0001, t0);
        env.gain.linearRampToValueAtTime(0.22 * scale, t0 + 0.014);
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        osc.connect(lp);
        body.connect(lp);
        lp.connect(env);
        env.connect(dest);

        osc.start(t0);
        body.start(t0);
        osc.stop(t0 + dur + 0.02);
        body.stop(t0 + dur + 0.02);
      }
      return;
    }

    if (species === 'squirrel') {
      // Quick chattering "chit-chit-chit-squeak!"
      const bursts = mood === 'happy' ? 5 : 4;
      for (let i = 0; i < bursts; i++) {
        const t0 = now + i * 0.072;
        const dur = 0.052;
        const osc = ctx.createOscillator();
        const env = ctx.createGain();
        const base = i === bursts - 1 ? 2350 : 1680 + (i % 2) * 320;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(base, t0);
        osc.frequency.exponentialRampToValueAtTime(base * 0.62, t0 + dur);

        env.gain.setValueAtTime(0.0001, t0);
        env.gain.linearRampToValueAtTime(0.14 * scale, t0 + 0.008);
        env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        osc.connect(env);
        env.connect(dest);
        osc.start(t0);
        osc.stop(t0 + dur + 0.015);
      }
      return;
    }

    // Raccoon: curious soft warbling "churr-trill"
    const t0 = now;
    const dur = mood === 'happy' ? 0.38 : 0.28;
    const osc = ctx.createOscillator();
    const flutter = ctx.createOscillator();
    const flutterGain = ctx.createGain();
    const bp = ctx.createBiquadFilter();
    const env = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(360, t0);
    osc.frequency.linearRampToValueAtTime(560, t0 + dur * 0.45);
    osc.frequency.linearRampToValueAtTime(420, t0 + dur);

    flutter.type = 'sine';
    flutter.frequency.setValueAtTime(28, t0);
    flutterGain.gain.setValueAtTime(58, t0);
    flutter.connect(flutterGain);
    flutterGain.connect(osc.frequency);

    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(760, t0);
    bp.Q.value = 1.6;

    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(0.18 * scale, t0 + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(bp);
    bp.connect(env);
    env.connect(dest);
    osc.start(t0);
    flutter.start(t0);
    osc.stop(t0 + dur + 0.02);
    flutter.stop(t0 + dur + 0.02);
  }

  public playAnimalSound(species: WildAnimalSpecies, mood: 'greet' | 'happy' = 'greet') {
    if (this.muted || this.disposed) return;
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const playNow = () => {
        if (this.disposed || this.muted || !this.animalFxGain) return;
        this.synthesizeSpeciesNoise(species, mood, this.animalFxGain, 1);
      };
      if (ctx.state === 'suspended') {
        ctx.resume().then(playNow).catch(() => {});
      } else {
        playNow();
      }
    } catch {
      // Ignore browser audio errors
    }
  }

  public playExpansionChime() {
    if (this.muted || this.disposed) return;
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const dest = this.masterGain || ctx.destination;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const t = ctx.currentTime + idx * 0.085;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.09, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
        osc.connect(gain);
        gain.connect(dest);
        osc.start(t);
        osc.stop(t + 0.38);
      });
    } catch {
      // Ignore browser audio errors
    }
  }

  public playPetSound(tool: string, species?: WildAnimalSpecies) {
    if (this.muted || this.disposed) return;
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      const dest = this.masterGain || ctx.destination;
      const playChime = () => {
        if (this.disposed || this.muted) return;
        const now = ctx.currentTime;
        if (tool === 'boop') {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, now);
          osc.frequency.exponentialRampToValueAtTime(880, now + 0.11);
          gain.gain.setValueAtTime(0.11, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
          osc.connect(gain);
          gain.connect(dest);
          osc.start(now);
          osc.stop(now + 0.18);
        } else {
          const notes =
            tool === 'treat'
              ? [587.33, 739.99, 880, 1174.66]
              : tool === 'scritch'
                ? [523.25, 659.25, 783.99]
                : tool === 'brush'
                  ? [392.0, 493.88, 587.33]
                  : [440.0, 554.37];

          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = tool === 'brush' ? 'sine' : 'triangle';
            const t = now + idx * 0.06;
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.075, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
            osc.connect(gain);
            gain.connect(dest);
            osc.start(t);
            osc.stop(t + 0.24);
          });
        }

        if (species && this.animalFxGain) {
          window.setTimeout(() => {
            if (!this.disposed && !this.muted && this.animalFxGain) {
              this.synthesizeSpeciesNoise(species, 'happy', this.animalFxGain, 0.95);
            }
          }, 120);
        }
      };

      if (ctx.state === 'suspended') {
        ctx.resume().then(playChime).catch(() => {});
      } else {
        playChime();
      }
    } catch {
      // Ignore browser audio errors
    }
  }

  public dispose() {
    this.disposed = true;
    if (this.birdTimer !== null) {
      clearTimeout(this.birdTimer);
      this.birdTimer = null;
    }
    if (this.animalTimer !== null) {
      clearTimeout(this.animalTimer);
      this.animalTimer = null;
    }
    if (this.lofiTimer !== null) {
      clearInterval(this.lofiTimer);
      this.lofiTimer = null;
    }
    if (this.crackleTimer !== null) {
      clearTimeout(this.crackleTimer);
      this.crackleTimer = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

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
  if (level <= 1) return 'Wind';
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
 * 100% procedural Web Audio API soundscape & ambient Lo-Fi music synthesizer.
 * Blends warm analog-filtered Rhodes chords, subtle brushed lo-fi drums, vinyl dust,
 * and stage-adaptive nature layers (wind, creek, birdsong).
 */
export class WorldAmbientAudio {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private creekGain: GainNode | null = null;
  private birdsGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private musicFilter: BiquadFilterNode | null = null;
  private vinylGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private level = 1;
  private track: AmbientAudioTrack = 'lofi_hearth';
  private muted = false;
  private started = false;
  private disposed = false;
  private birdTimer: number | null = null;
  private lofiTimer: number | null = null;
  private crackleTimer: number | null = null;
  private stepIndex = 0;

  private ensureContext(): AudioContext | null {
    if (this.disposed || typeof window === 'undefined') return null;
    if (this.ctx) return this.ctx;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.36;
    master.connect(ctx.destination);
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
    windGain.gain.value = 0.28;
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
    birdsGain.gain.value = 0;
    birdsGain.connect(master);
    this.birdsGain = birdsGain;

    // Layer 4: Warm Lo-Fi Music Bus (low-pass tape tone filter)
    const musicFilter = ctx.createBiquadFilter();
    musicFilter.type = 'lowpass';
    musicFilter.frequency.value = 1480;
    musicFilter.Q.value = 0.65;
    this.musicFilter = musicFilter;

    const musicBus = ctx.createGain();
    musicBus.gain.value = this.track === 'nature' ? 0 : 0.72;
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
    vinylGain.gain.value = this.track === 'nature' ? 0 : 0.032;
    this.vinylGain = vinylGain;
    vinylSrc.connect(vinylFilter);
    vinylFilter.connect(vinylGain);
    vinylGain.connect(master);
    vinylSrc.start();

    this.started = true;
    this.applyStageMix();
    this.scheduleNextBird();
    this.restartLofiLoop();
    this.scheduleVinylCrackle();

    return ctx;
  }

  public unlock() {
    if (this.disposed) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {
        // Ignore browser restriction until next gesture
      });
    }
  }

  public setLevel(nextLevel: number) {
    this.level = Math.max(1, nextLevel);
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
      this.masterGain.gain.setTargetAtTime(nextMuted ? 0 : 0.36, now, 0.15);
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

    // Blend nature underneath lo-fi music so both island stage & lo-fi feel cozy
    const baseWind = lvl === 1 ? 0.42 : lvl === 2 ? 0.32 : lvl === 3 ? 0.22 : 0.16;
    const windLevel = isLofi ? baseWind * 0.42 : baseWind;
    const windFreq = lvl === 1 ? 310 : lvl === 2 ? 430 : 510;

    const rainOverride = this.track === 'lofi_rain' ? 0.18 : 0;
    const baseCreek = lvl >= 3 ? (lvl === 3 ? 0.22 : 0.18) : 0;
    const creekLevel = Math.max(rainOverride, isLofi ? baseCreek * 0.5 : baseCreek);

    const baseBirds = lvl >= 4 ? (lvl === 4 ? 0.48 : 0.62) : 0;
    const birdsLevel = isLofi ? baseBirds * 0.55 : baseBirds;

    this.windGain.gain.setTargetAtTime(windLevel, now, 0.45);
    this.windFilter.frequency.setTargetAtTime(windFreq, now, 0.45);
    this.creekGain.gain.setTargetAtTime(creekLevel, now, 0.5);
    this.birdsGain.gain.setTargetAtTime(birdsLevel, now, 0.5);

    const targetMusicGain = !isLofi
      ? 0
      : this.track === 'lofi_stargaze'
        ? 0.68
        : this.track === 'lofi_rain'
          ? 0.72
          : 0.76;
    const targetMusicCutoff =
      this.track === 'lofi_stargaze' ? 1180 : this.track === 'lofi_rain' ? 1320 : 1580;

    this.musicBus.gain.setTargetAtTime(targetMusicGain, now, 0.28);
    this.musicFilter.frequency.setTargetAtTime(targetMusicCutoff, now, 0.35);
    this.vinylGain.gain.setTargetAtTime(isLofi ? 0.032 : 0, now, 0.3);
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
    const ctx = this.ctx;
    const prog = TRACK_PROGRESSIONS[this.track];
    const barStep = this.stepIndex % 8; // 8 eighth-notes per bar
    const chordIdx = Math.floor(this.stepIndex / 8) % prog.chords.length;
    const isOffbeat = barStep % 2 === 1;
    const swingSec = isOffbeat ? prog.swingMs / 1000 : 0;
    const t = ctx.currentTime + 0.02 + swingSec;

    // 1. Warm Rhodes / Pad chord on beat 1 (and soft re-voicing on beat 3.5)
    if (barStep === 0) {
      const chord = prog.chords[chordIdx];
      this.playRhodesChord(chord, t, this.track === 'lofi_stargaze' ? 3.4 : 2.9);
      this.playWarmBass(chord[0] * 0.5, t, 1.5);
    } else if (barStep === 5 && this.track !== 'lofi_stargaze') {
      const chord = prog.chords[chordIdx];
      this.playWarmBass(chord[0] * 0.5, t, 0.75);
    }

    // 2. Gentle Lo-Fi Beat (subtle muffled kick + soft brushed rim snare + faint hat)
    if (this.track !== 'lofi_stargaze') {
      if (barStep === 0 || barStep === 3 || (barStep === 5 && chordIdx % 2 === 1)) {
        this.playSoftKick(t);
      }
      if (barStep === 2 || barStep === 6) {
        this.playBrushedRim(t);
      }
      if (barStep % 2 === 1 || barStep === 4) {
        this.playSoftHat(t, isOffbeat ? 0.018 : 0.026);
      }
    } else if (barStep === 0 || barStep === 4) {
      // Stargaze track keeps an extra gentle pulse
      this.playSoftKick(t, 0.08);
    }

    // 3. Sparse Pentatonic / Bell Melody Phrase
    if (
      (barStep === 1 && (chordIdx === 0 || chordIdx === 2)) ||
      (barStep === 4 && chordIdx % 2 === 0) ||
      (barStep === 7 && chordIdx === 1)
    ) {
      const noteIdx = (chordIdx * 2 + barStep) % prog.melodyNotes.length;
      const freq = prog.melodyNotes[noteIdx];
      this.playPluckBell(freq, t, this.track === 'lofi_stargaze' ? 1.4 : 0.85);
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

      // Subtle analog tape wobble detune
      const wobble = (Math.random() - 0.5) * 4.5;
      osc.type = this.track === 'lofi_stargaze' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      osc.detune.setValueAtTime(wobble, t0);

      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(freq * 2, t0);
      overtone.detune.setValueAtTime(wobble + 2, t0);

      const overtoneGain = ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.14, t0);

      const peak = (this.track === 'lofi_stargaze' ? 0.055 : 0.068) / Math.sqrt(freqs.length);
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
    gain.gain.linearRampToValueAtTime(0.11, startTime + 0.03);
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
    gain.gain.linearRampToValueAtTime(0.048, startTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.musicFilter);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.04);
  }

  private playSoftKick(startTime: number, volume = 0.13) {
    if (!this.ctx || !this.musicFilter) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(108, startTime);
    osc.frequency.exponentialRampToValueAtTime(44, startTime + 0.11);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.2);

    osc.connect(gain);
    gain.connect(this.musicFilter);
    osc.start(startTime);
    osc.stop(startTime + 0.22);
  }

  private playBrushedRim(startTime: number) {
    if (!this.ctx || !this.musicFilter || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1350, startTime);
    filter.Q.setValueAtTime(1.8, startTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(0.065, startTime + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.085);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicFilter);
    src.start(startTime, Math.random() * 1.5, 0.1);
  }

  private playSoftHat(startTime: number, volume = 0.024) {
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
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.042);

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
    const delayMs = 2400 + Math.random() * 3400;
    this.birdTimer = window.setTimeout(() => {
      if (this.disposed) return;
      if (!this.muted && this.level >= 4 && this.ctx && this.ctx.state === 'running' && this.birdsGain) {
        this.playBirdPhrase();
      }
      this.scheduleNextBird();
    }, delayMs);
  }

  private playBirdPhrase() {
    if (!this.ctx || !this.birdsGain) return;
    const ctx = this.ctx;
    const baseTime = ctx.currentTime + 0.02;
    const pattern = Math.random();
    const notes =
      pattern < 0.35
        ? [1760, 2217, 1975]
        : pattern < 0.7
          ? [2093, 2637]
          : [1567, 1975, 2349, 2093];

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      const start = baseTime + i * (0.11 + Math.random() * 0.04);
      const dur = 0.09 + Math.random() * 0.06;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * 0.92, start);
      osc.frequency.exponentialRampToValueAtTime(freq * (1.04 + Math.random() * 0.08), start + dur * 0.65);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.97, start + dur);

      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(0.09, start + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      osc.connect(env);
      env.connect(this.birdsGain!);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    });
  }

  public playExpansionChime() {
    if (this.muted || this.disposed) return;
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const t = ctx.currentTime + idx * 0.085;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.07, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.36);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.38);
      });
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

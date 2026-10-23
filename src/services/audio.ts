export type SoundEffect = 'plink' | 'whoosh' | 'chime';
type AudioContextFactory = () => AudioContext | null;
type BrowserAudioSession = { type: string };
type PendingResume = { context: AudioContext; generation: number; ready: Promise<boolean> };

const defaultContextFactory: AudioContextFactory = () => {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext
    ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
};

/** Audio resources live outside React state and are created only from a user gesture. */
export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private sources = new Set<AudioScheduledSourceNode>();
  private generation = 0;
  private pendingResume: PendingResume | null = null;
  private queuedEffects = new Set<symbol>();
  private session: BrowserAudioSession | null = null;
  private previousSessionType: string | null = null;

  constructor(private readonly createContext: AudioContextFactory = defaultContextFactory) {}

  prepare(): void {
    try {
      if (!this.context || this.context.state === 'closed') {
        this.stop();
        // iOS otherwise treats Web Audio as ambient and obeys the silent switch.
        // Request playback only after a gesture, before constructing its context.
        this.requestPlaybackSession();
        this.context = this.createContext();
        if (!this.context) {
          this.releasePlaybackSession();
          return;
        }
        this.master = this.context.createGain();
        this.master.gain.value = 0.3;
        this.master.connect(this.context.destination);
      } else this.requestPlaybackSession();
      // WebKit also exposes "interrupted" after a tab or app interruption.
      if (this.context.state !== 'running') this.resumeContext(this.context);
    } catch {
      // Audio is decoration. Device/browser failures must not stop an adventure.
      this.dispose();
    }
  }

  play(effect: SoundEffect): void {
    if (!this.context || !this.master || this.context.state === 'closed') return;
    this.requestPlaybackSession();
    if (this.context.state === 'running') {
      this.schedule(effect);
      return;
    }

    // A delayed reveal may follow a completed launch sound. Releasing the
    // playback session can interrupt WebKit's already-unlocked context in between.
    try {
      this.resumeContext(this.context);
    } catch {
      this.stop();
      return;
    }

    const pending = this.pendingResume;
    if (!pending || pending.context !== this.context || pending.generation !== this.generation) {
      this.releaseIfIdle();
      return;
    }
    const queued = Symbol(effect);
    this.queuedEffects.add(queued);
    void pending.ready.then((ready) => {
      if (ready && this.generation === pending.generation && this.context === pending.context
        && this.context.state === 'running') this.schedule(effect);
      this.queuedEffects.delete(queued);
      this.releaseIfIdle();
    });
  }

  private requestPlaybackSession(): void {
    if (this.session) return;
    try {
      const session = typeof navigator === 'undefined' ? undefined
        : (navigator as Navigator & { audioSession?: BrowserAudioSession }).audioSession;
      if (!session) return;
      const previous = session.type;
      session.type = 'playback';
      this.session = session;
      this.previousSessionType = previous;
    } catch {
      // This optional API is absent or restricted in some browsers.
    }
  }

  private releasePlaybackSession(): void {
    const session = this.session;
    const previous = this.previousSessionType;
    this.session = null;
    this.previousSessionType = null;
    try {
      if (session && previous !== null && session.type === 'playback') session.type = previous;
    } catch {
      // Session cleanup must not interfere with muting or signing out.
    }
  }

  private releaseIfIdle(): void {
    if (this.sources.size === 0 && this.queuedEffects.size === 0) this.releasePlaybackSession();
  }

  private resumeContext(context: AudioContext): void {
    if (this.pendingResume?.context === context && this.pendingResume.generation === this.generation) return;
    const generation = this.generation;
    // prepare() first calls this synchronously in the original gesture; later
    // effects may retry the same unlocked context after a platform interruption.
    const resume = context.resume();
    const pending: PendingResume = {
      context,
      generation,
      ready: resume.then(
        () => this.context === context && this.generation === generation && context.state === 'running',
        () => {
          if (this.context === context && this.generation === generation) this.stop();
          return false;
        },
      ),
    };
    this.pendingResume = pending;
    void pending.ready.then(() => {
      if (this.pendingResume === pending) this.pendingResume = null;
      this.releaseIfIdle();
    });
  }

  private schedule(effect: SoundEffect): void {
    try {
      const start = this.context!.currentTime;
      if (effect === 'plink') this.tone(620, start, 0.12, 'sine');
      if (effect === 'whoosh') this.whoosh(start);
      if (effect === 'chime') {
        [523.25, 659.25, 783.99].forEach((frequency, index) => {
          this.tone(frequency, start + index * 0.085, 0.28, 'triangle');
        });
      }
    } catch {
      this.stop();
    }
  }

  private track(source: AudioScheduledSourceNode, nodes: AudioNode[]): void {
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      source.disconnect();
      nodes.forEach((node) => node.disconnect());
      this.releaseIfIdle();
    };
  }

  private envelope(start: number, duration: number, peak: number): GainNode {
    const gain = this.context!.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    gain.connect(this.master!);
    return gain;
  }

  private tone(frequency: number, start: number, duration: number, type: OscillatorType): void {
    const oscillator = this.context!.createOscillator();
    const gain = this.envelope(start, duration, 0.15);
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.connect(gain);
    this.track(oscillator, [gain]);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  private whoosh(start: number): void {
    const context = this.context!;
    const duration = 0.65;
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1;
    const noise = context.createBufferSource();
    noise.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(250, start);
    filter.frequency.exponentialRampToValueAtTime(1800, start + 0.25);
    filter.frequency.exponentialRampToValueAtTime(300, start + duration);
    const gain = this.envelope(start, duration, 0.09);
    noise.connect(filter);
    filter.connect(gain);
    this.track(noise, [filter, gain]);
    noise.start(start);
    noise.stop(start + duration);
  }

  stop(): void {
    this.generation += 1;
    this.pendingResume = null;
    this.queuedEffects.clear();
    this.sources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // A source may have finished between scheduling and this cleanup.
      }
    });
    this.sources.clear();
    this.releasePlaybackSession();
  }

  dispose(): void {
    this.stop();
    const context = this.context;
    this.context = null;
    this.master = null;
    try {
      if (context && context.state !== 'closed') void context.close().catch(() => undefined);
    } catch {
      // Browsers may already have torn down the audio device during an interruption.
    }
  }
}

export const audioEngine = new AudioEngine();

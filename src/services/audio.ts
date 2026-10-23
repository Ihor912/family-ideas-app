export type SoundEffect = 'plink' | 'whoosh' | 'chime';
type AudioContextFactory = () => AudioContext | null;

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

  constructor(private readonly createContext: AudioContextFactory = defaultContextFactory) {}

  prepare(): void {
    try {
      if (!this.context || this.context.state === 'closed') {
        this.context = this.createContext();
        if (!this.context) return;
        this.master = this.context.createGain();
        this.master.gain.value = 0.3;
        this.master.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => this.stop());
    } catch {
      // Audio is decoration. Device/browser failures must not stop an adventure.
      this.context = null;
      this.master = null;
    }
  }

  play(effect: SoundEffect): void {
    if (!this.context || !this.master || this.context.state === 'closed') return;
    try {
      const start = this.context.currentTime;
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
    this.sources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // A source may have finished between scheduling and this cleanup.
      }
    });
    this.sources.clear();
  }

  dispose(): void {
    this.stop();
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => undefined);
    this.context = null;
    this.master = null;
  }
}

export const audioEngine = new AudioEngine();

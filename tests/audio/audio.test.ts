import { describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../../src/services/audio';

function fakeAudio() {
  const parameter = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const gain = () => ({ gain: parameter(), connect: vi.fn(), disconnect: vi.fn() });
  const oscillator = () => ({
    type: 'sine', frequency: parameter(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null,
  });
  const context = {
    state: 'running', currentTime: 0, destination: {},
    createGain: vi.fn(gain), createOscillator: vi.fn(oscillator),
    resume: vi.fn(async () => undefined), close: vi.fn(async () => undefined),
  };
  const factory = vi.fn(() => context as unknown as AudioContext);
  return { context, factory, engine: new AudioEngine(factory) };
}

describe('AudioEngine', () => {
  it('does not create an audio context or play sounds before user preparation', () => {
    const { engine, factory, context } = fakeAudio();
    engine.play('chime');
    expect(factory).not.toHaveBeenCalled();
    expect(context.createOscillator).not.toHaveBeenCalled();
  });

  it('prepares synchronously, uses a quiet master volume, and reuses one context', () => {
    const { engine, factory, context } = fakeAudio();
    engine.prepare();
    engine.prepare();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(context.createGain.mock.results[0].value.gain.value).toBe(0.3);
    engine.play('chime');
    expect(context.createOscillator).toHaveBeenCalledTimes(3);
  });

  it('stops and disconnects all active tones immediately when muted', () => {
    const { engine, context } = fakeAudio();
    engine.prepare();
    engine.play('chime');
    engine.stop();
    for (const source of context.createOscillator.mock.results) {
      expect(source.value.stop).toHaveBeenLastCalledWith();
      expect(source.value.disconnect).toHaveBeenCalledTimes(1);
    }
    engine.stop();
    for (const source of context.createOscillator.mock.results) expect(source.value.stop).toHaveBeenCalledTimes(2);
  });

  it('gracefully handles unavailable audio and denied resume', async () => {
    const unavailable = new AudioEngine(() => { throw new Error('unsupported'); });
    expect(() => { unavailable.prepare(); unavailable.play('whoosh'); unavailable.dispose(); }).not.toThrow();
    const { engine, context } = fakeAudio();
    context.state = 'suspended';
    context.resume.mockRejectedValue(new Error('blocked'));
    expect(() => engine.prepare()).not.toThrow();
    await Promise.resolve();
    expect(context.resume).toHaveBeenCalledTimes(1);
  });

  it('releases its context on disposal and can be prepared after remount', () => {
    const { engine, context, factory } = fakeAudio();
    engine.prepare();
    engine.dispose();
    expect(context.close).toHaveBeenCalledTimes(1);
    engine.prepare();
    expect(factory).toHaveBeenCalledTimes(2);
  });
});

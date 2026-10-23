import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioEngine } from '../../src/services/audio';

function fakeAudio() {
  const parameter = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
  const gain = () => ({ gain: parameter(), connect: vi.fn(), disconnect: vi.fn() });
  const oscillator = () => ({
    type: 'sine', frequency: parameter(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null,
  });
  const context = {
    state: 'running', currentTime: 0, destination: {},
    createGain: vi.fn(gain), createOscillator: vi.fn(oscillator),
    resume: vi.fn<() => Promise<void>>(async () => undefined), close: vi.fn<() => Promise<void>>(async () => undefined),
  };
  const factory = vi.fn(() => context as unknown as AudioContext);
  return { context, factory, engine: new AudioEngine(factory) };
}

afterEach(() => vi.unstubAllGlobals());

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

  it('requests the iPhone playback session before context creation and restores it after the last tone', () => {
    const session = { type: 'ambient' };
    vi.stubGlobal('navigator', { audioSession: session });
    const { engine, context, factory } = fakeAudio();
    factory.mockImplementation(() => {
      expect(session.type).toBe('playback');
      return context as unknown as AudioContext;
    });
    engine.prepare();
    engine.play('chime');
    const tones = context.createOscillator.mock.results.map(({ value }) => value);
    tones[0].onended?.();
    tones[1].onended?.();
    expect(session.type).toBe('playback');
    tones[2].onended?.();
    expect(session.type).toBe('ambient');
    engine.play('plink');
    expect(session.type).toBe('playback');
    engine.stop();
    expect(session.type).toBe('ambient');
  });

  it('continues when the optional audio session is absent or its setter is blocked', () => {
    vi.stubGlobal('navigator', {});
    const absent = fakeAudio();
    absent.engine.prepare();
    absent.engine.play('plink');
    expect(absent.context.createOscillator).toHaveBeenCalledTimes(1);
    vi.stubGlobal('navigator', { audioSession: { get type() { return 'auto'; }, set type(value: string) { void value; throw new Error('blocked'); } } });
    const blocked = fakeAudio();
    expect(() => { blocked.engine.prepare(); blocked.engine.play('plink'); blocked.engine.dispose(); }).not.toThrow();
    expect(blocked.context.createOscillator).toHaveBeenCalledTimes(1);
  });

  it('resumes an interrupted iPhone context in the gesture and waits before scheduling effects', async () => {
    const { engine, context } = fakeAudio();
    context.state = 'interrupted';
    let finishResume!: () => void;
    context.resume.mockImplementation(() => new Promise<void>((resolve) => { finishResume = resolve; }));
    engine.prepare();
    expect(context.resume).toHaveBeenCalledTimes(1);
    engine.play('chime');
    engine.prepare();
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(context.createOscillator).not.toHaveBeenCalled();
    context.state = 'running';
    finishResume();
    await Promise.resolve();
    await Promise.resolve();
    expect(context.createOscillator).toHaveBeenCalledTimes(3);
  });

  it.each(['stop', 'dispose'] as const)('%s cancels effects waiting for resume and restores the previous session', async (action) => {
    const session = { type: 'auto' };
    vi.stubGlobal('navigator', { audioSession: session });
    const { engine, context } = fakeAudio();
    context.state = 'suspended';
    let finishResume!: () => void;
    context.resume.mockImplementation(() => new Promise<void>((resolve) => { finishResume = resolve; }));
    engine.prepare();
    engine.play('chime');
    engine[action]();
    expect(session.type).toBe('auto');
    context.state = 'running';
    finishResume();
    await Promise.resolve();
    await Promise.resolve();
    expect(context.createOscillator).not.toHaveBeenCalled();
    expect(session.type).toBe('auto');
  });

  it('discards a rejected resume and leaves the next gesture able to retry', async () => {
    const session = { type: 'auto' };
    vi.stubGlobal('navigator', { audioSession: session });
    const { engine, context } = fakeAudio();
    context.state = 'suspended';
    context.resume.mockRejectedValueOnce(new Error('blocked')).mockImplementationOnce(async () => { context.state = 'running'; });
    engine.prepare();
    engine.play('chime');
    await Promise.resolve();
    await Promise.resolve();
    expect(context.createOscillator).not.toHaveBeenCalled();
    expect(session.type).toBe('auto');
    engine.prepare();
    engine.play('plink');
    await Promise.resolve();
    await Promise.resolve();
    expect(context.createOscillator).toHaveBeenCalledTimes(1);
  });

  it('does not replay a queued effect into a replacement context', async () => {
    const old = fakeAudio();
    const fresh = fakeAudio();
    old.context.state = 'suspended';
    let finishResume!: () => void;
    old.context.resume.mockImplementation(() => new Promise<void>((resolve) => { finishResume = resolve; }));
    old.engine.prepare();
    old.engine.play('chime');
    old.context.state = 'closed';
    old.factory.mockReturnValue(fresh.context as unknown as AudioContext);
    old.engine.prepare();
    old.engine.play('plink');
    finishResume();
    await Promise.resolve();
    await Promise.resolve();
    expect(old.context.createOscillator).not.toHaveBeenCalled();
    expect(fresh.context.createOscillator).toHaveBeenCalledTimes(1);
  });

  it('resumes an already-prepared context for a delayed reveal after releasing the previous session', async () => {
    const session = { type: 'auto' };
    vi.stubGlobal('navigator', { audioSession: session });
    const { engine, context } = fakeAudio();
    engine.prepare();
    engine.play('plink');
    context.createOscillator.mock.results[0].value.onended?.();
    expect(session.type).toBe('auto');
    context.state = 'interrupted';
    context.resume.mockImplementation(async () => { context.state = 'running'; });
    engine.play('chime');
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(session.type).toBe('playback');
    await Promise.resolve();
    await Promise.resolve();
    expect(context.createOscillator).toHaveBeenCalledTimes(4);
    for (const tone of context.createOscillator.mock.results.slice(1)) tone.value.onended?.();
    expect(session.type).toBe('auto');
  });
});

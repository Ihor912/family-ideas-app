import { expect, test, type Page } from '@playwright/test';

type AudioProbe = {
  contexts: AudioContext[];
  starts: Array<{ kind: 'tone' | 'noise'; state: AudioContextState }>;
  peak: number;
};

type AudioProbeWindow = typeof window & { __familyAudioProbe: AudioProbe };

/** Observe native browser audio; do not replace contexts, sources, or resume with mocks. */
async function observeNativeAudio(page: Page) {
  await page.addInitScript(() => {
    const probe: AudioProbe = { contexts: [], starts: [], peak: 0 };
    (window as AudioProbeWindow).__familyAudioProbe = probe;
    const NativeAudioContext = window.AudioContext;
    const nativeToneStart = OscillatorNode.prototype.start;
    const nativeNoiseStart = AudioBufferSourceNode.prototype.start;

    OscillatorNode.prototype.start = function (...args: Parameters<OscillatorNode['start']>) {
      probe.starts.push({ kind: 'tone', state: this.context.state });
      return nativeToneStart.apply(this, args);
    };
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<AudioBufferSourceNode['start']>) {
      probe.starts.push({ kind: 'noise', state: this.context.state });
      return nativeNoiseStart.apply(this, args);
    };

    window.AudioContext = new Proxy(NativeAudioContext, {
      construct(target, args) {
        const context = Reflect.construct(target, args) as AudioContext;
        probe.contexts.push(context);
        const createGain = context.createGain.bind(context);
        let observedMaster = false;
        context.createGain = () => {
          const gain = createGain();
          if (!observedMaster) {
            observedMaster = true;
            const analyser = context.createAnalyser();
            const silentOutput = createGain();
            silentOutput.gain.value = 0;
            // Observe the real master output without adding audible output.
            gain.connect(analyser);
            analyser.connect(silentOutput);
            silentOutput.connect(context.destination);
            const samples = new Float32Array(analyser.fftSize);
            const timer = window.setInterval(() => {
              if (context.state === 'closed') {
                window.clearInterval(timer);
                return;
              }
              analyser.getFloatTimeDomainData(samples);
              for (const sample of samples) probe.peak = Math.max(probe.peak, Math.abs(sample));
            }, 10);
          }
          return gain;
        };
        return context;
      },
    });
  });
}

async function audioSnapshot(page: Page) {
  return page.evaluate(() => {
    const probe = (window as AudioProbeWindow).__familyAudioProbe;
    return { contexts: probe.contexts.length, states: probe.contexts.map(context => context.state), starts: probe.starts, peak: probe.peak };
  });
}

test('native audio produces a confirmation, resumes on a later gesture, and stays silent when muted', async ({ page }) => {
  await observeNativeAudio(page);
  await page.goto('./');
  await expect(page.getByRole('button', { name: 'Знайти пригоду', exact: true })).toBeEnabled();
  expect((await audioSnapshot(page)).contexts).toBe(0);

  await page.getByRole('button', { name: /Звук: вимкнено/ }).click();
  await expect.poll(async () => (await audioSnapshot(page)).starts.length).toBe(1);
  await expect.poll(async () => (await audioSnapshot(page)).peak).toBeGreaterThan(0.001);
  expect((await audioSnapshot(page)).starts).toEqual([{ kind: 'tone', state: 'running' }]);

  await page.evaluate(async () => {
    await (window as AudioProbeWindow).__familyAudioProbe.contexts[0].suspend();
  });
  expect((await audioSnapshot(page)).states).toEqual(['suspended']);
  await page.getByRole('button', { name: 'Знайти пригоду', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ще одну пригоду!' })).toBeEnabled();
  const afterDraw = await audioSnapshot(page);
  expect(afterDraw.starts).toEqual([
    { kind: 'tone', state: 'running' },
    { kind: 'noise', state: 'running' },
    { kind: 'tone', state: 'running' },
    { kind: 'tone', state: 'running' },
    { kind: 'tone', state: 'running' },
  ]);

  await page.getByRole('button', { name: /Звук: увімкнено/ }).click();
  await page.getByRole('button', { name: 'Ще одну пригоду!' }).click();
  await expect(page.getByRole('button', { name: 'Ще одну пригоду!' })).toBeEnabled();
  expect((await audioSnapshot(page)).starts).toEqual(afterDraw.starts);
});

test('remembered sound preference waits for a gesture before creating native audio', async ({ page }) => {
  await observeNativeAudio(page);
  await page.addInitScript(() => localStorage.setItem('family-orbit:sound', 'true'));
  await page.goto('./');
  await expect(page.getByRole('button', { name: /Звук: увімкнено/ })).toBeVisible();
  expect((await audioSnapshot(page)).contexts).toBe(0);
  await page.getByRole('button', { name: 'Знайти пригоду', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Ще одну пригоду!' })).toBeEnabled();
  const audio = await audioSnapshot(page);
  expect(audio.contexts).toBe(1);
  expect(audio.starts).toEqual([
    { kind: 'noise', state: 'running' },
    { kind: 'tone', state: 'running' },
    { kind: 'tone', state: 'running' },
    { kind: 'tone', state: 'running' },
  ]);
  expect(audio.peak).toBeGreaterThan(0.001);
});

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const DEFAULT_BASE_URL = process.env.PERF_BASE_URL ?? 'http://127.0.0.1:5173/object-synth/';
const SAMPLE_INTERVAL_MS = Number(process.env.PERF_SAMPLE_INTERVAL_MS ?? 1000);
const SHORT_SCENARIO_MS = Number(process.env.PERF_SHORT_SCENARIO_MS ?? 30000);
const LONG_SCENARIO_MS = Number(process.env.PERF_LONG_SCENARIO_MS ?? 45000);

const ensureNumber = (value) => (Number.isFinite(value) ? value : null);

const percentile = (values, p) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[idx];
};

const nowSlug = () => new Date().toISOString().replace(/[:.]/g, '-');

const summarizeSeries = (samples) => {
  const fpsValues = samples.map((sample) => sample.fps).filter((v) => typeof v === 'number');
  const heapValues = samples.map((sample) => sample.heapBytes).filter((v) => typeof v === 'number');
  const detectValues = samples
    .map((sample) => sample.detectMotionMsAvg)
    .filter((v) => typeof v === 'number');
  const drawValues = samples.map((sample) => sample.drawMsAvg).filter((v) => typeof v === 'number');
  const heapDeltaBytes =
    heapValues.length >= 2 ? heapValues[heapValues.length - 1] - heapValues[0] : null;

  return {
    sampleCount: samples.length,
    fpsMin: fpsValues.length > 0 ? Math.min(...fpsValues) : null,
    fpsMedian: percentile(fpsValues, 0.5),
    fpsP95: percentile(fpsValues, 0.95),
    heapStartBytes: heapValues.length > 0 ? heapValues[0] : null,
    heapEndBytes: heapValues.length > 0 ? heapValues[heapValues.length - 1] : null,
    heapDeltaBytes,
    detectMotionMsAvgMedian: percentile(detectValues, 0.5),
    drawMsAvgMedian: percentile(drawValues, 0.5),
  };
};

const classifyScenario = (name, summary) => {
  const findings = [];
  if (summary.fpsMedian !== null && summary.fpsMedian < 22) {
    findings.push('fps_regression');
  }
  if (summary.heapDeltaBytes !== null && summary.heapDeltaBytes > 15 * 1024 * 1024) {
    findings.push('heap_growth_suspect');
  }
  if (name === 'high-motion' && summary.detectMotionMsAvgMedian !== null && summary.detectMotionMsAvgMedian > 14) {
    findings.push('motion_detection_cpu_bound');
  }
  return findings;
};

const writeReportMarkdown = async (outputPath, result) => {
  const lines = [];
  lines.push('# Performance and Leak Baseline');
  lines.push('');
  lines.push(`- Timestamp: ${result.timestamp}`);
  lines.push(`- Base URL: ${result.baseUrl}`);
  lines.push(`- Browser: Chromium (headless)`);
  lines.push('');
  lines.push('## Scenario Summary');
  lines.push('');
  for (const scenario of result.scenarios) {
    const s = scenario.summary;
    lines.push(`### ${scenario.name}`);
    lines.push(`- Samples: ${s.sampleCount}`);
    lines.push(`- FPS median/min: ${s.fpsMedian ?? 'n/a'} / ${s.fpsMin ?? 'n/a'}`);
    lines.push(`- Heap delta: ${s.heapDeltaBytes ?? 'n/a'} bytes`);
    lines.push(`- Detect motion median: ${s.detectMotionMsAvgMedian ?? 'n/a'} ms`);
    lines.push(`- Draw median: ${s.drawMsAvgMedian ?? 'n/a'} ms`);
    lines.push(`- Signals: ${scenario.signals.length > 0 ? scenario.signals.join(', ') : 'none'}`);
    lines.push('');
  }
  lines.push('## Proposed Initial Thresholds');
  lines.push('');
  lines.push('- FPS median >= 24 in idle and >= 20 in high-motion.');
  lines.push('- Heap growth <= 12 MB during 45s steady-state scenarios.');
  lines.push('- `detectZoneMotion` median <= 12 ms in high-motion at 160x120 process resolution.');
  lines.push('- Object URL counters should stay balanced after reset (`created - revoked <= 1`).');
  lines.push('');
  await fs.writeFile(outputPath, lines.join('\n'), 'utf8');
};

const collectSample = async (page, scenarioName, startedAt) => {
  return page.evaluate(
    ({ scenarioName, startedAt }) => {
      const heapBytes = (performance && (performance).memory && (performance).memory.usedJSHeapSize) || null;
      const debug = window.__objectSynthDebug?.snapshot?.();
      return {
        scenario: scenarioName,
        tMs: Date.now() - startedAt,
        heapBytes,
        fps: debug?.fps ?? null,
        detectMotionMsAvg: debug?.detectMotionMsAvg ?? null,
        drawMsAvg: debug?.drawMsAvg ?? null,
        createdObjectUrls: debug?.createdObjectUrls ?? null,
        revokedObjectUrls: debug?.revokedObjectUrls ?? null,
        activeZoneAudioPlayers: debug?.activeZoneAudioPlayers ?? null,
        presenceActiveZones: debug?.presenceActiveZones ?? null,
        defaultDetectionMode: debug?.defaultDetectionMode ?? null,
        baseSoundPlayers: debug?.baseSoundPlayers ?? null,
        streamTrackCount: debug?.streamTrackCount ?? null,
      };
    },
    { scenarioName, startedAt }
  );
};

const runScenario = async (page, { name, durationMs, setup }) => {
  await setup();
  const startedAt = Date.now();
  const samples = [];
  while (Date.now() - startedAt < durationMs) {
    const sample = await collectSample(page, name, startedAt);
    samples.push(sample);
    await page.waitForTimeout(SAMPLE_INTERVAL_MS);
  }
  const summary = summarizeSeries(samples);
  return {
    name,
    durationMs,
    summary,
    signals: classifyScenario(name, summary),
    samples,
  };
};

const main = async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-precise-memory-info'],
  });
  const context = await browser.newContext();
  await context.addInitScript(() => {
    localStorage.setItem('object-synth-perf-debug', 'true');
    const listeners = new Map();
    const maybeExisting = navigator.mediaDevices || {};
    const mockCanvas = document.createElement('canvas');
    mockCanvas.width = 640;
    mockCanvas.height = 480;
    const ctx = mockCanvas.getContext('2d');
    let frame = 0;
    let motionEnabled = false;
    let presenceEnabled = false;
    let rafId = 0;

    const paint = () => {
      if (!ctx) return;
      frame += 1;
      ctx.fillStyle = '#111';
      ctx.fillRect(0, 0, mockCanvas.width, mockCanvas.height);
      if (motionEnabled) {
        const x = (frame * 7) % mockCanvas.width;
        const y = (frame * 3) % mockCanvas.height;
        ctx.fillStyle = '#f00';
        ctx.fillRect(x, y, 60, 60);
        ctx.fillStyle = '#0ff';
        ctx.beginPath();
        ctx.arc((frame * 5) % mockCanvas.width, (frame * 2) % mockCanvas.height, 24, 0, Math.PI * 2);
        ctx.fill();
      } else if (presenceEnabled) {
        ctx.fillStyle = '#0f0';
        ctx.fillRect(280, 160, 100, 140);
      } else {
        ctx.fillStyle = '#666';
        ctx.fillRect(200, 180, 120, 120);
      }
      rafId = requestAnimationFrame(paint);
    };
    paint();

    const stream = mockCanvas.captureStream(30);
    const mocked = {
      ...maybeExisting,
      getUserMedia: async () => stream,
      enumerateDevices: async () => [
        {
          deviceId: 'fake-cam-1',
          kind: 'videoinput',
          label: 'Fake Camera 1',
          groupId: 'fake-group',
          toJSON: () => ({}),
        },
      ],
      addEventListener: (eventName, fn) => {
        if (!listeners.has(eventName)) listeners.set(eventName, new Set());
        listeners.get(eventName).add(fn);
      },
      removeEventListener: (eventName, fn) => {
        listeners.get(eventName)?.delete(fn);
      },
      dispatchEvent: (event) => {
        listeners.get(event.type)?.forEach((fn) => fn(event));
        return true;
      },
    };

    try {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: mocked,
      });
    } catch {
      // fallback for environments where defineProperty is blocked
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = mocked.getUserMedia;
        navigator.mediaDevices.enumerateDevices = mocked.enumerateDevices;
        navigator.mediaDevices.addEventListener = mocked.addEventListener;
        navigator.mediaDevices.removeEventListener = mocked.removeEventListener;
      }
    }

    window.__setSyntheticMotion = (enabled) => {
      motionEnabled = Boolean(enabled);
    };
    window.__setSyntheticPresence = (enabled) => {
      presenceEnabled = Boolean(enabled);
    };
    window.__stopSyntheticMotion = () => {
      cancelAnimationFrame(rafId);
    };
  });

  const page = await context.newPage();
  await page.goto(DEFAULT_BASE_URL, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => Boolean(window.__objectSynthDebug), { timeout: 30000 });

  await page.evaluate(() => {
    window.__objectSynthDebug?.setProcessResolution(160, 120);
    window.__objectSynthDebug?.setActiveZoneCount(6);
    window.__objectSynthDebug?.setMode('performance');
  });

  const scenarios = [];

  scenarios.push(
    await runScenario(page, {
      name: 'idle',
      durationMs: SHORT_SCENARIO_MS,
      setup: async () => {
        await page.evaluate(() => {
          window.__setSyntheticMotion(false);
          window.__objectSynthDebug?.setMode('performance');
        });
      },
    })
  );

  scenarios.push(
    await runScenario(page, {
      name: 'presence-intermittent',
      durationMs: SHORT_SCENARIO_MS,
      setup: async () => {
        await page.evaluate(async () => {
          window.__setSyntheticMotion(false);
          window.__setSyntheticPresence(false);
          window.__objectSynthDebug?.setDefaultDetectionMode('presence');
          window.__objectSynthDebug?.setMode('performance');
          await new Promise((resolve) => setTimeout(resolve, 2500));
          window.__setSyntheticPresence(true);
          await new Promise((resolve) => setTimeout(resolve, 8000));
          window.__setSyntheticPresence(false);
          await new Promise((resolve) => setTimeout(resolve, 2500));
          window.__setSyntheticPresence(true);
        });
      },
    })
  );

  scenarios.push(
    await runScenario(page, {
      name: 'high-motion',
      durationMs: LONG_SCENARIO_MS,
      setup: async () => {
        await page.evaluate(() => {
          window.__setSyntheticMotion(true);
          window.__objectSynthDebug?.setMode('performance');
        });
      },
    })
  );

  scenarios.push(
    await runScenario(page, {
      name: 'device-switching',
      durationMs: SHORT_SCENARIO_MS,
      setup: async () => {
        await page.evaluate(async () => {
          window.__setSyntheticMotion(false);
          for (let i = 0; i < 12; i++) {
            await window.__objectSynthDebug?.setSelectedVideoDevice(i % 2 ? 'fake-cam-1' : null);
          }
        });
      },
    })
  );

  scenarios.push(
    await runScenario(page, {
      name: 'sound-library-stress',
      durationMs: SHORT_SCENARIO_MS,
      setup: async () => {
        await page.evaluate(async () => {
          window.__setSyntheticMotion(false);
          for (let i = 0; i < 4; i++) {
            await window.__objectSynthDebug?.addSyntheticSounds(8);
            await window.__objectSynthDebug?.resetSoundLibrary();
          }
        });
      },
    })
  );

  const reloadSnapshots = [];
  for (let i = 0; i < 6; i++) {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.__objectSynthDebug), { timeout: 30000 });
    const sample = await collectSample(page, 'mount-unmount-approx', Date.now());
    reloadSnapshots.push(sample);
  }

  const timestamp = new Date().toISOString();
  const result = {
    timestamp,
    baseUrl: DEFAULT_BASE_URL,
    scenarios,
    reloadSnapshots,
    thresholds: {
      fpsMedianIdleMin: 24,
      fpsMedianHighMotionMin: 20,
      heapDeltaMaxBytes: 12 * 1024 * 1024,
      detectMotionMedianMaxMs: 12,
    },
  };

  const slug = nowSlug();
  const jsonPath = path.join(process.cwd(), 'perf-artifacts', `perf-baseline-${slug}.json`);
  const mdPath = path.join(process.cwd(), 'perf-artifacts', `perf-baseline-${slug}.md`);
  await fs.writeFile(jsonPath, JSON.stringify(result, null, 2), 'utf8');
  await writeReportMarkdown(mdPath, result);
  await browser.close();

  console.log(`Perf audit complete.`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Summary: ${mdPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

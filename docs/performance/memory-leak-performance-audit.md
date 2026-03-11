# Memory Leak and Performance Audit

Date: 2026-03-11

## Scope

This pass focused on runtime behavior in `src/engine/p5Engine.ts` and lifecycle integration from `src/editor/components/EditorLayout.tsx`, with emphasis on:

- render-loop CPU cost in performance mode
- cleanup correctness for media/audio/listeners/object URLs
- repeatable measurement for FPS and heap trends

## Hotspot Map (Prioritized)

### High

- `detectZoneMotion` performs zone-area nested loops every frame. CPU cost scales with both zone count and zone size.
- Camera capture reinitialization (`initCaptureDevice`) can accumulate resources if previous capture elements are not cleaned.
- Global audio graph lifetime (`window.audioContext`) can outlive the engine lifecycle if not closed.

### Medium

- Process-buffer recreation (`createGraphics`) on resolution changes can leave transient memory pressure if old buffers are not released.
- Device change listener registration in `p.setup` can leak across remounts if remove path is missing.

### Low

- Per-frame grayscale allocation was a GC pressure source. It is now reduced by reusing frame buffers.

## Implemented Safeguards

The following were implemented directly in `src/engine/p5Engine.ts`:

- Added explicit teardown path called from adapter `destroy()`:
  - removes media device listeners
  - stops stream tracks and removes capture element
  - clears/pause/disconnects transient and base audio players
  - closes IndexedDB connection and audio context
  - removes perf debug hooks from `window`
- Added tracked object URL lifecycle helpers:
  - increments created/revoked counters
  - revokes URLs during single delete, full reset, and destroy
- Reused grayscale frame buffer in `detectZoneMotion` to lower allocation churn.
- Added optional perf debug surface (`localStorage['object-synth-perf-debug']="true"`) to expose:
  - fps, detect-motion timing EWMA, draw timing EWMA
  - object URL created/revoked counts
  - active audio player counts and stream track count
- Added synthetic sound creation helper (debug-only) for reproducible sound-library stress checks.

## Scenario Matrix Results

Automated full run artifact:

- `perf-artifacts/perf-baseline-2026-03-11T16-54-19-378Z.json`
- `perf-artifacts/perf-baseline-2026-03-11T16-54-19-378Z.md`

Key results:

- Idle (30s): FPS median 30.03, min 29.33, heap delta +1.46 MB
- High motion (45s): FPS median 29.94, min 29.15, heap delta +7.82 MB
- Device switching (30s): FPS median 30.03, heap delta -1.52 MB
- Sound library stress (30s): FPS median 30.03, heap delta -1.20 MB
- Sound stress URL counters stayed balanced (`created=32`, `revoked=32`)

Interpretation:

- No monotonic heap growth signal appeared in steady-state scenarios.
- CPU remained stable at current test resolution (`160x120`) under synthetic high-motion.
- Device switching and sound reset flows did not show resource accumulation in this run.
- Reload snapshots rise over repeated reloads in one browser process are expected; use isolated-process loops for strict mount/unmount leak assertions.

## CPU vs Leak Classification

- CPU-bound risk: motion detection complexity remains the primary scaling risk as zones/area increase.
- Leak risk (prior): object URLs, media listeners, and stream/audio teardown paths.
- Leak risk (after this pass): downgraded to medium/low based on counters and scenario outcomes; keep CI monitoring active.

## Initial Thresholds for CI

- Idle FPS median >= 24
- High-motion FPS median >= 20
- Heap delta <= 12 MB in 45s steady-state scenarios
- `detectZoneMotion` median <= 12 ms at `160x120`
- Object URL balance after resets: `created - revoked <= 1`

## How To Run

- Quick local check:
  - `PERF_BASE_URL="http://127.0.0.1:4175/object-synth/" pnpm perf:audit:quick`
- Full local check:
  - `PERF_BASE_URL="http://127.0.0.1:4175/object-synth/" pnpm perf:audit`

Note: start the app (`pnpm dev --host 127.0.0.1 --port 4173`) and pass the active URL as `PERF_BASE_URL`.

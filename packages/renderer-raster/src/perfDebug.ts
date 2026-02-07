interface PerfDebugConfig {
  skipSessionRender?: boolean;
  skipHotLayerRender?: boolean;
  skipTileBakeScheduling?: boolean;
  skipTileBakeExecution?: boolean;
  skipSnapshotCapture?: boolean;
}

interface PerfDebugState {
  config?: PerfDebugConfig;
  counters?: Record<string, number>;
  timingsMs?: Record<string, number>;
}

const PERF_KEY = "__kidsDrawPerf";

function getPerfDebugState(): PerfDebugState | null {
  const candidate = (globalThis as Record<string, unknown>)[PERF_KEY];
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  return candidate as PerfDebugState;
}

export function perfNowMs(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function perfFlagEnabled(flag: keyof PerfDebugConfig): boolean {
  return Boolean(getPerfDebugState()?.config?.[flag]);
}

export function perfAddCounter(key: string, delta = 1): void {
  const state = getPerfDebugState();
  if (!state) return;
  if (!state.counters) {
    state.counters = {};
  }
  const counters = state.counters;
  counters[key] = (counters[key] ?? 0) + delta;
}

export function perfAddTimingMs(key: string, durationMs: number): void {
  const state = getPerfDebugState();
  if (!state) return;
  if (!state.timingsMs) {
    state.timingsMs = {};
  }
  const timings = state.timingsMs;
  timings[key] = (timings[key] ?? 0) + durationMs;
}

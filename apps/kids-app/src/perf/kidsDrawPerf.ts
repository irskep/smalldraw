const nowMs = (): number =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

interface KidsDrawPerfConfig {
  skipSessionRender?: boolean;
  skipHotLayerRender?: boolean;
  skipTileBakeScheduling?: boolean;
  skipTileBakeExecution?: boolean;
  skipSnapshotCapture?: boolean;
}

interface KidsDrawPerfStrokeSummary {
  fps: number;
  frames: number;
  durationMs: number;
  modelInvalidations: number;
  rafFramesExecuted: number;
  renderPasses: number;
  avgRenderPassMs: number;
  sessionRenderMs: number;
  hotLayerMs: number;
  hotClearMs: number;
  hotBackdropBlitMs: number;
  hotBackgroundFillMs: number;
  hotDraftPaintMs: number;
  getRenderStateMs: number;
  captureTouchedTilesMs: number;
  bakeMs: number;
  tilesBaked: number;
  snapshotMs: number;
  snapshotCalls: number;
}

interface KidsDrawPerfGlobal {
  config: KidsDrawPerfConfig;
  counters: Record<string, number>;
  timingsMs: Record<string, number>;
  lastStrokeSummary?: KidsDrawPerfStrokeSummary;
  strokeHistory?: KidsDrawPerfStrokeSummary[];
}

const PERF_KEY = "__kidsDrawPerf";

function getKidsDrawPerfGlobal(): KidsDrawPerfGlobal {
  const root = globalThis as Record<string, unknown>;
  const existing = root[PERF_KEY];
  if (existing && typeof existing === "object") {
    const state = existing as KidsDrawPerfGlobal;
    state.config ??= {};
    state.counters ??= {};
    state.timingsMs ??= {};
    state.strokeHistory ??= [];
    return state;
  }
  const created: KidsDrawPerfGlobal = {
    config: {},
    counters: {},
    timingsMs: {},
    strokeHistory: [],
  };
  root[PERF_KEY] = created;
  return created;
}

export interface KidsDrawPerfSession {
  begin(): void;
  onModelInvalidation(): void;
  onRafFrameExecuted(): void;
  recordRenderPassStart(): number;
  recordRenderPassEnd(startMs: number): void;
  end(frameCount: number): void;
}

export function createKidsDrawPerfSession(): KidsDrawPerfSession {
  const perfGlobal = getKidsDrawPerfGlobal();
  let drawingPerfStartMs: number | null = null;
  let drawingPerfModelInvalidations = 0;
  let drawingPerfRafFramesExecuted = 0;
  let drawingPerfRenderPasses = 0;
  let drawingPerfRenderPassMsTotal = 0;
  let drawingPerfCounterBaseline: Record<string, number> = {};
  let drawingPerfTimingBaseline: Record<string, number> = {};

  const readCounterDelta = (key: string): number =>
    (perfGlobal.counters[key] ?? 0) - (drawingPerfCounterBaseline[key] ?? 0);
  const readTimingDelta = (key: string): number =>
    (perfGlobal.timingsMs[key] ?? 0) - (drawingPerfTimingBaseline[key] ?? 0);

  return {
    begin() {
      drawingPerfStartMs = nowMs();
      drawingPerfModelInvalidations = 0;
      drawingPerfRafFramesExecuted = 0;
      drawingPerfRenderPasses = 0;
      drawingPerfRenderPassMsTotal = 0;
      drawingPerfCounterBaseline = { ...perfGlobal.counters };
      drawingPerfTimingBaseline = { ...perfGlobal.timingsMs };
    },
    onModelInvalidation() {
      drawingPerfModelInvalidations += 1;
    },
    onRafFrameExecuted() {
      drawingPerfRafFramesExecuted += 1;
    },
    recordRenderPassStart() {
      drawingPerfRenderPasses += 1;
      return nowMs();
    },
    recordRenderPassEnd(startMs: number) {
      drawingPerfRenderPassMsTotal += nowMs() - startMs;
    },
    end(frameCount: number) {
      if (drawingPerfStartMs === null) return;
      const durationMs = Math.max(1, nowMs() - drawingPerfStartMs);
      const fps = (frameCount * 1000) / durationMs;
      const renderPasses = Math.max(1, drawingPerfRenderPasses);
      const summary: KidsDrawPerfStrokeSummary = {
        fps,
        frames: frameCount,
        durationMs,
        modelInvalidations: drawingPerfModelInvalidations,
        rafFramesExecuted: drawingPerfRafFramesExecuted,
        renderPasses: drawingPerfRenderPasses,
        avgRenderPassMs: drawingPerfRenderPassMsTotal / renderPasses,
        sessionRenderMs: readTimingDelta("session.render.ms"),
        hotLayerMs: readTimingDelta("session.hotLayer.renderDrafts.ms"),
        hotClearMs: readTimingDelta("hotLayer.clear.ms"),
        hotBackdropBlitMs: readTimingDelta("hotLayer.backdropBlit.ms"),
        hotBackgroundFillMs: readTimingDelta("hotLayer.backgroundFill.ms"),
        hotDraftPaintMs: readTimingDelta("hotLayer.draftPaint.ms"),
        getRenderStateMs: readTimingDelta("session.store.getRenderState.ms"),
        captureTouchedTilesMs: readTimingDelta("session.captureTouchedTiles.ms"),
        bakeMs: readTimingDelta("tileRenderer.bakePendingTiles.ms"),
        tilesBaked: readCounterDelta("tileRenderer.bakePendingTiles.tilesBaked"),
        snapshotMs: readTimingDelta("tileRenderer.captureViewportSnapshot.ms"),
        snapshotCalls: readCounterDelta(
          "tileRenderer.captureViewportSnapshot.calls",
        ),
      };
      perfGlobal.lastStrokeSummary = summary;
      perfGlobal.strokeHistory?.push(summary);
      console.log(
        `[kids-draw] stroke avg fps: ${fps.toFixed(1)} (${frameCount} frames / ${durationMs.toFixed(1)}ms); model=${summary.modelInvalidations}; raf=${summary.rafFramesExecuted}; renderPass=${summary.renderPasses}; renderMs=${summary.avgRenderPassMs.toFixed(2)}; hot(clear=${summary.hotClearMs.toFixed(2)} blit=${summary.hotBackdropBlitMs.toFixed(2)} fill=${summary.hotBackgroundFillMs.toFixed(2)} paint=${summary.hotDraftPaintMs.toFixed(2)}); bakeTiles=${summary.tilesBaked}; bakeMs=${summary.bakeMs.toFixed(1)}; snapshotCalls=${summary.snapshotCalls}`,
      );
      drawingPerfStartMs = null;
    },
  };
}

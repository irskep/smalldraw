import { afterEach, expect, spyOn, test } from "bun:test";
import { createKidsDrawPerfSession } from "../perf/kidsDrawPerf";

const target = globalThis as Record<string, unknown>;
afterEach(() => {
  delete target.__kidsDrawPerf;
});
test("normal drawing does not create a performance collector", () => {
  delete target.__kidsDrawPerf;
  const perf = createKidsDrawPerfSession();
  perf.begin();
  perf.onPointerMoveSamples(10, true);
  expect(perf.recordRenderPassStart()).toBe(0);
  perf.end(1);
  expect(target.__kidsDrawPerf).toBeUndefined();
});
test("diagnostics can be enabled between strokes and history stays bounded", () => {
  const log = spyOn(console, "log").mockImplementation(() => {});
  try {
    const perf = createKidsDrawPerfSession();
    const state = { strokeHistory: [] as unknown[] };
    target.__kidsDrawPerf = state;
    for (let i = 0; i < 150; i++) {
      perf.begin();
      perf.end(1);
    }
    expect(state.strokeHistory).toHaveLength(100);
    expect(log).toHaveBeenCalledTimes(150);
    delete target.__kidsDrawPerf;
    perf.begin();
    perf.end(1);
    expect(log).toHaveBeenCalledTimes(150);
  } finally {
    log.mockRestore();
  }
});

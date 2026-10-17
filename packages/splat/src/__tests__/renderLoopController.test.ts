import { expect, test } from "bun:test";
import { RenderLoopController } from "../controller/createRenderLoopController";
import type { RasterPipeline } from "../render/createRasterPipeline";

test("render requests made during a pass survive, and disposal stops scheduling", () => {
  const original = globalThis.requestAnimationFrame;
  const cancel = globalThis.cancelAnimationFrame;
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  globalThis.requestAnimationFrame = (fn) => {
    frames.set(++id, fn);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    frames.delete(id);
  };
  let passes = 0;
  const controller = new RenderLoopController(
    {
      pipeline: {} as RasterPipeline,
      backgroundColor: "white",
      getSize: () => ({ width: 100, height: 100 }),
      getPresentationIdentity: () => "test",
      perfSession: { onRafFrameExecuted() {} },
      onRenderPass() {
        passes++;
        if (passes === 1) controller.requestRenderFromModel();
      },
    },
    1,
  );
  const frame = () => {
    const [id, fn] = [...frames][0];
    frames.delete(id);
    fn(0);
  };
  try {
    controller.requestRenderFromModel();
    frame();
    frame();
    expect(passes).toBe(2);
    controller.dispose();
    controller.requestRenderFromModel();
    expect(frames.size).toBe(0);
  } finally {
    controller.dispose();
    globalThis.requestAnimationFrame = original;
    globalThis.cancelAnimationFrame = cancel;
  }
});

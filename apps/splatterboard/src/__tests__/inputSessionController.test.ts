import { describe, expect, test } from "bun:test";
import type { Vec2 } from "@smalldraw/geometry";
import { InputSessionController } from "../controller/createInputSessionController";

function point(x: number, y: number): Vec2 {
  return new Float32Array([x, y]) as unknown as Vec2;
}

describe("InputSessionController", () => {
  test("suppresses secondary pointerdown while a primary stroke is active", () => {
    const dispatchEvents: Array<{ type: string; buttons: number }> = [];
    let cursorPointerDownCalls = 0;

    const controller = new InputSessionController({
      store: {
        dispatch(type, payload) {
          dispatchEvents.push({ type, buttons: payload.buttons });
        },
        dispatchBatch() {},
        getActionSequence() {
          return 0;
        },
        getActiveToolId() {
          return "brush.marker";
        },
      } as never,
      cursorOverlay: {
        handlePointerDown() {
          cursorPointerDownCalls += 1;
        },
        handlePointerMove() {},
        handlePointerRawUpdate() {},
        setDrawingActive() {},
      } as never,
      overlayElement: {
        setPointerCapture() {},
        releasePointerCapture() {},
      } as HTMLElement,
      initialLastPointerPoint: point(0, 0),
      toPoint: (event) => point(event.clientX, event.clientY),
      onScheduleThumbnailSave() {},
      perfSession: {
        begin() {},
        end() {},
        onPointerMoveSamples() {},
      },
    });

    const primaryDown = {
      buttons: 1,
      clientX: 10,
      clientY: 20,
      pointerId: 1,
      pointerType: "mouse",
      preventDefault() {},
    } as PointerEvent;

    let secondaryPrevented = false;
    const secondaryDown = {
      buttons: 2,
      clientX: 12,
      clientY: 22,
      pointerId: 2,
      pointerType: "mouse",
      preventDefault() {
        secondaryPrevented = true;
      },
    } as PointerEvent;

    controller.handlePointerDown(primaryDown);
    controller.handlePointerDown(secondaryDown);

    expect(secondaryPrevented).toBe(true);
    expect(cursorPointerDownCalls).toBe(1);
    expect(dispatchEvents).toEqual([{ type: "pointerDown", buttons: 1 }]);
  });
});

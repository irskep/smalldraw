import { describe, expect, test } from "bun:test";
import { DrawingStore, type PenShape } from "@smalldraw/core";
import type { Vec2 } from "@smalldraw/geometry";
import { InputSessionController } from "../controller/createInputSessionController";
import { createKidsShapeHandlerRegistry } from "../shapes/kidsShapeHandlers";
import { createPenTool } from "../tools/drawingTools";

function point(x: number, y: number): Vec2 {
  return new Float32Array([x, y]) as unknown as Vec2;
}

describe("InputSessionController", () => {
  test.each([
    "pen",
    "mouse",
  ])("preserves pressure policy through real %s input", (pointerType) => {
    const store = new DrawingStore({
      tools: [createPenTool()],
      shapeHandlers: createKidsShapeHandlerRegistry(),
    });
    store.activateTool("brush.freehand");
    const controller = new InputSessionController({
      store,
      cursorOverlay: {
        handlePointerDown() {},
        handlePointerMove() {},
        setDrawingActive() {},
      } as never,
      overlayElement: {} as HTMLElement,
      initialLastPointerPoint: point(0, 0),
      toPoint: (event) => point(event.clientX, event.clientY),
      onScheduleThumbnailSave() {},
      perfSession: { begin() {}, end() {}, onPointerMoveSamples() {} },
    });
    const event = (x: number, pressure: number | undefined, buttons = 1) =>
      ({
        clientX: x,
        clientY: 10,
        pressure,
        buttons,
        pointerId: 1,
        pointerType,
        preventDefault() {},
      }) as PointerEvent;
    controller.handlePointerDown(event(0, 0));
    controller.handlePointerMove(event(10, 0.8));
    controller.handlePointerMove(event(20, undefined));
    controller.handlePointerUp(event(30, 0, 0));
    const shape = Object.values(store.getDocument().shapes)[0] as PenShape;
    expect(shape.geometry.pointCount).toBe(4);
    expect(shape.geometry.pressures).toEqual(
      pointerType === "pen" ? [0, 0.8, 0.8, 0] : undefined,
    );
  });

  test("suppresses secondary pointerdown while a primary stroke is active", () => {
    const dispatchEvents: Array<{ type: string; buttons: number }> = [];
    let cursorPointerDownCalls = 0;

    const controller = new InputSessionController({
      store: {
        dispatch(type: string, payload: { buttons: number }) {
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
      } as unknown as HTMLElement,
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

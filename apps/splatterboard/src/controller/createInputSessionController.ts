import type { DrawingStore } from "@smalldraw/core";
import type { Vec2 } from "@smalldraw/geometry";
import type { CursorOverlayController } from "./createCursorOverlayController";

const MAX_POINTER_SAMPLES_PER_EVENT = 64;

type PointerEventWithCoalesced = PointerEvent & {
  getCoalescedEvents?: () => PointerEvent[];
};

type PointerSessionEndType = "pointerUp" | "pointerCancel";

export class InputSessionController {
  private pointerIsDown = false;
  private drawingPerfFrameCount = 0;
  private activePointerId: number | null = null;
  private lastPointerPoint: Vec2;

  constructor(
    private readonly options: {
      store: DrawingStore;
      cursorOverlay: CursorOverlayController;
      overlayElement: HTMLElement;
      initialLastPointerPoint: Vec2;
      toPoint: (event: PointerEvent) => Vec2;
      onScheduleThumbnailSave: (delayMs: number) => void;
      perfSession: {
        begin: () => void;
        end: (frameCount: number) => void;
        onPointerMoveSamples: (
          sampleCount: number,
          usedCoalesced: boolean,
        ) => void;
      };
    },
  ) {
    this.lastPointerPoint = options.initialLastPointerPoint;
  }

  onRenderPass(): void {
    if (this.pointerIsDown) {
      this.drawingPerfFrameCount += 1;
    }
  }

  handlePointerDown(event: PointerEvent): void {
    if (this.pointerIsDown) {
      return;
    }
    event.preventDefault();
    this.options.cursorOverlay.handlePointerDown(event);
    this.pointerIsDown = true;
    this.activePointerId = event.pointerId;
    this.options.cursorOverlay.setDrawingActive(this.pointerIsDown);
    this.drawingPerfFrameCount = 0;
    this.options.perfSession.begin();
    this.lastPointerPoint = this.options.toPoint(event);
    this.options.store.dispatch("pointerDown", {
      point: this.lastPointerPoint,
      buttons: event.buttons,
    });
    this.options.overlayElement.setPointerCapture?.(event.pointerId);
  }

  handlePointerMove(event: PointerEventWithCoalesced): void {
    if (this.shouldIgnoreNonActivePointer(event)) {
      return;
    }
    this.options.cursorOverlay.handlePointerMove(event);
    const { samples, usedCoalesced } = this.getPointerMoveSamples(event);
    const pointerSamples = samples.map((sample) => ({
      point: this.options.toPoint(sample),
      buttons: sample.buttons,
      pressure: sample.pressure,
      shiftKey: sample.shiftKey,
      altKey: sample.altKey,
    }));
    const finalPoint = pointerSamples[pointerSamples.length - 1]?.point;
    if (finalPoint) {
      this.lastPointerPoint = finalPoint;
    }
    this.options.perfSession.onPointerMoveSamples(
      pointerSamples.length,
      usedCoalesced,
    );
    this.options.store.dispatchBatch("pointerMove", pointerSamples);
  }

  handlePointerRawUpdate(event: PointerEvent): void {
    if (this.shouldIgnoreNonActivePointer(event)) {
      return;
    }
    this.options.cursorOverlay.handlePointerRawUpdate(event);
  }

  handlePointerUp(event: PointerEvent): void {
    this.endPointerSession(event, "pointerUp");
  }

  handlePointerCancel(event: PointerEvent): void {
    this.endPointerSession(event, "pointerCancel");
  }

  forceCancelPointerSession(): void {
    if (!this.pointerIsDown) {
      return;
    }
    this.options.store.dispatch("pointerCancel", {
      point: this.lastPointerPoint,
      buttons: 0,
    });
    this.pointerIsDown = false;
    this.activePointerId = null;
    this.options.cursorOverlay.setDrawingActive(this.pointerIsDown);
    this.options.perfSession.end(this.drawingPerfFrameCount);
  }

  private endPointerSession(
    event: PointerEvent,
    type: PointerSessionEndType,
  ): void {
    if (!this.pointerIsDown) {
      return;
    }
    if (
      this.activePointerId !== null &&
      event.pointerId !== this.activePointerId
    ) {
      return;
    }
    this.lastPointerPoint = this.options.toPoint(event);
    const committedToolId = this.options.store.getActiveToolId();
    this.options.store.dispatch(type, {
      point: this.lastPointerPoint,
      buttons: event.buttons,
    });
    if (type === "pointerUp" && committedToolId?.startsWith("stamp.")) {
      this.options.cursorOverlay.playStampCommit(this.lastPointerPoint);
    }
    this.pointerIsDown = false;
    this.activePointerId = null;
    this.options.cursorOverlay.setDrawingActive(this.pointerIsDown);
    this.options.perfSession.end(this.drawingPerfFrameCount);
    if (type === "pointerUp") {
      this.options.overlayElement.releasePointerCapture?.(event.pointerId);
      this.options.onScheduleThumbnailSave(140);
    }
  }

  private getPointerMoveSamples(event: PointerEventWithCoalesced): {
    samples: PointerEvent[];
    usedCoalesced: boolean;
  } {
    const coalesced = event.getCoalescedEvents?.();
    const rawSamples =
      coalesced && coalesced.length > 0 ? coalesced : [event as PointerEvent];
    const cappedSamples =
      rawSamples.length > MAX_POINTER_SAMPLES_PER_EVENT
        ? rawSamples.slice(rawSamples.length - MAX_POINTER_SAMPLES_PER_EVENT)
        : rawSamples;
    const samples: PointerEvent[] = [];
    for (const sample of cappedSamples) {
      const previous = samples[samples.length - 1];
      if (
        previous &&
        previous.clientX === sample.clientX &&
        previous.clientY === sample.clientY
      ) {
        continue;
      }
      samples.push(sample);
    }
    if (samples.length === 0) {
      samples.push(event);
    }
    return {
      samples,
      usedCoalesced: Boolean(coalesced && coalesced.length > 0),
    };
  }

  private shouldIgnoreNonActivePointer(event: PointerEvent): boolean {
    if (!this.pointerIsDown || this.activePointerId === null) {
      return false;
    }
    return event.pointerId !== this.activePointerId;
  }
}

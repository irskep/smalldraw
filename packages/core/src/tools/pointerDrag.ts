import type { Point } from "../model/primitives";
import type { ToolEventHandler, ToolRuntime } from "./types";

export interface DragCallbacks<TState> {
  onStart: (
    point: Point,
    event: PointerDragEvent,
    runtime: ToolRuntime,
  ) => TState | null;
  onMove?: (
    state: TState,
    point: Point,
    event: PointerDragEvent,
    runtime: ToolRuntime,
  ) => void;
  onEnd?: (
    state: TState,
    point: Point,
    event: PointerDragEvent,
    runtime: ToolRuntime,
  ) => void;
  onCancel?: (state: TState | null, runtime: ToolRuntime) => void;
}

export interface PointerDragEvent {
  buttons: number;
  pressure?: number;
  shiftKey?: boolean;
  altKey?: boolean;
  handleId?: string;
}

export function createPointerDragHandler<TState>(
  runtime: ToolRuntime,
  callbacks: DragCallbacks<TState>,
): () => void {
  let dragState: TState | null = null;

  const handlePointerDown: ToolEventHandler = (event) => {
    if ((event.buttons ?? 0) & 1) {
      dragState = callbacks.onStart(event.point, event, runtime);
    }
  };

  const handlePointerMove: ToolEventHandler = (event) => {
    if (!dragState || !callbacks.onMove) return;
    callbacks.onMove(dragState, event.point, event, runtime);
  };

  const handlePointerUp: ToolEventHandler = (event) => {
    if (!dragState) return;
    callbacks.onEnd?.(dragState, event.point, event, runtime);
    dragState = null;
  };

  const handlePointerCancel: ToolEventHandler = () => {
    callbacks.onCancel?.(dragState, runtime);
    dragState = null;
  };

  const disposers: Array<() => void> = [];
  disposers.push(runtime.on("pointerDown", handlePointerDown));
  disposers.push(runtime.on("pointerMove", handlePointerMove));
  disposers.push(runtime.on("pointerUp", handlePointerUp));
  disposers.push(runtime.on("pointerCancel", handlePointerCancel));

  return () => {
    disposers.forEach((dispose) => dispose());
  };
}

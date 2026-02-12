import type { Box } from "@smalldraw/geometry";
import type { Vec2 } from "gl-matrix";
import type { UndoableAction } from "../actions";
import type { DrawingDocument } from "../model/document";
import type { AnyShape } from "../model/shape";

export type ToolEventName =
  | "pointerDown"
  | "pointerMove"
  | "pointerUp"
  | "pointerCancel"
  | "hover";

export interface ToolPointerEvent {
  point: Vec2;
  buttons: number;
  pressure?: number;
  shiftKey?: boolean;
  altKey?: boolean;
  handleId?: string;
}

export type ToolEventHandler = (event: ToolPointerEvent) => void;

export interface DraftShape extends AnyShape {
  toolId: string;
  temporary: true;
}

export interface SharedToolSettings {
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
}

export interface ToolPreview {
  dirtyBounds?: Box;
}

export interface SelectionState {
  ids: Set<string>;
  primaryId?: string;
}

export type ToolStyleElement = "strokeColor" | "strokeWidth" | "fillColor";

export interface ToolStyleSupport {
  strokeColor?: boolean;
  strokeWidth?: boolean;
  fillColor?: boolean;
  transparentStrokeColor?: boolean;
  transparentFillColor?: boolean;
}

export interface ToolRuntime {
  toolId: string;
  /** Register an event handler. Returns a disposer to detach the handler. */
  on(event: ToolEventName, handler: ToolEventHandler): () => void;
  /** Replace or clear the draft shape for this tool. */
  setDraft(shape: DraftShape | null): void;
  /** Replace or clear multiple draft shapes for this tool. */
  setDrafts(shapes: DraftShape[]): void;
  /** Forcefully clear any draft state for this tool. */
  clearDraft(): void;
  /** Set or clear tool preview hints for renderer hot paths. */
  setPreview(preview: ToolPreview | null): void;
  /** Get the latest preview hints for this tool. */
  getPreview(): ToolPreview | null;
  /** Queue an undoable action to mutate the document. */
  commit(action: UndoableAction): void;
  /** Helpers for generating ids and z-index keys. */
  generateShapeId(prefix?: string): string;
  getNextZIndex(): string;
  /** Access tool configuration or settings passed in by the host application. */
  getOptions<TOptions = Record<string, unknown>>(): TOptions | undefined;
  /** Access shared drawing settings (stroke color/width, fill color, etc.). */
  getSharedSettings<TSettings = SharedToolSettings>(): TSettings;
  updateSharedSettings<TSettings = SharedToolSettings>(
    updater: Partial<TSettings> | ((prev: TSettings) => TSettings),
  ): void;
  /** Access tool-specific state persisted across activations. */
  getToolState<TState = unknown>(): TState | undefined;
  setToolState<TState = unknown>(state: TState): void;
  updateToolState<TState = unknown>(
    updater: (prev: TState | undefined) => TState,
  ): void;
  clearToolState(): void;
  /** Selection helpers */
  getSelection(): SelectionState;
  setSelection(ids: Iterable<string>, primaryId?: string): void;
  toggleSelection(id: string): void;
  clearSelection(): void;
  isSelected(id: string): boolean;
  getShape(shapeId: string): AnyShape | undefined;
  getDocument(): DrawingDocument;
  getOrderedShapes(): AnyShape[];
  /** Get the shape handler registry for this drawing session */
  getShapeHandlers(): import("../model/shapeHandlers").ShapeHandlerRegistry;
  onEvent<TPayload>(
    type: ToolRuntimeEvent<TPayload>["type"],
    listener: (payload: TPayload) => void,
  ): () => void;
  emit<TPayload>(event: ToolRuntimeEvent<TPayload>): void;
}

export interface HandleDescriptor {
  id: string;
  position: { u: number; v: number };
  behavior: HandleBehavior;
  altBehavior?: HandleBehavior;
  shiftBehavior?: HandleBehavior;
}

export type HandleBehavior =
  | { type: "move" }
  | { type: "rotate" }
  | { type: "resize"; proportional?: boolean }
  | { type: "resize-axis"; axis: "x" | "y" };

export type ToolRuntimeEvent<TPayload = unknown> =
  | {
      type: "handles";
      payload: HandleDescriptor[];
    }
  | {
      type: "handle-hover";
      payload: { handleId: string | null; behavior: HandleBehavior | null };
    }
  | {
      type: "selection-frame";
      payload: Box | null;
    }
  | {
      type: "custom";
      payload: TPayload;
    };

export interface ToolDefinition {
  id: string;
  label: string;
  styleSupport?: ToolStyleSupport;
  // biome-ignore lint/suspicious/noConfusingVoidType: API conciseness
  activate(runtime: ToolRuntime): void | undefined | (() => void);
}

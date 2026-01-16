import type { Point, Bounds } from '../model/primitives';

export type { Bounds };
import type { Shape } from '../model/shape';
import type { UndoableAction } from '../actions';

export type ToolEventName =
  | 'pointerDown'
  | 'pointerMove'
  | 'pointerUp'
  | 'pointerCancel'
  | 'hover';

export interface ToolPointerEvent {
  point: Point;
  buttons: number;
  pressure?: number;
  shiftKey?: boolean;
  altKey?: boolean;
  handleId?: string;
}

export type ToolEventHandler = (event: ToolPointerEvent) => void;

export interface DraftShape extends Shape {
  toolId: string;
  temporary: true;
}

export interface SharedToolSettings {
  strokeColor: string;
  strokeWidth: number;
  fillColor: string;
}

export interface SelectionState {
  ids: Set<string>;
  primaryId?: string;
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
  getShape(shapeId: string): Shape | undefined;
  onEvent<TPayload>(
    type: ToolRuntimeEvent<TPayload>['type'],
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
  | { type: 'move' }
  | { type: 'rotate' }
  | { type: 'resize'; proportional?: boolean }
  | { type: 'resize-axis'; axis: 'x' | 'y' };

export type ToolRuntimeEvent<TPayload = unknown> = {
  type: 'handles';
  payload: HandleDescriptor[];
} | {
  type: 'handle-hover';
  payload: { handleId: string | null; behavior: HandleBehavior | null };
} | {
  type: 'selection-frame';
  payload: Bounds | null;
} | {
  type: 'custom';
  payload: TPayload;
};

export interface ToolDefinition {
  id: string;
  label: string;
  activate(runtime: ToolRuntime): void;
  deactivate?(runtime: ToolRuntime): void;
}

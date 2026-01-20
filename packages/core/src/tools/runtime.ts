import type { ActionContext, UndoableAction } from "../actions";
import type { DrawingDocument } from "../model/document";
import type { ShapeHandlerRegistry } from "../model/shapeHandlers";
import type { UndoManager } from "../undo";
import { getOrderedShapes, getZIndexBetween } from "../zindex";
import type {
  DraftShape,
  SelectionState,
  SharedToolSettings,
  ToolEventHandler,
  ToolEventName,
  ToolPointerEvent,
  ToolRuntime,
  ToolRuntimeEvent,
} from "./types";

interface ToolRuntimeConfig<TOptions = unknown> {
  toolId: string;
  document: DrawingDocument;
  undoManager: UndoManager;
  shapeHandlers: ShapeHandlerRegistry;
  options?: TOptions;
  onDraftChange?: (drafts: DraftShape[]) => void;
  sharedSettings?: SharedToolSettings;
  selectionState?: SelectionState;
  toolStates?: Map<string, unknown>;
}

export const DEFAULT_SHARED_SETTINGS: SharedToolSettings = {
  strokeColor: "#000000",
  strokeWidth: 2,
  fillColor: "#ffffff",
};

export class ToolRuntimeImpl<TOptions = unknown> implements ToolRuntime {
  public readonly toolId: string;
  private readonly document: DrawingDocument;
  private readonly undoManager: UndoManager;
  private readonly shapeHandlers: ShapeHandlerRegistry;
  private readonly options?: TOptions;
  private readonly onDraftChange?: (drafts: DraftShape[]) => void;
  private readonly toolStates: Map<string, unknown>;
  private readonly sharedSettings: SharedToolSettings;
  private readonly selectionState: SelectionState;
  private handlers = new Map<ToolEventName, Set<ToolEventHandler>>();
  private eventListeners = new Map<string, Set<(payload: unknown) => void>>();
  private drafts: DraftShape[] = [];
  private idCounter = 0;

  constructor(config: ToolRuntimeConfig<TOptions>) {
    this.toolId = config.toolId;
    this.shapeHandlers = config.shapeHandlers;
    this.document = config.document;
    this.undoManager = config.undoManager;
    this.options = config.options;
    this.onDraftChange = config.onDraftChange;
    this.toolStates = config.toolStates ?? new Map();
    this.sharedSettings = config.sharedSettings ?? {
      ...DEFAULT_SHARED_SETTINGS,
    };
    this.selectionState =
      config.selectionState ?? ({ ids: new Set<string>() } as SelectionState);
  }

  on(event: ToolEventName, handler: ToolEventHandler): () => void {
    const set = this.handlers.get(event) ?? new Set<ToolEventHandler>();
    set.add(handler);
    this.handlers.set(event, set);
    return () => {
      set.delete(handler);
      if (!set.size) {
        this.handlers.delete(event);
      }
    };
  }

  dispatch(event: ToolEventName, payload: ToolPointerEvent): void {
    this.handlers.get(event)?.forEach((handler) => {
      handler(payload);
    });
  }

  emit<TPayload>(event: ToolRuntimeEvent<TPayload>): void {
    const listeners = this.eventListeners.get(event.type);
    listeners?.forEach((listener) => {
      listener(event.payload);
    });
  }

  onEvent<TPayload>(
    type: ToolRuntimeEvent<TPayload>["type"],
    listener: (payload: TPayload) => void,
  ): () => void {
    const set =
      this.eventListeners.get(type) ?? new Set<(payload: unknown) => void>();
    set.add(listener as (payload: unknown) => void);
    this.eventListeners.set(type, set);
    return () => {
      set.delete(listener as (payload: unknown) => void);
      if (!set.size) {
        this.eventListeners.delete(type);
      }
    };
  }

  setDraft(shape: DraftShape | null): void {
    if (shape && shape.toolId !== this.toolId) {
      throw new Error(
        `Draft shape ${shape.id} toolId ${shape.toolId} does not match runtime ${this.toolId}`,
      );
    }
    this.drafts = shape ? [shape] : [];
    this.onDraftChange?.(this.drafts);
  }

  setDrafts(shapes: DraftShape[]): void {
    for (const shape of shapes) {
      if (shape.toolId !== this.toolId) {
        throw new Error(
          `Draft shape ${shape.id} toolId ${shape.toolId} does not match runtime ${this.toolId}`,
        );
      }
    }
    this.drafts = shapes;
    this.onDraftChange?.(this.drafts);
  }

  getDraft(): DraftShape | null {
    return this.drafts[0] ?? null;
  }

  clearDraft(): void {
    this.drafts = [];
    this.onDraftChange?.([]);
  }

  commit(action: UndoableAction): void {
    const ctx: ActionContext = { registry: this.shapeHandlers };
    this.undoManager.apply(action, this.document, ctx);
  }

  generateShapeId(prefix = "shape"): string {
    this.idCounter += 1;
    return `${prefix}-${this.idCounter}`;
  }

  getNextZIndex(): string {
    const ordered = getOrderedShapes(this.document);
    const last = ordered.length ? ordered[ordered.length - 1].zIndex : null;
    return getZIndexBetween(last, null);
  }

  getOptions<T = TOptions>(): T | undefined {
    return this.options as T | undefined;
  }

  getSharedSettings<T = SharedToolSettings>(): T {
    return { ...this.sharedSettings } as T;
  }

  updateSharedSettings<T = SharedToolSettings>(
    updater: Partial<T> | ((prev: T) => T),
  ): void {
    const current = { ...this.sharedSettings } as T;
    const next =
      typeof updater === "function"
        ? (updater(current) as Record<string, unknown>)
        : { ...current, ...(updater as Record<string, unknown>) };
    Object.assign(this.sharedSettings, next);
  }

  getToolState<TState = unknown>(): TState | undefined {
    return this.toolStates.get(this.toolId) as TState | undefined;
  }

  setToolState<TState = unknown>(state: TState): void {
    this.toolStates.set(this.toolId, state);
  }

  updateToolState<TState = unknown>(
    updater: (prev: TState | undefined) => TState,
  ): void {
    const next = updater(this.getToolState<TState>());
    this.setToolState(next);
  }

  clearToolState(): void {
    this.toolStates.delete(this.toolId);
  }

  getSelection(): SelectionState {
    return {
      ids: new Set(this.selectionState.ids),
      primaryId: this.selectionState.primaryId,
    };
  }

  setSelection(ids: Iterable<string>, primaryId?: string): void {
    this.selectionState.ids = new Set(ids);
    const ordered = Array.from(this.selectionState.ids);
    this.selectionState.primaryId =
      primaryId ?? (ordered.length ? ordered[ordered.length - 1] : undefined);
  }

  toggleSelection(id: string): void {
    if (this.selectionState.ids.has(id)) {
      this.selectionState.ids.delete(id);
      if (this.selectionState.primaryId === id) {
        const ordered = Array.from(this.selectionState.ids);
        this.selectionState.primaryId = ordered.length
          ? ordered[ordered.length - 1]
          : undefined;
      }
    } else {
      this.selectionState.ids.add(id);
      this.selectionState.primaryId = id;
    }
  }

  clearSelection(): void {
    this.selectionState.ids.clear();
    this.selectionState.primaryId = undefined;
  }

  isSelected(id: string): boolean {
    return this.selectionState.ids.has(id);
  }

  getShape(shapeId: string) {
    return this.document.shapes[shapeId];
  }

  getShapeHandlers(): ShapeHandlerRegistry {
    return this.shapeHandlers;
  }

  dispose(): void {
    this.handlers.clear();
    this.clearDraft();
    this.eventListeners.clear();
  }
}

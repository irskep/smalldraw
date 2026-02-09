import { change } from "@automerge/automerge/slim";
import type { Box } from "@smalldraw/geometry";
import type { ActionContext, UndoableAction } from "../actions";
import { filterShapesAfterClear } from "../model/clear";
import { createDocument, type DrawingDocument } from "../model/document";
import type { Shape } from "../model/shape";
import {
  getDefaultShapeHandlerRegistry,
  type ShapeHandlerRegistry,
} from "../model/shapeHandlers";
import { DEFAULT_SHARED_SETTINGS, ToolRuntimeImpl } from "../tools/runtime";
import type {
  DraftShape,
  HandleBehavior,
  HandleDescriptor,
  SelectionState,
  SharedToolSettings,
  ToolDefinition,
  ToolEventName,
  ToolPointerEvent,
  ToolPreview,
} from "../tools/types";
import { UndoManager } from "../undo";

export interface DrawingStoreOptions {
  document?: DrawingDocument;
  undoManager?: UndoManager;
  tools: ToolDefinition[];
  initialSharedSettings?: SharedToolSettings;
  onRenderNeeded?: () => void;
  onDocumentChanged?: (doc: DrawingDocument) => void;
  onAction?: (event: DrawingStoreActionEvent) => void;
  actionDispatcher?: (event: DrawingStoreActionEvent) => void;
  onUndoFailure?: (message: string) => void;
  shapeHandlers?: ShapeHandlerRegistry;
}

/** Result of consuming dirty state for incremental rendering. */
export interface DirtyState {
  /** Shape IDs that were modified and still exist. */
  dirty: Set<string>;
  /** Shape IDs that were deleted and no longer exist. */
  deleted: Set<string>;
}

export type DrawingStoreActionType = "apply" | "undo" | "redo";

export interface DrawingStoreActionEvent {
  type: DrawingStoreActionType;
  action: UndoableAction;
  doc: DrawingDocument;
}

export interface DrawingStoreAdapter {
  getDoc: () => DrawingDocument;
  applyAction: (event: DrawingStoreActionEvent) => void;
  subscribe: (listener: (doc: DrawingDocument) => void) => () => void;
}

export class DrawingStore {
  private document: DrawingDocument;
  private undoManager: UndoManager;
  private tools = new Map<string, ToolDefinition>();
  private sharedSettings: SharedToolSettings;
  private selectionState: SelectionState = { ids: new Set<string>() };
  private toolStates = new Map<string, unknown>();
  private activeToolId: string | null = null;
  private activeToolDeactivate?: () => void;
  private runtimes = new Map<string, ToolRuntimeImpl>();
  private handles: HandleDescriptor[] = [];
  private handleHover: {
    handleId: string | null;
    behavior: HandleBehavior | null;
  } = {
    handleId: null,
    behavior: null,
  };
  private selectionFrame: Box | null = null;

  // Dirty tracking for incremental rendering
  private dirtyShapeIds = new Set<string>();
  private deletedShapeIds = new Set<string>();

  // Cached ordered shapes for performance
  private orderedCache: Shape[] | null = null;

  // Callback invoked whenever rendering is needed
  private onRenderNeeded?: () => void;
  private onDocumentChanged?: (doc: DrawingDocument) => void;
  private onAction?: (event: DrawingStoreActionEvent) => void;
  private actionDispatcher?: (event: DrawingStoreActionEvent) => void;
  private onUndoFailure?: (message: string) => void;
  private renderBatchDepth = 0;
  private renderQueuedDuringBatch = false;

  // Shape handler registry
  private shapeHandlers: ShapeHandlerRegistry;

  // Action context for undo/redo
  private actionContext: ActionContext;

  constructor(options: DrawingStoreOptions) {
    this.shapeHandlers =
      options.shapeHandlers ?? getDefaultShapeHandlerRegistry();
    this.actionContext = {
      registry: this.shapeHandlers,
      change: (doc, update) => change(doc, update),
    };
    this.document =
      options.document ?? createDocument(undefined, this.shapeHandlers);
    this.undoManager = options.undoManager ?? new UndoManager();
    this.onRenderNeeded = options.onRenderNeeded;
    this.onDocumentChanged = options.onDocumentChanged;
    this.onAction = options.onAction;
    this.actionDispatcher = options.actionDispatcher;
    this.onUndoFailure = options.onUndoFailure;
    this.sharedSettings = options.initialSharedSettings ?? {
      ...DEFAULT_SHARED_SETTINGS,
    };
    for (const tool of options.tools) {
      this.tools.set(tool.id, tool);
    }
  }

  activateTool(toolId: string): void {
    if (this.activeToolId === toolId) return;
    this.deactivateActiveTool();
    const tool = this.tools.get(toolId);
    if (!tool) {
      throw new Error(`Tool ${toolId} not registered`);
    }
    const runtime = this.getOrCreateRuntime(toolId);
    this.activeToolId = toolId;
    this.activeToolDeactivate = tool.activate(runtime) ?? undefined;
    this.triggerRender();
  }

  dispatch(event: ToolEventName, payload: ToolPointerEvent) {
    if (!this.activeToolId) return;
    const runtime = this.runtimes.get(this.activeToolId);
    runtime?.dispatch(event, payload);
  }

  dispatchBatch(event: ToolEventName, payloads: ToolPointerEvent[]): void {
    if (!this.activeToolId || payloads.length === 0) return;
    const runtime = this.runtimes.get(this.activeToolId);
    if (!runtime) return;
    this.runWithBatchedRender(() => {
      for (const payload of payloads) {
        runtime.dispatch(event, payload);
      }
    });
  }

  getDrafts(): DraftShape[] {
    if (this.activeToolId) {
      const activeRuntime = this.runtimes.get(this.activeToolId);
      if (activeRuntime) {
        const drafts = activeRuntime.getDrafts();
        if (drafts.length) {
          return drafts;
        }
      }
    }
    return Array.from(this.runtimes.values()).flatMap((runtime) =>
      runtime.getDrafts(),
    );
  }

  getHandles(): HandleDescriptor[] {
    return this.handles;
  }

  getHandleHover(): {
    handleId: string | null;
    behavior: HandleBehavior | null;
  } {
    return this.handleHover;
  }

  getSelectionFrame(): Box | null {
    return this.selectionFrame;
  }

  getPreview(): ToolPreview | null {
    if (!this.activeToolId) {
      return null;
    }
    return this.runtimes.get(this.activeToolId)?.getPreview() ?? null;
  }

  private getOrCreateRuntime(toolId: string): ToolRuntimeImpl {
    let runtime = this.runtimes.get(toolId);
    if (runtime) {
      return runtime;
    }
    runtime = new ToolRuntimeImpl({
      toolId,
      getDocument: () => this.document,
      commitAction: (action) => this.mutateDocument(action),
      shapeHandlers: this.shapeHandlers,
      sharedSettings: this.sharedSettings,
      selectionState: this.selectionState,
      toolStates: this.toolStates,
      onDraftChange: () => {
        this.triggerRender();
      },
      onPreviewChange: () => {
        this.triggerRender();
      },
    });
    runtime.onEvent("handles", (payload: HandleDescriptor[]) => {
      if (this.activeToolId === toolId) {
        this.handles = payload;
        this.triggerRender();
      }
    });
    runtime.onEvent(
      "handle-hover",
      (payload: {
        handleId: string | null;
        behavior: HandleBehavior | null;
      }) => {
        if (this.activeToolId === toolId) {
          this.handleHover = payload;
          this.triggerRender();
        }
      },
    );
    runtime.onEvent("selection-frame", (payload: Box | null) => {
      if (this.activeToolId === toolId) {
        this.selectionFrame = payload;
        this.triggerRender();
      }
    });
    this.runtimes.set(toolId, runtime);
    return runtime;
  }

  private deactivateActiveTool(): void {
    if (!this.activeToolId) return;
    const currentId = this.activeToolId;
    const runtime = this.runtimes.get(currentId);
    this.activeToolDeactivate?.();
    this.activeToolDeactivate = undefined;
    // Canonical cleanup: The store is responsible for clearing tool state
    // between activations. Tools should not clear drafts in their deactivate
    // callbacks - the store handles it here to ensure clean state.
    // Note: Don't call runtime.dispose() here - we cache runtimes and their
    // DrawingStore event listeners should persist across tool switches.
    runtime?.clearDraft();
    runtime?.setPreview(null);
    this.handles = [];
    this.handleHover = { handleId: null, behavior: null };
    this.selectionFrame = null;
    this.activeToolId = null;
  }

  private triggerRender(): void {
    if (this.renderBatchDepth > 0) {
      this.renderQueuedDuringBatch = true;
      return;
    }
    this.onRenderNeeded?.();
  }

  private runWithBatchedRender(task: () => void): void {
    this.renderBatchDepth += 1;
    try {
      task();
    } finally {
      this.renderBatchDepth -= 1;
      if (this.renderBatchDepth === 0 && this.renderQueuedDuringBatch) {
        this.renderQueuedDuringBatch = false;
        this.onRenderNeeded?.();
      }
    }
  }

  setOnRenderNeeded(callback?: () => void): void {
    this.onRenderNeeded = callback;
  }

  setOnDocumentChanged(callback?: (doc: DrawingDocument) => void): void {
    this.onDocumentChanged = callback;
  }

  setOnAction(callback?: (event: DrawingStoreActionEvent) => void): void {
    this.onAction = callback;
  }

  setActionDispatcher(
    dispatcher?: (event: DrawingStoreActionEvent) => void,
  ): void {
    this.actionDispatcher = dispatcher;
  }

  applyAction(action: UndoableAction): void {
    this.mutateDocument(action);
  }

  applyDocument(nextDoc: DrawingDocument): void {
    const prevDoc = this.document;
    this.document = nextDoc;
    this.orderedCache = null;
    this.dirtyShapeIds = new Set(Object.keys(nextDoc.shapes));
    this.deletedShapeIds = new Set(
      Object.keys(prevDoc.shapes).filter((id) => !(id in nextDoc.shapes)),
    );
    this.onDocumentChanged?.(this.document);
    this.triggerRender();
  }

  resetToDocument(nextDoc: DrawingDocument): void {
    const prevDoc = this.document;
    this.document = nextDoc;
    this.undoManager.clear();
    this.orderedCache = null;
    this.dirtyShapeIds = new Set(Object.keys(nextDoc.shapes));
    this.deletedShapeIds = new Set(
      Object.keys(prevDoc.shapes).filter((id) => !(id in nextDoc.shapes)),
    );
    this.selectionState.ids.clear();
    this.selectionState.primaryId = undefined;
    this.handles = [];
    this.handleHover = { handleId: null, behavior: null };
    this.selectionFrame = null;
    for (const runtime of this.runtimes.values()) {
      runtime.clearDraft();
      runtime.setPreview(null);
    }
    this.onDocumentChanged?.(this.document);
    this.triggerRender();
  }

  mutateDocument(action: UndoableAction): void {
    if (this.actionDispatcher) {
      this.undoManager.record(action);
      this.actionDispatcher({ type: "apply", action, doc: this.document });
      this.triggerRender();
      return;
    }
    this.document = this.undoManager.apply(
      action,
      this.document,
      this.actionContext,
    );
    this.trackDirtyState(action);
    this.onAction?.({ type: "apply", action, doc: this.document });
    this.onDocumentChanged?.(this.document);
    this.triggerRender();
  }

  /**
   * Track dirty/deleted state based on action's affected shapes.
   * After an action, if a shape exists → dirty; if not → deleted.
   * Also invalidates the ordered cache when z-order might have changed.
   */
  private trackDirtyState(action: UndoableAction): void {
    // Invalidate ordered cache if action affects z-order
    if (action.affectsZOrder()) {
      this.orderedCache = null;
    }

    for (const id of action.affectedShapeIds()) {
      if (this.document.shapes[id]) {
        // Shape exists after action → it was modified
        this.dirtyShapeIds.add(id);
        this.deletedShapeIds.delete(id); // In case it was previously marked deleted
      } else {
        // Shape doesn't exist after action → it was deleted
        this.deletedShapeIds.add(id);
        this.dirtyShapeIds.delete(id); // No longer dirty, it's gone
      }
    }
  }

  /**
   * Consume and clear the dirty state. Call this before rendering to get
   * the set of shapes that need updating.
   */
  consumeDirtyState(): DirtyState {
    const result: DirtyState = {
      dirty: this.dirtyShapeIds,
      deleted: this.deletedShapeIds,
    };
    this.dirtyShapeIds = new Set();
    this.deletedShapeIds = new Set();
    return result;
  }

  /**
   * Get the complete render state including merged shapes and dirty tracking.
   * This is the recommended method for UIs to use for rendering.
   * Returns base document shapes merged with drafts, ordered by z-index,
   * with dirty state that includes draft IDs.
   */
  getRenderState(): { shapes: Shape[]; dirtyState: DirtyState } {
    // Merge base document with drafts
    const shapes: Record<string, Shape> = {};
    for (const shape of Object.values(this.document.shapes)) {
      shapes[shape.id] = shape;
    }
    const drafts = this.getDrafts();
    for (const draft of drafts) {
      const { temporary: _temp, toolId: _tool, ...shape } = draft;
      shapes[draft.id] = shape;
    }

    // Get ordered shapes
    const orderedShapes = Object.values(shapes).sort((a, b) => {
      if (a.zIndex === b.zIndex) return 0;
      return a.zIndex < b.zIndex ? -1 : 1;
    });
    const filteredShapes = filterShapesAfterClear(orderedShapes) as Shape[];

    // Get dirty state and mark drafts as dirty
    const dirtyState = this.consumeDirtyState();
    for (const draft of drafts) {
      dirtyState.dirty.add(draft.id);
    }

    return { shapes: filteredShapes, dirtyState };
  }

  getDocument(): DrawingDocument {
    return this.document;
  }

  /**
   * Get shapes sorted by z-index. Uses cached result when possible.
   * The cache is invalidated when shapes are added, deleted, or reordered.
   */
  getOrderedShapes(): Shape[] {
    if (!this.orderedCache) {
      const ordered = Object.values(this.document.shapes).sort((a, b) => {
        if (a.zIndex === b.zIndex) return 0;
        return a.zIndex < b.zIndex ? -1 : 1;
      });
      this.orderedCache = filterShapesAfterClear(ordered) as Shape[];
    }
    return this.orderedCache;
  }

  getActiveToolId(): string | null {
    return this.activeToolId;
  }

  getSharedSettings(): SharedToolSettings {
    return { ...this.sharedSettings };
  }

  updateSharedSettings<TSettings = SharedToolSettings>(
    updater: Partial<TSettings> | ((prev: TSettings) => TSettings),
  ): void {
    const current = { ...this.sharedSettings } as TSettings;
    const next =
      typeof updater === "function"
        ? updater(current)
        : { ...current, ...updater };
    Object.assign(this.sharedSettings, next);
    this.triggerRender();
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
    this.triggerRender();
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
      this.triggerRender();
      return;
    }
    this.selectionState.ids.add(id);
    this.selectionState.primaryId = id;
    this.triggerRender();
  }

  clearSelection(): void {
    this.selectionState.ids.clear();
    this.selectionState.primaryId = undefined;
    this.triggerRender();
  }

  undo(): boolean {
    if (this.actionDispatcher) {
      const action = this.undoManager.takeUndo();
      if (!action) {
        return false;
      }
      this.actionDispatcher({ type: "undo", action, doc: this.document });
      this.triggerRender();
      return true;
    }
    const outcome = this.undoManager.undo(this.document, this.actionContext);
    if (outcome.action) {
      this.document = outcome.doc;
      this.trackDirtyState(outcome.action);
      this.onAction?.({
        type: "undo",
        action: outcome.action,
        doc: this.document,
      });
      this.onDocumentChanged?.(this.document);
      this.triggerRender();
      return true;
    }
    if (outcome.error) {
      this.onUndoFailure?.(outcome.error);
      this.triggerRender();
    }
    return false;
  }

  redo(): boolean {
    if (this.actionDispatcher) {
      const action = this.undoManager.takeRedo();
      if (!action) {
        return false;
      }
      this.actionDispatcher({ type: "redo", action, doc: this.document });
      this.triggerRender();
      return true;
    }
    const outcome = this.undoManager.redo(this.document, this.actionContext);
    if (outcome.action) {
      this.document = outcome.doc;
      this.trackDirtyState(outcome.action);
      this.onAction?.({
        type: "redo",
        action: outcome.action,
        doc: this.document,
      });
      this.onDocumentChanged?.(this.document);
      this.triggerRender();
      return true;
    }
    if (outcome.error) {
      this.onUndoFailure?.(outcome.error);
      this.triggerRender();
    }
    return false;
  }

  canUndo(): boolean {
    return this.undoManager.canUndo();
  }

  canRedo(): boolean {
    return this.undoManager.canRedo();
  }

  getShapeHandlers(): ShapeHandlerRegistry {
    return this.shapeHandlers;
  }
}

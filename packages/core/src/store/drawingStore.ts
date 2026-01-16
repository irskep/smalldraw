import { AddShape, DeleteShape, UpdateShapeZIndex, type UndoableAction } from '../actions';
import { createDocument, type DrawingDocument } from '../model/document';
import type { Shape } from '../model/shape';
import { UndoManager } from '../undo';
import { ToolRuntimeImpl } from '../tools/runtime';
import type {
  DraftShape,
  HandleBehavior,
  HandleDescriptor,
  Bounds,
  SelectionState,
  SharedToolSettings,
  ToolDefinition,
  ToolEventName,
  ToolPointerEvent,
} from '../tools/types';

export interface DrawingStoreOptions {
  document?: DrawingDocument;
  undoManager?: UndoManager;
  tools: ToolDefinition[];
  initialSharedSettings?: SharedToolSettings;
}

/** Result of consuming dirty state for incremental rendering. */
export interface DirtyState {
  /** Shape IDs that were modified and still exist. */
  dirty: Set<string>;
  /** Shape IDs that were deleted and no longer exist. */
  deleted: Set<string>;
}

export class DrawingStore {
  private document: DrawingDocument;
  private undoManager: UndoManager;
  private tools = new Map<string, ToolDefinition>();
  private runtimeDrafts = new Map<string, DraftShape[]>();
  private sharedSettings: SharedToolSettings;
  private selectionState: SelectionState = { ids: new Set<string>() };
  private toolStates = new Map<string, unknown>();
  private activeToolId: string | null = null;
  private runtimes = new Map<string, ToolRuntimeImpl>();
  private handles: HandleDescriptor[] = [];
  private handleHover: { handleId: string | null; behavior: HandleBehavior | null } = {
    handleId: null,
    behavior: null,
  };
  private selectionFrame: Bounds | null = null;

  // Dirty tracking for incremental rendering
  private dirtyShapeIds = new Set<string>();
  private deletedShapeIds = new Set<string>();

  // Cached ordered shapes for performance
  private orderedCache: Shape[] | null = null;

  constructor(options: DrawingStoreOptions) {
    this.document = options.document ?? createDocument();
    this.undoManager = options.undoManager ?? new UndoManager();
    this.sharedSettings = options.initialSharedSettings ?? {
      strokeColor: '#000000',
      strokeWidth: 2,
      fillColor: '#ffffff',
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
    tool.activate(runtime);
  }

  dispatch(event: ToolEventName, payload: ToolPointerEvent) {
    if (!this.activeToolId) return;
    const runtime = this.runtimes.get(this.activeToolId);
    runtime?.dispatch(event, payload);
  }

  getDrafts(): DraftShape[] {
    return Array.from(this.runtimeDrafts.values()).flat();
  }

  getHandles(): HandleDescriptor[] {
    return this.handles;
  }

  getHandleHover(): { handleId: string | null; behavior: HandleBehavior | null } {
    return this.handleHover;
  }

  getSelectionFrame(): Bounds | null {
    return this.selectionFrame;
  }

  private getOrCreateRuntime(toolId: string): ToolRuntimeImpl {
    let runtime = this.runtimes.get(toolId);
    if (runtime) {
      return runtime;
    }
    runtime = new ToolRuntimeImpl({
      toolId,
      document: this.document,
      undoManager: this.undoManager,
      sharedSettings: this.sharedSettings,
      selectionState: this.selectionState,
      toolStates: this.toolStates,
      onDraftChange: (drafts) => {
        this.runtimeDrafts.set(toolId, drafts);
      },
    });
    runtime.onEvent('handles', (payload: HandleDescriptor[]) => {
      if (this.activeToolId === toolId) {
        this.handles = payload;
      }
    });
    runtime.onEvent('handle-hover', (payload: { handleId: string | null; behavior: HandleBehavior | null }) => {
      if (this.activeToolId === toolId) {
        this.handleHover = payload;
      }
    });
    runtime.onEvent('selection-frame', (payload: Bounds | null) => {
      if (this.activeToolId === toolId) {
        this.selectionFrame = payload;
      }
    });
    this.runtimes.set(toolId, runtime);
    return runtime;
  }

  private deactivateActiveTool(): void {
    if (!this.activeToolId) return;
    const currentId = this.activeToolId;
    const tool = this.tools.get(currentId);
    const runtime = this.runtimes.get(currentId);
    tool?.deactivate?.(runtime as ToolRuntimeImpl);
    // Note: Don't call runtime.dispose() here - we cache runtimes and their
    // DrawingStore event listeners should persist across tool switches.
    // The tool's deactivate() already cleans up its own handlers.
    runtime?.clearDraft();
    this.runtimeDrafts.set(currentId, []);
    this.handles = [];
    this.handleHover = { handleId: null, behavior: null };
    this.selectionFrame = null;
    this.activeToolId = null;
  }

  mutateDocument(action: UndoableAction): void {
    this.undoManager.apply(action, this.document);
    this.trackDirtyState(action);
  }

  /**
   * Track dirty/deleted state based on action's affected shapes.
   * After an action, if a shape exists → dirty; if not → deleted.
   * Also invalidates the ordered cache when z-order might have changed.
   */
  private trackDirtyState(action: UndoableAction): void {
    // Invalidate ordered cache if action affects z-order
    if (this.affectsZOrder(action)) {
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
   * Check if an action affects the z-order of shapes.
   * The ordered cache must be invalidated for these actions.
   */
  private affectsZOrder(action: UndoableAction): boolean {
    if (action instanceof AddShape) return true;
    if (action instanceof DeleteShape) return true;
    if (action instanceof UpdateShapeZIndex) return true;
    // CompositeAction: check children
    if ('actions' in action && Array.isArray((action as { actions: UndoableAction[] }).actions)) {
      return (action as { actions: UndoableAction[] }).actions.some((a) => this.affectsZOrder(a));
    }
    return false;
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

  getDocument(): DrawingDocument {
    return this.document;
  }

  /**
   * Get shapes sorted by z-index. Uses cached result when possible.
   * The cache is invalidated when shapes are added, deleted, or reordered.
   */
  getOrderedShapes(): Shape[] {
    if (!this.orderedCache) {
      this.orderedCache = Object.values(this.document.shapes).sort((a, b) => {
        if (a.zIndex === b.zIndex) return 0;
        return a.zIndex < b.zIndex ? -1 : 1;
      });
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
      typeof updater === 'function'
        ? (updater(current) as Record<string, unknown>)
        : { ...current, ...(updater as Record<string, unknown>) };
    Object.assign(this.sharedSettings, next);
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
      return;
    }
    this.selectionState.ids.add(id);
    this.selectionState.primaryId = id;
  }

  clearSelection(): void {
    this.selectionState.ids.clear();
    this.selectionState.primaryId = undefined;
  }

  undo(): boolean {
    const action = this.undoManager.undo(this.document);
    if (action) {
      this.trackDirtyState(action);
      return true;
    }
    return false;
  }

  redo(): boolean {
    const action = this.undoManager.redo(this.document);
    if (action) {
      this.trackDirtyState(action);
      return true;
    }
    return false;
  }

  canUndo(): boolean {
    return this.undoManager.canUndo();
  }

  canRedo(): boolean {
    return this.undoManager.canRedo();
  }
}

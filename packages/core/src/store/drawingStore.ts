import type { UndoableAction } from '../actions';
import { createDocument, type DrawingDocument } from '../model/document';
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
  }

  getDocument(): DrawingDocument {
    return this.document;
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
    return this.undoManager.undo(this.document);
  }

  redo(): boolean {
    return this.undoManager.redo(this.document);
  }

  canUndo(): boolean {
    return this.undoManager.canUndo();
  }

  canRedo(): boolean {
    return this.undoManager.canRedo();
  }
}

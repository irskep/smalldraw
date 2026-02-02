import {
  createPenTool,
  createRectangleTool,
  createSelectionTool,
  type DrawingDocument,
  DrawingStore,
  type ToolDefinition,
  type ToolPointerEvent,
} from "@smalldraw/core";
import {
  createStage,
  KonvaReconciler,
  reconcileDocument,
  type Viewport,
} from "@smalldraw/renderer-konva";
import { Vec2 } from "gl-matrix";
import { el, mount } from "redom";
import type { DrawingStoreAdapter } from "../store/storeAdapter";
import { updateCursor } from "../utils/cursorHelpers";
import { computeSelectionBounds } from "../utils/geometryHelpers";
import {
  buildLiveDocument,
  canShowAxisHandles,
  hitTestHandles,
  hitTestShapes,
  isPointInSelectionBounds,
} from "../utils/hitTesting";
import { buildToolEvent, getPointerPoint } from "../utils/pointerHandlers";
import { SelectionOverlay } from "./SelectionOverlay";
import { Toolbar } from "./Toolbar";

const DEFAULT_COLORS = [
  "#000000",
  "#ffffff",
  "#ff4b4b",
  "#1a73e8",
  "#ffcc00",
  "#00c16a",
  "#9c27b0",
];

export interface DrawingAppOptions {
  container: HTMLElement;
  width?: number;
  height?: number;
  backgroundColor?: string;
  palette?: string[];
  tools?: ToolDefinition[];
  storeAdapter?: DrawingStoreAdapter;
}

/**
 * Main DrawingApp component.
 */
export class DrawingApp {
  el: HTMLDivElement;
  store: DrawingStore;

  private toolbar: Toolbar;
  private canvasWrapper: HTMLDivElement;
  private stageContainer: HTMLDivElement;
  private overlay: HTMLDivElement;
  private selectionLayer: HTMLDivElement;
  private selectionOverlay: SelectionOverlay;
  private stage: ReturnType<typeof createStage>;
  private reconciler: KonvaReconciler;
  private viewport: Viewport;
  private storeSubscription?: () => void;
  private pointerHandlers: {
    down: (event: PointerEvent) => void;
    move: (event: PointerEvent) => void;
    up: (event: PointerEvent) => void;
    cancel: (event: PointerEvent) => void;
  };
  private lastPointerPoint: Vec2 | null = null;
  private lastPointerButtons = 0;
  private readonly modifierHandler: (event: KeyboardEvent) => void;

  constructor(options: DrawingAppOptions) {
    if (!options?.container) {
      throw new Error("container is required");
    }

    const width = options.width ?? 800;
    const height = options.height ?? 600;
    const palette = (
      options.palette?.length ? options.palette : DEFAULT_COLORS
    ).slice();
    const baseTools = options.tools ?? [
      createSelectionTool(),
      createRectangleTool(),
      createPenTool(),
    ];
    const tools = this.ensureSelectionTool(baseTools);
    const availableToolIds = new Set(tools.map((tool) => tool.id));
    const storeAdapter = options.storeAdapter;
    const initialDoc = storeAdapter?.getDoc();

    // Create root element
    this.el = el("div.smalldraw-app", {
      style: {
        display: "flex",
        "flex-direction": "column",
        gap: "8px",
        "font-family": "system-ui, sans-serif",
        "font-size": "14px",
        color: "#111111",
        "max-width": `${width}px`,
      },
    }) as HTMLDivElement;

    // Create canvas wrapper
    this.canvasWrapper = el("div.smalldraw-canvas-wrapper", {
      style: {
        position: "relative",
        width: `${width}px`,
        height: `${height}px`,
        border: "1px solid #d0d0d0",
        background: "#fdfdfd",
      },
    }) as HTMLDivElement;

    // Create stage container
    this.stageContainer = el("div.smalldraw-stage", {
      style: {
        width: "100%",
        height: "100%",
      },
    }) as HTMLDivElement;
    this.canvasWrapper.appendChild(this.stageContainer);

    // Create overlay
    this.overlay = el("div.smalldraw-overlay", {
      style: {
        position: "absolute",
        left: "0",
        top: "0",
        right: "0",
        bottom: "0",
        cursor: "default",
        "touch-action": "none",
      },
    }) as HTMLDivElement;
    this.canvasWrapper.appendChild(this.overlay);

    // Create selection layer
    this.selectionLayer = el("div.smalldraw-selection-layer", {
      style: {
        position: "absolute",
        left: "0",
        top: "0",
        right: "0",
        bottom: "0",
        "pointer-events": "none",
      },
    }) as HTMLDivElement;
    this.overlay.appendChild(this.selectionLayer);

    // Create selection overlay
    this.selectionOverlay = new SelectionOverlay(this.selectionLayer);

    // Setup viewport and Konva
    this.viewport = {
      width,
      height,
      scale: 1,
      center: new Vec2(width / 2, height / 2),
      backgroundColor: options.backgroundColor ?? "#ffffff",
    };
    this.stage = createStage({ container: this.stageContainer, width, height });
    this.reconciler = new KonvaReconciler();

    // Create store with render callback
    this.store = new DrawingStore({
      tools,
      document: initialDoc as DrawingDocument | undefined,
      onRenderNeeded: () => this.renderAll(),
      actionDispatcher: storeAdapter
        ? (event) => storeAdapter.applyAction(event)
        : undefined,
    });

    if (storeAdapter) {
      this.storeSubscription = storeAdapter.subscribe((doc) => {
        this.store.applyDocument(doc);
      });
    }

    // Create toolbar
    this.toolbar = new Toolbar(this.store, palette, tools, availableToolIds);

    // Assemble DOM structure
    this.el.appendChild(this.toolbar.el);
    this.el.appendChild(this.canvasWrapper);

    // Setup pointer handlers
    this.pointerHandlers = this.createPointerHandlers();
    this.overlay.addEventListener("pointerdown", this.pointerHandlers.down);
    this.overlay.addEventListener("pointermove", this.pointerHandlers.move);
    this.overlay.addEventListener("pointerup", this.pointerHandlers.up);
    this.overlay.addEventListener("pointercancel", this.pointerHandlers.cancel);
    this.overlay.addEventListener("pointerleave", this.pointerHandlers.cancel);

    this.modifierHandler = (event: KeyboardEvent) => {
      if (
        event.key !== "Shift" &&
        event.key !== "Alt" &&
        event.key !== "AltGraph"
      ) {
        return;
      }
      this.dispatchModifierSync(event);
    };
    window.addEventListener("keydown", this.modifierHandler);
    window.addEventListener("keyup", this.modifierHandler);

    // Mount to container
    mount(options.container, this.el);

    // Activate default tool and render initial state
    this.store.activateTool("selection");
  }

  private ensureSelectionTool(tools: ToolDefinition[]): ToolDefinition[] {
    const hasSelection = tools.some((tool) => tool.id === "selection");
    if (hasSelection) {
      return tools;
    }
    return [createSelectionTool(), ...tools];
  }

  private renderAll(): void {
    const { shapes, dirtyState } = this.store.getRenderState();
    reconcileDocument(this.stage, this.reconciler, shapes, dirtyState, {
      viewport: this.viewport,
    });
    this.updateSelectionOverlay();
    this.toolbar.update(this.store);
    updateCursor(this.overlay, this.store);
  }

  private updateSelectionOverlay(): void {
    const bounds =
      this.store.getSelectionFrame() ?? computeSelectionBounds(this.store);
    const showAxisHandles = canShowAxisHandles(this.store);
    const handles = this.store
      .getHandles()
      .filter(
        (handle) => showAxisHandles || handle.behavior?.type !== "resize-axis",
      );
    const liveDoc = buildLiveDocument(this.store);
    const selection = this.store.getSelection();
    const selectedId = selection.ids.size
      ? Array.from(selection.ids)[0]
      : selection.primaryId;
    const selectedShape = selectedId ? liveDoc.shapes[selectedId] : undefined;
    const registry = this.store.getShapeHandlers();
    this.selectionOverlay.update(bounds, handles, selectedShape, registry);
  }

  private createPointerHandlers() {
    return {
      down: (event: PointerEvent) => {
        event.preventDefault();
        const point = getPointerPoint(event, this.overlay);
        const payload = buildToolEvent(event, point);
        this.lastPointerPoint = point;
        this.lastPointerButtons = payload.buttons ?? 0;
        const activeTool = this.store.getActiveToolId();
        const selectionBefore = this.store.getSelection();
        console.log("[pointerDown] START", {
          point,
          activeTool,
          shiftKey: event.shiftKey,
          selectionBefore: {
            ids: Array.from(selectionBefore.ids),
            primaryId: selectionBefore.primaryId,
          },
        });
        if (activeTool === "selection") {
          const handleId = hitTestHandles(point, this.store);
          console.log("[pointerDown] hitTestHandles result:", handleId);
          if (handleId) {
            payload.handleId = handleId;
          } else {
            console.log("[pointerDown] calling updateSelectionForPoint");
            this.updateSelectionForPoint(point, event.shiftKey);
            const selectionAfter = this.store.getSelection();
            console.log(
              "[pointerDown] selection after updateSelectionForPoint:",
              {
                ids: Array.from(selectionAfter.ids),
                primaryId: selectionAfter.primaryId,
              },
            );
          }
        }
        try {
          this.overlay.setPointerCapture?.(event.pointerId ?? 0);
        } catch {
          // Pointer capture can fail with synthetic events or if pointer was released
        }
        console.log("[pointerDown] dispatching to tool with payload:", payload);
        this.store.dispatch("pointerDown", payload);
        console.log("[pointerDown] END");
      },

      move: (event: PointerEvent) => {
        const point = getPointerPoint(event, this.overlay);
        const payload = buildToolEvent(event, point);
        this.lastPointerPoint = point;
        this.lastPointerButtons = payload.buttons ?? 0;
        if (this.store.getActiveToolId() === "selection") {
          payload.handleId = hitTestHandles(point, this.store);
        }
        this.store.dispatch("pointerMove", payload);
      },

      up: (event: PointerEvent) => {
        const point = getPointerPoint(event, this.overlay);
        const payload = buildToolEvent(event, point, 0);
        this.lastPointerPoint = point;
        this.lastPointerButtons = 0;
        payload.handleId = undefined;
        try {
          this.overlay.releasePointerCapture?.(event.pointerId ?? 0);
        } catch {
          // Release can fail if pointer was never captured or already released
        }
        this.store.dispatch("pointerUp", payload);
      },

      cancel: (event: PointerEvent) => {
        const point = getPointerPoint(event, this.overlay);
        const payload = buildToolEvent(event, point, 0);
        this.lastPointerPoint = null;
        this.lastPointerButtons = 0;
        this.store.dispatch("pointerCancel", payload);
      },
    };
  }

  private dispatchModifierSync(event: KeyboardEvent): void {
    if (!this.lastPointerPoint) return;
    const payload: ToolPointerEvent = {
      point: this.lastPointerPoint,
      buttons: this.lastPointerButtons,
      shiftKey: event.shiftKey,
      altKey: event.altKey,
    };
    if (this.store.getActiveToolId() === "selection") {
      payload.handleId = hitTestHandles(this.lastPointerPoint, this.store);
    }
    this.store.dispatch("pointerMove", payload);
  }

  private updateSelectionForPoint(point: Vec2, additive: boolean): void {
    const selection = this.store.getSelection();
    console.log("[updateSelectionForPoint] START", {
      point,
      additive,
      selectionIds: Array.from(selection.ids),
      selectionSize: selection.ids.size,
    });

    // If clicking within current selection bounds, don't change selection (allow drag)
    if (selection.ids.size > 0 && !additive) {
      const inBounds = isPointInSelectionBounds(point, this.store);
      console.log(
        "[updateSelectionForPoint] checking if in selection bounds:",
        inBounds,
      );
      if (inBounds) {
        console.log(
          "[updateSelectionForPoint] EARLY RETURN - point is in selection bounds",
        );
        return;
      }
    }

    const hit = hitTestShapes(point, this.store);
    console.log(
      "[updateSelectionForPoint] hitTestShapes result:",
      hit?.id ?? null,
    );
    if (hit) {
      if (additive) {
        console.log(
          "[updateSelectionForPoint] toggling selection for:",
          hit.id,
        );
        this.store.toggleSelection(hit.id);
      } else {
        console.log("[updateSelectionForPoint] setting selection to:", hit.id);
        this.store.setSelection([hit.id], hit.id);
      }
      return;
    }
    if (!additive) {
      console.log(
        "[updateSelectionForPoint] clearing selection (clicked empty space)",
      );
      this.store.clearSelection();
    }
  }

  resize(nextWidth: number, nextHeight: number): void {
    this.viewport.width = nextWidth;
    this.viewport.height = nextHeight;
    this.viewport.center = new Vec2(nextWidth / 2, nextHeight / 2);
    this.stage.width(nextWidth);
    this.stage.height(nextHeight);
    this.canvasWrapper.style.width = `${nextWidth}px`;
    this.canvasWrapper.style.height = `${nextHeight}px`;
    this.el.style.maxWidth = `${nextWidth}px`;
    this.renderAll();
  }

  destroy(): void {
    this.storeSubscription?.();
    this.storeSubscription = undefined;
    this.overlay.removeEventListener("pointerdown", this.pointerHandlers.down);
    this.overlay.removeEventListener("pointermove", this.pointerHandlers.move);
    this.overlay.removeEventListener("pointerup", this.pointerHandlers.up);
    this.overlay.removeEventListener(
      "pointercancel",
      this.pointerHandlers.cancel,
    );
    this.overlay.removeEventListener(
      "pointerleave",
      this.pointerHandlers.cancel,
    );
    this.toolbar.unmount();
    this.reconciler.clear();
    this.stage.destroy();
    this.el.remove();
  }
}

import {
  type Bounds,
  type HandleDescriptor,
  resolveSelectionHandlePoint,
  type Shape,
  type ShapeHandlerRegistry,
} from "@smalldraw/core";
import { el } from "redom";

const HANDLE_SIZE = 8;

/**
 * SelectionOverlay manages the DOM elements for selection frame and handles.
 * It maintains a cache of DOM elements and updates them incrementally instead
 * of rebuilding from scratch on every render.
 */
export class SelectionOverlay {
  el: HTMLElement;
  private frameEl: HTMLDivElement | null = null;
  private handleEls = new Map<string, HTMLDivElement>();

  constructor(container: HTMLElement) {
    this.el = container;
  }

  /**
   * Update the overlay with new bounds and handles.
   * Only modifies DOM elements that actually changed.
   */
  update(
    bounds: Bounds | null,
    handles: HandleDescriptor[],
    shape?: Shape,
    registry?: ShapeHandlerRegistry,
  ): void {
    if (!bounds) {
      this.clear();
      return;
    }

    // Update or create frame
    this.updateFrame(bounds);

    // Track current handle IDs
    const currentIds = new Set(handles.map((h) => h.id));

    // Remove handles that no longer exist
    for (const [id, handleEl] of this.handleEls) {
      if (!currentIds.has(id)) {
        handleEl.remove();
        this.handleEls.delete(id);
      }
    }

    // Update or create handles
    const rotation = shape?.transform?.rotation ?? 0;
    for (const handle of handles) {
      this.updateHandle(handle, bounds, shape, rotation, registry);
    }
  }

  /**
   * Clear all overlay elements.
   */
  clear(): void {
    if (this.frameEl) {
      this.frameEl.remove();
      this.frameEl = null;
    }
    for (const handleEl of this.handleEls.values()) {
      handleEl.remove();
    }
    this.handleEls.clear();
  }

  /**
   * Update or create the selection frame element.
   */
  private updateFrame(bounds: Bounds): void {
    if (!this.frameEl) {
      this.frameEl = el("div.smalldraw-selection-frame", {
        style: {
          position: "absolute",
          border: "1px dashed #4a90e2",
          background: "rgba(74, 144, 226, 0.05)",
          "pointer-events": "none",
        },
      }) as HTMLDivElement;
      this.el.appendChild(this.frameEl);
    }

    // Only update style properties (no DOM structure change)
    Object.assign(this.frameEl.style, {
      left: `${bounds.minX}px`,
      top: `${bounds.minY}px`,
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
    });
  }

  /**
   * Update or create a handle element.
   */
  private updateHandle(
    handle: HandleDescriptor,
    bounds: Bounds,
    shape: Shape | undefined,
    rotation: number,
    registry: ShapeHandlerRegistry | undefined,
  ): void {
    const point =
      registry && shape
        ? resolveSelectionHandlePoint(bounds, handle, shape, registry)
        : {
            x: bounds.minX + bounds.width * handle.position.u,
            y: bounds.minY + bounds.height * handle.position.v,
          };
    const axisHandle = handle.behavior?.type === "resize-axis";
    const axis =
      handle.behavior?.type === "resize-axis" ? handle.behavior.axis : null;

    let handleEl = this.handleEls.get(handle.id);
    if (!handleEl) {
      handleEl = this.createHandleElement(handle.id, axisHandle, axis);
      this.handleEls.set(handle.id, handleEl);
      this.el.appendChild(handleEl);
    }

    // Update position (only style changes, no DOM structure)
    this.updateHandlePosition(handleEl, point, axisHandle, axis, rotation);
  }

  /**
   * Create a new handle DOM element.
   */
  private createHandleElement(
    id: string,
    axisHandle: boolean,
    axis: string | null,
  ): HTMLDivElement {
    const size = axisHandle
      ? axis === "x"
        ? { width: 6, height: 12 }
        : { width: 12, height: 6 }
      : { width: HANDLE_SIZE, height: HANDLE_SIZE };

    const handleEl = el("div.smalldraw-handle", {
      style: {
        position: "absolute",
        width: `${size.width}px`,
        height: `${size.height}px`,
        background: axisHandle ? "#4a90e2" : "#ffffff",
        border: axisHandle ? "1px solid #2c6db2" : "1px solid #4a90e2",
        "border-radius": axisHandle ? "2px" : "0px",
        "pointer-events": "none",
      },
    }) as HTMLDivElement;
    handleEl.dataset.handle = id;

    return handleEl;
  }

  /**
   * Update a handle's position without recreating it.
   */
  private updateHandlePosition(
    handleEl: HTMLDivElement,
    point: { x: number; y: number },
    axisHandle: boolean,
    axis: string | null,
    rotation: number,
  ): void {
    const size = axisHandle
      ? axis === "x"
        ? { width: 6, height: 12 }
        : { width: 12, height: 6 }
      : { width: HANDLE_SIZE, height: HANDLE_SIZE };

    const axisRotation =
      axisHandle && axis
        ? axis === "x"
          ? rotation
          : rotation + Math.PI / 2
        : null;

    const left = axisHandle ? `${point.x}px` : `${point.x - size.width / 2}px`;
    const top = axisHandle ? `${point.y}px` : `${point.y - size.height / 2}px`;
    const transform =
      axisHandle && axisRotation !== null
        ? `translate(-50%, -50%) rotate(${(axisRotation * 180) / Math.PI}deg)`
        : "";

    Object.assign(handleEl.style, {
      left,
      top,
      transform,
    });
  }

}

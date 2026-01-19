import type {
  Bounds,
  HandleDescriptor,
  RectGeometry,
  Shape,
} from "@smalldraw/core";

/** Size of corner handles in pixels */
const HANDLE_SIZE = 8;

/**
 * SelectionOverlay manages the DOM elements for selection frame and handles.
 * It maintains a cache of DOM elements and updates them incrementally instead
 * of rebuilding from scratch on every render.
 */
export class SelectionOverlay {
  private container: HTMLElement;
  private frameEl: HTMLDivElement | null = null;
  private handleEls = new Map<string, HTMLDivElement>();

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /**
   * Update the overlay with new bounds and handles.
   * Only modifies DOM elements that actually changed.
   */
  update(
    bounds: Bounds | null,
    handles: HandleDescriptor[],
    shape?: Shape,
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
    for (const [id, el] of this.handleEls) {
      if (!currentIds.has(id)) {
        el.remove();
        this.handleEls.delete(id);
      }
    }

    // Update or create handles
    const rotation = shape?.transform?.rotation ?? 0;
    for (const handle of handles) {
      this.updateHandle(handle, bounds, shape, rotation);
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
    for (const el of this.handleEls.values()) {
      el.remove();
    }
    this.handleEls.clear();
  }

  /**
   * Update or create the selection frame element.
   */
  private updateFrame(bounds: Bounds): void {
    if (!this.frameEl) {
      this.frameEl = document.createElement("div");
      this.frameEl.className = "smalldraw-selection-frame";
      Object.assign(this.frameEl.style, {
        position: "absolute",
        border: "1px dashed #4a90e2",
        background: "rgba(74, 144, 226, 0.05)",
        pointerEvents: "none",
      });
      this.container.appendChild(this.frameEl);
    }

    // Only update style properties (no DOM structure change)
    this.frameEl.style.left = `${bounds.minX}px`;
    this.frameEl.style.top = `${bounds.minY}px`;
    this.frameEl.style.width = `${bounds.width}px`;
    this.frameEl.style.height = `${bounds.height}px`;
  }

  /**
   * Update or create a handle element.
   */
  private updateHandle(
    handle: HandleDescriptor,
    bounds: Bounds,
    shape: Shape | undefined,
    rotation: number,
  ): void {
    const point = this.resolveHandlePoint(bounds, handle, shape);
    const axisHandle = handle.behavior?.type === "resize-axis";
    const axis =
      handle.behavior?.type === "resize-axis" ? handle.behavior.axis : null;

    let el = this.handleEls.get(handle.id);
    if (!el) {
      el = this.createHandleElement(handle.id, axisHandle, axis);
      this.handleEls.set(handle.id, el);
      this.container.appendChild(el);
    }

    // Update position (only style changes, no DOM structure)
    this.updateHandlePosition(el, point, axisHandle, axis, rotation);
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

    const el = document.createElement("div");
    el.className = "smalldraw-handle";
    el.dataset.handle = id;

    Object.assign(el.style, {
      position: "absolute",
      width: `${size.width}px`,
      height: `${size.height}px`,
      background: axisHandle ? "#4a90e2" : "#ffffff",
      border: axisHandle ? "1px solid #2c6db2" : "1px solid #4a90e2",
      borderRadius: axisHandle ? "2px" : "0px",
      pointerEvents: "none",
    });

    return el;
  }

  /**
   * Update a handle's position without recreating it.
   */
  private updateHandlePosition(
    el: HTMLDivElement,
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

    el.style.left = axisHandle
      ? `${point.x}px`
      : `${point.x - size.width / 2}px`;
    el.style.top = axisHandle
      ? `${point.y}px`
      : `${point.y - size.height / 2}px`;
    el.style.transform =
      axisHandle && axisRotation !== null
        ? `translate(-50%, -50%) rotate(${(axisRotation * 180) / Math.PI}deg)`
        : "";
  }

  /**
   * Resolve a handle's screen position based on bounds and shape.
   */
  private resolveHandlePoint(
    bounds: Bounds,
    handle: HandleDescriptor,
    shape?: Shape,
  ): { x: number; y: number } {
    if (
      handle.behavior?.type === "resize-axis" &&
      shape?.geometry.type === "rect"
    ) {
      const point = this.resolveAxisHandlePoint(handle.id, shape);
      if (point) return point;
    }
    return {
      x: bounds.minX + bounds.width * handle.position.u,
      y: bounds.minY + bounds.height * handle.position.v,
    };
  }

  /**
   * Resolve position for axis handles on rectangles.
   */
  private resolveAxisHandlePoint(
    handleId: string,
    shape: Shape,
  ): { x: number; y: number } | null {
    if (shape.geometry.type !== "rect") return null;
    const rectGeometry = shape.geometry as RectGeometry;

    const halfWidth = rectGeometry.size.width / 2;
    const halfHeight = rectGeometry.size.height / 2;

    let local: { x: number; y: number } | null = null;
    switch (handleId) {
      case "mid-right":
        local = { x: halfWidth, y: 0 };
        break;
      case "mid-left":
        local = { x: -halfWidth, y: 0 };
        break;
      case "mid-top":
        local = { x: 0, y: -halfHeight };
        break;
      case "mid-bottom":
        local = { x: 0, y: halfHeight };
        break;
      default:
        return null;
    }

    return applyTransformToPoint(local, shape.transform);
  }
}

/**
 * Apply a shape's transform to a local point.
 */
function applyTransformToPoint(
  point: { x: number; y: number },
  transform?: {
    translation?: { x: number; y: number };
    rotation?: number;
    scale?: { x: number; y: number };
  },
): { x: number; y: number } {
  const translation = transform?.translation ?? { x: 0, y: 0 };
  const rotation = transform?.rotation ?? 0;
  const scale = transform?.scale ?? { x: 1, y: 1 };

  // Scale
  const scaled = { x: point.x * scale.x, y: point.y * scale.y };

  // Rotate
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const rotated = {
    x: scaled.x * cos - scaled.y * sin,
    y: scaled.x * sin + scaled.y * cos,
  };

  // Translate
  return {
    x: rotated.x + translation.x,
    y: rotated.y + translation.y,
  };
}

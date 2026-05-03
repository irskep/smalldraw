import { el } from "redom";

type Axis = "horizontal" | "vertical" | "both";

/**
 * 2D resize handle that wraps a target element with draggable edges.
 * Right edge resizes horizontally, bottom edge vertically, corner does both.
 */
export class ResizeHandle {
  private target: HTMLElement | null = null;
  private dragging: Axis | null = null;
  private startX = 0;
  private startY = 0;
  private startWidth = 0;
  private startHeight = 0;

  private readonly rightGrip: HTMLDivElement;
  private readonly bottomGrip: HTMLDivElement;
  private readonly cornerGrip: HTMLDivElement;
  private wrapper: HTMLDivElement | null = null;

  constructor() {
    this.rightGrip = el("div.ds-resize-handle__right") as HTMLDivElement;
    this.bottomGrip = el("div.ds-resize-handle__bottom") as HTMLDivElement;
    this.cornerGrip = el("div.ds-resize-handle__corner") as HTMLDivElement;

    this.rightGrip.addEventListener("pointerdown", (e) =>
      this.onPointerDown(e, "horizontal"),
    );
    this.bottomGrip.addEventListener("pointerdown", (e) =>
      this.onPointerDown(e, "vertical"),
    );
    this.cornerGrip.addEventListener("pointerdown", (e) =>
      this.onPointerDown(e, "both"),
    );
  }

  wrap(target: HTMLElement): HTMLElement {
    this.target = target;
    this.wrapper = el(
      "div.ds-resize-handle__wrapper",
      target,
      this.rightGrip,
      this.bottomGrip,
      this.cornerGrip,
    ) as HTMLDivElement;
    return this.wrapper;
  }

  private onPointerDown = (e: PointerEvent, axis: Axis): void => {
    if (!this.target) return;
    e.preventDefault();
    const grip = e.currentTarget as HTMLElement;
    this.dragging = axis;
    this.startX = e.clientX;
    this.startY = e.clientY;
    const rect = this.target.getBoundingClientRect();
    this.startWidth = rect.width;
    this.startHeight = rect.height;
    grip.setPointerCapture(e.pointerId);
    this.wrapper?.classList.add("is-dragging");
    grip.addEventListener("pointermove", this.onPointerMove);
    grip.addEventListener("pointerup", this.onPointerUp);
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging || !this.target) return;
    if (this.dragging === "horizontal" || this.dragging === "both") {
      const dx = e.clientX - this.startX;
      this.target.style.width = `${this.startWidth + dx}px`;
    }
    if (this.dragging === "vertical" || this.dragging === "both") {
      const dy = e.clientY - this.startY;
      this.target.style.height = `${this.startHeight + dy}px`;
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    const grip = e.currentTarget as HTMLElement;
    this.dragging = null;
    this.wrapper?.classList.remove("is-dragging");
    grip.releasePointerCapture(e.pointerId);
    grip.removeEventListener("pointermove", this.onPointerMove);
    grip.removeEventListener("pointerup", this.onPointerUp);
  };
}

export function createResizeHandle(): ResizeHandle {
  return new ResizeHandle();
}

import { el, type RedomElement } from "redom";

/**
 * Individual tool button component.
 */
export class ToolButton {
  el: HTMLButtonElement;
  private toolId: string;

  constructor(toolId: string, label: string, onClick: () => void) {
    this.toolId = toolId;
    this.el = el("button", {
      type: "button",
      onclick: onClick,
    }) as HTMLButtonElement;
    this.el.textContent = label;
    this.el.dataset.tool = toolId;
  }

  update(activeToolId: string | null): void {
    if (this.toolId === activeToolId) {
      this.el.disabled = true;
      this.el.style.fontWeight = "600";
    } else {
      this.el.disabled = false;
      this.el.style.fontWeight = "400";
    }
  }

  unmount(): void {
    // No event listeners to clean up - using onclick attribute
  }
}

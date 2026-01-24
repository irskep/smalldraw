import { el } from "redom";

/**
 * Individual color swatch button.
 */
export class ColorSwatch {
  el: HTMLButtonElement;
  private color: string;

  constructor(color: string, onSelect: (color: string) => void) {
    this.color = color;
    this.el = el("button", {
      type: "button",
      onclick: () => onSelect(color),
    }) as HTMLButtonElement;
    this.el.dataset.color = color;
    Object.assign(this.el.style, {
      width: "20px",
      height: "20px",
      border: "1px solid #bbbbbb",
      background: color,
      padding: "0",
    });
  }

  update(activeColor: string): void {
    if (this.color.toLowerCase() === activeColor.toLowerCase()) {
      this.el.style.outline = "2px solid #333333";
    } else {
      this.el.style.outline = "none";
    }
  }

  unmount(): void {
    // No event listeners to clean up - using onclick attribute
  }
}

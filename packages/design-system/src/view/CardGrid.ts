import "./CardGrid.css";

import { setChildren } from "redom";
import type { ReDomLike } from "./ReDomLike";
import { type ReDomChild } from "./redomChildren";

export interface CardGridOptions {
  className?: string;
  itemMinWidth?: string;
  ariaLabel?: string;
}

export class CardGrid implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;

  constructor(options: CardGridOptions = {}) {
    this.el = document.createElement("div");
    this.el.className = "ds-card-grid";
    if (options.className) {
      this.el.classList.add(...options.className.split(/\s+/).filter(Boolean));
    }
    if (options.itemMinWidth) {
      this.setItemMinWidth(options.itemMinWidth);
    }
    if (options.ariaLabel) {
      this.el.setAttribute("aria-label", options.ariaLabel);
    }
  }

  setItems(items: readonly ReDomChild[]): void {
    setChildren(this.el, [...items]);
  }

  setItemMinWidth(value: string): void {
    this.el.style.setProperty("--ds-card-grid-item-min-width", value);
  }
}

export function createCardGrid(options?: CardGridOptions): CardGrid {
  return new CardGrid(options);
}

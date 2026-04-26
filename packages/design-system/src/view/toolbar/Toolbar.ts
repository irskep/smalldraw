import "./Toolbar.css";

import { el } from "redom";
import type { ReDomLike } from "../ReDomLike";

export type ToolbarOrientation = "horizontal" | "vertical";

export interface ToolbarOptions {
  orientation?: ToolbarOrientation;
  className?: string;
}

export class Toolbar implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;

  constructor(options: ToolbarOptions = {}) {
    this.el = el("div.ds-toolbar") as HTMLDivElement;
    this.setOrientation(options.orientation ?? "horizontal");
    for (const cls of (options.className ?? "").split(/\s+/)) {
      if (cls) this.el.classList.add(cls);
    }
  }

  setOrientation(orientation: ToolbarOrientation): void {
    this.el.setAttribute("data-orientation", orientation);
  }
}

export function createToolbar(options?: ToolbarOptions): Toolbar {
  return new Toolbar(options);
}

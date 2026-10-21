import { el, mount } from "redom";

import "./ProgressBar.css";

/** Omit value until the amount of work is known; values are fractions from 0 to 1. */
export class ProgressBar {
  readonly el = el("div.ds-progress-bar", {
    role: "progressbar",
  }) as HTMLDivElement;
  private readonly fill = el("span.ds-progress-bar__fill") as HTMLSpanElement;

  constructor() {
    mount(this.el, this.fill);
  }

  update({ label, value }: { label: string; value?: number }): void {
    this.el.setAttribute("aria-label", label);
    this.el.dataset.indeterminate = value === undefined ? "true" : "false";
    if (value === undefined) {
      this.el.removeAttribute("aria-valuenow");
      this.fill.style.width = "";
    } else {
      const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);
      this.el.setAttribute("aria-valuenow", String(percent));
      this.fill.style.width = `${percent}%`;
    }
  }
}

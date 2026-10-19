import { el, setChildren } from "redom";
import type { ReDomLike } from "./ReDomLike";
import { renderIcon } from "./renderIcon";
import type { IconButtonSource } from "./SquareIconButton";

export interface ToolStatePreviewModel {
  icon: IconButtonSource;
  accessibleName: string;
  color?: string;
}

export class ToolStatePreview
  implements ReDomLike<HTMLDivElement, ToolStatePreviewModel | null>
{
  readonly el = el("div.ds-tool-state-preview", {
    role: "img",
    hidden: true,
  }) as HTMLDivElement;

  update(model: ToolStatePreviewModel | null): void {
    this.el.hidden = model === null;
    if (!model) {
      setChildren(this.el, []);
      this.el.removeAttribute("aria-label");
      return;
    }
    this.el.setAttribute("aria-label", model.accessibleName);
    this.el.style.color = model.color ?? "";
    setChildren(this.el, [
      "kind" in model.icon
        ? el("img", { src: model.icon.src, alt: "", draggable: "false" })
        : renderIcon(model.icon),
    ]);
  }
}

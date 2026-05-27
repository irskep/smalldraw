import "./ThumbnailTile.css";

import type { IconNode } from "lucide";
import { setChildren } from "redom";
import type { ReDomLike } from "./ReDomLike";
import { type ReDomChild, toReDomChildren } from "./redomChildren";
import { renderIcon } from "./renderIcon";

type ThumbnailAction = {
  label: string;
  icon?: IconNode;
  onPress: (() => void) | null;
  disabled?: boolean;
  hidden?: boolean;
};

export class ThumbnailTile implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;

  #open: HTMLButtonElement;
  #media: HTMLDivElement;
  #badge: HTMLSpanElement;
  #action: HTMLButtonElement;
  #secondaryAction: HTMLButtonElement;
  #openPointerDownHandler: ((event: PointerEvent) => void) | null = null;
  #openPointerUpHandler: ((event: PointerEvent) => void) | null = null;
  #openPointerCancelHandler: ((event: PointerEvent) => void) | null = null;
  #openPointerLeaveHandler: ((event: PointerEvent) => void) | null = null;

  constructor() {
    this.#media = document.createElement("div");
    this.#media.className = "ds-thumbnail-tile__media";
    this.#open = document.createElement("button");
    this.#open.className = "ds-thumbnail-tile__open";
    this.#open.type = "button";
    this.#open.append(this.#media);
    this.#badge = document.createElement("span");
    this.#badge.className = "ds-thumbnail-tile__badge";
    this.#action = document.createElement("button");
    this.#action.className = "ds-thumbnail-tile__action";
    this.#action.type = "button";
    this.#secondaryAction = document.createElement("button");
    this.#secondaryAction.className = "ds-thumbnail-tile__secondary-action";
    this.#secondaryAction.type = "button";
    this.el = document.createElement("div");
    this.el.className = "ds-thumbnail-tile";
    this.el.append(
      this.#open,
      this.#badge,
      this.#secondaryAction,
      this.#action,
    );
    this.#badge.hidden = true;
    this.#action.hidden = true;
    this.#secondaryAction.hidden = true;
  }

  setMedia(children: ReDomChild | readonly ReDomChild[] | null): void {
    setChildren(this.#media, toReDomChildren(children));
  }

  setCurrent(current: boolean): void {
    this.el.dataset.current = current ? "true" : "false";
  }

  setOpenLabel(label: string): void {
    this.#open.setAttribute("aria-label", label);
    this.#open.title = label;
  }

  setOpenTitle(title: string): void {
    this.#open.title = title;
  }

  setOpenDisabled(disabled: boolean): void {
    this.#open.disabled = disabled;
  }

  setOnOpen(handler: (() => void) | null): void {
    this.#open.onclick = handler;
  }

  setOnOpenPointerDown(handler: ((event: PointerEvent) => void) | null): void {
    if (this.#openPointerDownHandler) {
      this.#open.removeEventListener(
        "pointerdown",
        this.#openPointerDownHandler,
      );
      this.#openPointerDownHandler = null;
    }
    if (!handler) {
      return;
    }
    this.#openPointerDownHandler = handler;
    this.#open.addEventListener("pointerdown", handler);
  }

  setOnOpenPointerUp(handler: ((event: PointerEvent) => void) | null): void {
    if (this.#openPointerUpHandler) {
      this.#open.removeEventListener("pointerup", this.#openPointerUpHandler);
      this.#openPointerUpHandler = null;
    }
    if (!handler) {
      return;
    }
    this.#openPointerUpHandler = handler;
    this.#open.addEventListener("pointerup", handler);
  }

  setOnOpenPointerCancel(
    handler: ((event: PointerEvent) => void) | null,
  ): void {
    if (this.#openPointerCancelHandler) {
      this.#open.removeEventListener(
        "pointercancel",
        this.#openPointerCancelHandler,
      );
      this.#openPointerCancelHandler = null;
    }
    if (!handler) {
      return;
    }
    this.#openPointerCancelHandler = handler;
    this.#open.addEventListener("pointercancel", handler);
  }

  setOnOpenPointerLeave(handler: ((event: PointerEvent) => void) | null): void {
    if (this.#openPointerLeaveHandler) {
      this.#open.removeEventListener(
        "pointerleave",
        this.#openPointerLeaveHandler,
      );
      this.#openPointerLeaveHandler = null;
    }
    if (!handler) {
      return;
    }
    this.#openPointerLeaveHandler = handler;
    this.#open.addEventListener("pointerleave", handler);
  }

  setBadge(
    input: { label: string; tone?: "default" | "positive" } | null,
  ): void {
    if (!input) {
      this.#badge.hidden = true;
      this.#badge.textContent = "";
      this.#badge.dataset.tone = "default";
      return;
    }
    this.#badge.hidden = false;
    this.#badge.textContent = input.label;
    this.#badge.dataset.tone = input.tone ?? "default";
  }

  setAction(action: ThumbnailAction | null): void {
    this.#applyAction(this.#action, action);
  }

  setSecondaryAction(
    action: (ThumbnailAction & { text?: string }) | null,
  ): void {
    this.#applyAction(
      this.#secondaryAction,
      action,
      action?.text ?? action?.label,
    );
  }

  setOpenAttributes(attributes: Record<string, string | null>): void {
    this.#applyAttributes(this.#open, attributes);
  }

  setActionAttributes(attributes: Record<string, string | null>): void {
    this.#applyAttributes(this.#action, attributes);
  }

  setSecondaryActionAttributes(
    attributes: Record<string, string | null>,
  ): void {
    this.#applyAttributes(this.#secondaryAction, attributes);
  }

  #applyAction(
    button: HTMLButtonElement,
    action: ThumbnailAction | null,
    visibleText?: string,
  ): void {
    if (!action || action.hidden) {
      button.hidden = true;
      button.onclick = null;
      button.replaceChildren();
      return;
    }
    button.hidden = false;
    button.disabled = action.disabled ?? false;
    button.setAttribute("aria-label", action.label);
    button.title = action.label;
    const children: Array<HTMLElement | SVGSVGElement> = [];
    if (action.icon) {
      children.push(renderIcon(action.icon));
    }
    if (visibleText) {
      const label = document.createElement("span");
      label.textContent = visibleText;
      children.push(label);
    }
    button.replaceChildren(...children);
    button.onclick = action.onPress;
  }

  #applyAttributes(
    element: HTMLElement,
    attributes: Record<string, string | null>,
  ): void {
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null) {
        element.removeAttribute(name);
        continue;
      }
      element.setAttribute(name, value);
    }
  }
}

export function createThumbnailTile(): ThumbnailTile {
  return new ThumbnailTile();
}

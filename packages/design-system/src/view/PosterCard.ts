import "./PosterCard.css";

import { setChildren } from "redom";
import type { ReDomLike } from "./ReDomLike";
import { type ReDomChild, toReDomChildren } from "./redomChildren";
import { Text } from "./Text";

export interface PosterCardOptions {
  label: string;
  className?: string;
}

export class PosterCard implements ReDomLike<HTMLButtonElement> {
  readonly el: HTMLButtonElement;

  #media: HTMLDivElement;
  #label: Text<"p">;
  #clickHandler: ((event: MouseEvent) => void) | null = null;

  constructor(options: PosterCardOptions) {
    this.#media = document.createElement("div");
    this.#media.className = "ds-poster-card__media";
    this.#label = new Text({
      tag: "p",
      kind: "body",
      className: "ds-poster-card__label",
      text: options.label,
    });
    this.el = document.createElement("button");
    this.el.className = "ds-poster-card";
    this.el.type = "button";
    if (options.className) {
      this.el.classList.add(...options.className.split(/\s+/).filter(Boolean));
    }
    this.el.append(this.#media, this.#label.el);
  }

  setMedia(children: ReDomChild | readonly ReDomChild[] | null): void {
    setChildren(this.#media, toReDomChildren(children));
  }

  setLabel(label: string): void {
    this.#label.setText(label);
  }

  setDisabled(disabled: boolean): void {
    this.el.disabled = disabled;
  }

  setAttributes(attributes: Record<string, string | null>): void {
    for (const [name, value] of Object.entries(attributes)) {
      if (value === null) {
        this.el.removeAttribute(name);
        continue;
      }
      this.el.setAttribute(name, value);
    }
  }

  setOnPress(handler: ((event: MouseEvent) => void) | null): void {
    if (this.#clickHandler) {
      this.el.removeEventListener("click", this.#clickHandler);
      this.#clickHandler = null;
    }
    if (!handler) {
      return;
    }
    this.#clickHandler = (event) => handler(event);
    this.el.addEventListener("click", this.#clickHandler);
  }
}

export function createPosterCard(options: PosterCardOptions): PosterCard {
  return new PosterCard(options);
}

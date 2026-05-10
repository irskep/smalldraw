import "./ChoiceCard.css";

import { setChildren } from "redom";
import type { ReDomLike } from "./ReDomLike";
import { Text } from "./Text";
import { toReDomChildren, type ReDomChild } from "./redomChildren";

export interface ChoiceCardOptions {
  title: string;
  subtitle?: string;
  className?: string;
}

export class ChoiceCard implements ReDomLike<HTMLButtonElement> {
  readonly el: HTMLButtonElement;

  #media: HTMLDivElement;
  #title: Text<"p">;
  #subtitle: Text<"p">;
  #clickHandler: ((event: MouseEvent) => void) | null = null;

  constructor(options: ChoiceCardOptions) {
    this.#media = document.createElement("div");
    this.#media.className = "ds-choice-card__media";
    this.#title = new Text({
      tag: "p",
      kind: "label",
      className: "ds-choice-card__title",
      text: options.title,
    });
    this.#subtitle = new Text({
      tag: "p",
      kind: "body",
      tone: "secondary",
      className: "ds-choice-card__subtitle",
      text: options.subtitle ?? "",
    });
    const body = document.createElement("div");
    body.className = "ds-choice-card__body";
    body.append(this.#title.el, this.#subtitle.el);
    this.el = document.createElement("button");
    this.el.className = "ds-choice-card";
    this.el.type = "button";
    if (options.className) {
      this.el.classList.add(...options.className.split(/\s+/).filter(Boolean));
    }
    this.el.append(this.#media, body);
    this.setSubtitle(options.subtitle ?? null);
  }

  setMedia(children: ReDomChild | readonly ReDomChild[] | null): void {
    setChildren(this.#media, toReDomChildren(children));
  }

  setTitle(title: string): void {
    this.#title.setText(title);
  }

  setSubtitle(subtitle: string | null): void {
    const hasSubtitle = subtitle !== null && subtitle.trim().length > 0;
    this.#subtitle.setText(subtitle ?? "");
    this.#subtitle.el.hidden = !hasSubtitle;
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

export function createChoiceCard(options: ChoiceCardOptions): ChoiceCard {
  return new ChoiceCard(options);
}

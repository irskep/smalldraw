import "./PreviewCard.css";

import type { ReDomLike } from "./ReDomLike";
import { Text } from "./Text";

export class PreviewCard implements ReDomLike<HTMLDivElement> {
  readonly el: HTMLDivElement;

  #image: HTMLImageElement;
  #title: Text<"p">;
  #subtitle: Text<"p">;

  constructor() {
    this.#image = document.createElement("img");
    this.#image.className = "ds-preview-card__image";
    this.#image.alt = "";
    this.#title = new Text({
      tag: "p",
      kind: "body",
      className: "ds-preview-card__title",
    });
    this.#subtitle = new Text({
      tag: "p",
      kind: "body",
      tone: "secondary",
      className: "ds-preview-card__subtitle",
    });
    const meta = document.createElement("div");
    meta.className = "ds-preview-card__meta";
    meta.append(this.#title.el, this.#subtitle.el);
    this.el = document.createElement("div");
    this.el.className = "ds-preview-card";
    this.el.append(this.#image, meta);
  }

  setImage(input: { src: string; alt?: string } | null): void {
    if (!input) {
      this.#image.hidden = true;
      this.#image.removeAttribute("src");
      this.#image.alt = "";
      return;
    }
    this.#image.hidden = false;
    this.#image.src = input.src;
    this.#image.alt = input.alt ?? "";
  }

  setTitle(title: string): void {
    this.#title.setText(title);
  }

  setSubtitle(subtitle: string): void {
    this.#subtitle.setText(subtitle);
  }
}

export function createPreviewCard(): PreviewCard {
  return new PreviewCard();
}

import type { ReDomLike } from "./ReDomLike";

export type TextKind = "title" | "body" | "label" | "caption";
export type TextTone = "default" | "secondary";

export interface TextOptions<TTag extends keyof HTMLElementTagNameMap> {
  tag: TTag;
  text?: string;
  kind: TextKind;
  tone?: TextTone;
  className?: string;
  attributes?: Record<string, string>;
}

export class Text<
  TTag extends keyof HTMLElementTagNameMap = "span",
> implements ReDomLike<HTMLElementTagNameMap[TTag]>
{
  readonly el: HTMLElementTagNameMap[TTag];

  constructor(options: TextOptions<TTag>) {
    this.el = document.createElement(options.tag);
    this.el.classList.add("ds-text");
    if (options.className) {
      this.el.classList.add(...options.className.split(/\s+/).filter(Boolean));
    }
    this.setKind(options.kind);
    this.setTone(options.tone ?? "default");
    this.setText(options.text ?? "");
    for (const [name, value] of Object.entries(options.attributes ?? {})) {
      this.el.setAttribute(name, value);
    }
  }

  setText(text: string): void {
    this.el.textContent = text;
  }

  setKind(kind: TextKind): void {
    this.el.dataset.kind = kind;
  }

  setTone(tone: TextTone): void {
    this.el.dataset.tone = tone;
  }
}

export function createText<TTag extends keyof HTMLElementTagNameMap>(
  options: TextOptions<TTag>,
): Text<TTag> {
  return new Text(options);
}

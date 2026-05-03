import type { IconNode } from "lucide";
import type { ReDomLike } from "./ReDomLike";
import { renderIcon } from "./renderIcon";
import type { TextKind, TextTone } from "./Text";

export interface TypographicIconOptions {
  icon: IconNode;
  kind: TextKind;
  tone?: TextTone;
  className?: string;
  attributes?: Record<string, string>;
}

export class TypographicIcon
  implements ReDomLike<HTMLSpanElement>
{
  readonly el: HTMLSpanElement;
  private svg: SVGSVGElement;

  constructor(options: TypographicIconOptions) {
    this.el = document.createElement("span");
    this.el.classList.add("ds-typographic-icon");
    if (options.className) {
      this.el.classList.add(...options.className.split(/\s+/).filter(Boolean));
    }
    this.svg = renderIcon(options.icon);
    this.el.append(this.svg);
    this.setKind(options.kind);
    this.setTone(options.tone ?? "default");
    for (const [name, value] of Object.entries(options.attributes ?? {})) {
      this.el.setAttribute(name, value);
    }
  }

  setIcon(icon: IconNode): void {
    const nextSvg = renderIcon(icon);
    this.el.replaceChild(nextSvg, this.svg);
    this.svg = nextSvg;
  }

  setKind(kind: TextKind): void {
    this.el.dataset.kind = kind;
  }

  setTone(tone: TextTone): void {
    this.el.dataset.tone = tone;
  }
}

export function createTypographicIcon(
  options: TypographicIconOptions,
): TypographicIcon {
  return new TypographicIcon(options);
}

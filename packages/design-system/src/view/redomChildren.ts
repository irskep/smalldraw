import type { ReDomLike } from "./ReDomLike";

export type ReDomChild =
  | HTMLElement
  | SVGElement
  | ReDomLike<HTMLElement>
  | ReDomLike<SVGElement>;

export function toReDomChildren(
  children: ReDomChild | readonly ReDomChild[] | null,
): ReDomChild[] {
  if (children === null) {
    return [];
  }
  if (Array.isArray(children)) {
    return Array.from(children);
  }
  return [children as ReDomChild];
}

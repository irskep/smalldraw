import type { IconNode } from "lucide";

const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Render a Lucide IconNode to an SVG element.
 */
export function renderIcon(iconNode: IconNode): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");

  for (const [tag, attrs] of iconNode) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [attr, value] of Object.entries(attrs)) {
      if (value !== undefined) {
        node.setAttribute(attr, `${value}`);
      }
    }
    svg.appendChild(node);
  }

  return svg;
}

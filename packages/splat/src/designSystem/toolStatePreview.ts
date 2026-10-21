import type { ToolStatePreviewModel } from "@smalldraw/design-system";
import type { IconNode } from "lucide";
import type { KidsToolConfig } from "../tools/kidsTools";
import { computeStampSize, toStampStrokeSize } from "../tools/stampTool";
import type { ToolbarUiState } from "../ui/stores/toolbarUiStore";

// Brushes use a fitted sample. Stamps keep proportional size, with a 120px
// stamp fitting the preview slot and larger stamps overflowing it visually.
export function createToolStatePreview(
  tool: KidsToolConfig,
  state: ToolbarUiState,
  label: string,
): ToolStatePreviewModel {
  const width = Math.max(0.75, Math.min(10, Math.sqrt(state.strokeWidth / 2)));
  const color = state.strokeColor;
  const sample = (icon: IconNode, sized = true): ToolStatePreviewModel => ({
    icon,
    color,
    accessibleName: `${label}, ${color}${sized ? `, size ${state.strokeWidth}` : ""}`,
  });
  switch (tool.familyId) {
    case "stamp.images":
    case "stamp.alphabet":
      return {
        icon: tool.icon,
        color: tool.familyId === "stamp.alphabet" ? color : undefined,
        accessibleName: `${label}, size ${state.strokeWidth}`,
        scale: computeStampSize(toStampStrokeSize(state.strokeWidth)) / 120,
      };
    case "fill":
      return sample(
        [
          [
            "circle",
            {
              cx: "12",
              cy: "12",
              r: "9",
              fill: "currentColor",
              stroke: "none",
            },
          ],
        ],
        false,
      );
    case "eraser":
      return {
        icon: [
          [
            "circle",
            {
              cx: "12",
              cy: "12",
              r: `${2 + width * 0.7}`,
              fill: "var(--ds-surface)",
              "stroke-width": "0.75",
            },
          ],
        ],
        accessibleName: `Eraser, size ${state.strokeWidth}`,
      };
    case "shape.filled":
    case "shape.outline": {
      const filled = tool.familyId === "shape.filled";
      const attrs = {
        fill: filled ? "currentColor" : "none",
        "stroke-width": filled ? "0" : `${width * 0.5}`,
      };
      if (tool.shapeVariant === "ellipse") {
        return sample(
          [["ellipse", { cx: "12", cy: "12", rx: "8", ry: "6", ...attrs }]],
          !filled,
        );
      }
      if (tool.shapeVariant === "rect") {
        return sample(
          [["rect", { x: "4", y: "5", width: "16", height: "14", ...attrs }]],
          !filled,
        );
      }
      return sample([
        ["path", { d: "M5 18L19 6", "stroke-width": `${width}` }],
      ]);
    }
    default:
      if (tool.id.includes("spraycan")) {
        const radius = 2 + width * 0.65;
        const dots: IconNode = Array.from({ length: 37 }, (_, i) => {
          const angle = i * 2.399963229728653;
          const distance = radius * Math.sqrt(i / 36);
          return [
            "circle",
            {
              cx: `${12 + Math.cos(angle) * distance}`,
              cy: `${12 + Math.sin(angle) * distance}`,
              r: "0.4",
              fill: "currentColor",
              stroke: "none",
            },
          ];
        });
        return sample(dots);
      }
      return sample([
        [
          "path",
          {
            d: "M5 16C9 4 15 20 19 8",
            "stroke-width": `${width}`,
            "stroke-linecap": "round",
            fill: "none",
          },
        ],
      ]);
  }
}

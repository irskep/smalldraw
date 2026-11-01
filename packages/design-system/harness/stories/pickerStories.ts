import { el } from "redom";

import { createColorSwatchGrid, createStrokeWidthGrid } from "../../src";
import { COLOR_SWATCHES } from "./colorFixtures";
import type { HarnessStory } from "./types";

const DEMO_STROKES = [2, 4, 8, 16, 24, 48, 96, 200] as const;

export const pickerStories: HarnessStory[] = [
  {
    id: "color-swatch-grid",
    title: "Color Swatch Grid",
    description:
      "Standalone color picker content grid, extracted from the color picker dropdown.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const status = el(
        "output.ds-story-output",
        "Selected color: #2e86ff",
      ) as HTMLOutputElement;
      const grid = createColorSwatchGrid({
        colors: COLOR_SWATCHES,
        selectedColor: "#2e86ff",
      });

      grid.setOnSelect((color) => {
        status.value = `Selected color: ${color}`;
        status.textContent = status.value;
      });

      canvas.append(grid.el, status);
      container.replaceChildren(canvas);
    },
  },
  {
    id: "stroke-width-grid",
    title: "Stroke Width Grid",
    description:
      "Standalone stroke picker content grid, extracted from the stroke picker dropdown.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const status = el(
        "output.ds-story-output",
        "Selected stroke: 16px",
      ) as HTMLOutputElement;
      const grid = createStrokeWidthGrid({
        strokeWidths: DEMO_STROKES,
        selectedStrokeWidth: 16,
      });

      grid.setOnSelect((strokeWidth) => {
        status.value = `Selected stroke: ${strokeWidth}px`;
        status.textContent = status.value;
      });

      canvas.append(grid.el, status);
      container.replaceChildren(canvas);
    },
  },
];

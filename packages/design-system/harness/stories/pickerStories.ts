import { el } from "redom";
import {
  createColorSwatchGrid,
  createStrokeWidthGrid,
} from "../../src";
import type { HarnessStory } from "./types";

const DEMO_COLORS = [
  { color: "#000000", label: "Black" },
  { color: "#ffffff", label: "White" },
  { color: "#9c682f", label: "Brown" },
  { color: "#ff4a6a", label: "Pink" },
  { color: "#ff8f0f", label: "Orange" },
  { color: "#ffd95a", label: "Yellow" },
  { color: "#63c430", label: "Green" },
  { color: "#11b79b", label: "Teal" },
  { color: "#3483ea", label: "Blue" },
  { color: "#6755db", label: "Indigo" },
  { color: "#ea58b7", label: "Magenta" },
  { color: "#98a2b3", label: "Gray" },
] as const;

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
        "Selected color: #3483ea",
      ) as HTMLOutputElement;
      const grid = createColorSwatchGrid({
        colors: DEMO_COLORS,
        selectedColor: "#3483ea",
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

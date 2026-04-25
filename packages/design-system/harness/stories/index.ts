import { el, mount } from "redom";
import { createButton } from "../../src";

export interface HarnessStory {
  id: string;
  title: string;
  description: string;
  mount: (container: HTMLElement) => void;
}

export const stories: HarnessStory[] = [
  {
    id: "button-tones",
    title: "Button Tones",
    description: "Base button primitive with neutral, primary, and danger tones.",
    mount: (container) => {
      const row = el("div.ds-story-row") as HTMLDivElement;
      const neutral = createButton({ label: "Neutral" });
      const primary = createButton({ label: "Primary", tone: "primary" });
      const danger = createButton({ label: "Danger", tone: "danger" });
      const disabled = createButton({ label: "Disabled", tone: "primary" });
      disabled.setDisabled(true);
      mount(row, neutral);
      mount(row, primary);
      mount(row, danger);
      mount(row, disabled);
      container.replaceChildren(row);
    },
  },
];

import { el } from "redom";
import { createResizeHandle } from "./ResizeHandle";
import type { HarnessStory } from "./types";

export const resizeHandleStories: HarnessStory[] = [
  {
    id: "resize-handle",
    title: "Resize Handle",
    description:
      "Drag handle for resizing a target element horizontally. Internal harness utility.",
    mount: (container) => {
      const stack = el("div.ds-story-stack") as HTMLDivElement;

      const box = el("div") as HTMLDivElement;
      Object.assign(box.style, {
        width: "300px",
        minHeight: "120px",
        background: "var(--gray-1)",
        border: "1px solid var(--gray-4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--gray-6)",
        fontSize: "var(--font-size-1)",
      });
      box.textContent = "Drag the handle to resize";

      const resizer = createResizeHandle();

      stack.append(el("h2.ds-story-heading", "Basic"), resizer.wrap(box));
      container.replaceChildren(stack);
    },
  },
];

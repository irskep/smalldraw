import { CloudAlert, CloudCheck, Pen, Type } from "lucide";
import { el } from "redom";
import {
  createText,
  createTypographicIcon,
  type TextKind,
  type TextTone,
} from "../../src";
import type { HarnessStory } from "./types";

const TYPOGRAPHY_KINDS: TextKind[] = ["title", "body", "label", "caption"];
const TYPOGRAPHY_TONES: TextTone[] = ["default", "secondary"];

function createTypographySpecimenRow(options: {
  label: string;
  preview: HTMLElement;
}): HTMLDivElement {
  return el(
    "div.ds-typography-story__specimen",
    el("div.ds-typography-story__specimen-label", options.label),
    el("div.ds-typography-story__specimen-preview", options.preview),
  ) as HTMLDivElement;
}

export const typographyStories: HarnessStory[] = [
  {
    id: "text",
    title: "Text",
    description:
      "Text primitive samples across the current kind and tone matrix, shown in isolation.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const isolatedText = el("div.ds-story-stack") as HTMLDivElement;
      const isolatedIcons = el("div.ds-story-stack") as HTMLDivElement;

      for (const tone of TYPOGRAPHY_TONES) {
        for (const kind of TYPOGRAPHY_KINDS) {
          const text = createText({
            tag: kind === "title" ? "h2" : "span",
            text: `${kind} / ${tone}`,
            kind,
            tone,
          });
          isolatedText.append(
            createTypographySpecimenRow({
              label: `${kind} • ${tone}`,
              preview: text.el,
            }),
          );

          const icon = createTypographicIcon({
            icon: kind === "title" ? Type : Pen,
            kind,
            tone,
          });
          isolatedIcons.append(
            createTypographySpecimenRow({
              label: `${kind} • ${tone}`,
              preview: icon.el,
            }),
          );
        }
      }

      canvas.append(
        el("h2.ds-story-heading", "Text"),
        isolatedText,
        el("h2.ds-story-heading", "TypographicIcon"),
        isolatedIcons,
      );

      container.replaceChildren(canvas);
    },
  },
  {
    id: "text-icon-pairs",
    title: "Text + Icon",
    description:
      "Matched text and typographic-icon pairings to verify shared sizing and tone behavior.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const pairs = el("div.ds-story-stack") as HTMLDivElement;

      const pairSpecs: Array<{
        kind: TextKind;
        tone: TextTone;
        icon: typeof CloudCheck;
        copy: string;
      }> = [
        {
          kind: "title",
          tone: "default",
          icon: Type,
          copy: "Typography title",
        },
        {
          kind: "body",
          tone: "default",
          icon: Pen,
          copy: "Primary body copy",
        },
        {
          kind: "body",
          tone: "secondary",
          icon: CloudAlert,
          copy: "Secondary status copy",
        },
        {
          kind: "label",
          tone: "default",
          icon: CloudCheck,
          copy: "Saved",
        },
        {
          kind: "caption",
          tone: "secondary",
          icon: CloudAlert,
          copy: "Offline",
        },
      ];

      for (const spec of pairSpecs) {
        const preview = el(
          "div.ds-typography-story__pair",
          createTypographicIcon({
            icon: spec.icon,
            kind: spec.kind,
            tone: spec.tone,
          }),
          createText({
            tag: spec.kind === "title" ? "h2" : "span",
            text: spec.copy,
            kind: spec.kind,
            tone: spec.tone,
          }),
        ) as HTMLDivElement;

        pairs.append(
          createTypographySpecimenRow({
            label: `${spec.kind} • ${spec.tone}`,
            preview,
          }),
        );
      }

      canvas.append(el("h2.ds-story-heading", "Paired"), pairs);
      container.replaceChildren(canvas);
    },
  },
];

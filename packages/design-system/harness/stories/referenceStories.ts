import { el } from "redom";
import type { HarnessStory } from "./types";

interface TokenFamily {
  id: string;
  title: string;
  prefixes: string[];
  preview:
    | "color"
    | "spacing"
    | "spacing-pair"
    | "radius"
    | "shadow"
    | "type"
    | "motion";
  previewColumns?: "narrow" | "wide";
}

const OPEN_PROPS_FAMILIES: TokenFamily[] = [
  {
    id: "colors-gray",
    title: "Gray Scale",
    prefixes: ["--gray-"],
    preview: "color",
    previewColumns: "narrow",
  },
  {
    id: "colors-blue",
    title: "Blue Scale",
    prefixes: ["--blue-"],
    preview: "color",
    previewColumns: "narrow",
  },
  {
    id: "colors-red",
    title: "Red Scale",
    prefixes: ["--red-"],
    preview: "color",
    previewColumns: "narrow",
  },
  {
    id: "spacing-primitive",
    title: "Primitive Spacing",
    prefixes: ["--size-px-"],
    preview: "spacing-pair",
    previewColumns: "wide",
  },
  {
    id: "spacing-scale",
    title: "Spacing Scale",
    prefixes: ["--size-"],
    preview: "spacing",
    previewColumns: "narrow",
  },
  {
    id: "borders",
    title: "Border Width",
    prefixes: ["--border-size-"],
    preview: "spacing",
    previewColumns: "narrow",
  },
  {
    id: "radius",
    title: "Radii",
    prefixes: ["--radius-"],
    preview: "radius",
    previewColumns: "narrow",
  },
  {
    id: "shadows",
    title: "Shadows",
    prefixes: ["--shadow-"],
    preview: "shadow",
    previewColumns: "narrow",
  },
  {
    id: "font-sizes",
    title: "Font Sizes",
    prefixes: ["--font-size-"],
    preview: "type",
    previewColumns: "wide",
  },
  {
    id: "font-weights",
    title: "Font Weights",
    prefixes: ["--font-weight-"],
    preview: "type",
    previewColumns: "wide",
  },
  {
    id: "ease-in",
    title: "Ease In",
    prefixes: ["--ease-in-"],
    preview: "motion",
    previewColumns: "wide",
  },
  {
    id: "ease-out",
    title: "Ease Out",
    prefixes: ["--ease-out-"],
    preview: "motion",
    previewColumns: "wide",
  },
  {
    id: "animations",
    title: "Animation Tokens",
    prefixes: ["--animation-"],
    preview: "motion",
    previewColumns: "wide",
  },
];

function compareTokenNames(left: string, right: string): number {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function collectTokens(prefixes: string[]): string[] {
  const style = getComputedStyle(document.documentElement);
  const collected = new Set<string>();

  for (const propertyName of style) {
    if (prefixes.some((prefix) => propertyName.startsWith(prefix))) {
      collected.add(propertyName);
    }
  }

  return Array.from(collected).sort(compareTokenNames);
}

function getTokenValue(token: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
}

function parsePixelValue(value: string): number | null {
  const match = value.match(/^(-?\d+(?:\.\d+)?)px$/);
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

function createPreview(token: string, preview: TokenFamily["preview"]): HTMLElement {
  const value = getTokenValue(token);

  if (preview === "color") {
    return el("div.ds-reference__swatch", {
      style: `background:${value};`,
      "aria-hidden": "true",
    }) as HTMLDivElement;
  }

  if (preview === "spacing") {
    return el(
      "div.ds-reference__spacing-preview",
      el("div.ds-reference__spacing-bar", {
        style: `width:min(${value}, 100%);`,
      }),
    ) as HTMLDivElement;
  }

  if (preview === "spacing-pair") {
    const numericValue = parsePixelValue(value);
    const isNegative = numericValue !== null && numericValue < 0;
    return el(
      "div.ds-reference__spacing-pair-preview",
      {
        style: isNegative
          ? `--ds-reference-spacing-overlap:${Math.abs(numericValue ?? 0)}px;`
          : `gap:${value};`,
      },
      el("div.ds-reference__spacing-square"),
      el(
        `div.ds-reference__spacing-square${isNegative ? " ds-reference__spacing-square--overlap" : ""}`,
      ),
    ) as HTMLDivElement;
  }

  if (preview === "radius") {
    return el("div.ds-reference__radius-preview", {
      style: `border-radius:${value};`,
      "aria-hidden": "true",
    }) as HTMLDivElement;
  }

  if (preview === "shadow") {
    return el("div.ds-reference__shadow-preview", {
      style: `box-shadow:${value};`,
      "aria-hidden": "true",
    }) as HTMLDivElement;
  }

  if (preview === "type") {
    if (token.startsWith("--font-size-")) {
      return el(
        "div.ds-reference__type-preview ds-reference__type-preview--size",
        el(
          "div.ds-reference__type-line",
          { style: `font-size:${value};` },
          "Sphinx of black quartz, judge my vow.",
        ),
      ) as HTMLDivElement;
    }

    return el(
      "div.ds-reference__type-preview ds-reference__type-preview--weight",
      el(
        "div.ds-reference__type-line",
        { style: `font-weight:${value};` },
        "Hamburgefontsiv 123",
      ),
    ) as HTMLDivElement;
  }

  if (token.startsWith("--ease-")) {
    const demo = el("div.ds-reference__motion-preview") as HTMLDivElement;
    demo.style.setProperty("--ds-reference-easing", value);
    demo.append(el("div.ds-reference__motion-track", el("div.ds-reference__motion-dot")));
    return demo;
  }

  const demo = el("div.ds-reference__motion-preview") as HTMLDivElement;
  demo.style.setProperty("--ds-reference-animation", value);
  demo.append(el("div.ds-reference__motion-chip", "Animate"));
  return demo;
}

function createTokenRow(
  token: string,
  preview: TokenFamily["preview"],
  previewColumns: TokenFamily["previewColumns"] = "narrow",
): HTMLElement {
  const value = getTokenValue(token);
  return el(
    `div.ds-reference__token-row ds-reference__token-row--${preview} ds-reference__token-row--${previewColumns}`,
    createPreview(token, preview),
    el(
      "div.ds-reference__token-meta",
      el("code.ds-reference__token-name", token),
      el(
        "code.ds-reference__token-value",
        value.length > 0 ? value : "(empty)",
      ),
    ),
  ) as HTMLDivElement;
}

export const referenceStories: HarnessStory[] = [
  {
    id: "open-props-reference",
    title: "Open Props Reference",
    description:
      "Reference for the Open Props token families used by the design-system package, expanded to all tokens in those families.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      canvas.append(
        el(
          "p",
          "This page expands beyond individual tokens in use and shows all Open Props values for the token families the design system currently relies on.",
        ),
      );

      for (const family of OPEN_PROPS_FAMILIES) {
        const tokens = collectTokens(family.prefixes);
        if (tokens.length === 0) {
          continue;
        }

        const sectionEl = el("section.ds-reference__section") as HTMLElement;
        const rows = el("div.ds-reference__token-list") as HTMLDivElement;
        for (const token of tokens) {
          rows.append(
            createTokenRow(token, family.preview, family.previewColumns),
          );
        }
        sectionEl.append(
          el("h2.ds-story-heading", family.title),
          el(
            "p.ds-reference__section-note",
            `${tokens.length} tokens`,
          ),
          rows,
        );
        canvas.append(sectionEl);
      }

      container.replaceChildren(canvas);
    },
  },
];

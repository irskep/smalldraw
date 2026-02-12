import type { IconNode } from "lucide";

export type StampPoint = readonly [number, number];

export type StampCommand =
  | { readonly kind: "line"; readonly to: StampPoint }
  | {
      readonly kind: "quad";
      readonly control: StampPoint;
      readonly to: StampPoint;
    };

export interface StampStroke {
  readonly start: StampPoint;
  readonly commands: readonly StampCommand[];
}

export interface StampGlyph {
  readonly strokes: readonly StampStroke[];
  readonly advance: number;
}

const lineTo = (x: number, y: number): StampCommand => ({
  kind: "line",
  to: [x, y],
});

const quadTo = (
  cx: number,
  cy: number,
  x: number,
  y: number,
): StampCommand => ({
  kind: "quad",
  control: [cx, cy],
  to: [x, y],
});

const stroke = (
  start: StampPoint,
  ...commands: readonly StampCommand[]
): StampStroke => ({
  start,
  commands,
});

const ALPHABET: Record<string, StampGlyph> = {
  A: {
    advance: 1,
    strokes: [
      stroke([0.1, 1], lineTo(0.5, 0)),
      stroke([0.9, 1], lineTo(0.5, 0)),
      stroke([0.25, 0.58], lineTo(0.75, 0.58)),
    ],
  },
  B: {
    advance: 1,
    strokes: [
      stroke([0.12, 0], lineTo(0.12, 1)),
      stroke(
        [0.12, 0],
        lineTo(0.58, 0),
        quadTo(0.9, 0.04, 0.76, 0.26),
        quadTo(0.64, 0.46, 0.12, 0.46),
      ),
      stroke(
        [0.12, 0.46],
        lineTo(0.62, 0.46),
        quadTo(0.96, 0.5, 0.8, 0.78),
        quadTo(0.66, 1, 0.12, 1),
        lineTo(0.12, 1),
      ),
    ],
  },
  C: {
    advance: 1,
    strokes: [
      stroke(
        [0.88, 0.14],
        quadTo(0.7, -0.02, 0.3, 0.06),
        quadTo(0.06, 0.22, 0.08, 0.5),
        quadTo(0.06, 0.78, 0.3, 0.94),
        quadTo(0.7, 1.02, 0.88, 0.86),
      ),
    ],
  },
  D: {
    advance: 1,
    strokes: [
      stroke([0.12, 0], lineTo(0.12, 1)),
      stroke(
        [0.12, 0],
        lineTo(0.6, 0),
        quadTo(0.94, 0.2, 0.94, 0.5),
        quadTo(0.94, 0.8, 0.6, 1),
        lineTo(0.12, 1),
      ),
    ],
  },
  E: {
    advance: 1,
    strokes: [
      stroke([0.12, 0], lineTo(0.12, 1)),
      stroke([0.12, 0], lineTo(0.88, 0)),
      stroke([0.12, 0.5], lineTo(0.74, 0.5)),
      stroke([0.12, 1], lineTo(0.88, 1)),
    ],
  },
  F: {
    advance: 1,
    strokes: [
      stroke([0.12, 0], lineTo(0.12, 1)),
      stroke([0.12, 0], lineTo(0.88, 0)),
      stroke([0.12, 0.5], lineTo(0.74, 0.5)),
    ],
  },
  G: {
    advance: 1,
    strokes: [
      stroke(
        [0.9, 0.22],
        quadTo(0.76, 0.02, 0.46, 0.02),
        quadTo(0.14, 0.02, 0.08, 0.5),
        quadTo(0.14, 0.98, 0.5, 0.98),
        quadTo(0.82, 0.98, 0.9, 0.8),
      ),
      stroke([0.9, 0.62], lineTo(0.54, 0.62)),
      stroke([0.9, 0.62], lineTo(0.9, 0.8)),
    ],
  },
  H: {
    advance: 1,
    strokes: [
      stroke([0.12, 0], lineTo(0.12, 1)),
      stroke([0.88, 0], lineTo(0.88, 1)),
      stroke([0.12, 0.5], lineTo(0.88, 0.5)),
    ],
  },
  I: {
    advance: 0.75,
    strokes: [
      stroke([0.08, 0], lineTo(0.67, 0)),
      stroke([0.38, 0], lineTo(0.38, 1)),
      stroke([0.08, 1], lineTo(0.67, 1)),
    ],
  },
  J: {
    advance: 1,
    strokes: [
      stroke([0.24, 0], lineTo(0.8, 0)),
      stroke(
        [0.64, 0],
        lineTo(0.64, 0.72),
        quadTo(0.64, 1, 0.36, 1),
        quadTo(0.14, 0.98, 0.14, 0.82),
      ),
    ],
  },
  K: {
    advance: 1,
    strokes: [
      stroke([0.16, 0], lineTo(0.16, 1)),
      stroke([0.84, 0.04], lineTo(0.38, 0.4), lineTo(0.16, 0.52)),
      stroke([0.16, 0.52], lineTo(0.38, 0.64), lineTo(0.84, 1)),
    ],
  },
  L: {
    advance: 1,
    strokes: [
      stroke([0.12, 0], lineTo(0.12, 1)),
      stroke([0.12, 1], lineTo(0.88, 1)),
    ],
  },
  M: {
    advance: 1,
    strokes: [
      stroke(
        [0.1, 1],
        lineTo(0.1, 0),
        lineTo(0.5, 0.46),
        lineTo(0.9, 0),
        lineTo(0.9, 1),
      ),
    ],
  },
  N: {
    advance: 1,
    strokes: [
      stroke([0.12, 1], lineTo(0.12, 0), lineTo(0.88, 1), lineTo(0.88, 0)),
    ],
  },
  O: {
    advance: 1,
    strokes: [
      stroke(
        [0.5, 0],
        quadTo(0.84, 0, 0.92, 0.3),
        quadTo(0.96, 0.5, 0.92, 0.7),
        quadTo(0.84, 1, 0.5, 1),
        quadTo(0.16, 1, 0.08, 0.7),
        quadTo(0.04, 0.5, 0.08, 0.3),
        quadTo(0.16, 0, 0.5, 0),
      ),
    ],
  },
  P: {
    advance: 1,
    strokes: [
      stroke([0.12, 0], lineTo(0.12, 1)),
      stroke(
        [0.12, 0],
        lineTo(0.68, 0),
        quadTo(0.92, 0.14, 0.68, 0.5),
        lineTo(0.12, 0.5),
      ),
    ],
  },
  Q: {
    advance: 1,
    strokes: [
      stroke(
        [0.5, 0],
        quadTo(0.84, 0, 0.92, 0.3),
        quadTo(0.96, 0.5, 0.92, 0.7),
        quadTo(0.84, 1, 0.5, 1),
        quadTo(0.16, 1, 0.08, 0.7),
        quadTo(0.04, 0.5, 0.08, 0.3),
        quadTo(0.16, 0, 0.5, 0),
      ),
      stroke([0.62, 0.7], lineTo(0.92, 1)),
    ],
  },
  R: {
    advance: 1,
    strokes: [
      stroke([0.14, 0], lineTo(0.14, 1)),
      stroke(
        [0.14, 0],
        lineTo(0.6, 0),
        quadTo(0.9, 0.08, 0.72, 0.46),
        lineTo(0.14, 0.46),
      ),
      stroke([0.38, 0.46], lineTo(0.86, 1)),
    ],
  },
  S: {
    advance: 1,
    strokes: [
      stroke(
        [0.86, 0.14],
        quadTo(0.68, 0, 0.36, 0.06),
        quadTo(0.08, 0.16, 0.16, 0.36),
        quadTo(0.22, 0.48, 0.58, 0.52),
        quadTo(0.94, 0.58, 0.86, 0.8),
        quadTo(0.76, 1.02, 0.36, 0.94),
        quadTo(0.16, 0.9, 0.08, 0.78),
      ),
    ],
  },
  T: {
    advance: 1,
    strokes: [
      stroke([0.08, 0], lineTo(0.92, 0)),
      stroke([0.5, 0], lineTo(0.5, 1)),
    ],
  },
  U: {
    advance: 1,
    strokes: [
      stroke(
        [0.12, 0],
        lineTo(0.12, 0.78),
        quadTo(0.3, 1, 0.5, 1),
        quadTo(0.7, 1, 0.88, 0.78),
        lineTo(0.88, 0),
      ),
    ],
  },
  V: {
    advance: 1,
    strokes: [stroke([0.12, 0], lineTo(0.5, 1), lineTo(0.88, 0))],
  },
  W: {
    advance: 1.25,
    strokes: [
      stroke(
        [0.08, 0],
        lineTo(0.28, 1),
        lineTo(0.5, 0.4),
        lineTo(0.72, 1),
        lineTo(0.92, 0),
      ),
    ],
  },
  X: {
    advance: 1,
    strokes: [
      stroke([0.12, 0], lineTo(0.88, 1)),
      stroke([0.88, 0], lineTo(0.12, 1)),
    ],
  },
  Y: {
    advance: 1,
    strokes: [
      stroke([0.12, 0], lineTo(0.5, 0.52), lineTo(0.88, 0)),
      stroke([0.5, 0.52], lineTo(0.5, 1)),
    ],
  },
  Z: {
    advance: 1,
    strokes: [
      stroke([0.12, 0], lineTo(0.88, 0), lineTo(0.12, 1), lineTo(0.88, 1)),
    ],
  },
};

const ALPHABET_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const ICON_PADDING = 3;
const ICON_SIZE = 18;

const toIconCoord = (value: number): string =>
  (ICON_PADDING + value * ICON_SIZE).toFixed(2);

export function getAlphabetLetters(): readonly string[] {
  return ALPHABET_LETTERS;
}

export function getAlphabetGlyph(letter: string): StampGlyph {
  const normalized = letter.toUpperCase();
  const glyph = ALPHABET[normalized];
  if (!glyph) {
    throw new Error(`Unsupported alphabet glyph '${letter}'.`);
  }
  return glyph;
}

export function getAlphabetGlyphIcon(letter: string): IconNode {
  return glyphToIconNode(getAlphabetGlyph(letter));
}

export function glyphToIconNode(glyph: StampGlyph): IconNode {
  const icon: IconNode = [];

  glyph.strokes.forEach((strokeData, index) => {
    const d = [
      `M ${toIconCoord(strokeData.start[0])} ${toIconCoord(strokeData.start[1])}`,
    ];

    for (const command of strokeData.commands) {
      if (command.kind === "line") {
        d.push(`L ${toIconCoord(command.to[0])} ${toIconCoord(command.to[1])}`);
        continue;
      }
      d.push(
        `Q ${toIconCoord(command.control[0])} ${toIconCoord(command.control[1])} ${toIconCoord(command.to[0])} ${toIconCoord(command.to[1])}`,
      );
    }

    icon.push([
      "path",
      {
        d: d.join(" "),
        fill: "none",
        "stroke-width": "3",
        key: `path-${index}`,
      },
    ]);
  });

  return icon;
}

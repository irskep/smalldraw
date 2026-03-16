type InitialDrawingLayer = {
  id: string;
  kind: "drawing";
  zIndex: string;
};

export type InitialSmalldrawDocument = {
  size: {
    width: number;
    height: number;
  };
  presentation: Record<string, never>;
  layers: Record<string, InitialDrawingLayer>;
  shapes: Record<string, never>;
  temporalOrderCounter: number;
};

export function createInitialSmalldrawDocument(): InitialSmalldrawDocument {
  return {
    size: {
      width: 960,
      height: 600,
    },
    presentation: {},
    layers: {
      default: {
        id: "default",
        kind: "drawing",
        zIndex: "a0",
      },
    },
    shapes: {},
    temporalOrderCounter: 0,
  };
}

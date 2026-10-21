import { expect, test } from "bun:test";

import { renderMarkerPath } from "../../shapes/renderers/markerPath";

test("incremental native path retains exactly the full path commands and updates only its tail", () => {
  const original = globalThis.Path2D;
  let submitted = 0;
  class RecordingPath {
    commands: number[][];
    constructor(path?: RecordingPath) {
      this.commands = path ? [...path.commands] : [];
    }
    moveTo(x: number, y: number) {
      this.commands.push([x, y]);
    }
    bezierCurveTo(...args: number[]) {
      submitted++;
      this.commands.push(args);
    }
  }
  globalThis.Path2D = RecordingPath as unknown as typeof Path2D;
  const context = () => {
    let current = new RecordingPath();
    let painted: number[][] = [];
    const ctx = {
      beginPath() {
        current = new RecordingPath();
      },
      moveTo(x: number, y: number) {
        current.moveTo(x, y);
      },
      bezierCurveTo(...args: number[]) {
        current.bezierCurveTo(...args);
      },
      stroke(path?: RecordingPath) {
        painted = (path ?? current).commands;
      },
    } as unknown as CanvasRenderingContext2D;
    return {
      ctx,
      get painted() {
        return painted;
      },
    };
  };
  try {
    const full = context(),
      cached = context();
    const points: [number, number][] = [];
    for (let i = 0; i < 100; i++) {
      points.push([Math.sin(i) * 30, Math.cos(i) * 30]);
      renderMarkerPath(full.ctx, points, 8);
      submitted = 0;
      renderMarkerPath(cached.ctx, points, 8, true);
      expect(cached.painted).toEqual(full.painted);
      expect(submitted).toBeLessThanOrEqual(23);
    }
    submitted = 0;
    renderMarkerPath(cached.ctx, points, 12, true);
    expect(submitted).toBe(0);
    for (const replacement of [
      points.slice(0, 3),
      [
        [10, 20],
        [30, 40],
      ] as [number, number][],
      [
        [11, 21],
        [31, 41],
      ] as [number, number][],
    ]) {
      renderMarkerPath(full.ctx, replacement, 8);
      renderMarkerPath(cached.ctx, replacement, 8, true);
      expect(cached.painted).toEqual(full.painted);
    }
  } finally {
    globalThis.Path2D = original;
  }
});

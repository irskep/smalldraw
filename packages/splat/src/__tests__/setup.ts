import { beforeEach } from "bun:test";
import { initAutomerge } from "@smalldraw/core";
import { Window } from "happy-dom";

await initAutomerge();

const windowInstance = new Window();
const { document } = windowInstance;

(globalThis as any).window = windowInstance;
(globalThis as any).document = document;
(globalThis as any).HTMLElement = windowInstance.HTMLElement;
(globalThis as any).HTMLCanvasElement = windowInstance.HTMLCanvasElement;
(globalThis as any).SVGElement = windowInstance.SVGElement;
(globalThis as any).navigator = windowInstance.navigator;
(globalThis as any).Image = windowInstance.Image;
(globalThis as any).localStorage = windowInstance.localStorage;
(globalThis as any).sessionStorage = windowInstance.sessionStorage;
(globalThis as any).PointerEvent =
  (windowInstance as any).PointerEvent ?? windowInstance.MouseEvent;
(globalThis as any).ResizeObserver =
  (windowInstance as any).ResizeObserver ??
  class ResizeObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };

const contextStub: Partial<CanvasRenderingContext2D> = {
  canvas: {} as HTMLCanvasElement,
  setTransform: () => {},
  clearRect: () => {},
  save: () => {},
  translate: () => {},
  rotate: () => {},
  scale: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  quadraticCurveTo: () => {},
  bezierCurveTo: () => {},
  ellipse: () => {},
  closePath: () => {},
  fill: () => {},
  clip: () => {},
  arc: () => {},
  rect: () => {},
  drawImage: () => {},
  stroke: () => {},
  restore: () => {},
  fillRect: () => {},
};

(
  windowInstance.HTMLCanvasElement.prototype as unknown as {
    getContext: HTMLCanvasElement["getContext"];
  }
).getContext = (() =>
  contextStub as CanvasRenderingContext2D) as unknown as HTMLCanvasElement["getContext"];

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

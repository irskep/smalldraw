import { beforeEach } from "bun:test";
import { automergeWasmBase64 } from "@automerge/automerge/automerge.wasm.base64";
import {
  initializeBase64Wasm,
  isWasmInitialized,
} from "@automerge/automerge/slim";
import { Window } from "happy-dom";

if (!isWasmInitialized()) {
  await initializeBase64Wasm(automergeWasmBase64);
}

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

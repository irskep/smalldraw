import { beforeEach } from "bun:test";
import { Window } from "happy-dom";

const windowInstance = new Window();
const { document } = windowInstance;

(globalThis as Record<string, unknown>).window = windowInstance;
(globalThis as Record<string, unknown>).document = document;
(globalThis as Record<string, unknown>).HTMLElement = windowInstance.HTMLElement;
(globalThis as Record<string, unknown>).SVGElement = windowInstance.SVGElement;
(globalThis as Record<string, unknown>).navigator = windowInstance.navigator;
(globalThis as Record<string, unknown>).Node = windowInstance.Node;
(globalThis as Record<string, unknown>).MouseEvent = windowInstance.MouseEvent;

beforeEach(() => {
  document.body.replaceChildren();
});

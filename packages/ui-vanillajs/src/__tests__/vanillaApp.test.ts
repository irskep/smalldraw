import { describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { Canvas, Image } from 'canvas';

import { createVanillaDrawingApp } from '../createVanillaDrawingApp';

function setupDom() {
  const windowInstance = new Window();
  const { document } = windowInstance;
  (globalThis as any).window = windowInstance as any;
  (globalThis as any).document = document;
  (globalThis as any).HTMLElement = windowInstance.HTMLElement;
  (globalThis as any).HTMLCanvasElement = Canvas as unknown as typeof windowInstance.HTMLCanvasElement;
  (globalThis as any).HTMLImageElement = Image as unknown as typeof windowInstance.HTMLImageElement;
  (globalThis as any).navigator = windowInstance.navigator;
  (globalThis as any).PointerEvent = (windowInstance as any).PointerEvent ?? windowInstance.MouseEvent;
  const container = document.createElement('div');
  document.body.appendChild(container);
  return { window: windowInstance, document, container };
}

function stubOverlayRect(overlay: HTMLElement, width: number, height: number) {
  overlay.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    width,
    height,
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    toJSON() {
      return {};
    },
  }) as DOMRect;
}

function dispatchPointer(overlay: HTMLElement, type: string, x: number, y: number, buttons = 1) {
  const PointerCtor = (globalThis as any).PointerEvent ?? globalThis.MouseEvent;
  const event = new PointerCtor(type, {
    bubbles: true,
    clientX: x,
    clientY: y,
    buttons,
    pointerId: 1,
  });
  overlay.dispatchEvent(event);
}

describe('createVanillaDrawingApp', () => {
  test('draws a rectangle via pointer interaction', () => {
    const { container } = setupDom();
    const app = createVanillaDrawingApp({ container, width: 300, height: 200 });
    const rectBtn = container.querySelector('[data-tool="rect"]') as HTMLButtonElement;
    rectBtn?.click();

    const overlay = container.querySelector('.smalldraw-overlay') as HTMLElement;
    stubOverlayRect(overlay, 300, 200);

    dispatchPointer(overlay, 'pointerdown', 50, 50, 1);
    dispatchPointer(overlay, 'pointermove', 180, 150, 1);
    dispatchPointer(overlay, 'pointerup', 180, 150, 0);

    const shapes = Object.values(app.store.getDocument().shapes);
    expect(shapes).toHaveLength(1);
    expect(shapes[0]?.geometry.type).toBe('rect');
    app.destroy();
  });

  test('updates shared colors via palette clicks', () => {
    const { container } = setupDom();
    const app = createVanillaDrawingApp({ container });
    const strokeRow = container.querySelector('[data-role="stroke-swatches"]');
    const target = strokeRow?.querySelector('button[data-color="#ff4b4b"]') as HTMLButtonElement;
    target?.click();
    expect(app.store.getSharedSettings().strokeColor.toLowerCase()).toBe('#ff4b4b');
    app.destroy();
  });

  test('selects and undoes shapes via toolbar controls', () => {
    const { container } = setupDom();
    const app = createVanillaDrawingApp({ container, width: 320, height: 240 });
    const rectBtn = container.querySelector('[data-tool="rect"]') as HTMLButtonElement;
    rectBtn?.click();
    const overlay = container.querySelector('.smalldraw-overlay') as HTMLElement;
    stubOverlayRect(overlay, 320, 240);
    dispatchPointer(overlay, 'pointerdown', 40, 40, 1);
    dispatchPointer(overlay, 'pointermove', 140, 120, 1);
    dispatchPointer(overlay, 'pointerup', 140, 120, 0);

    const selectBtn = container.querySelector('[data-tool="selection"]') as HTMLButtonElement;
    selectBtn?.click();
    dispatchPointer(overlay, 'pointerdown', 90, 80, 1);
    dispatchPointer(overlay, 'pointerup', 90, 80, 0);
    expect(app.store.getSelection().ids.size).toBe(1);

    const undoBtn = container.querySelector('button[data-action="undo"]') as HTMLButtonElement;
    undoBtn?.click();
    expect(Object.values(app.store.getDocument().shapes)).toHaveLength(0);
    app.destroy();
  });
});

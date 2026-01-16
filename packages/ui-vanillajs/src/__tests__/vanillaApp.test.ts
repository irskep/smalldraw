import { describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import { Canvas, Image } from 'canvas';

import { createVanillaDrawingApp } from '../createVanillaDrawingApp';

// happy-dom types don't match standard DOM types, so we cast through unknown
function qs<T extends Element>(container: HTMLElement, selector: string): T | null {
  return container.querySelector(selector) as unknown as T | null;
}

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
  // Cast to standard DOM type for use with createVanillaDrawingApp
  return { window: windowInstance, document, container: container as unknown as HTMLElement };
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
    const rectBtn = qs<HTMLButtonElement>(container, '[data-tool="rect"]');
    rectBtn?.click();

    const overlay = qs<HTMLElement>(container, '.smalldraw-overlay')!;
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
    const strokeRow = qs<HTMLElement>(container, '[data-role="stroke-swatches"]');
    const target = qs<HTMLButtonElement>(strokeRow!, 'button[data-color="#ff4b4b"]');
    target?.click();
    expect(app.store.getSharedSettings().strokeColor.toLowerCase()).toBe('#ff4b4b');
    app.destroy();
  });

  test('selects and undoes shapes via toolbar controls', () => {
    const { container } = setupDom();
    const app = createVanillaDrawingApp({ container, width: 320, height: 240 });
    const rectBtn = qs<HTMLButtonElement>(container, '[data-tool="rect"]');
    rectBtn?.click();
    const overlay = qs<HTMLElement>(container, '.smalldraw-overlay')!;
    stubOverlayRect(overlay, 320, 240);
    dispatchPointer(overlay, 'pointerdown', 40, 40, 1);
    dispatchPointer(overlay, 'pointermove', 140, 120, 1);
    dispatchPointer(overlay, 'pointerup', 140, 120, 0);

    const selectBtn = qs<HTMLButtonElement>(container, '[data-tool="selection"]');
    selectBtn?.click();
    dispatchPointer(overlay, 'pointerdown', 90, 80, 1);
    dispatchPointer(overlay, 'pointerup', 90, 80, 0);
    expect(app.store.getSelection().ids.size).toBe(1);

    const undoBtn = qs<HTMLButtonElement>(container, 'button[data-action="undo"]');
    undoBtn?.click();
    expect(Object.values(app.store.getDocument().shapes)).toHaveLength(0);
    app.destroy();
  });

  test('axis handles follow rotated rectangle geometry', () => {
    const { container } = setupDom();
    const app = createVanillaDrawingApp({ container, width: 300, height: 300 });
    const doc = app.store.getDocument();
    const shapeId = 'rot-rect';
    doc.shapes[shapeId] = {
      id: shapeId,
      geometry: { type: 'rect', size: { width: 40, height: 20 } },
      zIndex: 'z',
      interactions: { resizable: true, rotatable: true },
      transform: {
        translation: { x: 0, y: 0 },
        rotation: Math.PI / 4,
        scale: { x: 1, y: 1 },
      },
    };
    app.store.activateTool('selection');
    app.store.setSelection([shapeId], shapeId);
    const overlay = qs<HTMLElement>(container, '.smalldraw-overlay')!;
    stubOverlayRect(overlay, 300, 300);
    dispatchPointer(overlay, 'pointermove', 150, 150, 0);

    const axisHandle = qs<HTMLElement>(container, '[data-handle="mid-right"]')!;
    expect(axisHandle).not.toBeNull();
    const handleTop = parseFloat(axisHandle.style.top);
    const handleHeight = parseFloat(axisHandle.style.height);
    const centerY = handleTop + handleHeight / 2;
    expect(centerY).not.toBeCloseTo(0, 3);
    app.destroy();
  });
});

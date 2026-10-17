import { afterEach, describe, expect, test } from "bun:test";
import {
  getLoadedRasterImage,
  onDeferredImageLoaded,
  registerRasterImage,
  resetRasterImageCache,
  waitForRasterImage,
} from "../../shapes/rasterImageCache";

const originalImage = globalThis.Image;

afterEach(() => {
  globalThis.Image = originalImage;
  resetRasterImageCache();
});

type FakeImageInstance = {
  complete: boolean;
  naturalWidth: number;
  naturalHeight: number;
  decoding: string;
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
};

function createFakeImage(opts?: { immediatelyReady?: boolean }): {
  FakeImageClass: new () => FakeImageInstance;
  getOnloadHandler: () => (() => void) | null;
  getInstance: () => FakeImageInstance | null;
} {
  const immediatelyReady = opts?.immediatelyReady ?? false;
  let onloadHandler: (() => void) | null = null;
  let instance: FakeImageInstance | null = null;

  class FakeImage {
    complete = immediatelyReady;
    naturalWidth = immediatelyReady ? 100 : 0;
    naturalHeight = immediatelyReady ? 100 : 0;
    decoding = "";
    src = "";
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor() {
      instance = this as unknown as FakeImageInstance;
      if (immediatelyReady) {
        return;
      }
      // biome-ignore lint/correctness/noConstructorReturn: test mock
      return new Proxy(this, {
        set(target, prop, value) {
          if (prop === "onload") {
            onloadHandler = value as () => void;
          }
          (target as Record<string | symbol, unknown>)[prop] = value;
          return true;
        },
      });
    }
  }

  return {
    FakeImageClass: FakeImage as unknown as new () => FakeImageInstance,
    getOnloadHandler: () => onloadHandler,
    getInstance: () => instance,
  };
}

describe("deferred image loading", () => {
  test("waiters share a pending load and settle on success, failure, or timeout", async () => {
    const { FakeImageClass, getInstance } = createFakeImage();
    globalThis.Image = FakeImageClass as unknown as typeof Image;
    const first = waitForRasterImage("ready");
    const image = getInstance()!;
    const second = waitForRasterImage("ready");
    expect(getInstance()).toBe(image);
    image.complete = true;
    image.naturalWidth = image.naturalHeight = 10;
    image.onload!();
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    const failed = waitForRasterImage("failed");
    getInstance()!.onerror!();
    expect(await failed).toBe(false);
    expect(await waitForRasterImage("timeout", 1)).toBe(false);
    const replacement = waitForRasterImage("replacement");
    registerRasterImage("replacement", {
      width: 10,
      height: 10,
    } as HTMLCanvasElement);
    expect(await replacement).toBe(true);
  });

  test("reuses the pending image and ignores superseded load callbacks", () => {
    const { FakeImageClass, getInstance, getOnloadHandler } = createFakeImage();
    globalThis.Image = FakeImageClass as unknown as typeof Image;
    let notifications = 0;
    onDeferredImageLoaded(() => notifications++);
    getLoadedRasterImage("pending");
    const first = getInstance();
    for (let i = 0; i < 10; i++)
      expect(getLoadedRasterImage("pending")).toBeNull();
    expect(getInstance()).toBe(first);
    const staleLoad = getOnloadHandler()!;
    const staleError = first!.onerror!;
    const replacement = { width: 10, height: 10 } as HTMLCanvasElement;
    registerRasterImage("pending", replacement);
    staleLoad();
    staleError();
    expect(notifications).toBe(0);
    expect(getLoadedRasterImage("pending")).toBe(replacement);
  });

  test("retries failed loads after a cooldown instead of permanently blacklisting them", () => {
    const originalNow = Date.now;
    let now = 100;
    Date.now = () => now;
    try {
      const { FakeImageClass, getInstance } = createFakeImage();
      globalThis.Image = FakeImageClass as unknown as typeof Image;
      getLoadedRasterImage("retry");
      const first = getInstance()!;
      first.onerror!();
      expect(getLoadedRasterImage("retry")).toBeNull();
      expect(getInstance()).toBe(first);
      now += 5000;
      getLoadedRasterImage("retry");
      expect(getInstance()).not.toBe(first);
    } finally {
      Date.now = originalNow;
    }
  });

  test("listener fires when a deferred image finishes loading", () => {
    const { FakeImageClass, getOnloadHandler } = createFakeImage();
    globalThis.Image = FakeImageClass as unknown as typeof Image;

    let callCount = 0;
    onDeferredImageLoaded(() => {
      callCount++;
    });

    // First call starts async load, returns null
    const result = getLoadedRasterImage("data:image/png;base64,abc");
    expect(result).toBeNull();

    // Simulate the image finishing loading
    const onloadHandler = getOnloadHandler();
    expect(onloadHandler).not.toBeNull();
    onloadHandler!();

    expect(callCount).toBe(1);
  });

  test("disposed listener does not fire", () => {
    const { FakeImageClass, getOnloadHandler } = createFakeImage();
    globalThis.Image = FakeImageClass as unknown as typeof Image;

    let callCount = 0;
    const dispose = onDeferredImageLoaded(() => {
      callCount++;
    });

    getLoadedRasterImage("data:image/png;base64,def");
    dispose();

    getOnloadHandler()!();
    expect(callCount).toBe(0);
  });

  test("multiple listeners all fire on deferred load", () => {
    const { FakeImageClass, getOnloadHandler } = createFakeImage();
    globalThis.Image = FakeImageClass as unknown as typeof Image;

    let count1 = 0;
    let count2 = 0;
    onDeferredImageLoaded(() => {
      count1++;
    });
    onDeferredImageLoaded(() => {
      count2++;
    });

    getLoadedRasterImage("data:image/png;base64,ghi");
    getOnloadHandler()!();

    expect(count1).toBe(1);
    expect(count2).toBe(1);
  });

  test("already-loaded image does not trigger deferred listener", () => {
    const { FakeImageClass } = createFakeImage({ immediatelyReady: true });
    globalThis.Image = FakeImageClass as unknown as typeof Image;

    let callCount = 0;
    onDeferredImageLoaded(() => {
      callCount++;
    });

    // Image is immediately ready, should return it
    const result = getLoadedRasterImage("data:image/png;base64,jkl");
    expect(result).not.toBeNull();

    // No deferred load happened, so listener should not have fired
    expect(callCount).toBe(0);
  });

  test("cached ready image on second call does not re-trigger listener", () => {
    const { FakeImageClass, getOnloadHandler, getInstance } = createFakeImage();
    globalThis.Image = FakeImageClass as unknown as typeof Image;

    let callCount = 0;
    onDeferredImageLoaded(() => {
      callCount++;
    });

    // First call: not ready yet
    const first = getLoadedRasterImage("data:image/png;base64,mno");
    expect(first).toBeNull();

    // Simulate load completing
    const fakeInstance = getInstance()!;
    fakeInstance.complete = true;
    fakeInstance.naturalWidth = 50;
    fakeInstance.naturalHeight = 50;
    getOnloadHandler()!();
    expect(callCount).toBe(1);

    // Second call: should return cached image without creating new Image
    const second = getLoadedRasterImage("data:image/png;base64,mno");
    expect(second).not.toBeNull();
    // Listener count unchanged
    expect(callCount).toBe(1);
  });
});

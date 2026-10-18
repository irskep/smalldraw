import { spyOn } from "bun:test";
import { createCanvas } from "canvas";

// Give the DOM canvases real backing pixels while retaining their DOM identity.
export function useNativeCanvases() {
  const canvases = new WeakMap<
    HTMLCanvasElement,
    ReturnType<typeof createCanvas>
  >();
  const nativeCanvas = (canvas: HTMLCanvasElement) => {
    let native = canvases.get(canvas);
    if (!native) {
      native = createCanvas(canvas.width, canvas.height);
      canvases.set(canvas, native);
      for (const dimension of ["width", "height"] as const) {
        const backing = native;
        Object.defineProperty(canvas, dimension, {
          configurable: true,
          get: () => backing[dimension],
          set: (value: number) => {
            backing[dimension] = value;
          },
        });
      }
    }
    return native;
  };
  return spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    function (this: HTMLCanvasElement) {
      const ctx = nativeCanvas(this).getContext("2d");
      return new Proxy(ctx, {
        get(target, key) {
          if (key === "drawImage")
            return (source: HTMLCanvasElement, ...args: number[]) => {
              const image =
                source instanceof HTMLCanvasElement
                  ? nativeCanvas(source)
                  : source;
              Reflect.apply(target.drawImage, target, [image, ...args]);
            };
          const value = Reflect.get(target, key);
          return typeof value === "function" ? value.bind(target) : value;
        },
        set(target, key, value) {
          return Reflect.set(target, key, value);
        },
      }) as unknown as CanvasRenderingContext2D;
    } as unknown as HTMLCanvasElement["getContext"],
  );
}

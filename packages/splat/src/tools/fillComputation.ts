import type { FillPixelsRequest, FillPixelsResult } from "./fillPixels";

/** One in-flight fill per tool activation; disposal releases both CPU and memory. */
export function createFillComputation(workerUrl?: URL) {
  let worker: Worker | undefined;
  let pending:
    | {
        resolve: (pixels: FillPixelsResult | null) => void;
        reject: (error: Error) => void;
      }
    | undefined;
  return {
    compute(request: FillPixelsRequest): Promise<FillPixelsResult | null> {
      if (pending) throw new Error("A fill is already computing");
      if (!worker) {
        // Both hosts emit this asset beside their HTML entry point.
        const url = workerUrl ?? new URL("fill-worker.js", document.baseURI);
        worker = new Worker(url, { type: "module" });
      }
      let rejectRequest!: (error: Error) => void;
      const result = new Promise<FillPixelsResult | null>((resolve, reject) => {
        pending = { resolve, reject };
        rejectRequest = reject;
      });
      worker.onmessage = (event: MessageEvent<FillPixelsResult | null>) => {
        const current = pending;
        pending = undefined;
        current?.resolve(event.data);
      };
      worker.onerror = (event) => {
        const current = pending;
        pending = undefined;
        worker?.terminate();
        worker = undefined;
        current?.reject(new Error(event.message));
      };
      try {
        worker.postMessage(request, [request.imageData.buffer]);
      } catch (error) {
        rejectRequest(
          error instanceof Error ? error : new Error(String(error)),
        );
        pending = undefined;
        worker.terminate();
        worker = undefined;
      }
      return result;
    },
    dispose() {
      worker?.terminate();
      worker = undefined;
      pending?.resolve(null);
      pending = undefined;
    },
  };
}

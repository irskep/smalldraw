import type { Server, ServerResponse } from "node:http";

/** One lifecycle for readiness and signal handling; callers own resource cleanup. */
export class ServerLifecycle {
  ready = false;
  draining = false;
  private shutdown?: Promise<void>;
  private requests = 0;
  private requestsFinished?: () => void;

  trackResponse(response: ServerResponse): void {
    this.requests++;
    response.once("finish", () => {
      this.requests--;
      if (!this.requests) this.requestsFinished?.();
    });
    // A disconnected client may still have a mutation running. Do not treat
    // "close" as completion; the shutdown deadline covers unfinished responses.
  }

  drain(
    server: Server,
    stopNetwork: () => Promise<void>,
    flush: () => Promise<void>,
  ): Promise<void> {
    if (this.shutdown) return this.shutdown;
    this.draining = true;
    this.ready = false;
    this.shutdown = (async () => {
      // Bun's close callback can remain pending after a WebSocket upgrade.
      // Stop accepting connections, but wait on our accepted responses explicitly.
      server.close();
      server.closeIdleConnections();
      const httpFinished = this.requests
        ? new Promise<void>((resolve) => {
            this.requestsFinished = resolve;
          })
        : Promise.resolve();
      await Promise.all([httpFinished, stopNetwork()]);
      await flush();
    })();
    return this.shutdown;
  }
}

import { createServer } from "node:http";
import { monitorEventLoopDelay } from "node:perf_hooks";

const buckets = [0.005, 0.025, 0.1, 0.5, 1, 5];

/** Fixed-size counters only: no document, account, or URL labels. */
export class ServerMetrics {
  private checkpoints = { saved: 0, resync: 0, error: 0 };
  private durations = buckets.map(() => 0);
  private durationSum = 0;

  checkpoint(outcome: keyof ServerMetrics["checkpoints"], seconds: number) {
    this.checkpoints[outcome]++;
    this.durationSum += seconds;
    buckets.forEach((upper, index) => {
      if (seconds <= upper) this.durations[index]++;
    });
  }

  render(gauges: {
    residentDocuments: number;
    sockets: number;
    eventLoopDelay: number;
  }): string {
    const count = Object.values(this.checkpoints).reduce((a, b) => a + b, 0);
    return [
      "# TYPE splatterboard_checkpoints_total counter",
      ...Object.entries(this.checkpoints).map(
        ([outcome, value]) =>
          `splatterboard_checkpoints_total{outcome="${outcome}"} ${value}`,
      ),
      "# TYPE splatterboard_checkpoint_duration_seconds histogram",
      ...buckets.map(
        (upper, index) =>
          `splatterboard_checkpoint_duration_seconds_bucket{le="${upper}"} ${this.durations[index]}`,
      ),
      `splatterboard_checkpoint_duration_seconds_bucket{le="+Inf"} ${count}`,
      `splatterboard_checkpoint_duration_seconds_sum ${this.durationSum}`,
      `splatterboard_checkpoint_duration_seconds_count ${count}`,
      "# TYPE splatterboard_resident_documents gauge",
      `splatterboard_resident_documents ${gauges.residentDocuments}`,
      "# TYPE splatterboard_active_sockets gauge",
      `splatterboard_active_sockets ${gauges.sockets}`,
      "# TYPE splatterboard_event_loop_delay_seconds gauge",
      `splatterboard_event_loop_delay_seconds ${gauges.eventLoopDelay}`,
      "",
    ].join("\n");
  }
}

export const serverMetrics = new ServerMetrics();

export function startMetrics(
  port: number,
  gauges: () => { residentDocuments: number; sockets: number },
) {
  const delay = monitorEventLoopDelay({ resolution: 100 });
  delay.enable();
  let eventLoopDelay = 0;
  const sample = setInterval(() => {
    eventLoopDelay = Number.isFinite(delay.mean) ? delay.mean / 1e9 : 0;
    delay.reset();
  }, 15_000);
  sample.unref();
  const server = createServer((req, res) => {
    if (req.url !== "/metrics") {
      res.writeHead(404).end();
      return;
    }
    res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
    res.end(serverMetrics.render({ ...gauges(), eventLoopDelay }));
  });
  server.on("close", () => {
    clearInterval(sample);
    delay.disable();
  });
  // Fly scrapes this port over its private network; it has no public service mapping.
  server.listen(port, "0.0.0.0");
  return server;
}

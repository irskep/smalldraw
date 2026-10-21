import { expect, test } from "bun:test";
import { createServer } from "node:http";
import { ServerMetrics, startMetrics } from "./metrics";
import { ServerLifecycle } from "./runtime";

test("drain waits for an accepted HTTP request before flushing and is idempotent", async () => {
  const lifecycle = new ServerLifecycle();
  let finish!: () => void;
  let started!: () => void;
  const accepted = new Promise<void>((resolve) => {
    started = resolve;
  });
  const server = createServer((_req, res) => {
    lifecycle.trackResponse(res);
    finish = () => res.end("saved");
    started();
  }).listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  lifecycle.ready = true;
  const response = fetch(`http://127.0.0.1:${address.port}`);
  await accepted;
  let flushes = 0;
  const drain = lifecycle.drain(
    server,
    async () => {},
    async () => {
      flushes++;
    },
  );
  expect(lifecycle.ready).toBe(false);
  expect(lifecycle.draining).toBe(true);
  expect(
    lifecycle.drain(
      server,
      async () => {},
      async () => {
        throw new Error("second flush");
      },
    ),
  ).toBe(drain);
  expect(flushes).toBe(0);
  finish();
  expect(await (await response).text()).toBe("saved");
  await drain;
  expect(flushes).toBe(1);
});

test("metrics use cumulative buckets and bounded outcomes", () => {
  const metrics = new ServerMetrics();
  metrics.checkpoint("saved", 0.02);
  metrics.checkpoint("error", 0.2);
  metrics.checkpoint("resync", 0.001);
  const text = metrics.render({
    residentDocuments: 4,
    sockets: 2,
    eventLoopDelay: 0,
  });
  expect(text).toContain('bucket{le="0.005"} 1');
  expect(text).toContain('bucket{le="0.025"} 2');
  expect(text).toContain('bucket{le="+Inf"} 3');
  expect(text).toContain('checkpoints_total{outcome="error"} 1');
  expect(text).toContain("splatterboard_resident_documents 4");
});

test("internal metrics listener serves Prometheus and closes cleanly on Bun", async () => {
  const server = startMetrics(0, () => ({ residentDocuments: 3, sockets: 1 }));
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No address");
    const response = await fetch(`http://127.0.0.1:${address.port}/metrics`);
    expect(response.headers.get("content-type")).toContain("version=0.0.4");
    expect(await response.text()).toContain("splatterboard_active_sockets 1");
    expect(
      (await fetch(`http://127.0.0.1:${address.port}/healthz`)).status,
    ).toBe(404);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

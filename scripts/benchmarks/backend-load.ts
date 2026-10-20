// Generate fixtures with bench:server:fixtures first. Only creates synthetic documents.
// Production fixtures: BENCH_ORIGIN=https://splatterboard.app/draw mise run bench:server:fixtures
// Load test: BENCH_ORIGIN=https://splatterboard.app mise run bench:server:load > results.json
// Run bench:server:sample separately to collect server resource samples.
// Caps concurrency at four; stops on failed requests or degraded health.
import * as A from "@automerge/automerge";
import { generateAutomergeUrl } from "@automerge/automerge-repo";
import * as cbor from "@automerge/automerge-repo/helpers/cbor.js";

const origin = process.env.BENCH_ORIGIN ?? "http://localhost:3030";
const rounds = 8;
const documents: string[] = [];
const fixtures: { size: string; bytes: number; sha256: string }[] = [];
const runId = crypto.randomUUID();
const stop = new AbortController();
const samples: {
  phase: string;
  operation: string;
  ms: number;
  sent: number;
  received: number;
}[] = [];
let phase = "baseline";
let finished = false;
let failure: string | undefined;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function request<T>(
  operation: string,
  input: unknown,
  label = operation,
): Promise<T> {
  stop.signal.throwIfAborted();
  const body = input instanceof Uint8Array ? input : cbor.encode(input);
  const start = performance.now();
  const response = await fetch(`${origin}/api/v1/documents/${operation}`, {
    method: "POST",
    headers: { "content-type": "application/cbor" },
    body: body as Uint8Array<ArrayBuffer>,
    signal: AbortSignal.any([stop.signal, AbortSignal.timeout(5000)]),
  });
  const bytes = new Uint8Array(await response.arrayBuffer());
  const ms = performance.now() - start;
  if (!response.ok) throw Error(`${operation}: HTTP ${response.status}`);
  const decoded = cbor.decode(bytes) as { result?: T };
  if (!decoded.result) throw Error(`${operation}: missing result`);
  samples.push({
    phase,
    operation: label,
    ms,
    sent: body.length,
    received: bytes.length,
  });
  return decoded.result;
}
// Prepare all Automerge and large CBOR encoding before starting any measurements.
const plans: {
  name: string;
  fixtureBytes: number;
  clients: {
    deviceTag: string;
    updates: { body: Uint8Array; heads: string }[];
  }[];
}[] = [];
for (const size of ["medium", "large"]) {
  const bytes = new Uint8Array(
    await Bun.file(`/tmp/smalldraw-${size}.automerge`).arrayBuffer(),
  );
  const checked = A.load<{
    shapes: Record<string, { geometry: { pointsJson?: unknown } }>;
  }>(bytes);
  try {
    if (
      Object.values(checked.shapes).some(
        (shape) => typeof shape.geometry.pointsJson === "string",
      )
    )
      throw Error(
        "Outdated collaborative-text fixture; rerun bench:server:fixtures against the current editor",
      );
  } finally {
    A.free(checked);
  }
  fixtures.push({
    size,
    bytes: bytes.length,
    sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
  });
  for (const concurrency of [1, 2, 4]) {
    const clients = Array.from({ length: concurrency }, (_, client) => {
      const documentId = generateAutomergeUrl();
      documents.push(documentId);
      const deviceTag = `load-${runId}-${size}-${concurrency}-${client}`;
      let doc = A.load<Record<string, unknown>>(bytes);
      try {
        const updates = Array.from({ length: rounds }, (_, round) => {
          doc = A.change(doc, (d) => {
            d.benchmarkRevision = round;
          });
          return {
            body: cbor.encode({ documentId, deviceTag, content: A.save(doc) }),
            heads: JSON.stringify(A.getHeads(doc).sort()),
          };
        });
        return { deviceTag, updates };
      } finally {
        A.free(doc);
      }
    });
    plans.push({
      name: `${size}-${concurrency}`,
      fixtureBytes: bytes.length,
      clients,
    });
  }
}
const validations: { content: Uint8Array; heads: string }[] = [];
const clientLoopDelays: number[] = [];
let previousTick = performance.now();
const clientLoopTimer = setInterval(() => {
  const now = performance.now();
  clientLoopDelays.push(Math.max(0, now - previousTick - 20));
  previousTick = now;
}, 20);
const health = (async () => {
  while (!finished) {
    const measuredPhase = phase;
    const start = performance.now();
    try {
      const response = await fetch(`${origin}/healthz`, {
        signal: AbortSignal.any([stop.signal, AbortSignal.timeout(2000)]),
      });
      await response.arrayBuffer();
      const ms = performance.now() - start;
      if (!response.ok || ms > 2000) throw Error("Health degraded");
      samples.push({
        phase: measuredPhase,
        operation: "health",
        ms,
        sent: 0,
        received: 0,
      });
    } catch {
      failure = "Health check failed; workload stopped";
      stop.abort();
      return;
    }
    await pause(200);
  }
})();
try {
  await pause(5000);
  for (const plan of plans) {
    phase = plan.name;
    console.error(
      JSON.stringify({
        phase,
        startedAt: new Date().toISOString(),
        fixtureBytes: plan.fixtureBytes,
      }),
    );
    await Promise.all(
      plan.clients.map(async (client) => {
        for (const update of client.updates) {
          const registration = await request<{ joinSecret: string }>(
            "registerCollaborativeDocument",
            update.body,
          );
          for (let open = 0; open < 2; open++) {
            const result = await request<{ content: Uint8Array }>(
              "resolveAnonymousCollaborativeDocument",
              {
                joinSecret: registration.joinSecret,
                deviceTag: client.deviceTag,
              },
              open ? "cachedOpen" : "openAfterWrite",
            );
            validations.push({ content: result.content, heads: update.heads });
          }
          await pause(250);
        }
      }),
    );
    await pause(1000);
  }
} catch (error) {
  failure ??= error instanceof Error ? error.message : String(error);
  stop.abort();
} finally {
  finished = true;
  await health;
  clearInterval(clientLoopTimer);
  // Validate only after every timed request and health probe has completed.
  for (const check of validations) {
    const loaded = A.load(check.content);
    try {
      if (JSON.stringify(A.getHeads(loaded).sort()) !== check.heads)
        failure = "Persisted heads mismatch";
    } finally {
      A.free(loaded);
    }
  }
  clientLoopDelays.sort((a, b) => a - b);
  const groups = new Map<string, typeof samples>();
  for (const sample of samples) {
    const key = `${sample.phase}/${sample.operation}`;
    const group = groups.get(key) ?? [];
    group.push(sample);
    groups.set(key, group);
  }
  const summary = Array.from(groups, ([key, values]) => {
    const times = values.map((v) => v.ms).sort((a, b) => a - b);
    return {
      key,
      n: times.length,
      p50: times[Math.ceil(times.length * 0.5) - 1],
      p95: times[Math.ceil(times.length * 0.95) - 1],
      max: times.at(-1),
      sent: values.reduce((n, v) => n + v.sent, 0),
      received: values.reduce((n, v) => n + v.received, 0),
    };
  });
  console.log(
    JSON.stringify(
      {
        origin,
        runId,
        documents,
        fixtures,
        rounds,
        failure,
        clientLoopDelayMs: {
          max: clientLoopDelays.at(-1),
          p95: clientLoopDelays[Math.ceil(clientLoopDelays.length * 0.95) - 1],
        },
        method:
          "Guest full-snapshot share updates with metadata edits, followed by first and cached opens. No WebSocket drawing or authenticated checkpoints. Encoding is precomputed and Automerge validation is deferred outside the timed run.",
        summary,
        samples,
      },
      null,
      2,
    ),
  );
  if (failure) process.exitCode = 1;
}

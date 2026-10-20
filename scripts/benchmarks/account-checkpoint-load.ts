// Bounded authenticated checkpoint comparison; creates synthetic account/documents only.
// Full and incremental requests use the SAME deployed endpoint and incremental reply format.
// All change generation/encoding and reply validation happen outside timed requests.
import * as A from "@automerge/automerge";
import { generateAutomergeUrl } from "@automerge/automerge-repo";
import * as cbor from "@automerge/automerge-repo/helpers/cbor.js";
import * as opaque from "@serenity-kit/opaque";
import type { DrawingCheckpointResult } from "@smalldraw/shared";
import { createTRPCUntypedClient, httpBatchLink } from "@trpc/client";

const origin = process.env.BENCH_ORIGIN ?? "http://localhost:3030";
const rounds = 8;
const runId = crypto.randomUUID();
let cookie = "";
const rpc = createTRPCUntypedClient({
  links: [
    httpBatchLink({
      url: `${origin}/api/v1`,
      async fetch(url, options) {
        const response = await fetch(url, {
          ...options,
          headers: { ...options?.headers, cookie },
          signal: AbortSignal.timeout(10000),
        });
        const setCookie = response.headers.getSetCookie();
        if (setCookie.length)
          cookie = setCookie.map((value) => value.split(";")[0]).join("; ");
        return response;
      },
    }),
  ],
});
await opaque.ready;
const password = crypto.randomUUID();
const userIdentifier = `checkpoint-bench-${runId}`;
const registration = opaque.client.startRegistration({ password });
const response = (await rpc.mutation("registerStart", {
  userIdentifier,
  registrationRequest: registration.registrationRequest,
})) as { registrationResponse: string };
const { registrationRecord } = opaque.client.finishRegistration({
  ...registration,
  password,
  registrationResponse: response.registrationResponse,
});
await rpc.mutation("registerFinish", { userIdentifier, registrationRecord });
const login = opaque.client.startLogin({ password });
const challenge = (await rpc.mutation("loginStart", {
  userIdentifier,
  startLoginRequest: login.startLoginRequest,
})) as { loginResponse: string };
const proof = opaque.client.finishLogin({
  ...login,
  password,
  loginResponse: challenge.loginResponse,
});
if (!proof) throw Error("Benchmark login failed");
const { userId: accountId } = (await rpc.mutation("loginFinish", {
  userIdentifier,
  finishLoginRequest: proof.finishLoginRequest,
})) as { userId: string };
const plans = [];
const fixtures = [];
for (const size of ["medium", "large"]) {
  const bytes = new Uint8Array(
    await Bun.file(`/tmp/smalldraw-${size}.automerge`).arrayBuffer(),
  );
  fixtures.push({
    size,
    bytes: bytes.length,
    sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
  });
  for (const concurrency of [1, 2, 4]) {
    for (const mode of concurrency === 2
      ? ["incremental", "full"]
      : ["full", "incremental"]) {
      const clients = Array.from({ length: concurrency }, () => {
        const documentId = generateAutomergeUrl().replace("automerge:", "");
        let doc = A.load<{ shapes: Record<string, Record<string, unknown>> }>(
          bytes,
        );
        try {
          const stroke = Object.values(A.toJS(doc).shapes)[0];
          if (!stroke) throw Error("Fixture has no stroke");
          const updates = Array.from({ length: rounds }, (_, round) => {
            const baseHeads = A.getHeads(doc);
            doc = A.change(doc, (draft) => {
              draft.shapes[`bench-${round}`] = {
                ...stroke,
                id: `bench-${round}`,
              };
            });
            const heads = A.getHeads(doc);
            return {
              heads: JSON.stringify(heads.sort()),
              body: cbor.encode({
                accountId,
                documentId,
                heads,
                baseHeads: mode === "full" ? null : baseHeads,
                content:
                  mode === "full" ? A.save(doc) : A.saveSince(doc, baseHeads),
              }),
            };
          });
          return {
            documentId,
            bootstrap: cbor.encode({ accountId, documentId, content: bytes }),
            updates,
          };
        } finally {
          A.free(doc);
        }
      });
      plans.push({ name: `${size}-${concurrency}-${mode}`, clients });
    }
  }
}
const stop = new AbortController();
const samples: {
  phase: string;
  operation: string;
  ms: number;
  sent: number;
  received: number;
}[] = [];
const phases: { phase: string; at: string }[] = [];
const validations: { heads: string; content: Uint8Array }[] = [];
let phase = "baseline";
let finished = false;
let failure: string | undefined;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function transfer(
  operation: string,
  body: Uint8Array,
  timed = true,
): Promise<unknown> {
  stop.signal.throwIfAborted();
  const start = performance.now();
  const result = await fetch(`${origin}/api/v1/documents/${operation}`, {
    method: "POST",
    headers: { cookie, "content-type": "application/cbor" },
    body: body as Uint8Array<ArrayBuffer>,
    signal: AbortSignal.any([stop.signal, AbortSignal.timeout(5000)]),
  });
  const bytes = new Uint8Array(await result.arrayBuffer());
  const ms = performance.now() - start;
  if (!result.ok) throw Error(`${operation}: HTTP ${result.status}`);
  const decoded = cbor.decode(bytes) as { result: unknown };
  if (timed)
    samples.push({
      phase,
      operation,
      ms,
      sent: body.length,
      received: bytes.length,
    });
  return decoded.result;
}
const health = (async () => {
  while (!finished) {
    const measuredPhase = phase;
    const start = performance.now();
    try {
      const response = await fetch(`${origin}/healthz`, {
        signal: AbortSignal.any([stop.signal, AbortSignal.timeout(2000)]),
      });
      await response.arrayBuffer();
      if (!response.ok) throw Error("Unhealthy");
      samples.push({
        phase: measuredPhase,
        operation: "health",
        ms: performance.now() - start,
        sent: 0,
        received: 0,
      });
    } catch {
      failure = "Health degraded; stopped";
      stop.abort();
      return;
    }
    await pause(200);
  }
})();
try {
  await pause(3000);
  for (const plan of plans) {
    phase = `${plan.name}-bootstrap`;
    for (const client of plan.clients)
      await transfer("registerAccountSyncedDocument", client.bootstrap, false);
    phase = plan.name;
    phases.push({ phase, at: new Date().toISOString() });
    console.error(JSON.stringify(phases.at(-1)));
    await Promise.all(
      plan.clients.map(async (client) => {
        for (const update of client.updates) {
          const ack = (await transfer(
            "checkpointAccountDrawing",
            update.body,
          )) as DrawingCheckpointResult;
          if (
            ack.status !== "saved" ||
            JSON.stringify(ack.heads.sort()) !== update.heads ||
            ack.content.length !== 0
          )
            throw Error("Incorrect checkpoint acknowledgement");
          await pause(250);
        }
      }),
    );
    phases.push({ phase: `${plan.name}-end`, at: new Date().toISOString() });
    phase = `${plan.name}-validate`;
    for (const client of plan.clients) {
      const opened = (await transfer(
        "resolveAccountCollaborativeDocument",
        cbor.encode({ documentId: client.documentId, deviceTag: runId }),
        false,
      )) as { content: Uint8Array };
      validations.push({
        content: opened.content,
        heads: client.updates[rounds - 1].heads,
      });
    }
    await pause(1000);
  }
} catch (error) {
  failure ??= String(error);
  stop.abort();
} finally {
  finished = true;
  await health;
  for (const check of validations) {
    const doc = A.load(check.content);
    try {
      if (JSON.stringify(A.getHeads(doc).sort()) !== check.heads)
        failure = "Saved drawing mismatch";
    } finally {
      A.free(doc);
    }
  }
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
      sent: values.reduce((n, v) => n + v.sent, 0),
      received: values.reduce((n, v) => n + v.received, 0),
    };
  });
  console.log(
    JSON.stringify(
      {
        origin,
        runId,
        accountId,
        rounds,
        fixtures,
        phases,
        documents: plans.flatMap((p) => p.clients.map((c) => c.documentId)),
        failure,
        validated: validations.length,
        method:
          "Precomputed real-stroke edits; full vs incremental upload on current checkpoint endpoint (both replies incremental). Bootstrap and validation excluded. Sequential phases, concurrency capped at 4, 250ms between requests. No capacity claim.",
        summary,
        samples,
      },
      null,
      2,
    ),
  );
  if (failure) process.exitCode = 1;
}

import * as A from "@automerge/automerge";
import { cbor } from "@automerge/automerge-repo";
const doc = A.from({
  points: new A.ImmutableString(
    JSON.stringify(Array.from({ length: 64000 }, (_, i) => [i / 7, i % 900])),
  ),
});
const bytes = A.save(doc);
for (const binary of [false, true]) {
  const times: number[] = [];
  let payloadBytes = 0;
  for (let i = 0; i < 105; i++) {
    const start = performance.now();
    const payload = binary
      ? cbor.encode({ documentId: "example", content: bytes })
      : JSON.stringify({
          documentId: "example",
          content: Buffer.from(bytes).toString("base64"),
        });
    payloadBytes = payload.length;
    const decoded = binary
      ? cbor.decode(payload as Uint8Array)
      : JSON.parse(payload as string);
    const restored = binary
      ? decoded.content
      : Buffer.from(decoded.content, "base64");
    const elapsed = performance.now() - start;
    if (!Buffer.from(restored).equals(Buffer.from(bytes)))
      throw Error("Bytes changed");
    if (i >= 5) times.push(elapsed);
  }
  times.sort((a, b) => a - b);
  console.log(
    JSON.stringify({ binary, payloadBytes, medianRoundTripMs: times[50] }),
  );
}
A.free(doc);

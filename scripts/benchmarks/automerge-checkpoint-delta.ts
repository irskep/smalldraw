// Compare full snapshots with the changes needed after one additional real fixture stroke.
// CPU numbers are local; this does not implement or measure a new network protocol.
import * as A from "@automerge/automerge";

for (const size of ["medium", "large"]) {
  const bytes = new Uint8Array(
    await Bun.file(`/tmp/smalldraw-${size}.automerge`).arrayBuffer(),
  );
  const original = A.load<{ shapes: Record<string, Record<string, unknown>> }>(
    bytes,
  );
  let changed = A.clone(original);
  const stroke = Object.values(A.toJS(original).shapes)[0];
  if (!stroke) throw new Error("Fixture has no strokes");
  changed = A.change(changed, (draft) => {
    draft.shapes["benchmark-new-stroke"] = {
      ...stroke,
      id: "benchmark-new-stroke",
    };
  });
  const heads = A.getHeads(original);
  const rows = [];
  for (const incremental of [false, true]) {
    const encodeMs = [];
    let output: Uint8Array = new Uint8Array();
    for (let i = 0; i < 25; i++) {
      const start = performance.now();
      output = incremental ? A.saveSince(changed, heads) : A.save(changed);
      if (i >= 5) encodeMs.push(performance.now() - start);
    }
    const restored = incremental
      ? A.loadIncremental(A.clone(original), output)
      : A.load<{ shapes: Record<string, Record<string, unknown>> }>(output);
    if (
      JSON.stringify(A.getHeads(restored).sort()) !==
      JSON.stringify(A.getHeads(changed).sort())
    )
      throw Error("Heads mismatch");
    if (
      Object.keys(restored.shapes).length !==
      Object.keys(original.shapes).length + 1
    )
      throw Error("Stroke missing");
    A.free(restored);
    encodeMs.sort((a, b) => a - b);
    rows.push({
      incremental,
      bytes: output.length,
      encodeMedianMs: encodeMs[10],
    });
  }
  console.log(JSON.stringify({ size, rows }));
  A.free(changed);
  A.free(original);
}

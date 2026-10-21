import { isDeepStrictEqual } from "node:util";

// Controlled fresh documents: identical state/history, only stroke text representation differs.
// This does not change the application format. ImmutableString needs explicit decoding at its boundary.
import * as A from "@automerge/automerge";
for (const name of ["small", "medium", "large"]) {
  const original = A.load(
    new Uint8Array(
      await Bun.file(`/tmp/smalldraw-${name}.automerge`).arrayBuffer(),
    ),
  );
  const plain = A.toJS(original) as any;
  // Fixtures exported by the app now already contain atomic coordinates.
  // Normalize to JSON before constructing either controlled representation.
  for (const shape of Object.values(plain.shapes) as any[]) {
    if (A.isImmutableString(shape.geometry.pointsJson))
      shape.geometry.pointsJson = shape.geometry.pointsJson.toString();
  }
  A.free(original);
  for (const encoding of ["text", "immutable"]) {
    const value = structuredClone(plain);
    if (encoding === "immutable")
      for (const shape of Object.values(value.shapes) as any[]) {
        if (typeof shape.geometry.pointsJson === "string")
          shape.geometry.pointsJson = new A.ImmutableString(
            shape.geometry.pointsJson,
          );
      }
    const doc = A.from(value);
    const binary = A.save(doc);
    const { numOps } = A.stats(doc);
    A.free(doc);
    const times: number[] = [];
    for (let i = 0; i < 25; i++) {
      const start = performance.now();
      const loaded = A.load(binary);
      const elapsed = performance.now() - start;
      if (i === 0) {
        const decoded = A.toJS(loaded) as any;
        for (const shape of Object.values(decoded.shapes) as any[]) {
          if (shape.geometry.pointsJson instanceof A.ImmutableString)
            shape.geometry.pointsJson = shape.geometry.pointsJson.toString();
        }
        if (!isDeepStrictEqual(decoded, plain))
          throw Error("Stroke encoding changed drawing");
      }
      A.free(loaded);
      if (i >= 5) times.push(elapsed);
    }
    times.sort((a, b) => a - b);
    console.log(
      JSON.stringify({
        name,
        encoding,
        bytes: binary.length,
        numOps,
        load: times[10],
      }),
    );
  }
}

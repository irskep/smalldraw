// Run with bun; deterministic synthetic PNG, 5 warmups and 20 measured loads.
import * as A from "@automerge/automerge";
import { createCanvas } from "canvas";
const canvas = createCanvas(900, 1200);
const ctx = canvas.getContext("2d");
for (let i = 0; i < 80; i++) {
  ctx.fillStyle = `hsl(${(i * 47) % 360},70%,50%)`;
  ctx.beginPath();
  ctx.arc((i * 113) % 900, (i * 197) % 1200, 20 + (i % 70), 0, Math.PI * 2);
  ctx.fill();
}
const src = canvas.toDataURL();
for (const atomic of [false, true]) {
  const doc = A.from({
    geometry: {
      type: "raster-fill",
      src: atomic ? new A.ImmutableString(src) : src,
      width: 900,
      height: 1200,
    },
  });
  const bytes = A.save(doc);
  const times: number[] = [];
  for (let i = 0; i < 25; i++) {
    const start = performance.now();
    const loaded = A.load<typeof doc>(bytes);
    const elapsed = performance.now() - start;
    if (loaded.geometry.src.toString() !== src) throw Error("Image changed");
    A.free(loaded);
    if (i >= 5) times.push(elapsed);
  }
  times.sort((a, b) => a - b);
  console.log(
    JSON.stringify({
      atomic,
      imageCharacters: src.length,
      bytes: bytes.length,
      numOps: A.stats(doc).numOps,
      medianLoadMs: times[10],
    }),
  );
  A.free(doc);
}

import "@automerge/automerge";
// Private API only for diagnosis: bypass JS materialization, using the same WASM backend.
const { ApiHandler } = await import(
  new URL(
    "../../node_modules/@automerge/automerge/dist/mjs/low_level.js",
    import.meta.url,
  ).href
);
await import(
  new URL(
    "../../node_modules/@automerge/automerge/dist/mjs/entrypoints/fullfat_base64.js",
    import.meta.url,
  ).href
);
for (const name of ["small", "medium", "large"]) {
  const bytes = new Uint8Array(
    await Bun.file(`/tmp/smalldraw-${name}.automerge`).arrayBuffer(),
  );
  const loads = [],
    saves = [];
  for (let i = 0; i < 25; i++) {
    const start = performance.now();
    const doc = ApiHandler.load(bytes, {});
    const l = performance.now() - start;
    const s = performance.now();
    doc.save();
    const elapsed = performance.now() - s;
    doc.free();
    if (i >= 5) {
      loads.push(l);
      saves.push(elapsed);
    }
  }
  loads.sort((a, b) => a - b);
  saves.sort((a, b) => a - b);
  console.log(JSON.stringify({ name, rawLoad: loads[10], rawSave: saves[10] }));
}

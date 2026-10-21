const expected = (
  await Bun.file(new URL("../.bun-version", import.meta.url)).text()
).trim();
if (!/^\d+\.\d+\.\d+$/.test(expected) || Bun.version !== expected) {
  throw new Error(
    "Expected bun@" +
      expected +
      ", running bun@" +
      Bun.version +
      ". Run mise install and use mise exec -- bun (do not bun upgrade a mise-managed install).",
  );
}
export {};

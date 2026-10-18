// Serve Mermaid locally so diagrams do not depend on a third-party CDN.
await Bun.write(
  new URL("../../../docs/assets/mermaid.min.js", import.meta.url),
  Bun.file(new URL("./mermaid.min.js", import.meta.resolve("mermaid"))),
);

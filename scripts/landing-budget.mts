import { gzipSync } from "node:zlib";

import type { Plugin, Rolldown } from "vite";

type Chunk = Pick<
  Rolldown.OutputChunk,
  "fileName" | "code" | "imports" | "moduleIds" | "isEntry"
>;

// Anonymous landing baseline: ~186 KB raw / 63 KB gzip, including lazy Home.
// Gzip is a repeatable comparison, not a claim about Fly's negotiated encoding.
// Review added dependencies before raising these limits; account/editor code is lazy.
const limits = { raw: 240_000, gzip: 80_000 };

export function checkLandingBudget(chunks: Chunk[]) {
  const entries = chunks.filter((chunk) => chunk.isEntry);
  const home = chunks.filter((chunk) =>
    chunk.moduleIds.some((id) =>
      id.replace(/\\/g, "/").endsWith("/src/routes/index.lazy.tsx"),
    ),
  );
  if (!entries.length || !home.length)
    throw new Error(
      "Landing budget could not locate entry/Home chunks; update the check if routing changed.",
    );
  const byName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
  const visited = new Set<string>();
  let raw = 0;
  let gzip = 0;
  function visit(chunk: Chunk) {
    if (visited.has(chunk.fileName)) return;
    visited.add(chunk.fileName);
    raw += Buffer.byteLength(chunk.code);
    gzip += gzipSync(chunk.code).byteLength;
    for (const name of chunk.imports) {
      const dependency = byName.get(name);
      if (!dependency)
        throw new Error(`Landing budget cannot account for import: ${name}`);
      visit(dependency);
    }
  }
  for (const chunk of [...entries, ...home]) visit(chunk);
  const summary = `Landing JS: ${raw.toLocaleString("en-US")} / ${limits.raw.toLocaleString("en-US")} bytes raw; ${gzip.toLocaleString("en-US")} / ${limits.gzip.toLocaleString("en-US")} bytes gzip (${visited.size} chunks)`;
  if (raw > limits.raw || gzip > limits.gzip)
    throw new Error(
      `${summary}. Budget exceeded: inspect eager imports before increasing the limit.`,
    );
  return { raw, gzip, files: [...visited], summary };
}

export function landingBudget(): Plugin {
  return {
    name: "landing-javascript-budget",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const result = checkLandingBudget(
        Object.values(bundle).filter((output) => output.type === "chunk"),
      );
      console.log(result.summary);
    },
  };
}

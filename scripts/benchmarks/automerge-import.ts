import * as A from "@automerge/automerge";
import {
  Repo,
  generateAutomergeUrl,
  parseAutomergeUrl,
} from "@automerge/automerge-repo";

import { importValidatedDocument } from "../../apps/server/src/automergeRepo/importValidatedDocument";
const doc = A.from({
  points: new A.ImmutableString(
    JSON.stringify(Array.from({ length: 64000 }, (_, i) => [i / 7, i % 900])),
  ),
});
const binary = A.save(doc);
A.free(doc);
for (const optimized of [false, true]) {
  const times: number[] = [];
  for (let i = 0; i < 25; i++) {
    const repo = new Repo({ network: [] });
    const { documentId } = parseAutomergeUrl(generateAutomergeUrl());
    const start = performance.now();
    const incoming = A.load(binary);
    if (optimized)
      await importValidatedDocument(
        repo,
        { hasDocumentContent: () => false },
        documentId,
        incoming,
      );
    else repo.import(binary, { docId: documentId });
    A.free(incoming);
    const elapsed = performance.now() - start;
    if (i >= 5) times.push(elapsed);
    await repo.removeFromCache(documentId);
    await repo.shutdown();
  }
  times.sort((a, b) => a - b);
  console.log(
    JSON.stringify({ optimized, bytes: binary.length, medianMs: times[10] }),
  );
}

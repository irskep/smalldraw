import {
  clone,
  free,
  getHeads,
  getMissingDeps,
  hasHeads,
  load,
  loadIncremental,
  merge,
  saveSince,
} from "@automerge/automerge";
import type { DocHandle, Repo } from "@automerge/automerge-repo";
import type {
  DrawingCheckpoint,
  DrawingCheckpointResult,
} from "@smalldraw/shared";

/** The reply describes a captured version that flush has made durable. */
export async function checkpointDocument<T>(
  repo: Repo,
  handle: DocHandle<T>,
  input: DrawingCheckpoint,
): Promise<DrawingCheckpointResult> {
  if (input.baseHeads !== null && !hasHeads(handle.doc(), input.baseHeads))
    return { status: "resync" };
  let candidate = clone(handle.doc());
  try {
    if (input.baseHeads === null) {
      const incoming = load<T>(input.content);
      try {
        candidate = merge(candidate, incoming);
      } finally {
        free(incoming);
      }
    } else {
      candidate = loadIncremental(candidate, input.content);
    }
    // A partial change stream can load successfully while dependencies are absent.
    if (
      getMissingDeps(candidate, []).length ||
      !hasHeads(candidate, input.heads)
    )
      return { status: "resync" };
    handle.update((current) => merge(current, candidate));
    const snapshot = handle.doc();
    const result: DrawingCheckpointResult = {
      status: "saved",
      heads: getHeads(snapshot),
      content: saveSince(snapshot, input.heads),
    };
    await repo.flush([handle.documentId]);
    return result;
  } finally {
    free(candidate);
  }
}

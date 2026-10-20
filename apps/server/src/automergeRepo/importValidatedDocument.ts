import { clone, type Doc, free, init, merge, save } from "@automerge/automerge";
import type { DocumentId, Repo } from "@automerge/automerge-repo";

const empty = init();
const emptySnapshot = save(empty);
free(empty);

/** Import an already validated snapshot without decoding it again. Caller owns incoming. */
export async function importValidatedDocument<T>(
  repo: Repo,
  storage: { hasDocumentContent(id: string): boolean },
  documentId: DocumentId,
  incoming: Doc<T>,
) {
  // A cold retry must load saved history before merging, just like a warm retry.
  const existing =
    repo.handles[documentId] ??
    (storage.hasDocumentContent(documentId)
      ? await repo.find<T>(documentId)
      : undefined);
  const handle =
    existing ?? repo.import<T>(emptySnapshot, { docId: documentId });
  if (existing) await handle.whenReady();
  handle.update((current) =>
    existing ? merge(current, incoming) : clone(incoming),
  );
  await handle.whenReady();
  await repo.flush([documentId]);
  return handle;
}

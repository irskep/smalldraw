import { RotateCcw } from "lucide";
import { useRef, useState } from "react";

import {
  DeletedDrawingsList,
  type DeletedDrawingListItem,
} from "@/components/DeletedDrawingsList/DeletedDrawingsList";
import {
  DsConfirmDialog,
  type DsConfirmDialogHandle,
} from "@/components/DsConfirmDialog/DsConfirmDialog";
import { useResource, useAction } from "@/hooks/useResource";
import { api } from "@/utils/api";

function DeletedDrawings() {
  const confirmDialogRef = useRef<DsConfirmDialogHandle>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const deletedDocumentsQuery = useResource(
    (signal) => api.deletedDocuments.query(undefined, { signal }),
    [],
    {},
  );
  const restoreDocumentMutation = useAction(api.restoreDocument.mutate);

  const restoreDocument = async (
    document: DeletedDrawingListItem,
  ): Promise<void> => {
    const confirmed =
      (await confirmDialogRef.current?.confirm({
        title: "Restore drawing?",
        message: "This makes the drawing available in your account again.",
        confirmLabel: "Restore",
        cancelLabel: "Cancel",
        icon: RotateCcw,
      })) ?? false;
    if (!confirmed) {
      return;
    }

    setRestoringId(document.id);
    try {
      await restoreDocumentMutation.run({ id: document.id });
      await deletedDocumentsQuery.reload();
    } finally {
      setRestoringId(null);
    }
  };

  const documents = deletedDocumentsQuery.data ?? [];

  return (
    <section className="portal-page" aria-label="Deleted drawings">
      <div className="portal-page__header">
        <h1 className="portal-title">Deleted drawings</h1>
        <p className="portal-muted">
          These shared drawings are hidden from your regular drawings until you
          restore them.
        </p>
      </div>

      {deletedDocumentsQuery.loading ? (
        <p className="portal-muted">Loading deleted drawings…</p>
      ) : null}

      {deletedDocumentsQuery.error ? (
        <div className="portal-alert" data-tone="danger" role="alert">
          <div className="portal-alert__body">
            <div className="portal-alert__title">
              Deleted drawings could not be loaded
            </div>
            <div>Please try again.</div>
          </div>
        </div>
      ) : null}

      {!deletedDocumentsQuery.error ? (
        <DeletedDrawingsList
          documents={documents}
          emptyLayout="card"
          emptyLabel="No deleted drawings."
          isLoading={deletedDocumentsQuery.loading}
          onRestore={(document) => {
            void restoreDocument(document);
          }}
          restoringId={restoringId}
        />
      ) : null}

      <DsConfirmDialog ref={confirmDialogRef} />
    </section>
  );
}

export default DeletedDrawings;

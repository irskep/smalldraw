import { createLazyFileRoute } from "@tanstack/react-router";
import { RotateCcw } from "lucide";
import { useRef, useState } from "react";
import {
  DsConfirmDialog,
  type DsConfirmDialogHandle,
} from "@/components/DsConfirmDialog/DsConfirmDialog";
import {
  DeletedDrawingsList,
  type DeletedDrawingListItem,
} from "@/components/DeletedDrawingsList/DeletedDrawingsList";
import { trpc } from "../../utils/trpc";

export const Route = createLazyFileRoute("/drawings/deleted")({
  component: DeletedDrawings,
});

function DeletedDrawings() {
  const trpcUtils = trpc.useUtils();
  const confirmDialogRef = useRef<DsConfirmDialogHandle>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const deletedDocumentsQuery = trpc.deletedDocuments.useQuery(undefined, {
    retry: (failureCount) => failureCount < 2,
  });
  const restoreDocumentMutation = trpc.restoreDocument.useMutation();

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
      await restoreDocumentMutation.mutateAsync({ id: document.id });
      await Promise.all([
        trpcUtils.deletedDocuments.invalidate(),
        trpcUtils.documents.invalidate(),
      ]);
    } finally {
      setRestoringId(null);
    }
  };

  const documents = deletedDocumentsQuery.data ?? [];

  return (
    <section className="account-page" aria-label="Deleted drawings">
      <div className="account-page__header">
        <h1 className="account-title">Deleted drawings</h1>
        <p className="account-muted">
          These shared drawings are hidden from your regular drawings until you
          restore them.
        </p>
      </div>

      {deletedDocumentsQuery.isLoading ? (
        <p className="account-muted">Loading deleted drawings…</p>
      ) : null}

      {deletedDocumentsQuery.error ? (
        <div className="account-alert" data-tone="danger" role="alert">
          <div className="account-alert__body">
            <div className="account-alert__title">
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
          isLoading={deletedDocumentsQuery.isLoading}
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

import { createLocalDocumentBackend } from "@smalldraw/splat/documents";
import { createModalDialogView } from "@smalldraw/design-system";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide";
import { useEffect, useMemo, useRef, useState } from "react";
import { mount, unmount } from "redom";
import { DsThumbnailTile } from "@/components/DsThumbnailTile/DsThumbnailTile";
import { buildLauncherDocumentTiles } from "@/utils/documentLauncher";
import {
  buildNewDrawingUrl,
  createAccountWebRuntimeConfig,
} from "@/utils/drawingAppLinks";
import { trpc } from "../utils/trpc";

export const Route = createLazyFileRoute("/")({
  component: Index,
});

type LocalDocumentTileInput = Parameters<
  typeof buildLauncherDocumentTiles
>[0]["localDocuments"][number];

type LocalCatalogState =
  | { type: "loading" }
  | { type: "loaded"; documents: LocalDocumentTileInput[] }
  | { type: "error"; message: string };

function Index() {
  const runtimeConfig = useMemo(() => createAccountWebRuntimeConfig(), []);
  const trpcUtils = trpc.useUtils();
  const documentBackend = useMemo(
    () =>
      createLocalDocumentBackend({
        currentDocStorageKey: "kids-draw-doc-url",
      }),
    [],
  );
  const modalDialog = useMemo(() => createModalDialogView(), []);
  const localObjectUrlsRef = useRef<string[]>([]);
  const [localCatalog, setLocalCatalog] = useState<LocalCatalogState>({
    type: "loading",
  });
  const [deletingTileKey, setDeletingTileKey] = useState<string | null>(null);
  const meQuery = trpc.me.useQuery(undefined, {
    retry: false,
  });
  const isLoggedIn = Boolean(meQuery.data);
  const documentsQuery = trpc.documents.useQuery(undefined, {
    enabled: isLoggedIn,
    refetchInterval: 5000,
    retry: (failureCount) => failureCount < 2,
  });
  const deleteDocumentMutation = trpc.deleteDocument.useMutation();
  const removeDocumentFromAccountMutation =
    trpc.removeDocumentFromAccount.useMutation();
  const tiles = useMemo(() => {
    const accountDocuments =
      isLoggedIn && !documentsQuery.error ? (documentsQuery.data ?? []) : [];
    return buildLauncherDocumentTiles({
      localDocuments:
        localCatalog.type === "loaded" ? localCatalog.documents : [],
      accountDocuments,
      config: runtimeConfig,
    });
  }, [
    documentsQuery.data,
    documentsQuery.error,
    isLoggedIn,
    localCatalog,
    runtimeConfig,
  ]);

  useEffect(() => {
    mount(document.body, modalDialog);
    return () => {
      unmount(document.body, modalDialog);
    };
  }, [modalDialog]);

  useEffect(() => {
    let disposed = false;

    const loadLocalCatalog = async () => {
      try {
        for (const objectUrl of localObjectUrlsRef.current) {
          URL.revokeObjectURL(objectUrl);
        }
        localObjectUrlsRef.current = [];
        const documents = await documentBackend.listDocuments();
        const documentsWithThumbnails = await Promise.all(
          documents.map(async (document) => {
            const thumbnail = await documentBackend.getThumbnail(
              document.docUrl,
            );
            if (!thumbnail) {
              return document;
            }
            const thumbnailUrl = URL.createObjectURL(thumbnail);
            localObjectUrlsRef.current.push(thumbnailUrl);
            return { ...document, thumbnailUrl };
          }),
        );
        if (!disposed) {
          setLocalCatalog({
            type: "loaded",
            documents: documentsWithThumbnails,
          });
        }
      } catch (error) {
        if (!disposed) {
          setLocalCatalog({
            type: "error",
            message:
              error instanceof Error
                ? error.message
                : "Local drawings could not be loaded.",
          });
        }
      }
    };

    void loadLocalCatalog();

    return () => {
      disposed = true;
      for (const objectUrl of localObjectUrlsRef.current) {
        URL.revokeObjectURL(objectUrl);
      }
      localObjectUrlsRef.current = [];
    };
  }, [documentBackend]);

  const reloadLocalCatalog = async () => {
    const documents = await documentBackend.listDocuments();
    const nextObjectUrls: string[] = [];
    const documentsWithThumbnails = await Promise.all(
      documents.map(async (document) => {
        const thumbnail = await documentBackend.getThumbnail(document.docUrl);
        if (!thumbnail) {
          return document;
        }
        const thumbnailUrl = URL.createObjectURL(thumbnail);
        nextObjectUrls.push(thumbnailUrl);
        return { ...document, thumbnailUrl };
      }),
    );
    for (const objectUrl of localObjectUrlsRef.current) {
      URL.revokeObjectURL(objectUrl);
    }
    localObjectUrlsRef.current = nextObjectUrls;
    setLocalCatalog({ type: "loaded", documents: documentsWithThumbnails });
  };

  const confirmDelete = async (tile: (typeof tiles)[number]) => {
    if (!tile.deleteAction) {
      return;
    }
    const sharedDelete = tile.deleteAction.type === "shared";
    const sharedRemoval = tile.deleteAction.type === "remove-shared";
    const confirmed = await modalDialog.showConfirm({
      title: sharedDelete
        ? "Delete shared drawing?"
        : sharedRemoval
          ? "Remove shared drawing?"
          : "Delete drawing?",
      message: sharedDelete
        ? "This stops syncing and removes server access. People who already opened it may still have a local copy in their browser."
        : sharedRemoval
          ? "This removes the drawing from your account. If it was opened in this browser, the local copy will also be removed. People who already opened it may still have a local copy in their browser."
          : "This deletes the drawing from this browser.",
      confirmLabel: sharedRemoval ? "Remove" : "Delete",
      cancelLabel: "Cancel",
      tone: "danger",
      icon: Trash2,
    });
    if (!confirmed) {
      return;
    }

    setDeletingTileKey(tile.key);
    try {
      if (tile.deleteAction.type === "shared") {
        await deleteDocumentMutation.mutateAsync({
          id: tile.deleteAction.documentId,
        });
        if (tile.deleteAction.localDocUrl) {
          await documentBackend.deleteDocument(tile.deleteAction.localDocUrl);
        }
        await trpcUtils.documents.invalidate();
      } else if (tile.deleteAction.type === "remove-shared") {
        await removeDocumentFromAccountMutation.mutateAsync({
          id: tile.deleteAction.documentId,
        });
        if (tile.deleteAction.localDocUrl) {
          await documentBackend.deleteDocument(tile.deleteAction.localDocUrl);
        }
        await trpcUtils.documents.invalidate();
      } else {
        await documentBackend.deleteDocument(tile.deleteAction.docUrl);
      }
      await reloadLocalCatalog();
    } finally {
      setDeletingTileKey(null);
    }
  };

  return (
    <section className="account-launcher" aria-label="Drawings">
      {localCatalog.type === "error" ? (
        <div className="account-alert" data-tone="danger" role="alert">
          <div className="account-alert__body">
            <div className="account-alert__title">
              Local drawings could not be loaded
            </div>
            <div>{localCatalog.message}</div>
          </div>
        </div>
      ) : null}

      <div className="account-launcher-grid">
        <a
          href={buildNewDrawingUrl(runtimeConfig)}
          className="account-launcher-card account-launcher-card--new"
        >
          <span className="account-launcher-card__media">
            <span
              className="ds-button account-launcher-card__cta"
              data-tone="primary"
            >
              New Drawing
            </span>
          </span>
        </a>

        {tiles.map((tile) => (
          <div key={tile.key} className="account-launcher-card">
            <DsThumbnailTile
              badge={{
                label: tile.badge,
                tone: tile.badge === "Shared" ? "positive" : "default",
              }}
              deleteAction={
                tile.deleteAction
                  ? {
                      label:
                        tile.deleteAction.type === "shared"
                          ? "Delete shared drawing"
                          : tile.deleteAction.type === "remove-shared"
                            ? "Remove shared drawing"
                            : "Delete drawing",
                      icon: Trash2,
                      onPress: () => {
                        void confirmDelete(tile);
                      },
                      disabled: deletingTileKey === tile.key,
                    }
                  : undefined
              }
              emptyLabel="No preview"
              imageAlt={`${tile.title} thumbnail`}
              imageSrc={tile.thumbnailUrl}
              onOpen={() => {
                window.location.href = tile.href;
              }}
              openLabel={`Open ${tile.title}`}
            />
          </div>
        ))}
      </div>

      {localCatalog.type === "loading" ? (
        <p className="account-muted">Loading drawings…</p>
      ) : null}

      {isLoggedIn && documentsQuery.error ? (
        <p className="account-muted">
          Account drawings could not be refreshed right now.
        </p>
      ) : null}
    </section>
  );
}

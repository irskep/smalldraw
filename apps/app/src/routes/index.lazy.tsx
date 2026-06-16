import { createLocalDocumentBackend } from "@smalldraw/splat/documents";
import { createLazyFileRoute } from "@tanstack/react-router";
import { Trash2 } from "lucide";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DsConfirmDialog,
  type DsConfirmDialogHandle,
} from "@/components/DsConfirmDialog/DsConfirmDialog";
import {
  ParentalControlsDialog,
  type ParentalControlsDialogHandle,
} from "@/components/ParentalControlsDialog/ParentalControlsDialog";
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
  const confirmDialogRef = useRef<DsConfirmDialogHandle>(null);
  const parentalControlsDialogRef = useRef<ParentalControlsDialogHandle>(null);
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
    const confirmed =
      (await confirmDialogRef.current?.confirm({
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
      })) ?? false;
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
    <>
      <section className="portal-info">
        <p>
          Splatterboard is a free drawing app for kids. No data is stored on the
          server unless you use the draw-together feature.{" "}
          <button
            className="portal-link-button"
            type="button"
            onClick={() => void parentalControlsDialogRef.current?.open()}
          >
            Parental controls can hide sharing.
          </button>
        </p>
      </section>
      <section className="portal-launcher" aria-label="Drawings">
        {localCatalog.type === "error" ? (
          <div className="portal-alert" data-tone="danger" role="alert">
            <div className="portal-alert__body">
              <div className="portal-alert__title">
                Local drawings could not be loaded
              </div>
              <div>{localCatalog.message}</div>
            </div>
          </div>
        ) : null}

        <div className="portal-launcher-grid">
          <a
            href={buildNewDrawingUrl(runtimeConfig)}
            className="portal-launcher-card portal-launcher-card--new"
          >
            <span className="portal-launcher-card__media">
              <span
                className="ds-button portal-launcher-card__cta"
                data-tone="primary"
              >
                New Drawing
              </span>
            </span>
          </a>

          {tiles.map((tile) => (
            <div key={tile.key} className="portal-launcher-card">
              <DsThumbnailTile
                action={
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
                badge={{
                  label: tile.badge,
                  tone: tile.badge === "Shared" ? "positive" : "default",
                }}
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
          <p className="portal-muted">Loading drawings…</p>
        ) : null}

        {isLoggedIn && documentsQuery.error ? (
          <p className="portal-muted">
            Account drawings could not be refreshed right now.
          </p>
        ) : null}
      </section>
      <DsConfirmDialog ref={confirmDialogRef} />
      <ParentalControlsDialog ref={parentalControlsDialogRef} />
    </>
  );
}

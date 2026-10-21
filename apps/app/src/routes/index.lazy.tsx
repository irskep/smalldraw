import { useAccount } from "@/utils/account";
import { createLocalDocumentBackend } from "@smalldraw/splat/documents";
import { Trash2 } from "lucide";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArtTable } from "@/components/ArtTable/ArtTable";
import {
  DsConfirmDialog,
  type DsConfirmDialogHandle,
} from "@/components/DsConfirmDialog/DsConfirmDialog";
import { DsThumbnailTile } from "@/components/DsThumbnailTile/DsThumbnailTile";
import { buildLauncherDocumentTiles } from "@/utils/documentLauncher";
import {
  buildNewDrawingUrl,
  createAccountWebRuntimeConfig,
} from "@/utils/drawingAppLinks";
import { api } from "@/utils/api";
import { useResource, useAction } from "@/hooks/useResource";

type LocalDocumentTileInput = Parameters<
  typeof buildLauncherDocumentTiles
>[0]["localDocuments"][number];

type LocalCatalogState =
  | { type: "loading" }
  | { type: "loaded"; documents: LocalDocumentTileInput[] }
  | { type: "error"; message: string };

function Index() {
  const runtimeConfig = useMemo(() => createAccountWebRuntimeConfig(), []);
  const documentBackend = useMemo(() => createLocalDocumentBackend(), []);
  const confirmDialogRef = useRef<DsConfirmDialogHandle>(null);
  const localObjectUrlsRef = useRef<string[]>([]);
  const [localCatalog, setLocalCatalog] = useState<LocalCatalogState>({
    type: "loading",
  });
  const [deletingTileKey, setDeletingTileKey] = useState<string | null>(null);
  const meQuery = useAccount();
  const isLoggedIn = Boolean(meQuery.data);
  const documentsQuery = useResource(
    (signal) => api.documents.query(undefined, { signal }),
    [],
    {
      enabled: isLoggedIn,
      interval: 5000,
    },
  );
  const deleteDocumentMutation = useAction(api.deleteDocument.mutate);
  const removeDocumentFromAccountMutation = useAction(
    api.removeDocumentFromAccount.mutate,
  );
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
  const launcherState =
    localCatalog.type === "loading" || (isLoggedIn && documentsQuery.loading)
      ? "loading"
      : localCatalog.type === "loaded" && tiles.length === 0
        ? "empty"
        : "active";

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
    window.addEventListener("drawing-catalog-change", loadLocalCatalog);

    return () => {
      disposed = true;
      window.removeEventListener("drawing-catalog-change", loadLocalCatalog);
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
        await deleteDocumentMutation.run({
          id: tile.deleteAction.documentId,
        });
        if (tile.deleteAction.localDocUrl) {
          await documentBackend.deleteDocument(tile.deleteAction.localDocUrl);
        }
        await documentsQuery.reload();
      } else if (tile.deleteAction.type === "remove-shared") {
        await removeDocumentFromAccountMutation.run({
          id: tile.deleteAction.documentId,
        });
        if (tile.deleteAction.localDocUrl) {
          await documentBackend.deleteDocument(tile.deleteAction.localDocUrl);
        }
        await documentsQuery.reload();
      } else {
        await documentBackend.deleteDocument(tile.deleteAction.docUrl);
      }
      await reloadLocalCatalog();
    } finally {
      setDeletingTileKey(null);
    }
  };

  return (
    <div className="portal-home" data-state={launcherState}>
      {launcherState === "empty" ? (
        <ArtTable
          href={buildNewDrawingUrl(runtimeConfig, { account: isLoggedIn })}
          coloringHref={buildNewDrawingUrl(runtimeConfig, {
            account: isLoggedIn,
            coloring: true,
          })}
        />
      ) : null}
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

        {tiles.length > 0 ? (
          <h1 className="portal-drawings-title">Your drawings</h1>
        ) : null}
        {launcherState === "active" ? (
          <nav className="portal-drawing-actions" aria-label="Create a drawing">
            <a
              href={buildNewDrawingUrl(runtimeConfig, { account: isLoggedIn })}
              className="ds-button"
              data-tone="primary"
            >
              <span aria-hidden="true">+</span>
              New drawing
            </a>
            <a
              href={buildNewDrawingUrl(runtimeConfig, {
                account: isLoggedIn,
                coloring: true,
              })}
              className="ds-button"
              data-tone="primary"
            >
              Pick a coloring page
            </a>
          </nav>
        ) : null}
        <div
          className="portal-launcher-grid"
          hidden={launcherState !== "active"}
        >
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
                badge={
                  tile.badge === "Shared"
                    ? { label: "Shared", tone: "positive" }
                    : null
                }
                emptyLabel="No preview"
                imageAlt={`${tile.title} thumbnail`}
                imageSrc={tile.thumbnailUrl}
                onOpen={() => {
                  const url = new URL(tile.href);
                  if (isLoggedIn) url.searchParams.set("account", "1");
                  window.location.href = url.toString();
                }}
                openLabel={`Open ${tile.title}`}
              />
            </div>
          ))}
        </div>

        {launcherState === "loading" ? (
          <p className="portal-muted">Loading drawings…</p>
        ) : null}

        {isLoggedIn && documentsQuery.error ? (
          <p className="portal-muted">
            Account drawings could not be refreshed right now.
          </p>
        ) : null}
      </section>
      <section className="art-table-about" aria-label="Made for families">
        <div>
          <h2>No ads, no gimmicks</h2>
          <p>
            I’m a dad. I made Splatterboard so my kid could draw. Now your kids
            can use it too.
          </p>
        </div>
        <p>
          {isLoggedIn
            ? "Your drawings sync to your account. You decide when to share."
            : "Drawings are saved on this device. Sign in to keep them in your account."}{" "}
          <a className="portal-link" href="/data">
            How your drawings are stored
          </a>
        </p>
      </section>
      <footer className="portal-home-footer">
        <p>
          Send questions and feedback to{" "}
          <a className="portal-link" href="mailto:splatterboard@fastmail.com">
            splatterboard@fastmail.com
          </a>
        </p>
        <nav
          className="portal-home-footer__links"
          aria-label="Privacy and terms"
        >
          <a className="portal-link" href="/privacy">
            Privacy policy
          </a>
          <a className="portal-link" href="/privacy#analytics">
            Analytics settings
          </a>
          <a className="portal-link" href="/terms">
            Terms of service
          </a>
        </nav>
      </footer>
      <DsConfirmDialog ref={confirmDialogRef} />
    </div>
  );
}

export default Index;

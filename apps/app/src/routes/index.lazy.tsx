import { createLocalDocumentBackend } from "@smalldraw/splat/documents";
import { createLazyFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  const [localCatalog, setLocalCatalog] = useState<LocalCatalogState>({
    type: "loading",
  });
  const meQuery = trpc.me.useQuery(undefined, {
    retry: false,
  });
  const isLoggedIn = Boolean(meQuery.data);
  const documentsQuery = trpc.documents.useQuery(undefined, {
    enabled: isLoggedIn,
    refetchInterval: 5000,
    retry: (failureCount) => failureCount < 2,
  });
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
    const objectUrls: string[] = [];
    const documentBackend = createLocalDocumentBackend({
      currentDocStorageKey: "kids-draw-doc-url",
    });

    void (async () => {
      try {
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
            objectUrls.push(thumbnailUrl);
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
    })();

    return () => {
      disposed = true;
      for (const objectUrl of objectUrls) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, []);

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
          <a
            key={tile.key}
            href={tile.href}
            className="account-launcher-card"
            aria-label={`Open ${tile.title}`}
          >
            <span className="account-launcher-card__badge">{tile.badge}</span>
            <span className="account-launcher-card__media">
              {tile.thumbnailUrl ? (
                <img src={tile.thumbnailUrl} alt={`${tile.title} thumbnail`} />
              ) : (
                <span className="account-launcher-card__empty">No preview</span>
              )}
            </span>
          </a>
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

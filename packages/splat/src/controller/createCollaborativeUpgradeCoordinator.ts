import type { KidsDocumentBackend } from "../documents";
import { buildJoinUrl, isCollaborativeDocument } from "../documents";
import type { KidsDocumentSummary } from "../documents/types";

export type SharePayload = {
  catalogDocUrl: string;
  collabDocUrl: string;
  joinSecret: string;
  joinUrl: string;
  upgraded: boolean;
};

export function createCollaborativeUpgradeCoordinator(options: {
  documentBackend: Pick<
    KidsDocumentBackend,
    "getDocument" | "createDocument" | "setCurrentDocument"
  >;
  getCurrentCatalogDocUrl: () => string;
  createDocumentCopy: () => { url: string; binary: Uint8Array };
  registerCollaborativeDocument: (
    documentId: string,
    content: Uint8Array,
  ) => Promise<{ joinSecret: string }>;
  switchToDocument: (catalogDocUrl: string) => Promise<void>;
  resolveJoinBaseUrl: () => string;
  onCollaborativeMetadataPersisted?: (
    summary: KidsDocumentSummary,
  ) => Promise<void> | void;
}) {
  const pendingCollaborativeByCatalogDocUrl = new Map<
    string,
    { collabDocUrl: string; binary: Uint8Array; joinSecret?: string }
  >();

  const ensureCollaborative = async (): Promise<SharePayload> => {
    const startMs = Date.now();
    const catalogDocUrl = options.getCurrentCatalogDocUrl();
    console.info("[kids-draw:multiplayer] share flow: ensure start", {
      catalogDocUrl,
    });
    const existing = await options.documentBackend.getDocument(catalogDocUrl);
    if (isCollaborativeDocument(existing) && existing.joinSecret) {
      console.info(
        "[kids-draw:multiplayer] share flow: already collaborative",
        {
          catalogDocUrl,
          collabDocUrl: existing.collabDocUrl,
        },
      );
      return {
        catalogDocUrl,
        collabDocUrl: existing.collabDocUrl,
        joinSecret: existing.joinSecret,
        joinUrl: buildJoinUrl(
          existing.joinSecret,
          options.resolveJoinBaseUrl(),
        ),
        upgraded: false,
      };
    }

    const pending = pendingCollaborativeByCatalogDocUrl.get(catalogDocUrl);
    let collabDocUrl: string;
    let binary: Uint8Array;
    let joinSecret: string | undefined;

    if (pending) {
      collabDocUrl = pending.collabDocUrl;
      binary = pending.binary;
      joinSecret = pending.joinSecret;
    } else {
      console.info(
        "[kids-draw:multiplayer] share flow: creating document copy",
      );
      const copy = options.createDocumentCopy();
      collabDocUrl = copy.url;
      binary = copy.binary;
      pendingCollaborativeByCatalogDocUrl.set(catalogDocUrl, {
        collabDocUrl,
        binary,
      });
    }

    if (!joinSecret) {
      console.info(
        "[kids-draw:multiplayer] share flow: registering with server",
        { collabDocUrl },
      );
      const registered = await options.registerCollaborativeDocument(
        collabDocUrl,
        binary,
      );
      joinSecret = registered.joinSecret;
      pendingCollaborativeByCatalogDocUrl.set(catalogDocUrl, {
        collabDocUrl,
        binary,
        joinSecret,
      });
    }

    const persistedSummary = await options.documentBackend.createDocument({
      docUrl: catalogDocUrl,
      collaborative: true,
      collabDocUrl,
      joinSecret,
    });
    await options.onCollaborativeMetadataPersisted?.(persistedSummary);
    console.info("[kids-draw:multiplayer] share flow: metadata persisted");

    console.info("[kids-draw:multiplayer] share flow: switch start", {
      catalogDocUrl,
    });
    await options.switchToDocument(catalogDocUrl);
    console.info("[kids-draw:multiplayer] share flow: switch complete");
    await options.documentBackend.setCurrentDocument(catalogDocUrl);
    pendingCollaborativeByCatalogDocUrl.delete(catalogDocUrl);
    console.info("[kids-draw:multiplayer] share flow: complete", {
      elapsedMs: Date.now() - startMs,
      catalogDocUrl,
      collabDocUrl,
    });

    return {
      catalogDocUrl,
      collabDocUrl,
      joinSecret,
      joinUrl: buildJoinUrl(joinSecret, options.resolveJoinBaseUrl()),
      upgraded: true,
    };
  };

  return {
    ensureCollaborative,
  };
}

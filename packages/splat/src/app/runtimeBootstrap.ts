import { createSmalldraw, type DrawingDocumentSize } from "@smalldraw/core";
import type { SmalldrawCore } from "@smalldraw/core";
import {
  createLocalSmalldrawRepo,
  type KidsDocumentBackend,
  type LocalSmalldrawRepo,
  resolveDocumentOpenUrl,
} from "../documents";
import { createKidsShapeHandlerRegistry } from "../shapes/kidsShapeHandlers";
import { resolveCollaborativeDocumentId } from "./documentBootstrap";

export async function bootstrapKidsDrawRuntime(options: {
  providedCore?: SmalldrawCore;
  websocketUrl?: string;
  websocketAuthToken: string | null;
  websocketAuthorizedDocumentId: string | null;
  hasCollaborativeDocumentId(documentId: string): Promise<boolean>;
  onWebsocketConnectedChange(connected: boolean): void;
  documentBackend: KidsDocumentBackend;
  initialCatalogDocUrlOverride?: string | null;
  preImports: Array<{ binary: Uint8Array; docId: string }>;
  documentSize: DrawingDocumentSize;
  shapeHandlers: ReturnType<typeof createKidsShapeHandlerRegistry>;
}): Promise<{ core: SmalldrawCore; localRepo: LocalSmalldrawRepo | null }> {
  if (options.providedCore) {
    return {
      core: options.providedCore,
      localRepo: null,
    };
  }

  const localRepo = createLocalSmalldrawRepo({
    websocketUrl: options.websocketUrl,
    websocketAuthToken: options.websocketAuthToken ?? undefined,
    websocketAuthorizedDocumentId:
      options.websocketAuthorizedDocumentId ?? undefined,
    isCollaborativeDocumentId: async (documentId: string) => {
      const resolvedId = resolveCollaborativeDocumentId(documentId);
      const allowed = await options.hasCollaborativeDocumentId(resolvedId);
      console.info("[kids-draw:multiplayer] collaborative id lookup", {
        documentId,
        resolvedId,
        allowed,
      });
      return allowed;
    },
    onWebsocketConnectedChange: options.onWebsocketConnectedChange,
  });
  const core = await createSmalldraw({
    repo: localRepo,
    preImports: options.preImports,
    persistence: {
      mode: "reuse",
      getCurrentDocUrl: async () => {
        if (options.initialCatalogDocUrlOverride !== undefined) {
          if (!options.initialCatalogDocUrlOverride) {
            return null;
          }
          const summary = await options.documentBackend.getDocument(
            options.initialCatalogDocUrlOverride,
          );
          return resolveDocumentOpenUrl(
            options.initialCatalogDocUrlOverride,
            summary,
          );
        }
        const currentCatalogDocUrl =
          await options.documentBackend.getCurrentDocument();
        if (!currentCatalogDocUrl) {
          return null;
        }
        const summary =
          await options.documentBackend.getDocument(currentCatalogDocUrl);
        return resolveDocumentOpenUrl(currentCatalogDocUrl, summary);
      },
      setCurrentDocUrl: (url) => options.documentBackend.setCurrentDocument(url),
    },
    documentSize: options.documentSize,
    shapeHandlers: options.shapeHandlers,
  });

  return {
    core,
    localRepo,
  };
}

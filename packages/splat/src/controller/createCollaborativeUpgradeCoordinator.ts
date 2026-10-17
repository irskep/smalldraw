import type { KidsDocumentBackend } from "../documents";
import {
  automergeUrlToDocumentId,
  buildJoinUrl,
  isCollaborativeDocument,
} from "../documents";
import type { KidsDocumentSummary } from "../documents/types";

export type SharePayload = {
  catalogDocUrl: string;
  collabDocUrl: string;
  joinSecret: string;
  accessToken: string;
  accessTokenScope: "owner";
  joinUrl: string;
  upgraded: boolean;
};

export type AccountSyncPayload = {
  catalogDocUrl: string;
  collabDocUrl: string;
  accessToken: string;
  accessTokenScope: "owner";
  synced: boolean;
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
  ) => Promise<{
    joinSecret: string;
    accessToken: string;
    accessTokenScope: "owner";
  }>;
  registerAccountSyncedDocument?: (
    documentId: string,
    content: Uint8Array,
  ) => Promise<{
    accessToken: string;
    accessTokenScope: "owner";
  }>;
  createShareInvitation?: (documentId: string) => Promise<{ token: string }>;
  switchToDocument: (catalogDocUrl: string) => Promise<void>;
  resolveJoinBaseUrl: () => string;
  onCollaborativeMetadataPersisted?: (
    summary: KidsDocumentSummary,
  ) => Promise<void> | void;
}) {
  const pendingCollaborativeByCatalogDocUrl = new Map<
    string,
    {
      collabDocUrl: string;
      binary: Uint8Array;
      joinSecret?: string;
      accessToken?: string;
    }
  >();

  const ensureCollaborative = async (): Promise<SharePayload> => {
    const startMs = Date.now();
    const catalogDocUrl = options.getCurrentCatalogDocUrl();
    console.info("[kids-draw:multiplayer] share flow: ensure start", {
      catalogDocUrl,
    });
    const existing = await options.documentBackend.getDocument(catalogDocUrl);
    if (isCollaborativeDocument(existing) && existing.joinSecret) {
      if (!existing.accessToken || existing.accessTokenScope !== "owner") {
        throw new Error(
          "Collaborative document metadata is missing its owner access token.",
        );
      }
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
        accessToken: existing.accessToken,
        accessTokenScope: "owner",
        joinUrl: buildJoinUrl(
          existing.joinSecret,
          options.resolveJoinBaseUrl(),
        ),
        upgraded: false,
      };
    }
    if (isCollaborativeDocument(existing) && !existing.joinSecret) {
      if (!existing.accessToken || existing.accessTokenScope !== "owner") {
        throw new Error(
          "Collaborative document metadata is missing its owner access token.",
        );
      }
      if (!options.createShareInvitation) {
        throw new Error("Share invitation API is not configured");
      }
      const documentId = automergeUrlToDocumentId(existing.collabDocUrl);
      if (!documentId) {
        throw new Error("Collaborative document URL is invalid.");
      }
      const invitation = await options.createShareInvitation(documentId);
      const persistedSummary = await options.documentBackend.createDocument({
        docUrl: catalogDocUrl,
        collaborative: true,
        collabDocUrl: existing.collabDocUrl,
        joinSecret: invitation.token,
        accessToken: existing.accessToken,
        accessTokenScope: existing.accessTokenScope,
        accountAttached: existing.accountAttached,
        canDeleteFromServer: existing.canDeleteFromServer,
      });
      await options.onCollaborativeMetadataPersisted?.(persistedSummary);
      return {
        catalogDocUrl,
        collabDocUrl: existing.collabDocUrl,
        joinSecret: invitation.token,
        accessToken: existing.accessToken,
        accessTokenScope: "owner",
        joinUrl: buildJoinUrl(invitation.token, options.resolveJoinBaseUrl()),
        upgraded: false,
      };
    }

    const pending = pendingCollaborativeByCatalogDocUrl.get(catalogDocUrl);
    let collabDocUrl: string;
    let binary: Uint8Array;
    let joinSecret: string | undefined;
    let accessToken: string | undefined;

    if (pending) {
      collabDocUrl = pending.collabDocUrl;
      binary = pending.binary;
      joinSecret = pending.joinSecret;
      accessToken = pending.accessToken;
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
      accessToken = registered.accessToken;
      pendingCollaborativeByCatalogDocUrl.set(catalogDocUrl, {
        collabDocUrl,
        binary,
        joinSecret,
        accessToken,
      });
    }

    if (!joinSecret || !accessToken) {
      throw new Error("Collaborative registration did not return both tokens.");
    }

    const persistedSummary = await options.documentBackend.createDocument({
      docUrl: catalogDocUrl,
      collaborative: true,
      collabDocUrl,
      joinSecret,
      accessToken,
      accessTokenScope: "owner",
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
      accessToken,
      accessTokenScope: "owner",
      joinUrl: buildJoinUrl(joinSecret, options.resolveJoinBaseUrl()),
      upgraded: true,
    };
  };

  const ensureAccountSynced = async (): Promise<AccountSyncPayload> => {
    const catalogDocUrl = options.getCurrentCatalogDocUrl();
    const existing = await options.documentBackend.getDocument(catalogDocUrl);
    if (
      isCollaborativeDocument(existing) &&
      existing.accessToken &&
      existing.accessTokenScope === "owner"
    ) {
      return {
        catalogDocUrl,
        collabDocUrl: existing.collabDocUrl,
        accessToken: existing.accessToken,
        accessTokenScope: "owner",
        synced: false,
      };
    }
    if (!options.registerAccountSyncedDocument) {
      throw new Error("Account sync API is not configured");
    }
    await options.documentBackend.createDocument({
      docUrl: catalogDocUrl,
      accountSyncPending: true,
      accountSyncLastAttemptAt: new Date().toISOString(),
    });
    const copy = options.createDocumentCopy();
    const registered = await options.registerAccountSyncedDocument(
      copy.url,
      copy.binary,
    );
    const persistedSummary = await options.documentBackend.createDocument({
      docUrl: catalogDocUrl,
      collaborative: true,
      collabDocUrl: copy.url,
      accessToken: registered.accessToken,
      accessTokenScope: "owner",
      accountAttached: true,
      canDeleteFromServer: true,
      accountSyncPending: false,
    });
    await options.onCollaborativeMetadataPersisted?.(persistedSummary);
    await options.switchToDocument(catalogDocUrl);
    await options.documentBackend.setCurrentDocument(catalogDocUrl);
    return {
      catalogDocUrl,
      collabDocUrl: copy.url,
      accessToken: registered.accessToken,
      accessTokenScope: "owner",
      synced: true,
    };
  };

  return {
    ensureCollaborative,
    ensureAccountSynced,
  };
}

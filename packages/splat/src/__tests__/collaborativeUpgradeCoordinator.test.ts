import { describe, expect, test } from "bun:test";
import { createCollaborativeUpgradeCoordinator } from "../controller/createCollaborativeUpgradeCoordinator";

describe("createCollaborativeUpgradeCoordinator", () => {
  test("upgrades local document and returns join payload", async () => {
    const getDocumentCalls: string[] = [];
    const createDocumentInputs: Array<Record<string, unknown>> = [];
    const callOrder: string[] = [];
    const callbackSummaries: Array<{ docUrl: string; collabDocUrl?: string }> =
      [];
    const switched: string[] = [];
    const setCurrentCalls: string[] = [];
    const registeredDocs: Array<{
      documentId: string;
      contentLength: number;
    }> = [];

    const coordinator = createCollaborativeUpgradeCoordinator({
      documentBackend: {
        async getDocument(docUrl) {
          getDocumentCalls.push(docUrl);
          return {
            docUrl,
            mode: "normal",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            lastOpenedAt: "2026-01-01T00:00:00.000Z",
          };
        },
        async createDocument(input) {
          callOrder.push("createDocument");
          createDocumentInputs.push({ ...input });
          return {
            docUrl: input.docUrl,
            mode: "normal",
            collaborative: input.collaborative,
            collabDocUrl: input.collabDocUrl,
            joinSecret: input.joinSecret,
            accessToken: input.accessToken,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            lastOpenedAt: "2026-01-01T00:00:00.000Z",
          };
        },
        async setCurrentDocument(docUrl) {
          setCurrentCalls.push(docUrl);
        },
      },
      getCurrentCatalogDocUrl: () => "automerge:catalog-doc",
      createDocumentCopy: () => ({
        url: "automerge:collab-doc",
        binary: new Uint8Array([1, 2, 3]),
      }),
      registerCollaborativeDocument: async (documentId, content) => {
        callOrder.push("registerCollaborativeDocument");
        registeredDocs.push({
          documentId,
          contentLength: content.length,
        });
        return {
          joinSecret: "join-secret-1",
          accessToken: "access-token-1",
          accessTokenScope: "owner",
        };
      },
      onCollaborativeMetadataPersisted(summary) {
        callOrder.push("onCollaborativeMetadataPersisted");
        callbackSummaries.push({
          docUrl: summary.docUrl,
          collabDocUrl: summary.collabDocUrl,
        });
      },
      switchToDocument: async (catalogDocUrl) => {
        switched.push(catalogDocUrl);
      },
      resolveJoinBaseUrl: () => "https://splatterboard.app/draw",
    });

    const result = await coordinator.ensureCollaborative();

    expect(result).toEqual({
      catalogDocUrl: "automerge:catalog-doc",
      collabDocUrl: "automerge:collab-doc",
      joinSecret: "join-secret-1",
      accessToken: "access-token-1",
      accessTokenScope: "owner",
      joinUrl: "https://splatterboard.app/draw?join=join-secret-1",
      upgraded: true,
    });
    expect(getDocumentCalls).toEqual(["automerge:catalog-doc"]);
    expect(registeredDocs).toEqual([
      { documentId: "automerge:collab-doc", contentLength: 3 },
    ]);
    expect(callOrder).toEqual([
      "registerCollaborativeDocument",
      "createDocument",
      "onCollaborativeMetadataPersisted",
    ]);
    expect(callbackSummaries).toEqual([
      {
        docUrl: "automerge:catalog-doc",
        collabDocUrl: "automerge:collab-doc",
      },
    ]);
    expect(createDocumentInputs).toEqual([
      {
        docUrl: "automerge:catalog-doc",
        collaborative: true,
        collabDocUrl: "automerge:collab-doc",
        joinSecret: "join-secret-1",
        accessToken: "access-token-1",
        accessTokenScope: "owner",
      },
    ]);
    expect(switched).toEqual(["automerge:catalog-doc"]);
    expect(setCurrentCalls).toEqual(["automerge:catalog-doc"]);
  });

  test("returns existing collaborative metadata without migration", async () => {
    let created = false;
    let switched = false;

    const coordinator = createCollaborativeUpgradeCoordinator({
      documentBackend: {
        async getDocument(docUrl) {
          return {
            docUrl,
            mode: "normal",
            collaborative: true,
            collabDocUrl: "automerge:existing-collab",
            joinSecret: "existing-secret",
            accessToken: "existing-access",
            accessTokenScope: "owner",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            lastOpenedAt: "2026-01-01T00:00:00.000Z",
          };
        },
        async createDocument() {
          created = true;
          throw new Error("unexpected");
        },
        async setCurrentDocument() {},
      },
      getCurrentCatalogDocUrl: () => "automerge:catalog-doc",
      createDocumentCopy: () => {
        throw new Error("unexpected");
      },
      registerCollaborativeDocument: async () => {
        throw new Error("unexpected");
      },
      switchToDocument: async () => {
        switched = true;
      },
      resolveJoinBaseUrl: () => "https://splatterboard.app",
    });

    const result = await coordinator.ensureCollaborative();
    expect(result).toEqual({
      catalogDocUrl: "automerge:catalog-doc",
      collabDocUrl: "automerge:existing-collab",
      joinSecret: "existing-secret",
      accessToken: "existing-access",
      accessTokenScope: "owner",
      joinUrl: "https://splatterboard.app/?join=existing-secret",
      upgraded: false,
    });
    expect(created).toBeFalse();
    expect(switched).toBeFalse();
  });

  test("keeps collaborative metadata when switch fails", async () => {
    const createDocumentInputs: Array<Record<string, unknown>> = [];

    const coordinator = createCollaborativeUpgradeCoordinator({
      documentBackend: {
        async getDocument(docUrl) {
          return {
            docUrl,
            mode: "normal",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            lastOpenedAt: "2026-01-01T00:00:00.000Z",
          };
        },
        async createDocument(input) {
          createDocumentInputs.push({ ...input });
          return {
            docUrl: input.docUrl,
            mode: "normal",
            collaborative: input.collaborative,
            collabDocUrl: input.collabDocUrl,
            joinSecret: input.joinSecret,
            accessToken: input.accessToken,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            lastOpenedAt: "2026-01-01T00:00:00.000Z",
          };
        },
        async setCurrentDocument() {},
      },
      getCurrentCatalogDocUrl: () => "automerge:catalog-doc",
      createDocumentCopy: () => ({
        url: "automerge:collab-doc",
        binary: new Uint8Array([1, 2, 3]),
      }),
      registerCollaborativeDocument: async () => ({
        joinSecret: "join-secret-1",
        accessToken: "access-token-1",
        accessTokenScope: "owner",
      }),
      switchToDocument: async () => {
        throw new Error("switch failed");
      },
      resolveJoinBaseUrl: () => "https://splatterboard.app",
    });

    await expect(coordinator.ensureCollaborative()).rejects.toThrow(
      "switch failed",
    );
    expect(createDocumentInputs).toEqual([
      {
        docUrl: "automerge:catalog-doc",
        collaborative: true,
        collabDocUrl: "automerge:collab-doc",
        joinSecret: "join-secret-1",
        accessToken: "access-token-1",
        accessTokenScope: "owner",
      },
    ]);
  });

  test("reuses pending collaborative document on retry after register failure", async () => {
    let createDocumentCopyCalls = 0;
    let registerCalls = 0;
    let shouldFailRegister = true;

    const coordinator = createCollaborativeUpgradeCoordinator({
      documentBackend: {
        async getDocument(docUrl) {
          return {
            docUrl,
            mode: "normal",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            lastOpenedAt: "2026-01-01T00:00:00.000Z",
          };
        },
        async createDocument(input) {
          return {
            docUrl: input.docUrl,
            mode: "normal",
            collaborative: input.collaborative,
            collabDocUrl: input.collabDocUrl,
            joinSecret: input.joinSecret,
            accessToken: input.accessToken,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            lastOpenedAt: "2026-01-01T00:00:00.000Z",
          };
        },
        async setCurrentDocument() {},
      },
      getCurrentCatalogDocUrl: () => "automerge:catalog-doc",
      createDocumentCopy: () => {
        createDocumentCopyCalls += 1;
        return {
          url: "automerge:collab-doc",
          binary: new Uint8Array([1, 2, 3]),
        };
      },
      registerCollaborativeDocument: async () => {
        registerCalls += 1;
        if (shouldFailRegister) {
          shouldFailRegister = false;
          throw new Error("register failed");
        }
        return {
          joinSecret: "join-secret-1",
          accessToken: "access-token-1",
          accessTokenScope: "owner",
        };
      },
      switchToDocument: async () => {},
      resolveJoinBaseUrl: () => "https://splatterboard.app",
    });

    await expect(coordinator.ensureCollaborative()).rejects.toThrow(
      "register failed",
    );
    const result = await coordinator.ensureCollaborative();
    expect(result.collabDocUrl).toBe("automerge:collab-doc");
    expect(result.joinSecret).toBe("join-secret-1");
    expect(result.accessToken).toBe("access-token-1");
    expect(result.accessTokenScope).toBe("owner");
    expect(createDocumentCopyCalls).toBe(1);
    expect(registerCalls).toBe(2);
  });
});

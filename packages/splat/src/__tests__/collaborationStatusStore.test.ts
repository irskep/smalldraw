import { describe, expect, test } from "bun:test";
import { createCollaborationStatusStore } from "../controller/stores/createCollaborationStatusStore";

describe("createCollaborationStatusStore", () => {
  test("hides status for local-only documents", () => {
    const store = createCollaborationStatusStore();
    store.setCurrentDocument({
      docUrl: "automerge:local-1",
      mode: "normal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
    });
    store.setWebsocketConnected(true);

    expect(store.getStatus()).toEqual({ visible: false });
  });

  test("shows online/offline labels for collaborative docs", () => {
    const store = createCollaborationStatusStore();
    store.setCurrentDocument({
      docUrl: "automerge:local-1",
      collaborative: true,
      collabDocUrl: "automerge:collab-1",
      joinSecret: "join-secret-1",
      mode: "normal",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
    });

    store.setWebsocketConnected(false);
    expect(store.getStatus()).toMatchObject({
      visible: true,
      state: "offline",
      label: "Collab drawing (offline)",
      docUrl: "automerge:local-1",
      collabDocUrl: "automerge:collab-1",
    });

    store.setWebsocketConnected(true);
    expect(store.getStatus()).toMatchObject({
      visible: true,
      state: "online",
      label: "Collab drawing (online)",
      docUrl: "automerge:local-1",
      collabDocUrl: "automerge:collab-1",
    });
  });
});

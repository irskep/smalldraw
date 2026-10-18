import { getHeads, load, merge } from "@automerge/automerge/slim";
import type { AutomergeUrl, Repo } from "@automerge/automerge-repo/slim";
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb";
import { initAutomerge } from "@smalldraw/core";
import { atom } from "nanostores";
import type { MultiplayerApiClient } from "../app/createMultiplayerApiClient";
import { createLocalSmalldrawRepo } from "./createLocalSmalldrawRepo";
import { createLocalDocumentBackend } from "./localDocumentBackend";
import type { KidsDocumentBackend, KidsDocumentSummary } from "./types";
import {
  getDrawingWorkspace,
  getLastDrawingWorkspace,
  setDrawingWorkspace,
  workspaceNames,
} from "./workspace";

export const $accountSync = atom<{ busy: boolean; error: string | null }>({
  busy: false,
  error: null,
});
export function retryAccountSync() {
  window.dispatchEvent(new Event("drawing-sync-retry"));
}
class AccountIdentityChanged extends Error {}
const TAB = crypto.randomUUID();
const TRANSITION = "drawing-account-transition";
const PURGE = "drawing-account-purge";
const channel = () => new BroadcastChannel(TRANSITION);
const binaryId = (document: KidsDocumentSummary) =>
  (document.collabDocUrl ?? document.docUrl) as AutomergeUrl;
const backendFor = (id: string | null) => {
  const names = workspaceNames(id);
  return createLocalDocumentBackend({
    databaseName: names.catalog,
    currentDocStorageKey: names.current,
  });
};

/** Safe to repeat after a crash, including when logout already cleared the cookie. */
async function finishPurge(): Promise<void> {
  const id = localStorage.getItem(PURGE);
  if (!id) return;
  const backend = backendFor(id);
  for (const document of await backend.listDocuments())
    await backend.deleteDocument(document.docUrl);
  await new IndexedDBStorageAdapter(workspaceNames(id).repo).removeRange([]);
  localStorage.removeItem(workspaceNames(id).current);
  localStorage.removeItem(PURGE);
  setDrawingWorkspace(null);
}

/** Resolve identity before opening any catalog or Automerge cache. */
export async function prepareAccountWorkspace(
  api: MultiplayerApiClient,
): Promise<void> {
  await initAutomerge();
  await navigator.locks.request(TRANSITION, async () => {
    const pendingPurge = localStorage.getItem(PURGE);
    if (pendingPurge) {
      const bus = channel();
      try {
        bus.postMessage({ type: "freeze", workspace: pendingPurge });
        await navigator.locks.request(
          workspaceNames(pendingPurge).lock,
          async () => {
            const current = await api.getCurrentAccount();
            if (current?.id === pendingPurge) await api.signOut();
            await finishPurge();
          },
        );
        bus.postMessage("reload");
      } catch (error) {
        bus.postMessage({ type: "resume", initiator: TAB });
        throw error;
      } finally {
        bus.close();
      }
    }
    let user: Awaited<ReturnType<MultiplayerApiClient["getCurrentAccount"]>>;
    try {
      user = await api.getCurrentAccount();
    } catch {
      // Offline is not logout. Preserve the last workspace without exposing it to a different account.
      setDrawingWorkspace(getLastDrawingWorkspace());
      return;
    }
    setDrawingWorkspace(user?.id ?? null);
    if (!user) return;
    await importGuestDrawings(api, user.id);
  });
}

async function importGuestDrawings(api: MultiplayerApiClient, userId: string) {
  const guest = backendFor(null);
  const target = backendFor(userId);
  const sourceRepo = createLocalSmalldrawRepo({
    workspace: null,
    localOnly: true,
  });
  const targetRepo = createLocalSmalldrawRepo({
    workspace: userId,
    localOnly: true,
  });
  const bus = channel();
  let frozeGuest = false;
  try {
    const memberships = await api.listAccountCollaborativeDocuments();
    const allowed = new Set(
      memberships.map((item) => `automerge:${item.documentId}`),
    );
    const candidates = (await guest.listDocuments()).filter(
      (document) =>
        !document.accountAttached || allowed.has(document.collabDocUrl ?? ""),
    );
    if (!candidates.length) return;
    frozeGuest = true;
    bus.postMessage({ type: "freeze", workspace: null });
    await navigator.locks.request(workspaceNames(null).lock, async () => {
      for (const document of await guest.listDocuments()) {
        // Old account caches are not guest work and must never be claimed by another account.
        if (
          document.accountAttached &&
          !allowed.has(document.collabDocUrl ?? "")
        )
          continue;
        const id = binaryId(document);
        const hasContent = await sourceRepo.storageSubsystem?.loadDoc(
          id.replace(/^automerge:/, "") as never,
        );
        if (!hasContent && document.accountAttached) {
          await target.createDocument(document);
          await guest.deleteDocument(document.docUrl);
          continue;
        }
        await sourceRepo.find(id);
        const binary = await sourceRepo.export(id);
        if (!binary)
          throw new Error(
            "A drawing on this device could not be read. Please try again.",
          );
        if (
          await targetRepo.storageSubsystem?.loadDoc(
            id.replace(/^automerge:/, "") as never,
          )
        )
          await targetRepo.find(id);
        const handle = targetRepo.import(binary, {
          docId: id.replace(/^automerge:/, "") as never,
        });
        await handle.whenReady();
        await targetRepo.flush();
        await target.createDocument(document);
        const thumbnail = await guest.getThumbnail(document.docUrl);
        if (thumbnail) await target.saveThumbnail(document.docUrl, thumbnail);
        // The durable account workspace now owns this work, even if upload must wait.
        await guest.deleteDocument(document.docUrl);
        const guestStorage = new IndexedDBStorageAdapter(
          workspaceNames(null).repo,
        );
        await guestStorage.removeRange([id.replace(/^automerge:/, "")]);
        if (document.docUrl !== id)
          await guestStorage.removeRange([
            document.docUrl.replace(/^automerge:/, ""),
          ]);
      }
    });
    bus.postMessage("reload");
  } finally {
    if (frozeGuest) bus.postMessage("reload");
    bus.close();
    await sourceRepo.shutdown();
    await targetRepo.shutdown();
  }
}

/** Checkpoint every local drawing without changing the active editor. */
export async function syncAccountWorkspace(
  api: MultiplayerApiClient,
  repo: Repo,
  backend: KidsDocumentBackend,
  userId: string,
  checkpoints?: Map<string, { heads: string; at: number }>,
): Promise<void> {
  const user = await api.getCurrentAccount();
  if (user?.id !== userId)
    throw new AccountIdentityChanged(
      "Sign back in to this account to finish syncing your drawings.",
    );
  await repo.flush();
  for (const document of await backend.listDocuments()) {
    const id = binaryId(document);
    if (
      document.accountAttached &&
      repo.storageSubsystem &&
      !(await repo.storageSubsystem.loadDoc(
        id.replace(/^automerge:/, "") as never,
      ))
    )
      continue;
    const localHandle = await repo.find(id);
    const last = checkpoints?.get(id);
    if (
      document.accountAttached &&
      last &&
      Date.now() - last.at < 30_000 &&
      last.heads === JSON.stringify(getHeads(localHandle.doc()))
    )
      continue;
    let binary = await repo.export(id);
    // Catalog-only account entries have no local edits to upload.
    if (!binary && document.accountAttached) continue;
    if (!binary)
      throw new Error("A drawing could not be read from this device.");
    if (!document.accountAttached) {
      if (document.collaborative) {
        if (document.accessTokenScope === "owner" && document.accessToken) {
          await api.claimCollaborativeDocument(document.accessToken);
        } else if (document.joinSecret) {
          await api.acceptDocumentInvitation(document.joinSecret);
        } else {
          throw new Error(
            "Open the sharing link again to sync this shared drawing.",
          );
        }
        await backend.createDocument({
          docUrl: document.docUrl,
          accountAttached: true,
          canDeleteFromServer: document.accessTokenScope === "owner",
        });
      } else {
        const registered = await api.registerAccountSyncedDocument(
          id,
          binary,
          userId,
        );
        await backend.createDocument({
          docUrl: document.docUrl,
          collaborative: true,
          accountAttached: true,
          collabDocUrl: registered.collabDocUrl,
          accessToken: registered.accessToken,
          accessTokenScope: "owner",
          canDeleteFromServer: true,
        });
      }
    }
    if (!document.accountAttached) {
      window.dispatchEvent(new window.Event("drawing-catalog-change"));
      const updates = channel();
      updates.postMessage({ type: "catalog", workspace: userId });
      updates.close();
    }
    // Capture after registration: edits made while it was in flight must also be saved.
    binary = await repo.export(id);
    if (!binary)
      throw new Error("A drawing changed while syncing. Please try again.");
    const heads = getHeads(load(binary));
    const result = await api.checkpointAccountDrawing(id, binary, userId);
    if (heads.some((head) => !result.heads.includes(head)))
      throw new Error("The server has not saved every change yet.");
    const remote = load(
      Uint8Array.from(atob(result.content), (character) =>
        character.charCodeAt(0),
      ),
    );
    const handle = await repo.find(id);
    handle.update((current) => merge(current, remote));
    checkpoints?.set(id, {
      heads: JSON.stringify(getHeads(remote)),
      at: Date.now(),
    });
    await repo.flush([handle.documentId]);
    const thumbnail = await backend.getThumbnail(document.docUrl);
    if (thumbnail)
      await api
        .uploadDocumentThumbnail(id.replace(/^automerge:/, ""), thumbnail)
        .catch(() => {});
  }
}

/** Every open page holds a shared writer lease; logout waits for all pages to flush and stop. */
export function watchAccountWorkspace(options: {
  api: MultiplayerApiClient;
  repo: Repo;
  backend: KidsDocumentBackend;
  beforeFreeze?: () => Promise<void>;
  onSignedOut?: () => void;
}) {
  const workspace = getDrawingWorkspace();
  const bus = channel();
  const checkpoints = new Map<string, { heads: string; at: number }>();
  let stopped = false;
  let pending: Promise<void> | null = null;
  let release: (() => void) | undefined;
  const lease = new Promise<void>((resolve) => {
    release = resolve;
  });
  const held = navigator.locks.request(
    workspaceNames(workspace).lock,
    { mode: "shared" },
    () => {
      if (getLastDrawingWorkspace() !== workspace) {
        release?.();
        window.location.reload();
      }
      return lease;
    },
  );
  const run = () => {
    if (stopped || pending) return pending ?? Promise.resolve();
    pending = navigator.locks
      .request(`drawing-sync:${workspace}`, async () => {
        if (stopped) return;
        if (workspace) $accountSync.set({ busy: true, error: null });
        try {
          if (workspace === null) {
            if (await options.api.getCurrentAccount())
              throw new AccountIdentityChanged("Account changed");
            return;
          }
          await syncAccountWorkspace(
            options.api,
            options.repo,
            options.backend,
            workspace,
            checkpoints,
          );
          $accountSync.set({ busy: false, error: null });
        } catch (error) {
          if (error instanceof AccountIdentityChanged) {
            setTimeout(() => {
              void freeze().then(() => window.location.reload());
            }, 0);
          }
          if (workspace === null && !(error instanceof AccountIdentityChanged))
            return;
          $accountSync.set({
            busy: false,
            error:
              error instanceof Error
                ? error.message
                : "Could not sync drawings. Try again.",
          });
        }
      })
      .then(() => {})
      .finally(() => {
        pending = null;
      });
    return pending;
  };
  let freezePromise: Promise<void> | undefined;
  const freeze = (): Promise<void> => {
    freezePromise ??= (async () => {
      stopped = true;
      clearInterval(timer);
      await options.beforeFreeze?.();
      await pending;
      await options.repo.flush();
      await options.repo.shutdown();
      release?.();
      await held;
    })();
    return freezePromise;
  };
  bus.onmessage = (event) => {
    if (event.data?.type === "catalog" && event.data.workspace === workspace)
      window.dispatchEvent(new window.Event("drawing-catalog-change"));
    if (event.data?.type === "freeze" && event.data.workspace === workspace)
      void freeze();
    if (
      event.data === "reload" ||
      (event.data?.type === "resume" && event.data.initiator !== TAB)
    )
      window.location.reload();
    if (event.data === "signed-out") {
      if (options.onSignedOut) options.onSignedOut();
      else window.location.assign("/");
    }
  };
  const timer = setInterval(() => {
    void run();
  }, 5000);
  void run();
  window.addEventListener("online", run);
  window.addEventListener("drawing-sync-retry", run);
  return {
    retry: run,
    freeze,
    dispose() {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener("online", run);
      window.removeEventListener("drawing-sync-retry", run);
      bus.close();
      release?.();
    },
  };
}

export async function signOutAccountWorkspace(
  api: MultiplayerApiClient,
  freeze: () => Promise<void>,
): Promise<void> {
  const userId = getDrawingWorkspace();
  if (!userId) return;
  const bus = channel();
  try {
    await navigator.locks.request(TRANSITION, async () => {
      bus.postMessage({ type: "freeze", workspace: userId });
      await freeze();
      await navigator.locks.request(workspaceNames(userId).lock, async () => {
        const repo = createLocalSmalldrawRepo({
          workspace: userId,
          localOnly: true,
        });
        try {
          await syncAccountWorkspace(api, repo, backendFor(userId), userId);
        } finally {
          await repo.shutdown();
        }
        // Mark before the network request: recovery verifies the session before deciding whether to purge.
        localStorage.setItem(PURGE, userId);
        try {
          await api.signOut();
        } catch (error) {
          localStorage.removeItem(PURGE);
          throw error;
        }
        await finishPurge();
      });
    });
    bus.postMessage("signed-out");
  } catch (error) {
    // Pages were frozen; reload restores editing from the intact account workspace.
    bus.postMessage({ type: "resume", initiator: TAB });
    throw error;
  } finally {
    bus.close();
  }
}

import type {
  AutomergeUrl,
  DocumentId,
  Repo,
} from "@automerge/automerge-repo/slim";
import { atom } from "nanostores";
import type { MultiplayerApiClient } from "../app/createMultiplayerApiClient";
import { createAccountSyncQueue } from "./accountSyncQueue";
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
  const { IndexedDBStorageAdapter } = await import(
    "@automerge/automerge-repo-storage-indexeddb"
  );
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
    const { initAutomerge } = await import("@smalldraw/core");
    await initAutomerge();
    await importGuestDrawings(api, user.id);
  });
}

async function importGuestDrawings(api: MultiplayerApiClient, userId: string) {
  const [{ createLocalSmalldrawRepo }, { IndexedDBStorageAdapter }] =
    await Promise.all([
      import("./createLocalSmalldrawRepo"),
      import("@automerge/automerge-repo-storage-indexeddb"),
    ]);
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
  verifyIdentity = true,
  candidates?: readonly KidsDocumentSummary[],
): Promise<void> {
  const {
    clone,
    free,
    getHeads,
    hasHeads,
    loadIncremental,
    merge,
    save,
    saveSince,
  } = await import("@automerge/automerge/slim");
  if (verifyIdentity) {
    const user = await api.getCurrentAccount();
    if (user?.id !== userId)
      throw new AccountIdentityChanged(
        "Sign back in to this account to finish syncing your drawings.",
      );
  }
  for (const candidate of candidates ?? (await backend.listDocuments())) {
    // Another tab may have acknowledged or deleted this drawing since it was queued.
    const document = await backend.getDocument(candidate.docUrl);
    if (!document) continue;
    const id = binaryId(document);
    if (
      document.accountAttached &&
      !repo.handles[id.replace(/^automerge:/, "") as DocumentId] &&
      repo.storageSubsystem &&
      !(await repo.storageSubsystem.loadDocData(
        id.replace(/^automerge:/, "") as never,
      ))
    )
      continue;
    const localHandle = await repo.find(id);
    const last =
      document.accountCheckpoint?.documentUrl === id
        ? document.accountCheckpoint
        : undefined;
    if (
      document.accountAttached &&
      last &&
      JSON.stringify(last.heads) ===
        JSON.stringify(getHeads(localHandle.doc()).sort())
    )
      continue;
    // Unchanged drawings need neither a storage flush nor a network request.
    await repo.flush([localHandle.documentId]);
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
          save(localHandle.doc()),
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
    const snapshot = localHandle.doc();
    const heads = getHeads(snapshot);
    const baseHeads = last?.heads ?? null;
    const canSendChanges = baseHeads !== null && hasHeads(snapshot, baseHeads);
    let result = await api.checkpointAccountDrawing(
      id,
      {
        heads,
        baseHeads: canSendChanges ? baseHeads : null,
        content: canSendChanges
          ? saveSince(snapshot, baseHeads)
          : save(snapshot),
      },
      userId,
    );
    if (result.status === "resync") {
      result = await api.checkpointAccountDrawing(
        id,
        { heads, baseHeads: null, content: save(snapshot) },
        userId,
      );
    }
    if (result.status !== "saved")
      throw new Error("The server has not saved every change yet.");
    let confirmed = clone(snapshot);
    try {
      confirmed = loadIncremental(confirmed, result.content);
      // Validate against the captured upload, not edits made while it was in flight.
      if (
        JSON.stringify(getHeads(confirmed).sort()) !==
        JSON.stringify([...result.heads].sort())
      )
        throw new Error("The server has not saved every change yet.");
      localHandle.update((current) => merge(current, confirmed));
    } finally {
      free(confirmed);
    }
    await repo.flush([localHandle.documentId]);
    await backend.saveAccountCheckpoint(document.docUrl, {
      documentUrl: id,
      heads: [...result.heads].sort(),
    });
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
  repo?: Repo;
  backend: KidsDocumentBackend;
  beforeFreeze?: () => Promise<void>;
  onSignedOut?: () => void;
}) {
  const workspace = getDrawingWorkspace();
  const bus = channel();
  const syncQueue =
    workspace && options.repo
      ? createAccountSyncQueue(options.repo, options.backend)
      : undefined;
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
  let identityCheckedAt = -Infinity;
  const run = (verifyIdentity = false) => {
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
          if (!options.repo)
            throw new Error("Account sync requires a drawing repository.");
          const checkIdentity =
            verifyIdentity || Date.now() - identityCheckedAt >= 60_000;
          const batch = await syncQueue!.take();
          await syncAccountWorkspace(
            options.api,
            options.repo,
            options.backend,
            workspace,
            checkIdentity,
            batch.documents,
          );
          syncQueue!.complete(batch);
          if (checkIdentity) identityCheckedAt = Date.now();
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
      syncQueue?.dispose();
      await options.beforeFreeze?.();
      await pending;
      await options.repo?.flush();
      await options.repo?.shutdown();
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
  const timer =
    workspace === null
      ? undefined
      : setInterval(() => {
          if (document.visibilityState !== "hidden") void run();
        }, 5000);
  const refresh = () => {
    void run(true);
  };
  const visible = () => {
    if (document.visibilityState === "visible") refresh();
  };
  void run();
  window.addEventListener("online", refresh);
  window.addEventListener("focus", refresh);
  document.addEventListener("visibilitychange", visible);
  window.addEventListener("drawing-sync-retry", refresh);
  return {
    retry: () => run(true),
    freeze,
    dispose() {
      stopped = true;
      clearInterval(timer);
      syncQueue?.dispose();
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("drawing-sync-retry", refresh);
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
        const { createLocalSmalldrawRepo } = await import(
          "./createLocalSmalldrawRepo"
        );
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

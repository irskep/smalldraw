import { describe, expect, test } from "bun:test";
import {
  bindCollaborativeSyncErrorSurface,
  isSyncIssueShareMessage,
  resolveCollaborativeSyncIssueMessage,
} from "../app/collaborativeSyncErrorSurface";

describe("resolveCollaborativeSyncIssueMessage", () => {
  test("normalizes DocSynchronizer timeout errors", () => {
    const error = new Error("withTimeout: timed out after 60000ms");
    error.name = "TimeoutError";
    error.stack = "TimeoutError\n at beginSync (DocSynchronizer.js:184:1)";

    expect(resolveCollaborativeSyncIssueMessage(error)).toBe(
      "Sync is taking longer than expected. Changes may not be reaching the server. Check your connection and try again.",
    );
  });

  test("ignores unrelated errors", () => {
    expect(resolveCollaborativeSyncIssueMessage(new Error("Boom"))).toBeNull();
  });

  test("matches cross-realm error-like rejection objects", () => {
    expect(
      resolveCollaborativeSyncIssueMessage({
        name: "TimeoutError",
        message: "withTimeout: timed out after 60000ms",
        stack:
          "TimeoutError\n at beginSync (DocSynchronizer.js:184:1)\n at withTimeout.js:9",
      }),
    ).toBe(
      "Sync is taking longer than expected. Changes may not be reaching the server. Check your connection and try again.",
    );
  });
});

describe("bindCollaborativeSyncErrorSurface", () => {
  test("captures known sync rejections for collaborative documents", () => {
    type EventListenerLike = (event: Event) => void;
    let listener: EventListenerLike | null = null;
    let syncError: string | null = null;
    const unbind = bindCollaborativeSyncErrorSurface({
      windowTarget: {
        addEventListener(
          _type: string,
          nextListener: EventListenerOrEventListenerObject,
        ) {
          listener = nextListener as EventListenerLike;
        },
        removeEventListener() {
          listener = null;
        },
      },
      collaborationStatusStore: {
        getStatus: () => ({
          visible: true,
          state: "offline",
          label: "Collab drawing (offline)",
          docUrl: "automerge:local-1",
          collabDocUrl: "automerge:collab-1",
        }),
        setSyncError(message) {
          syncError = message;
        },
      },
    });

    let prevented = false;
    const error = new Error("withTimeout: timed out after 60000ms");
    error.name = "TimeoutError";
    error.stack = "TimeoutError\n at beginSync (DocSynchronizer.js:184:1)";
    const event = {
      type: "unhandledrejection",
      reason: error,
      preventDefault() {
        prevented = true;
      },
    } as Event & { reason: Error; preventDefault(): void };
    if (!listener) {
      throw new Error("Expected unhandled rejection listener to be bound");
    }
    const boundListener = listener as EventListenerLike;
    boundListener(event);

    expect(prevented).toBeTrue();
    expect(syncError as string | null).toBe(
      "Sync is taking longer than expected. Changes may not be reaching the server. Check your connection and try again.",
    );

    unbind();
    expect(listener).toBeNull();
  });
});

describe("isSyncIssueShareMessage", () => {
  test("recognizes share-sync timeout copy", () => {
    expect(
      isSyncIssueShareMessage(
        "Share timed out while connecting to collaborative sync. Check server connection and try again.",
      ),
    ).toBeTrue();
  });
});

import { describe, expect, test } from "bun:test";
import type { DocHandle } from "@automerge/automerge-repo";
import { createSmalldraw } from "../createSmalldraw";

function createHandle(
  url: string,
  ready: boolean,
  options?: { onAbort?: () => void },
): DocHandle<any> {
  return {
    url,
    isReady: () => ready,
    whenReady: (_states?: unknown, whenReadyOptions?: { signal?: AbortSignal }) =>
      ready
        ? Promise.resolve()
        : new Promise<void>((_, reject) => {
            whenReadyOptions?.signal?.addEventListener(
              "abort",
              () => {
                options?.onAbort?.();
                reject(new DOMException("Aborted", "AbortError"));
              },
              { once: true },
            );
          }),
    doc: () => ({
      size: { width: 100, height: 100 },
      presentation: { documentType: "normal" },
      layers: [],
      shapes: {},
      temporalOrderCounter: 0,
    }),
    change: () => {},
    on: () => {},
    off: () => {},
    heads: () => [],
  } as unknown as DocHandle<any>;
}

describe("createSmalldraw", () => {
  test("falls back to a new document when stored document open times out", async () => {
    let aborted = false;
    const staleHandle = createHandle("automerge:stale-doc", false, {
      onAbort: () => {
        aborted = true;
      },
    });
    const freshHandle = createHandle("automerge:fresh-doc", true);
    const writes: string[] = [];

    const staleDocId = "stale-doc";
    const core = await createSmalldraw({
      repo: {
        peerId: "peer-1",
        handles: { [staleDocId]: staleHandle },
        find: async () => staleHandle,
        create: () => freshHandle,
      } as any,
      shapeHandlers: {} as any,
      initialOpenTimeoutMs: 5,
      persistence: {
        mode: "reuse",
        getCurrentDocUrl: async () => "automerge:stale-doc",
        setCurrentDocUrl: async (url) => {
          writes.push(url);
        },
      },
    });

    expect(core.getCurrentDocUrl()).toBe("automerge:fresh-doc");
    expect(writes).toEqual(["automerge:fresh-doc"]);
    expect(aborted).toBeTrue();
  });

  test("open aborts wait instead of leaking automerge timeout", async () => {
    let aborted = false;
    const readyHandle = createHandle("automerge:ready-doc", true);
    const staleHandle = createHandle("automerge:stale-doc", false, {
      onAbort: () => {
        aborted = true;
      },
    });
    const core = await createSmalldraw({
      repo: {
        peerId: "peer-1",
        handles: {},
        find: async (url: string) =>
          url === "automerge:stale-doc" ? staleHandle : readyHandle,
        create: () => readyHandle,
      } as any,
      shapeHandlers: {} as any,
      initialOpenTimeoutMs: 5,
      persistence: {
        mode: "always-new",
        getCurrentDocUrl: async () => null,
        setCurrentDocUrl: async () => {},
      },
    });

    await expect(core.open("automerge:stale-doc")).rejects.toThrow(
      "Timed out opening document: automerge:stale-doc",
    );
    expect(aborted).toBeTrue();
  });
});

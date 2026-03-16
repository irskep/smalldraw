import { describe, expect, test } from "bun:test";
import type { DocHandle } from "@automerge/automerge-repo";
import { createSmalldraw } from "../createSmalldraw";

function createHandle(url: string, ready: boolean): DocHandle<any> {
  return {
    url,
    isReady: () => ready,
    whenReady: () =>
      ready ? Promise.resolve() : new Promise<void>(() => undefined),
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
    const staleHandle = createHandle("automerge:stale-doc", false);
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
  });
});

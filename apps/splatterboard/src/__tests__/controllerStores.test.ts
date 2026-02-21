import { describe, expect, test } from "bun:test";
import { createDocumentPickerStore } from "../controller/stores/createDocumentPickerStore";
import { createDocumentSessionStore } from "../controller/stores/createDocumentSessionStore";
import { createKidsDrawRuntimeStore } from "../controller/stores/createKidsDrawRuntimeStore";

describe("createKidsDrawRuntimeStore", () => {
  test("dedupes unchanged state updates", () => {
    const store = createKidsDrawRuntimeStore();
    let updates = 0;
    const unbind = store.subscribe(() => {
      updates += 1;
    });
    const baselineUpdates = updates;

    store.setPresentation({ mode: "normal" });
    store.setDestroyed(false);
    expect(updates).toBe(baselineUpdates);

    store.setDestroyed(true);
    expect(updates).toBe(baselineUpdates + 1);

    store.setDestroyed(true);
    expect(updates).toBe(baselineUpdates + 1);

    unbind();
  });

  test("presentation identity tracks referenced overlays", () => {
    const store = createKidsDrawRuntimeStore();
    const identities: string[] = [];
    const unbind = store.subscribePresentationIdentity((identity) => {
      identities.push(identity);
    });

    store.setPresentation({
      mode: "coloring",
      referenceImageSrc: "/page-001.png",
      referenceComposite: "over-drawing",
      coloringPageId: "pdr-v1-001",
    });

    expect(store.getPresentationIdentity()).toBe("over-drawing:/page-001.png");
    expect(store.getReferenceImageSrc("over-drawing")).toBe("/page-001.png");
    expect(store.getReferenceImageSrc("under-drawing")).toBeNull();
    expect(identities.at(-1)).toBe("over-drawing:/page-001.png");

    unbind();
  });
});

describe("createDocumentSessionStore intents", () => {
  test("subscribeDrainedIntents receives and clears batches", () => {
    const store = createDocumentSessionStore();
    const drainedBatches: Array<readonly string[]> = [];

    const unbind = store.subscribeDrainedIntents((intents) => {
      drainedBatches.push(intents.map((intent) => intent.type));
    });

    store.emitIntent({ type: "adapter_applied" });
    store.emitIntent({ type: "switch_or_create_completed" });

    expect(drainedBatches).toEqual([
      ["adapter_applied"],
      ["switch_or_create_completed"],
    ]);
    expect(store.consumeIntents()).toEqual([]);

    unbind();
  });
});

describe("createDocumentPickerStore", () => {
  test("dedupes no-op writes for documents and thumbnails", () => {
    const store = createDocumentPickerStore();
    let updates = 0;
    const unbind = store.subscribe(() => {
      updates += 1;
    });
    const baselineUpdates = updates;

    const documents = [
      {
        docUrl: "doc://1",
        mode: "normal" as const,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        lastOpenedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    store.setDocuments(documents);
    expect(updates).toBe(baselineUpdates + 1);

    store.setDocuments([...documents]);
    expect(updates).toBe(baselineUpdates + 1);

    const thumbnails = new Map([["doc://1", "blob://thumb-1"]]);
    store.setThumbnailUrls(thumbnails);
    expect(updates).toBe(baselineUpdates + 2);

    store.setThumbnailUrls(new Map([["doc://1", "blob://thumb-1"]]));
    expect(updates).toBe(baselineUpdates + 2);

    unbind();
  });
});

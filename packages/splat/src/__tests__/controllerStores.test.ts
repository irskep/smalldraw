import { describe, expect, test } from "bun:test";
import { createDocumentPickerStore } from "../controller/stores/createDocumentPickerStore";
import { createDocumentSessionStore } from "../controller/stores/createDocumentSessionStore";
import { createKidsDrawRuntimeStore } from "../controller/stores/createKidsDrawRuntimeStore";
import { createStartupReadinessStore } from "../controller/stores/createStartupReadinessStore";
import { createUiIntentStore } from "../controller/stores/createUiIntentStore";

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

  test("viewport metrics channel dedupes and supports unsubscribe", () => {
    const store = createKidsDrawRuntimeStore();
    const seen: Array<{
      overlayLeft: number;
      overlayTop: number;
      overlayWidth: number;
      overlayHeight: number;
      logicalWidth: number;
      logicalHeight: number;
    }> = [];
    const unbind = store.subscribeViewportMetrics((metrics) => {
      seen.push(metrics);
    });

    const baselineEvents = seen.length;
    const firstMetrics = {
      overlayLeft: 10,
      overlayTop: 20,
      overlayWidth: 300,
      overlayHeight: 200,
      logicalWidth: 900,
      logicalHeight: 600,
    };
    store.setViewportMetrics(firstMetrics);
    expect(seen.length).toBe(baselineEvents + 1);
    expect(store.getViewportMetrics()).toEqual(firstMetrics);

    store.setViewportMetrics({ ...firstMetrics });
    expect(seen.length).toBe(baselineEvents + 1);

    store.setDestroyed(true);
    expect(seen.length).toBe(baselineEvents + 1);

    unbind();

    store.setViewportMetrics({
      overlayLeft: 12,
      overlayTop: 22,
      overlayWidth: 320,
      overlayHeight: 220,
      logicalWidth: 960,
      logicalHeight: 640,
    });
    expect(seen.length).toBe(baselineEvents + 1);
  });

  test("layout profile channel dedupes and supports unsubscribe", () => {
    const store = createKidsDrawRuntimeStore();
    const profiles: string[] = [];
    const unbind = store.subscribeLayoutProfile((profile) => {
      profiles.push(profile);
    });

    const baselineEvents = profiles.length;
    store.setLayoutProfile("mobile-portrait");
    expect(store.getLayoutProfile()).toBe("mobile-portrait");
    expect(profiles.length).toBe(baselineEvents + 1);

    store.setLayoutProfile("mobile-portrait");
    expect(profiles.length).toBe(baselineEvents + 1);

    unbind();
    store.setLayoutProfile("large");
    expect(profiles.length).toBe(baselineEvents + 1);
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

describe("createUiIntentStore", () => {
  test("subscribeDrainedIntents drains each published batch", () => {
    const store = createUiIntentStore();
    const drained: string[][] = [];
    const unbind = store.subscribeDrainedIntents((intents) => {
      drained.push(intents.map((intent) => intent.type));
    });

    store.publish({ type: "undo" });
    store.publish({ type: "redo" });

    expect(drained).toEqual([["undo"], ["redo"]]);
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

describe("createStartupReadinessStore", () => {
  test("tracks startup phases and asset counters", () => {
    const store = createStartupReadinessStore();

    store.startDocLoad("switch_document");
    expect(store.getState()).toMatchObject({
      phase: "doc_loading",
      interactionEnabled: false,
      lastBlockingReason: "switch_document",
    });

    store.setAssetsExpected(2);
    store.markAssetLoaded();
    store.markAssetFailed();
    expect(store.getState()).toMatchObject({
      phase: "assets_loading",
      assetsTotal: 2,
      assetsLoaded: 1,
      assetsFailed: 1,
      interactionEnabled: false,
    });

    store.startFirstBake();
    expect(store.getState().phase).toBe("first_bake");
    expect(store.getState().interactionEnabled).toBeFalse();

    store.markReady();
    expect(store.getState()).toMatchObject({
      phase: "ready",
      interactionEnabled: true,
      lastBlockingReason: undefined,
    });
  });

  test("degraded state still enables interaction", () => {
    const store = createStartupReadinessStore();
    store.startDocLoad("switch_document");
    store.markDegraded("asset_timeout");

    expect(store.getState()).toMatchObject({
      phase: "degraded",
      interactionEnabled: true,
      lastBlockingReason: "asset_timeout",
    });
  });
});

import { describe, expect, test } from "bun:test";
import { createLocalDocumentBackend } from "../documents";

describe("document backends", () => {
  test("local backend supports document CRUD, current document pointer, and thumbnails", async () => {
    const currentDocStorageKey = `kids-draw-doc-url-test-${Math.random()}`;
    const backend = createLocalDocumentBackend({
      currentDocStorageKey,
      databaseName: `kids-draw-documents-test-${Math.random()}`,
    });

    const created = await backend.createDocument({
      docUrl: "automerge:test-local-doc",
      title: "My Drawing",
    });
    expect(created.docUrl).toBe("automerge:test-local-doc");
    expect(created.title).toBe("My Drawing");

    const touched = await backend.touchDocument("automerge:test-local-doc");
    expect(touched).not.toBeNull();
    expect(touched?.docUrl).toBe("automerge:test-local-doc");

    const listed = await backend.listDocuments();
    expect(listed.length).toBe(1);
    expect(listed[0]?.docUrl).toBe("automerge:test-local-doc");

    await backend.setCurrentDocument("automerge:test-local-doc");
    expect(await backend.getCurrentDocument()).toBe("automerge:test-local-doc");

    const blob = new Blob(["thumbnail-bytes"], { type: "image/png" });
    await backend.saveThumbnail("automerge:test-local-doc", blob);
    const restoredThumbnail = await backend.getThumbnail(
      "automerge:test-local-doc",
    );
    expect(restoredThumbnail).not.toBeNull();
    expect(restoredThumbnail?.type).toBe("image/png");

    await backend.deleteDocument("automerge:test-local-doc");
    expect(await backend.getDocument("automerge:test-local-doc")).toBeNull();
    expect(await backend.getCurrentDocument()).toBeNull();
  });

  test("local backend stores collaboration metadata and maps current doc from collab url", async () => {
    const currentDocStorageKey = `kids-draw-doc-url-test-${Math.random()}`;
    const backend = createLocalDocumentBackend({
      currentDocStorageKey,
      databaseName: `kids-draw-documents-test-${Math.random()}`,
    });

    const created = await backend.createDocument({
      docUrl: "automerge:local-2",
      collaborative: true,
      collabDocUrl: "automerge:collab-2",
      joinSecret: "join-secret-2",
      mode: "normal",
    });
    expect(created.collaborative).toBeTrue();
    expect(created.collabDocUrl).toBe("automerge:collab-2");
    expect(created.joinSecret).toBe("join-secret-2");

    await backend.setCurrentDocument("automerge:collab-2");
    expect(await backend.getCurrentDocument()).toBe("automerge:local-2");

    await backend.createDocument({
      docUrl: "automerge:local-2",
      collaborative: false,
      mode: "normal",
    });
    const updated = await backend.getDocument("automerge:local-2");
    expect(updated?.collaborative).toBeFalse();
    expect(updated?.collabDocUrl).toBeUndefined();
    expect(updated?.joinSecret).toBeUndefined();
  });
});

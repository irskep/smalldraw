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
});

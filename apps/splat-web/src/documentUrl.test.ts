import { describe, expect, test } from "bun:test";
import { buildSplatCurrentDocumentUrl } from "./documentUrl";

describe("buildSplatCurrentDocumentUrl", () => {
  test("uses local catalog urls for browser-local drawings", () => {
    expect(
      buildSplatCurrentDocumentUrl("http://localhost:3000/", {
        docUrl: "automerge:local-doc",
      }),
    ).toBe("http://localhost:3000/draw/?local=automerge%3Alocal-doc");
  });

  test("uses account document ids for account-attached drawings", () => {
    expect(
      buildSplatCurrentDocumentUrl("http://localhost:3000/draw/?local=old", {
        docUrl: "catalog-collab:server-doc",
        collaborative: true,
        collabDocUrl: "automerge:server-doc",
        accountAttached: true,
      }),
    ).toBe("http://localhost:3000/draw/?doc=server-doc");
  });

  test("clears startup-only document params before writing the current doc", () => {
    expect(
      buildSplatCurrentDocumentUrl(
        "http://localhost:3000/draw/?join=share-token",
        {
          docUrl: "catalog-collab:joined-doc",
          collaborative: true,
          collabDocUrl: "automerge:joined-doc",
        },
      ),
    ).toBe("http://localhost:3000/draw/?local=catalog-collab%3Ajoined-doc");
  });
});

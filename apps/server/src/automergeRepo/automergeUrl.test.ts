import { describe, expect, it } from "bun:test";
import { toAutomergeUrl } from "./automergeUrl.js";

describe("toAutomergeUrl", () => {
  it("adds automerge prefix to a document id", () => {
    expect(toAutomergeUrl("doc-123")).toBe("automerge:doc-123");
  });
});

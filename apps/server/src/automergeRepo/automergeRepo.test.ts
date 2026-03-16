import { describe, expect, test } from "bun:test";
import { serverSharePolicy } from "./automergeRepo.js";

describe("serverSharePolicy", () => {
  test("denies proactive sharing when no document id is provided", async () => {
    await expect(serverSharePolicy("peer-1")).resolves.toBe(false);
  });

  test("allows sharing for explicit document requests", async () => {
    await expect(serverSharePolicy("peer-1", "doc-123")).resolves.toBe(true);
  });
});

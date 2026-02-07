import { describe, expect, test } from "bun:test";
import { imagesMatch } from "../index";

describe("@smalldraw/testing", () => {
  test("imagesMatch returns true for identical buffers", async () => {
    const buffer = Buffer.from([1, 2, 3, 4]);
    expect(await imagesMatch(buffer, buffer, 0)).toBeTrue();
  });
});

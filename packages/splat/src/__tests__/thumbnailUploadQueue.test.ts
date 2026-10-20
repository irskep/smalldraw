import { expect, test } from "bun:test";
import { createThumbnailUploadQueue } from "../app/createThumbnailUploadQueue";

test("uploads changed thumbnails in order and skips identical saves", async () => {
  let finishFirst!: () => void;
  const first = new Promise<void>((resolve) => {
    finishFirst = resolve;
  });
  const writes: string[] = [];
  const publish = createThumbnailUploadQueue(async (_key, image) => {
    const value = await image.text();
    if (value === "first") await first;
    writes.push(value);
  });
  const one = new Blob(["first"], { type: "image/webp" });
  const two = new Blob(["second"], { type: "image/webp" });
  const pending = [
    publish("drawing", one),
    publish("drawing", one),
    publish("drawing", two),
  ];
  finishFirst();
  await Promise.all(pending);
  expect(writes).toEqual(["first", "second"]);
  await publish("drawing", two);
  expect(writes).toHaveLength(2);
  await publish("other-drawing", two);
  expect(writes).toHaveLength(3);
});

test("a failed upload can be retried with the same image", async () => {
  let calls = 0;
  const publish = createThumbnailUploadQueue(async () => {
    if (++calls === 1) throw new Error("offline");
  });
  const image = new Blob(["image"]);
  await expect(publish("drawing", image)).rejects.toThrow("offline");
  await publish("drawing", image);
  await publish("drawing", image);
  expect(calls).toBe(2);
});

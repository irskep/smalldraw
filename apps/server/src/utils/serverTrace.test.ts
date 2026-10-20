import { expect, test } from "bun:test";
import { createServerTrace } from "./serverTrace";

test("routine traffic emits no production logs unless tracing is enabled", () => {
  let calls = 0;
  const write = () => {
    calls++;
  };
  for (const enabled of [false, true]) {
    calls = 0;
    const trace = createServerTrace(enabled, write);
    for (let i = 0; i < 1000; i++)
      trace("accepted sync", { documentId: "test", sequence: i });
    expect(calls).toBe(enabled ? 1000 : 0);
  }
});

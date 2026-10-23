import { describe, expect, it, mock, spyOn } from "bun:test";

import { ModerationWebSocketAdapter } from "../documents/ModerationWebSocketAdapter";
import {
  $unavailableDrawings,
  markDrawingUnavailable,
} from "../documents/unavailableDrawings";

describe("moderation disconnect", () => {
  it("stops reconnecting and identifies the removed drawing", () => {
    const unavailable = mock(() => {});
    const adapter = new ModerationWebSocketAdapter(
      "ws://localhost",
      unavailable,
    );
    // Exercise the registered socket close handler without opening a network connection.
    const disconnect = spyOn(adapter, "disconnect").mockImplementation(
      () => {},
    );
    (adapter.onClose as (event: { code: number; reason: string }) => void)({
      code: 4004,
      reason: "Drawing unavailable:abc123",
    });
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(unavailable).toHaveBeenCalledWith("abc123");
    adapter.connect("peer" as never);
    expect(adapter.socket).toBeUndefined();
  });

  it("tolerates removal after the terminal close already disconnected it", () => {
    const adapter = new ModerationWebSocketAdapter("ws://localhost", () => {});
    expect(() => {
      adapter.disconnect();
      adapter.disconnect();
    }).not.toThrow();
  });

  it("publishes terminal IDs only once and keeps distinct drawings", () => {
    $unavailableDrawings.set(new Set());
    const listener = mock(() => {});
    const unsubscribe = $unavailableDrawings.listen(listener);
    markDrawingUnavailable("a");
    markDrawingUnavailable("a");
    markDrawingUnavailable("b");
    expect(listener).toHaveBeenCalledTimes(2);
    expect([...$unavailableDrawings.get()]).toEqual(["a", "b"]);
    unsubscribe();
    $unavailableDrawings.set(new Set());
  });
});

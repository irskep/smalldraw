import { act, render, screen, waitFor } from "@testing-library/preact";
import { useEffect } from "preact/hooks";
import { describe, expect, test, vi } from "vitest";

import { useResource, useAction } from "../hooks/useResource";
import { createResource } from "../utils/resource";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("portal requests", () => {
  test("a superseded response cannot overwrite newer data, even when transport ignores abort", async () => {
    const first = deferred<string>(),
      second = deferred<string>();
    const signals: AbortSignal[] = [];
    const load = vi
      .fn()
      .mockImplementationOnce((signal) => {
        signals.push(signal);
        return first.promise;
      })
      .mockImplementationOnce(() => second.promise);
    const request = createResource(load);
    const old = request.reload();
    const latest = request.reload();
    expect(signals[0].aborted).toBe(true);
    second.resolve("new");
    await latest;
    first.resolve("old");
    await old;
    expect(request.state.value.data).toBe("new");
  });
  test("cancellation prevents late errors and clears pending state", async () => {
    const response = deferred<string>();
    const request = createResource(() => response.promise);
    const pending = request.reload();
    request.cancel();
    response.reject(new Error("late"));
    await pending;
    expect(request.state.value).toEqual({
      data: undefined,
      error: null,
      fetching: false,
    });
  });
  test("refresh retains visible data and a failure can be retried", async () => {
    let fail = false;
    const request = createResource(async () => {
      if (fail) throw new Error("Offline");
      return "drawing";
    });
    await request.reload();
    fail = true;
    await request.reload();
    expect(request.state.value.data).toBe("drawing");
    expect(request.state.value.error?.message).toBe("Offline");
    fail = false;
    await request.reload();
    expect(request.state.value.error).toBeNull();
  });
  test("changing route input clears the previous user's data and ignores its pending response", async () => {
    const a = deferred<string>(),
      b = deferred<string>();
    function View({ user }: { user: string }) {
      const result = useResource(
        () => (user === "a" ? a.promise : b.promise),
        [user],
      );
      return <output>{result.data ?? "Loading"}</output>;
    }
    const view = render(<View user="a" />);
    await act(async () => {
      view.rerender(<View user="b" />);
    });
    await act(async () => {
      b.resolve("B");
    });
    expect(await screen.findByText("B")).toBeTruthy();
    await act(async () => {
      a.resolve("A");
    });
    expect(screen.queryByText("A")).toBeNull();
  });
  test("disabled reads do not run; unmount aborts an active read", async () => {
    const response = deferred<string>();
    let signal: AbortSignal | undefined;
    const load = vi.fn((s) => {
      signal = s;
      return response.promise;
    });
    function View({ enabled }: { enabled: boolean }) {
      useResource(load, [], { enabled });
      return null;
    }
    const view = render(<View enabled={false} />);
    await act(async () => {});
    expect(load).not.toHaveBeenCalled();
    await act(async () => {
      view.rerender(<View enabled />);
    });
    await waitFor(() => expect(load).toHaveBeenCalledOnce());
    await act(async () => {
      view.unmount();
    });
    expect(signal?.aborted).toBe(true);
  });
  test("writes run once and expose errors to the caller instead of retrying", async () => {
    const action = vi.fn(async (_input: string) => {
      throw new Error("Rejected");
    });
    let run!: (input: string) => Promise<unknown>;
    function View() {
      const result = useAction(action);
      useEffect(() => {
        run = result.run;
      }, [result.run]);
      return <output>{String(result.pending)}</output>;
    }
    render(<View />);
    await act(async () => {});
    await act(async () => {
      await expect(run("write")).rejects.toThrow("Rejected");
    });
    expect(action).toHaveBeenCalledOnce();
    expect(screen.getByText("false")).toBeTruthy();
  });
});

import { useCallback, useEffect, useMemo, useRef } from "preact/hooks";
import { useSignal } from "@preact/signals";
import { createResource } from "../utils/resource";

export function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  dependencies: readonly unknown[],
  { enabled = true, interval = 0 } = {},
) {
  const loader = useRef(load);
  loader.current = load;
  const resource = useMemo(
    () => createResource((signal) => loader.current(signal)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Caller-supplied identity discards old results; the loader itself changes each render.
    [...dependencies, enabled],
  );
  useEffect(() => {
    if (!enabled) return;
    void resource.reload();
    const refresh = () => {
      if (!document.hidden && !resource.state.peek().fetching)
        void resource.reload();
    };
    const timer = interval ? window.setInterval(refresh, interval) : undefined;
    if (interval) document.addEventListener("visibilitychange", refresh);
    return () => {
      resource.cancel();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [resource, enabled, interval]);
  const state = resource.state.value;
  return {
    ...state,
    loading: enabled && state.data === undefined && state.error === null,
    reload: resource.reload,
  };
}

/** Writes run only on user intent, once; callers own success/error handling. */
export function useAction<Input, Output>(
  action: (input: Input) => Promise<Output>,
) {
  const pending = useSignal(0);
  const lastInput = useSignal<Input | undefined>(undefined);
  const latest = useRef(action);
  latest.current = action;
  const run = useCallback(
    async (input: Input) => {
      lastInput.value = input;
      pending.value++;
      try {
        return await latest.current(input);
      } finally {
        pending.value--;
      }
    },
    [pending, lastInput],
  );
  return { run, pending: pending.value > 0, input: lastInput.value };
}

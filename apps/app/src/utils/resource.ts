import { signal } from "@preact/signals";

/** One view's current request, not a cache. A newer load owns the result. */
export function createResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const state = signal<{
    data: T | undefined;
    error: Error | null;
    fetching: boolean;
  }>({ data: undefined, error: null, fetching: false });
  let controller: AbortController | undefined;
  function cancel() {
    controller?.abort();
    controller = undefined;
    if (state.peek().fetching)
      state.value = { ...state.peek(), fetching: false };
  }
  async function reload() {
    cancel();
    const request = (controller = new AbortController());
    state.value = { ...state.peek(), error: null, fetching: true };
    try {
      const data = await load(request.signal);
      if (controller === request)
        state.value = { data, error: null, fetching: false };
    } catch (error) {
      if (controller === request)
        state.value = {
          ...state.peek(),
          error: error instanceof Error ? error : new Error(String(error)),
          fetching: false,
        };
    }
  }
  return { state, reload, cancel };
}

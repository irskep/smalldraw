import { useEffect } from "preact/hooks";

import { api } from "./api";
import { createResource } from "./resource";

// Identity is shared by the menu, route gates, and account pages. Page-specific
// requests stay local and disappear on unmount, so there is no account data cache.
const account = createResource((signal) => api.me.query(undefined, { signal }));
export function refreshAccount() {
  if (!account.state.peek().fetching) void account.reload();
}
export function useAccount() {
  const state = account.state.value;
  return {
    ...state,
    data: state.error ? undefined : state.data,
    loading: state.data === undefined && state.error === null,
  };
}
export function useAccountSession() {
  useEffect(() => {
    refreshAccount();
    const refresh = () => {
      if (!document.hidden) refreshAccount();
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      account.cancel();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, []);
}

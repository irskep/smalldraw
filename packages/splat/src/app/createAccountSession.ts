import { atom } from "nanostores";
import type { MultiplayerApiClient } from "./createMultiplayerApiClient";

export interface AccountSessionState {
  status: "loading" | "signed-out" | "signed-in" | "unavailable";
  username: string | null;
  busy: boolean;
  error: string | null;
}

export type AccountSession = ReturnType<typeof createAccountSession>;

/** Account state is independent of document ownership and share tokens. */
export function createAccountSession(options: {
  client: Pick<MultiplayerApiClient, "getCurrentAccount" | "signOut">;
  navigateToSignIn: (docUrl?: string) => void;
  onSignedOut: () => void;
  onIdentityChanged: () => void;
}) {
  const $state = atom<AccountSessionState>({
    status: "loading",
    username: null,
    busy: false,
    error: null,
  });
  let generation = 0;
  let disposed = false;
  let identity: string | null | undefined;
  let pending: Promise<void> | null = null;
  const refresh = (): Promise<void> => {
    if (disposed || $state.get().busy) return Promise.resolve();
    if (pending) return pending;
    const current = ++generation;
    pending = (async () => {
      try {
        const user = await options.client.getCurrentAccount();
        if (disposed || current !== generation) return;
        const changed =
          identity !== undefined && identity !== (user?.id ?? null);
        identity = user?.id ?? null;
        $state.set({
          status: user ? "signed-in" : "signed-out",
          username: user?.username ?? null,
          busy: false,
          error: null,
        });
        if (changed) options.onIdentityChanged();
      } catch (error) {
        if (disposed || current !== generation) return;
        $state.set({
          status: "unavailable",
          username: null,
          busy: false,
          error:
            error instanceof Error
              ? error.message
              : "Could not check your sign-in status.",
        });
      } finally {
        if (current === generation) pending = null;
      }
    })();
    return pending;
  };
  return {
    $state,
    refresh,
    signIn(docUrl?: string) {
      if (!disposed) options.navigateToSignIn(docUrl);
    },
    async signOut() {
      if (disposed || $state.get().busy) return;
      const current = ++generation;
      pending = null;
      $state.set({ ...$state.get(), busy: true, error: null });
      try {
        await options.client.signOut();
        if (disposed || current !== generation) return;
        identity = null;
        $state.set({
          status: "signed-out",
          username: null,
          busy: false,
          error: null,
        });
        options.onSignedOut();
      } catch (error) {
        if (disposed || current !== generation) return;
        $state.set({
          ...$state.get(),
          busy: false,
          error: error instanceof Error ? error.message : "Could not sign out.",
        });
      }
    },
    dispose() {
      disposed = true;
      generation++;
    },
  };
}

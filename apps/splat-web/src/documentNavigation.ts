import { buildJoinedCatalogDocUrl } from "@smalldraw/splat";
import { atom, type ReadableAtom } from "nanostores";
import {
  buildSplatCurrentDocumentUrl,
  type SplatDocumentUrlSummary,
} from "./documentUrl";
import {
  resolveSplatStartupIntent,
  type SplatStartupIntent,
} from "./multiplayerConfig";

export interface SplatDocumentNavigationWindow {
  readonly location: {
    href: string;
  };
  readonly history: {
    pushState(data: unknown, unused: string, url?: string | URL | null): void;
    replaceState(
      data: unknown,
      unused: string,
      url?: string | URL | null,
    ): void;
  };
  addEventListener(type: "popstate", listener: () => void): void;
  removeEventListener(type: "popstate", listener: () => void): void;
}

export type SplatDocumentNavigationState =
  | {
      type: "none";
      key: string;
    }
  | {
      type: "open-document";
      key: string;
      docUrl: string;
    }
  | {
      type: "startup-error";
      key: string;
      message: string;
    };

export interface SplatDocumentNavigationStore {
  readonly $state: ReadableAtom<SplatDocumentNavigationState>;
  get(): SplatDocumentNavigationState;
  subscribe(
    listener: (state: SplatDocumentNavigationState) => void,
  ): () => void;
  pushDocument(summary: SplatDocumentUrlSummary | null, docUrl: string): void;
  replaceCurrentDocument(
    summary: SplatDocumentUrlSummary | null,
  ): SplatDocumentNavigationState;
  syncFromLocation(): void;
  dispose(): void;
}

export function createSplatDocumentNavigationStore(options: {
  window: SplatDocumentNavigationWindow;
}): SplatDocumentNavigationStore {
  const { window } = options;
  const state = atom(resolveNavigationState(window.location.href));
  const setFromLocation = (): void => {
    const next = resolveNavigationState(window.location.href);
    if (isSameNavigationState(state.get(), next)) {
      return;
    }
    state.set(next);
  };
  const onPopState = (): void => {
    setFromLocation();
  };
  window.addEventListener("popstate", onPopState);

  return {
    $state: state,
    get(): SplatDocumentNavigationState {
      return state.get();
    },
    subscribe(listener): () => void {
      return state.subscribe(listener);
    },
    pushDocument(summary, docUrl): void {
      const nextHref = buildSplatCurrentDocumentUrl(window.location.href, {
        docUrl,
        collaborative: summary?.collaborative,
        collabDocUrl: summary?.collabDocUrl,
        accountAttached: summary?.accountAttached,
      });
      if (nextHref !== window.location.href) {
        window.history.pushState(null, "", nextHref);
      }
      setFromLocation();
    },
    replaceCurrentDocument(summary): SplatDocumentNavigationState {
      const nextHref = buildSplatCurrentDocumentUrl(
        window.location.href,
        summary,
      );
      if (nextHref !== window.location.href) {
        window.history.replaceState(null, "", nextHref);
      }
      setFromLocation();
      return state.get();
    },
    syncFromLocation(): void {
      setFromLocation();
    },
    dispose(): void {
      window.removeEventListener("popstate", onPopState);
    },
  };
}

export function resolveNavigationState(
  href: string,
): SplatDocumentNavigationState {
  const url = new URL(href);
  const intent = resolveSplatStartupIntent(url.search);
  return navigationStateFromStartupIntent(intent);
}

function navigationStateFromStartupIntent(
  intent: SplatStartupIntent,
): SplatDocumentNavigationState {
  switch (intent.kind) {
    case "open-local-document":
      return {
        type: "open-document",
        key: `local:${intent.docUrl}`,
        docUrl: intent.docUrl,
      };
    case "open-account-document": {
      const docUrl = buildJoinedCatalogDocUrl(`automerge:${intent.documentId}`);
      return {
        type: "open-document",
        key: `account:${intent.documentId}`,
        docUrl,
      };
    }
    case "startup-error":
      return {
        type: "startup-error",
        key: `error:${intent.message}`,
        message: intent.message,
      };
    case "open-share-link":
      return {
        type: "none",
        key: `share:${intent.joinSecret}`,
      };
    case "open-last-local":
      return {
        type: "none",
        key: "last-local",
      };
  }
}

function isSameNavigationState(
  a: SplatDocumentNavigationState,
  b: SplatDocumentNavigationState,
): boolean {
  if (a.type !== b.type || a.key !== b.key) {
    return false;
  }
  if (a.type === "open-document" && b.type === "open-document") {
    return a.docUrl === b.docUrl;
  }
  if (a.type === "startup-error" && b.type === "startup-error") {
    return a.message === b.message;
  }
  return true;
}

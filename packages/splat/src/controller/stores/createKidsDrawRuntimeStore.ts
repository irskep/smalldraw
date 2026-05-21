import { atom, computed } from "nanostores";
import type { ResponsiveLayoutProfile } from "../../layout/responsiveLayout";
import type { DocumentSessionPresentation } from "../createDocumentSessionController";

export type DocumentAccessDisplay = {
  title: string;
  description: string;
  message?: string;
};

export type ActiveDocumentState =
  | {
      type: "loading";
      requestedDocUrl: string | null;
      reason: string;
    }
  | {
      type: "loaded";
      docUrl: string;
      presentation: DocumentSessionPresentation;
    }
  | {
      type: "error";
      requestedDocUrl: string | null;
      reason: string;
      display: DocumentAccessDisplay;
    }
  | {
      type: "none";
      reason: string;
      display: DocumentAccessDisplay;
    };

export type RuntimeState = {
  destroyed: boolean;
  activeDocument: ActiveDocumentState;
  layoutProfile: ResponsiveLayoutProfile;
  viewportMetrics: ViewportMetrics;
};

export type KidsDrawRuntimeStore = ReturnType<
  typeof createKidsDrawRuntimeStore
>;

export type ViewportMetrics = {
  overlayLeft: number;
  overlayTop: number;
  overlayWidth: number;
  overlayHeight: number;
  logicalWidth: number;
  logicalHeight: number;
};

const DEFAULT_VIEWPORT_METRICS: ViewportMetrics = {
  overlayLeft: 0,
  overlayTop: 0,
  overlayWidth: 0,
  overlayHeight: 0,
  logicalWidth: 1,
  logicalHeight: 1,
};

export function createKidsDrawRuntimeStore() {
  const $destroyed = atom(false);
  const $activeDocument = atom<ActiveDocumentState>({
    type: "loading",
    requestedDocUrl: null,
    reason: "app_boot",
  });
  const $layoutProfile = atom<ResponsiveLayoutProfile>("large");
  const $viewportMetrics = atom<ViewportMetrics>(DEFAULT_VIEWPORT_METRICS);
  const $state = computed(
    [$destroyed, $activeDocument, $layoutProfile, $viewportMetrics],
    (destroyed, activeDocument, layoutProfile, viewportMetrics) => ({
      destroyed,
      activeDocument,
      layoutProfile,
      viewportMetrics,
    }),
  );

  const $presentationIdentity = computed($activeDocument, (activeDocument) => {
    if (activeDocument.type !== "loaded") {
      return "no-document";
    }
    const presentation = activeDocument.presentation;
    if (presentation.referenceImageSrc && presentation.referenceComposite) {
      return `${presentation.referenceComposite}:${presentation.referenceImageSrc}`;
    }
    return "normal";
  });

  return {
    $state,
    $destroyed,
    $activeDocument,
    $layoutProfile,
    $viewportMetrics,
    $presentationIdentity,
    subscribe(listener: (state: RuntimeState) => void): () => void {
      return $state.subscribe(listener);
    },
    subscribeActiveDocument(
      listener: (state: ActiveDocumentState) => void,
    ): () => void {
      return $activeDocument.subscribe(listener);
    },
    subscribePresentationIdentity(
      listener: (identity: string) => void,
    ): () => void {
      return $presentationIdentity.subscribe(listener);
    },
    subscribeViewportMetrics(
      listener: (metrics: ViewportMetrics) => void,
    ): () => void {
      return $viewportMetrics.subscribe(listener);
    },
    subscribeLayoutProfile(
      listener: (layoutProfile: ResponsiveLayoutProfile) => void,
    ): () => void {
      return $layoutProfile.subscribe(listener);
    },
    isDestroyed(): boolean {
      return $destroyed.get();
    },
    setDestroyed(destroyed: boolean): void {
      if ($destroyed.get() === destroyed) {
        return;
      }
      $destroyed.set(destroyed);
    },
    getActiveDocument(): ActiveDocumentState {
      return $activeDocument.get();
    },
    getActiveDocumentDocUrl(): string | null {
      const activeDocument = $activeDocument.get();
      return activeDocument.type === "loaded" ? activeDocument.docUrl : null;
    },
    setDocumentLoading(input: {
      requestedDocUrl: string | null;
      reason: string;
    }): void {
      const next: ActiveDocumentState = {
        type: "loading",
        requestedDocUrl: input.requestedDocUrl,
        reason: input.reason,
      };
      if (isSameActiveDocumentState($activeDocument.get(), next)) {
        return;
      }
      $activeDocument.set(next);
    },
    setDocumentLoaded(input: {
      docUrl: string;
      presentation: DocumentSessionPresentation;
    }): void {
      const next: ActiveDocumentState = {
        type: "loaded",
        docUrl: input.docUrl,
        presentation: input.presentation,
      };
      if (isSameActiveDocumentState($activeDocument.get(), next)) {
        return;
      }
      $activeDocument.set(next);
    },
    setDocumentError(input: {
      requestedDocUrl: string | null;
      reason: string;
      display: DocumentAccessDisplay;
    }): void {
      const next: ActiveDocumentState = {
        type: "error",
        requestedDocUrl: input.requestedDocUrl,
        reason: input.reason,
        display: input.display,
      };
      if (isSameActiveDocumentState($activeDocument.get(), next)) {
        return;
      }
      $activeDocument.set(next);
    },
    setNoDocument(input: { reason: string; display: DocumentAccessDisplay }): void {
      const next: ActiveDocumentState = {
        type: "none",
        reason: input.reason,
        display: input.display,
      };
      if (isSameActiveDocumentState($activeDocument.get(), next)) {
        return;
      }
      $activeDocument.set(next);
    },
    getReferenceImageSrc(
      composite: "under-drawing" | "over-drawing",
    ): string | null {
      const activeDocument = $activeDocument.get();
      if (activeDocument.type !== "loaded") {
        return null;
      }
      const presentation = activeDocument.presentation;
      return presentation.referenceComposite === composite
        ? (presentation.referenceImageSrc ?? null)
        : null;
    },
    getPresentationIdentity(): string {
      return $presentationIdentity.get();
    },
    getLayoutProfile(): ResponsiveLayoutProfile {
      return $layoutProfile.get();
    },
    setLayoutProfile(layoutProfile: ResponsiveLayoutProfile): void {
      if ($layoutProfile.get() === layoutProfile) {
        return;
      }
      $layoutProfile.set(layoutProfile);
    },
    getViewportMetrics(): ViewportMetrics {
      return $viewportMetrics.get();
    },
    setViewportMetrics(viewportMetrics: ViewportMetrics): void {
      if (isSameViewportMetrics($viewportMetrics.get(), viewportMetrics)) {
        return;
      }
      $viewportMetrics.set(viewportMetrics);
    },
  };
}

function isSameActiveDocumentState(
  a: ActiveDocumentState,
  b: ActiveDocumentState,
): boolean {
  if (a.type !== b.type) {
    return false;
  }
  if (a.type === "loading" && b.type === "loading") {
    return (
      a.requestedDocUrl === b.requestedDocUrl && a.reason === b.reason
    );
  }
  if (a.type === "loaded" && b.type === "loaded") {
    return (
      a.docUrl === b.docUrl &&
      isSamePresentation(a.presentation, b.presentation)
    );
  }
  if (a.type === "error" && b.type === "error") {
    return (
      a.requestedDocUrl === b.requestedDocUrl &&
      a.reason === b.reason &&
      isSameDocumentAccessDisplay(a.display, b.display)
    );
  }
  if (a.type === "none" && b.type === "none") {
    return (
      a.reason === b.reason &&
      isSameDocumentAccessDisplay(a.display, b.display)
    );
  }
  return false;
}

function isSamePresentation(
  a: DocumentSessionPresentation,
  b: DocumentSessionPresentation,
): boolean {
  return (
    a.mode === b.mode &&
    a.coloringPageId === b.coloringPageId &&
    a.referenceImageSrc === b.referenceImageSrc &&
    a.referenceComposite === b.referenceComposite
  );
}

function isSameDocumentAccessDisplay(
  a: DocumentAccessDisplay,
  b: DocumentAccessDisplay,
): boolean {
  return (
    a.title === b.title &&
    a.description === b.description &&
    a.message === b.message
  );
}

function isSameViewportMetrics(
  a: ViewportMetrics,
  b: ViewportMetrics,
): boolean {
  return (
    a.overlayLeft === b.overlayLeft &&
    a.overlayTop === b.overlayTop &&
    a.overlayWidth === b.overlayWidth &&
    a.overlayHeight === b.overlayHeight &&
    a.logicalWidth === b.logicalWidth &&
    a.logicalHeight === b.logicalHeight
  );
}

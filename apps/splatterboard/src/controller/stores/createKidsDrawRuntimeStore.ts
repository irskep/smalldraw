import { atom, computed } from "nanostores";
import type { DocumentSessionPresentation } from "../createDocumentSessionController";

export type RuntimeState = {
  destroyed: boolean;
  presentation: DocumentSessionPresentation;
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
  const $state = atom<RuntimeState>({
    destroyed: false,
    presentation: { mode: "normal" },
    viewportMetrics: DEFAULT_VIEWPORT_METRICS,
  });

  const $presentationIdentity = computed($state, (state) => {
    const presentation = state.presentation;
    if (presentation.referenceImageSrc && presentation.referenceComposite) {
      return `${presentation.referenceComposite}:${presentation.referenceImageSrc}`;
    }
    return "normal";
  });
  const $viewportMetrics = computed($state, (state) => state.viewportMetrics);

  const setStateIfChanged = (next: RuntimeState): void => {
    const current = $state.get();
    if (
      current.destroyed === next.destroyed &&
      isSamePresentation(current.presentation, next.presentation) &&
      isSameViewportMetrics(current.viewportMetrics, next.viewportMetrics)
    ) {
      return;
    }
    $state.set(next);
  };

  return {
    $state,
    $presentationIdentity,
    subscribe(listener: (state: RuntimeState) => void): () => void {
      return $state.subscribe(listener);
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
    isDestroyed(): boolean {
      return $state.get().destroyed;
    },
    setDestroyed(destroyed: boolean): void {
      const current = $state.get();
      setStateIfChanged({ ...current, destroyed });
    },
    getPresentation(): DocumentSessionPresentation {
      return $state.get().presentation;
    },
    setPresentation(presentation: DocumentSessionPresentation): void {
      const current = $state.get();
      setStateIfChanged({ ...current, presentation });
    },
    getReferenceImageSrc(
      composite: "under-drawing" | "over-drawing",
    ): string | null {
      const presentation = $state.get().presentation;
      return presentation.referenceComposite === composite
        ? (presentation.referenceImageSrc ?? null)
        : null;
    },
    getPresentationIdentity(): string {
      return $presentationIdentity.get();
    },
    getViewportMetrics(): ViewportMetrics {
      return $state.get().viewportMetrics;
    },
    setViewportMetrics(viewportMetrics: ViewportMetrics): void {
      const current = $state.get();
      setStateIfChanged({ ...current, viewportMetrics });
    },
  };
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

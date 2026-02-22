import { atom, computed } from "nanostores";
import type { ResponsiveLayoutProfile } from "../../layout/responsiveLayout";
import type { DocumentSessionPresentation } from "../createDocumentSessionController";

export type RuntimeState = {
  destroyed: boolean;
  presentation: DocumentSessionPresentation;
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
  const $presentation = atom<DocumentSessionPresentation>({ mode: "normal" });
  const $layoutProfile = atom<ResponsiveLayoutProfile>("large");
  const $viewportMetrics = atom<ViewportMetrics>(DEFAULT_VIEWPORT_METRICS);
  const $state = computed(
    [$destroyed, $presentation, $layoutProfile, $viewportMetrics],
    (destroyed, presentation, layoutProfile, viewportMetrics) => ({
      destroyed,
      presentation,
      layoutProfile,
      viewportMetrics,
    }),
  );

  const $presentationIdentity = computed($presentation, (presentation) => {
    if (presentation.referenceImageSrc && presentation.referenceComposite) {
      return `${presentation.referenceComposite}:${presentation.referenceImageSrc}`;
    }
    return "normal";
  });

  return {
    $state,
    $destroyed,
    $presentation,
    $layoutProfile,
    $viewportMetrics,
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
    getPresentation(): DocumentSessionPresentation {
      return $presentation.get();
    },
    setPresentation(presentation: DocumentSessionPresentation): void {
      if (isSamePresentation($presentation.get(), presentation)) {
        return;
      }
      $presentation.set(presentation);
    },
    getReferenceImageSrc(
      composite: "under-drawing" | "over-drawing",
    ): string | null {
      const presentation = $presentation.get();
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

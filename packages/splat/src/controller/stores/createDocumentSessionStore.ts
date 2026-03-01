import type { DrawingDocumentSize } from "@smalldraw/core";
import { atom } from "nanostores";

type DocumentSessionPresentation = {
  mode: "normal" | "coloring" | "markup";
  coloringPageId?: string;
  referenceImageSrc?: string;
  referenceComposite?: "under-drawing" | "over-drawing";
};

type DocumentSessionState = {
  presentation: DocumentSessionPresentation;
  canvasSize: DrawingDocumentSize | null;
};

export type DocumentSessionIntent =
  | {
      type: "apply_canvas_size";
      width: number;
      height: number;
    }
  | {
      type: "apply_presentation";
      presentation: DocumentSessionPresentation;
    }
  | {
      type: "apply_toolbar_state";
      presentation: DocumentSessionPresentation;
      forceDefaults: boolean;
    }
  | {
      type: "adapter_applied";
    }
  | {
      type: "switch_or_create_completed";
    };

export function createDocumentSessionStore() {
  const $state = atom<DocumentSessionState>({
    presentation: { mode: "normal" },
    canvasSize: null,
  });
  const $intents = atom<DocumentSessionIntent[]>([]);

  return {
    subscribe(listener: (state: DocumentSessionState) => void): () => void {
      return $state.subscribe(listener);
    },
    subscribeIntents(
      listener: (intents: readonly DocumentSessionIntent[]) => void,
    ): () => void {
      return $intents.subscribe(listener);
    },
    subscribeDrainedIntents(
      listener: (intents: readonly DocumentSessionIntent[]) => void,
    ): () => void {
      return $intents.subscribe((intents) => {
        if (intents.length === 0) {
          return;
        }
        const drained = [...intents];
        $intents.set([]);
        listener(drained);
      });
    },
    consumeIntents(): DocumentSessionIntent[] {
      const intents = $intents.get();
      if (intents.length === 0) {
        return [];
      }
      $intents.set([]);
      return intents;
    },
    emitIntent(intent: DocumentSessionIntent): void {
      const current = $intents.get();
      $intents.set([...current, intent]);
    },
    get(): DocumentSessionState {
      return $state.get();
    },
    setPresentation(presentation: DocumentSessionPresentation): void {
      const current = $state.get();
      const previous = current.presentation;
      if (
        previous.mode === presentation.mode &&
        previous.coloringPageId === presentation.coloringPageId &&
        previous.referenceImageSrc === presentation.referenceImageSrc &&
        previous.referenceComposite === presentation.referenceComposite
      ) {
        return;
      }
      $state.set({
        ...current,
        presentation,
      });
    },
    setCanvasSize(canvasSize: DrawingDocumentSize): void {
      const current = $state.get();
      const previous = current.canvasSize;
      if (
        previous &&
        previous.width === canvasSize.width &&
        previous.height === canvasSize.height
      ) {
        return;
      }
      $state.set({
        ...current,
        canvasSize,
      });
    },
  };
}

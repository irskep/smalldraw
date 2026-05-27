import "./DocumentBrowserDialogView.css";

import {
  Button,
  createCardGrid,
  createDialogScaffold,
  createPreviewCard,
  createThumbnailTile,
  type ThumbnailTile,
} from "@smalldraw/design-system";
import { KeyRound, Trash2, X } from "lucide";
import { atom } from "nanostores";
import { list } from "redom";
import type { KidsDocumentSummary } from "../documents";
import { bindAtom } from "./atomBindings";
import type { ReDomLike } from "./ReDomLike";

const LONG_PRESS_PREVIEW_MS = 320;

type DocumentBrowserDialogState = {
  open: boolean;
  loading: boolean;
  busyDocUrl: string | null;
  removingDocUrl: string | null;
  currentDocUrl: string | null;
  documents: KidsDocumentSummary[];
  thumbnailUrlByDocUrl: Map<string, string>;
  claimableDocUrls: Set<string>;
  previewDocUrl: string | null;
  touchPressDocUrl: string | null;
  suppressNextOpenDocUrl: string | null;
};

type DocumentTileItem = {
  docUrl: string;
  document: KidsDocumentSummary;
  isCurrent: boolean;
  busy: boolean;
  removing: boolean;
  claimable: boolean;
  thumbnailUrl: string | null;
  onOpen: (docUrl: string) => void;
  onDelete: (docUrl: string) => void;
  onClaim: (docUrl: string) => void;
  onPointerDown: (docUrl: string, event: PointerEvent) => void;
  onPointerEnd: () => void;
};

export interface DocumentBrowserDialogView extends ReDomLike<HTMLDivElement> {
  setOpen(open: boolean): void;
  isOpen(): boolean;
  setLoading(loading: boolean): void;
  setRemovingDocument(docUrl: string | null): void;
  waitForRemovingDocument(docUrl: string): Promise<void>;
  setDocuments(documents: KidsDocumentSummary[]): void;
  setCurrentDocument(docUrl: string | null): void;
  setThumbnailUrls(thumbnailUrlByDocUrl: Map<string, string>): void;
  setClaimableDocuments(claimableDocUrls: Set<string>): void;
  setBusyDocument(docUrl: string | null): void;
}

function formatTimestamp(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return "Unknown time";
  }
  return date.toLocaleString();
}

function toFallbackTitle(document: KidsDocumentSummary): string {
  if (document.title && document.title.trim().length > 0) {
    return document.title;
  }
  return `Drawing ${document.docUrl.slice(-8)}`;
}

function getMetadataTooltip(document: KidsDocumentSummary): string {
  const mode = (() => {
    if (document.mode === "coloring" && document.coloringPageId) {
      return `\nMode: Coloring (${document.coloringPageId})`;
    }
    if (document.mode === "markup") {
      return "\nMode: Markup";
    }
    return "\nMode: Normal";
  })();
  return `${toFallbackTitle(document)}\nLast opened: ${formatTimestamp(document.lastOpenedAt)}${mode}`;
}

function toViewTransitionName(docUrl: string): string {
  return `kids-draw-doc-${docUrl.replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
}

class DocumentTileView implements ReDomLike<HTMLDivElement, DocumentTileItem> {
  readonly el: HTMLDivElement;

  #tile: ThumbnailTile;
  #thumbnailMedia: HTMLDivElement;
  #thumbnailImage: HTMLImageElement;
  #thumbnailFallback: HTMLDivElement;
  #thumbnailUrl: string | null = null;

  constructor() {
    this.#tile = createThumbnailTile();
    this.#thumbnailMedia = document.createElement("div");
    this.#thumbnailMedia.className =
      "kids-draw-document-browser-dialog__thumbnail-media";
    this.#thumbnailImage = document.createElement("img");
    this.#thumbnailImage.alt = "";
    this.#thumbnailImage.loading = "lazy";
    this.#thumbnailImage.decoding = "async";
    this.#thumbnailImage.draggable = false;
    this.#thumbnailFallback = document.createElement("div");
    this.#thumbnailMedia.append(this.#thumbnailFallback);
    this.#tile.setMedia(this.#thumbnailMedia);
    this.el = this.#tile.el;
  }

  update(item: DocumentTileItem): void {
    const { document, busy, claimable } = item;
    const nextThumbnailUrl = item.thumbnailUrl;
    const openLabel = toFallbackTitle(document);
    const openTitle = getMetadataTooltip(document);

    this.el.dataset.docBrowserDoc = document.docUrl;
    this.el.dataset.removing = item.removing ? "true" : "false";
    this.el.style.viewTransitionName = toViewTransitionName(document.docUrl);
    this.#tile.setCurrent(item.isCurrent);
    this.#tile.setOpenLabel(openLabel);
    this.#tile.setOpenTitle(openTitle);
    this.#tile.setOpenAttributes({
      "data-document-browser-open": document.docUrl,
    });
    this.#tile.setOpenDisabled(busy);
    this.#tile.setOnOpen(() => item.onOpen(document.docUrl));
    this.#tile.setOnOpenPointerDown((event) =>
      item.onPointerDown(document.docUrl, event),
    );
    this.#tile.setOnOpenPointerUp(() => item.onPointerEnd());
    this.#tile.setOnOpenPointerCancel(() => item.onPointerEnd());
    this.#tile.setOnOpenPointerLeave(() => item.onPointerEnd());
    this.#tile.setBadge({
      label: document.collaborative ? "Shared" : "Local",
      tone: document.collaborative ? "positive" : "default",
    });
    this.#tile.setAction({
      label: "Delete drawing",
      icon: Trash2,
      onPress: () => item.onDelete(document.docUrl),
      disabled: busy,
      hidden: false,
    });
    this.#tile.setActionAttributes({
      "data-document-browser-delete": document.docUrl,
    });
    this.#tile.setSecondaryAction(
      claimable
        ? {
            label: "Claim drawing to your account",
            text: "Claim",
            icon: KeyRound,
            onPress: () => item.onClaim(document.docUrl),
            disabled: busy,
            hidden: false,
          }
        : null,
    );
    this.#tile.setSecondaryActionAttributes(
      claimable
        ? {
            "data-document-browser-claim": document.docUrl,
          }
        : {
            "data-document-browser-claim": null,
          },
    );

    if (nextThumbnailUrl !== this.#thumbnailUrl) {
      if (nextThumbnailUrl) {
        this.#thumbnailImage.src = nextThumbnailUrl;
      } else {
        this.#thumbnailImage.removeAttribute("src");
      }
      this.#thumbnailUrl = nextThumbnailUrl;
    }
    this.#thumbnailMedia.replaceChildren(
      nextThumbnailUrl ? this.#thumbnailImage : this.#thumbnailFallback,
    );
  }
}

export function createDocumentBrowserDialogView(options: {
  onClose: () => void;
  onOpenCreateDialog: () => void;
  onOpenDocument: (docUrl: string) => void;
  onClaimDocument?: (docUrl: string) => void;
  onDeleteDocument: (docUrl: string) => void;
}): DocumentBrowserDialogView {
  const root = document.createElement("div");
  root.className = "kids-draw-document-browser-dialog-host";

  const scaffold = createDialogScaffold();
  scaffold.setDialogClassName("kids-draw-document-browser-dialog");
  scaffold.setSurfaceClassName("kids-draw-document-browser-dialog__panel");
  scaffold.setTitleAlignment("center");
  scaffold.setTitle("Browse Drawings");
  scaffold.setOnDismiss(() => {
    options.onClose();
  });

  const closeButton = new Button({
    label: "Close",
    tone: "neutral",
    icon: X,
  });
  closeButton.setOnPress(() => {
    options.onClose();
  });
  const newButton = new Button({
    label: "New Drawing",
    tone: "primary",
  });
  newButton.setOnPress(() => {
    options.onOpenCreateDialog();
  });
  scaffold.setLeading(closeButton);
  scaffold.setTrailing(newButton);

  const grid = createCardGrid({
    className: "kids-draw-document-browser-dialog__grid",
    ariaLabel: "Browse drawings",
  });
  const body = document.createElement("div");
  body.className = "kids-draw-document-browser-dialog__body";
  body.append(grid.el);
  scaffold.setBody(body);

  const previewCard = createPreviewCard();
  const previewOverlay = document.createElement("div");
  previewOverlay.className = "kids-draw-document-browser-dialog__preview";
  previewOverlay.hidden = true;
  previewOverlay.append(previewCard.el);
  previewOverlay.addEventListener("click", (event) => {
    if (event.target === previewOverlay) {
      closePreview();
    }
  });

  root.append(scaffold.el, previewOverlay);

  const loadingEl = document.createElement("p");
  loadingEl.className = "kids-draw-document-browser-dialog__loading";
  loadingEl.textContent = "Loading drawings…";
  const emptyStateEl = document.createElement("p");
  emptyStateEl.className = "kids-draw-document-browser-dialog__empty";
  emptyStateEl.textContent = "No drawings yet. Start a new one.";
  body.append(loadingEl, emptyStateEl);

  const tileList = list(grid.el, DocumentTileView, "docUrl");

  const $state = atom<DocumentBrowserDialogState>({
    open: false,
    loading: false,
    busyDocUrl: null,
    removingDocUrl: null,
    currentDocUrl: null,
    documents: [],
    thumbnailUrlByDocUrl: new Map(),
    claimableDocUrls: new Set(),
    previewDocUrl: null,
    touchPressDocUrl: null,
    suppressNextOpenDocUrl: null,
  });
  let longPressTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const updateState = (
    updater: (state: DocumentBrowserDialogState) => DocumentBrowserDialogState,
  ): void => {
    $state.set(updater($state.get()));
  };

  const clearLongPressTimeout = (): void => {
    if (longPressTimeoutHandle !== null) {
      clearTimeout(longPressTimeoutHandle);
      longPressTimeoutHandle = null;
    }
  };

  const closePreview = (): void => {
    updateState((state) => ({ ...state, previewDocUrl: null }));
  };

  const showPreview = (docUrl: string): void => {
    updateState((state) => ({ ...state, previewDocUrl: docUrl }));
  };

  const startLongPressPreview = (docUrl: string, event: PointerEvent): void => {
    if (event.pointerType === "mouse") {
      return;
    }
    clearLongPressTimeout();
    updateState((state) => ({ ...state, touchPressDocUrl: docUrl }));
    longPressTimeoutHandle = setTimeout(() => {
      longPressTimeoutHandle = null;
      if ($state.get().touchPressDocUrl !== docUrl) {
        return;
      }
      showPreview(docUrl);
    }, LONG_PRESS_PREVIEW_MS);
  };

  const cancelTouchHold = (): void => {
    const state = $state.get();
    clearLongPressTimeout();
    if (!state.previewDocUrl) {
      if (state.touchPressDocUrl !== null) {
        updateState((nextState) => ({ ...nextState, touchPressDocUrl: null }));
      }
      return;
    }
    updateState((nextState) => ({
      ...nextState,
      touchPressDocUrl: null,
      suppressNextOpenDocUrl: state.previewDocUrl,
      previewDocUrl: null,
    }));
  };

  const openDocument = (docUrl: string): void => {
    const state = $state.get();
    if (state.suppressNextOpenDocUrl === docUrl) {
      updateState((nextState) => ({
        ...nextState,
        suppressNextOpenDocUrl: null,
      }));
      return;
    }
    options.onOpenDocument(docUrl);
  };

  bindAtom($state, (state) => {
    closeButton.setDisabled(state.busyDocUrl !== null);
    newButton.setDisabled(state.busyDocUrl === "__new__");

    const previewDocument = state.previewDocUrl
      ? (state.documents.find(
          (document) => document.docUrl === state.previewDocUrl,
        ) ?? null)
      : null;
    previewOverlay.hidden = previewDocument === null;
    if (previewDocument) {
      const previewImageSrc =
        state.thumbnailUrlByDocUrl.get(previewDocument.docUrl) ?? null;
      previewCard.setImage(
        previewImageSrc
          ? {
              src: previewImageSrc,
            }
          : null,
      );
      previewCard.setTitle(toFallbackTitle(previewDocument));
      previewCard.setSubtitle(
        `Last opened: ${formatTimestamp(previewDocument.lastOpenedAt)}`,
      );
    }

    const showInitialLoading = state.loading && state.documents.length === 0;
    const showEmpty = !state.loading && state.documents.length === 0;
    loadingEl.hidden = !showInitialLoading;
    emptyStateEl.hidden = !showEmpty;
    grid.el.hidden = showInitialLoading || showEmpty;

    tileList.update(
      state.documents.map((document) => ({
        docUrl: document.docUrl,
        document,
        isCurrent: document.docUrl === state.currentDocUrl,
        busy: state.busyDocUrl === document.docUrl,
        removing: state.removingDocUrl === document.docUrl,
        claimable: state.claimableDocUrls.has(document.docUrl),
        thumbnailUrl: state.thumbnailUrlByDocUrl.get(document.docUrl) ?? null,
        onOpen: openDocument,
        onDelete: options.onDeleteDocument,
        onClaim: (docUrl: string) => options.onClaimDocument?.(docUrl),
        onPointerDown: startLongPressPreview,
        onPointerEnd: cancelTouchHold,
      })),
    );
  });

  return {
    el: root,
    setOpen(open) {
      if (!open) {
        clearLongPressTimeout();
      }
      updateState((state) => ({
        ...state,
        open,
        previewDocUrl: open ? state.previewDocUrl : null,
        touchPressDocUrl: open ? state.touchPressDocUrl : null,
      }));
      if (open) {
        scaffold.show();
        return;
      }
      void scaffold.close({ animated: true });
    },
    isOpen() {
      return $state.get().open;
    },
    setLoading(loading) {
      updateState((state) => ({ ...state, loading }));
    },
    setRemovingDocument(docUrl) {
      updateState((state) => ({ ...state, removingDocUrl: docUrl }));
    },
    waitForRemovingDocument(docUrl) {
      const tile =
        Array.from(
          root.querySelectorAll<HTMLElement>("[data-doc-browser-doc]"),
        ).find((element) => element.dataset.docBrowserDoc === docUrl) ?? null;
      if (!tile) {
        return Promise.resolve();
      }
      return new Promise((resolve) => {
        let settled = false;
        let startedTransitions = 0;
        let finishedTransitions = 0;
        let sawTransitionRun = false;
        const finish = () => {
          if (settled) {
            return;
          }
          settled = true;
          tile.removeEventListener("transitionrun", onTransitionRun);
          tile.removeEventListener("transitionend", onTransitionDone);
          tile.removeEventListener("transitioncancel", onTransitionDone);
          resolve();
        };
        const isRelevantTransition = (event: TransitionEvent): boolean => {
          return event.target === tile && event.propertyName === "opacity";
        };
        const onTransitionRun = (event: TransitionEvent) => {
          if (!isRelevantTransition(event)) {
            return;
          }
          sawTransitionRun = true;
          startedTransitions += 1;
        };
        const onTransitionDone = (event: TransitionEvent) => {
          if (!isRelevantTransition(event)) {
            return;
          }
          finishedTransitions += 1;
          if (sawTransitionRun && finishedTransitions >= startedTransitions) {
            finish();
          }
        };
        tile.addEventListener("transitionrun", onTransitionRun);
        tile.addEventListener("transitionend", onTransitionDone);
        tile.addEventListener("transitioncancel", onTransitionDone);

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!sawTransitionRun) {
              finish();
            }
          });
        });
      });
    },
    setDocuments(documents) {
      updateState((state) => ({
        ...state,
        documents: [...documents],
        removingDocUrl:
          state.removingDocUrl &&
          documents.some((document) => document.docUrl === state.removingDocUrl)
            ? state.removingDocUrl
            : null,
      }));
    },
    setCurrentDocument(docUrl) {
      updateState((state) => ({ ...state, currentDocUrl: docUrl }));
    },
    setThumbnailUrls(thumbnailUrlByDocUrl) {
      updateState((state) => ({
        ...state,
        thumbnailUrlByDocUrl: new Map(thumbnailUrlByDocUrl),
      }));
    },
    setClaimableDocuments(claimableDocUrls) {
      updateState((state) => ({
        ...state,
        claimableDocUrls: new Set(claimableDocUrls),
      }));
    },
    setBusyDocument(docUrl) {
      updateState((state) => ({ ...state, busyDocUrl: docUrl }));
    },
  };
}

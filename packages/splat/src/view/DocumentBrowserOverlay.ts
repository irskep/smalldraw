import "./DocumentBrowserOverlay.css";

import { ArrowLeft, type IconNode, Trash2, X } from "lucide";
import { atom } from "nanostores";
import { el, list, setChildren } from "redom";
import { getColoringPages } from "../coloring/catalog";
import type { KidsDocumentSummary } from "../documents";
import { bindAtom, bindAttrs } from "./atomBindings";
import type { ReDomLike } from "./ReDomLike";

const LONG_PRESS_PREVIEW_MS = 320;
const SVG_NS = "http://www.w3.org/2000/svg";

export type NewDocumentRequest =
  | {
      mode: "normal";
    }
  | {
      mode: "coloring";
      coloringPageId: string;
    };

function createLucideIcon(
  iconNode: IconNode,
  className: string,
): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("class", className);

  for (const [tag, attrs] of iconNode) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [attr, value] of Object.entries(attrs)) {
      if (value !== undefined) {
        node.setAttribute(attr, `${value}`);
      }
    }
    svg.appendChild(node);
  }
  return svg;
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

export interface DocumentBrowserOverlay extends ReDomLike<HTMLDivElement> {
  setOpen(open: boolean): void;
  isOpen(): boolean;
  openCreateDialog(): void;
  closeCreateDialog(): void;
  isCreateDialogOpen(): boolean;
  setLoading(loading: boolean): void;
  setDocuments(
    documents: KidsDocumentSummary[],
    currentDocUrl: string,
    thumbnailUrlByDocUrl: Map<string, string>,
  ): void;
  setBusyDocument(docUrl: string | null): void;
}

type DocumentTileItem = {
  docUrl: string;
  document: KidsDocumentSummary;
  isCurrent: boolean;
  busy: boolean;
  thumbnailUrl: string | null;
};

type ColoringVolumeId = "pdr-v1" | "pdr-v2";

class DocumentTileView implements ReDomLike<HTMLDivElement, DocumentTileItem> {
  readonly el: HTMLDivElement;
  private readonly openButton: HTMLButtonElement;
  private readonly thumbnailImage: HTMLImageElement;
  private readonly thumbnailFallback: HTMLDivElement;
  private readonly deleteButton: HTMLButtonElement;
  private thumbnailUrl: string | null = null;

  constructor() {
    this.thumbnailImage = el("img.kids-draw-document-tile__thumbnail", {
      alt: "",
      loading: "lazy",
      decoding: "async",
      draggable: "false",
    }) as HTMLImageElement;
    this.thumbnailFallback = el(
      "div.kids-draw-document-tile__fallback",
    ) as HTMLDivElement;
    this.openButton = el(
      "button.kids-draw-document-tile__open",
      {
        type: "button",
      },
      this.thumbnailImage,
      this.thumbnailFallback,
    ) as HTMLButtonElement;
    this.deleteButton = el(
      "button.kids-draw-document-tile__delete",
      {
        type: "button",
        "aria-label": "Delete drawing",
      },
      createLucideIcon(Trash2, "kids-draw-document-tile__delete-icon"),
    ) as HTMLButtonElement;
    this.el = el(
      "div.kids-draw-document-tile",
      this.openButton,
      this.deleteButton,
    ) as HTMLDivElement;
  }

  update(item: DocumentTileItem): void {
    const { document, isCurrent, busy } = item;
    const nextThumbnailUrl = item.thumbnailUrl;

    this.el.classList.toggle("is-current", isCurrent);
    this.el.dataset.docBrowserDoc = document.docUrl;
    this.openButton.dataset.docBrowserOpen = document.docUrl;
    this.openButton.title = getMetadataTooltip(document);
    this.openButton.disabled = busy;
    this.deleteButton.dataset.docBrowserDelete = document.docUrl;
    this.deleteButton.disabled = busy;

    if (nextThumbnailUrl !== this.thumbnailUrl) {
      if (nextThumbnailUrl) {
        this.thumbnailImage.src = nextThumbnailUrl;
      } else {
        this.thumbnailImage.removeAttribute("src");
      }
      this.thumbnailUrl = nextThumbnailUrl;
    }
    this.thumbnailImage.hidden = nextThumbnailUrl === null;
    this.thumbnailFallback.hidden = nextThumbnailUrl !== null;
  }
}

export function createDocumentBrowserOverlay(options: {
  onClose: () => void;
  onNewDocument: (request: NewDocumentRequest) => void;
  onOpenDocument: (docUrl: string) => void;
  onDeleteDocument: (docUrl: string) => void;
}): DocumentBrowserOverlay {
  const pages = getColoringPages();
  const pagesByVolume = new Map<
    ColoringVolumeId,
    Array<(typeof pages)[number]>
  >();
  for (const page of pages) {
    const volumeId = page.volumeId;
    const volumePages = pagesByVolume.get(volumeId) ?? [];
    volumePages.push(page);
    pagesByVolume.set(volumeId, volumePages);
  }

  const rootChoices = [
    {
      id: "normal",
      title: "Blank Page",
      subtitle: "Normal drawing",
      thumbSrc: null,
    },
    {
      id: "pdr-v1",
      title: "Coloring Book 1",
      subtitle: "Open page picker",
      thumbSrc: pagesByVolume.get("pdr-v1")?.[0]?.src ?? null,
    },
    {
      id: "pdr-v2",
      title: "Coloring Book 2",
      subtitle: "Open page picker",
      thumbSrc: pagesByVolume.get("pdr-v2")?.[0]?.src ?? null,
    },
  ] as const;

  const title = el(
    "h2.kids-draw-document-browser__title",
    "Browse Drawings",
  ) as HTMLHeadingElement;
  const closeButton = el(
    "button.kids-draw-document-browser__close",
    {
      type: "button",
      "aria-label": "Close document browser",
    },
    createLucideIcon(X, "kids-draw-document-browser__close-icon"),
    el("span.kids-draw-document-browser__close-label", "Close"),
  ) as HTMLButtonElement;
  const newButton = el(
    "button.kids-draw-document-browser__new",
    { type: "button" },
    "New Drawing",
  ) as HTMLButtonElement;
  const controls = el(
    "div.kids-draw-document-browser__controls",
    closeButton,
    title,
    newButton,
  ) as HTMLDivElement;

  const grid = el("div.kids-draw-document-browser__grid") as HTMLDivElement;
  const loadingEl = el(
    "p.kids-draw-document-browser__loading",
    "Loading drawings…",
  ) as HTMLParagraphElement;
  const emptyStateEl = el(
    "p.kids-draw-document-browser__empty",
    "No drawings yet. Start a new one.",
  ) as HTMLParagraphElement;
  const tileList = list(grid, DocumentTileView, "docUrl");
  const panel = el(
    "div.kids-draw-document-browser__panel",
    controls,
    grid,
  ) as HTMLDivElement;
  const previewImage = el("img.kids-draw-document-preview__image", {
    alt: "",
    draggable: "false",
  }) as HTMLImageElement;
  const previewMetaTitle = el(
    "p.kids-draw-document-preview__meta-title",
  ) as HTMLParagraphElement;
  const previewMetaTimestamp = el(
    "p.kids-draw-document-preview__meta-time",
  ) as HTMLParagraphElement;
  const previewMeta = el(
    "div.kids-draw-document-preview__meta",
    previewMetaTitle,
    previewMetaTimestamp,
  ) as HTMLDivElement;
  const previewCard = el(
    "div.kids-draw-document-preview__card",
    previewImage,
    previewMeta,
  ) as HTMLDivElement;
  const preview = el(
    "div.kids-draw-document-preview",
    { hidden: "true" },
    previewCard,
  ) as HTMLDivElement;
  const browserHost = el(
    "div.kids-draw-document-browser",
    panel,
    preview,
  ) as HTMLDivElement;

  const createCloseButton = el(
    "button.kids-draw-new-document__close",
    {
      type: "button",
      "aria-label": "Close new drawing dialog",
      "data-doc-create-close": "true",
    },
    createLucideIcon(X, "kids-draw-new-document__close-icon"),
    el("span.kids-draw-new-document__close-label", "Close"),
  ) as HTMLButtonElement;
  const createBackButton = el(
    "button.kids-draw-new-document__back",
    {
      type: "button",
      "aria-label": "Back",
      hidden: "true",
      "data-doc-create-back": "true",
    },
    createLucideIcon(ArrowLeft, "kids-draw-new-document__back-icon"),
    el("span.kids-draw-new-document__back-label", "Back"),
  ) as HTMLButtonElement;
  const createTitle = el(
    "h2.kids-draw-new-document__title",
    "New Drawing",
  ) as HTMLHeadingElement;
  const createSubtitle = el(
    "p.kids-draw-new-document__subtitle",
    "Choose how to start",
  ) as HTMLParagraphElement;
  const createHeader = el(
    "div.kids-draw-new-document__header",
    createBackButton,
    createTitle,
    createCloseButton,
  ) as HTMLDivElement;

  const createRootChoices = el(
    "div.kids-draw-new-document__choices",
  ) as HTMLDivElement;
  const rootButtons: HTMLButtonElement[] = [];
  for (const choice of rootChoices) {
    const thumb = choice.thumbSrc
      ? (el("img.kids-draw-new-document-choice__thumb", {
          src: choice.thumbSrc,
          alt: "",
          loading: "eager",
          decoding: "async",
          draggable: "false",
        }) as HTMLImageElement)
      : (el(
          "div.kids-draw-new-document-choice__thumb kids-draw-new-document-choice__thumb--blank",
          "Blank",
        ) as HTMLDivElement);
    const titleEl = el(
      "p.kids-draw-new-document-choice__title",
      choice.title,
    ) as HTMLParagraphElement;
    const subtitleEl = el(
      "p.kids-draw-new-document-choice__subtitle",
      choice.subtitle,
    ) as HTMLParagraphElement;
    const text = el(
      "div.kids-draw-new-document-choice__text",
      titleEl,
      subtitleEl,
    ) as HTMLDivElement;
    const button = el(
      "button.kids-draw-new-document__choice",
      {
        type: "button",
      },
      thumb,
      text,
    ) as HTMLButtonElement;
    if (choice.id === "normal") {
      button.dataset.docBrowserCreateNormal = "true";
    } else {
      button.dataset.docCreateVolume = choice.id;
    }
    rootButtons.push(button);
    createRootChoices.appendChild(button);
  }

  const createPageGrid = el(
    "div.kids-draw-new-document-pages__grid",
  ) as HTMLDivElement;
  const createPageView = el(
    "div.kids-draw-new-document-pages",
    createPageGrid,
  ) as HTMLDivElement;

  const createBody = el(
    "div.kids-draw-new-document__body",
    createSubtitle,
    createRootChoices,
    createPageView,
  ) as HTMLDivElement;
  const createCard = el(
    "div.kids-draw-new-document__card",
    createHeader,
    createBody,
  ) as HTMLDivElement;
  const createHost = el(
    "div.kids-draw-new-document",
    { hidden: "true" },
    createCard,
  ) as HTMLDivElement;

  const root = el(
    "div.kids-draw-document-overlays",
    browserHost,
    createHost,
  ) as HTMLDivElement;

  type OverlayState = {
    open: boolean;
    loading: boolean;
    busyDocUrl: string | null;
    currentDocUrl: string;
    documents: KidsDocumentSummary[];
    thumbnailUrlByDocUrl: Map<string, string>;
    previewDocUrl: string | null;
    touchPressDocUrl: string | null;
    suppressNextOpenDocUrl: string | null;
    createOpen: boolean;
    createVolumeId: ColoringVolumeId | null;
  };
  const $state = atom<OverlayState>({
    open: false,
    loading: false,
    busyDocUrl: null,
    currentDocUrl: "",
    documents: [],
    thumbnailUrlByDocUrl: new Map(),
    previewDocUrl: null,
    touchPressDocUrl: null,
    suppressNextOpenDocUrl: null,
    createOpen: false,
    createVolumeId: null,
  });
  let longPressTimeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const updateState = (
    updater: (state: OverlayState) => OverlayState,
  ): void => {
    $state.set(updater($state.get()));
  };

  const clearLongPressTimeout = (): void => {
    if (longPressTimeoutHandle !== null) {
      clearTimeout(longPressTimeoutHandle);
      longPressTimeoutHandle = null;
    }
  };

  const startLongPressPreview = (docUrl: string): void => {
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

  const closePreview = (): void => {
    updateState((state) => ({ ...state, previewDocUrl: null }));
  };

  const showPreview = (docUrl: string): void => {
    updateState((state) => ({ ...state, previewDocUrl: docUrl }));
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

  const applyPreviewImage = (previewDocUrl: string | null): void => {
    if (!previewDocUrl) {
      previewImage.hidden = true;
      if (previewImage.hasAttribute("src")) {
        previewImage.removeAttribute("src");
      }
      return;
    }
    const state = $state.get();
    const nextPreviewImageSrc =
      state.thumbnailUrlByDocUrl.get(previewDocUrl) ?? null;
    const currentPreviewImageSrc = previewImage.getAttribute("src");
    if (nextPreviewImageSrc) {
      if (currentPreviewImageSrc !== nextPreviewImageSrc) {
        previewImage.src = nextPreviewImageSrc;
      }
      previewImage.hidden = false;
      return;
    }
    previewImage.hidden = true;
    if (currentPreviewImageSrc !== null) {
      previewImage.removeAttribute("src");
    }
  };

  const renderCreateGrid = (state: OverlayState): void => {
    if (!state.createVolumeId) {
      setChildren(createPageGrid, []);
      return;
    }
    const volumePages = pagesByVolume.get(state.createVolumeId) ?? [];
    const pageButtons = volumePages.map((page) => {
      const pageNum = String(page.pageNumber).padStart(3, "0");
      return el(
        "button.kids-draw-new-document-page",
        {
          type: "button",
          "data-doc-create-page": page.id,
          disabled: state.busyDocUrl === "__new__" ? "true" : null,
        },
        el("img.kids-draw-new-document-page__thumb", {
          src: page.src,
          alt: `${page.volumeLabel} Page ${pageNum}`,
          loading: "eager",
          decoding: "async",
          draggable: "false",
        }),
        el("span.kids-draw-new-document-page__label", `Page ${pageNum}`),
      ) as HTMLButtonElement;
    });
    setChildren(createPageGrid, pageButtons);
  };

  const render = (): void => {
    const state = $state.get();
    const createBusy = state.busyDocUrl === "__new__";
    createBackButton.hidden = state.createVolumeId === null;
    createSubtitle.textContent =
      state.createVolumeId === null
        ? "Choose how to start"
        : `Choose a page from ${state.createVolumeId === "pdr-v1" ? "Coloring Book 1" : "Coloring Book 2"}`;
    createRootChoices.hidden = state.createVolumeId !== null;
    createPageView.hidden = state.createVolumeId === null;
    createTitle.textContent =
      state.createVolumeId === null
        ? "New Drawing"
        : state.createVolumeId === "pdr-v1"
          ? "Coloring Book 1"
          : "Coloring Book 2";

    for (const button of rootButtons) {
      button.disabled = createBusy;
    }
    createBackButton.disabled = createBusy;
    createCloseButton.disabled = createBusy;
    renderCreateGrid(state);

    if (!state.open) {
      clearLongPressTimeout();
      return;
    }

    const previewDocument = state.previewDocUrl
      ? (state.documents.find(
          (document) => document.docUrl === state.previewDocUrl,
        ) ?? null)
      : null;
    preview.hidden = previewDocument === null;
    if (previewDocument) {
      applyPreviewImage(previewDocument.docUrl);
      previewMetaTitle.textContent = toFallbackTitle(previewDocument);
      previewMetaTimestamp.textContent = `Last opened: ${formatTimestamp(previewDocument.lastOpenedAt)}`;
    } else {
      applyPreviewImage(null);
    }

    if (state.loading) {
      setChildren(grid, [loadingEl]);
      return;
    }

    if (state.documents.length === 0) {
      setChildren(grid, [emptyStateEl]);
      return;
    }

    const items = state.documents.map((document) => ({
      docUrl: document.docUrl,
      document,
      isCurrent: document.docUrl === state.currentDocUrl,
      busy: state.busyDocUrl === document.docUrl,
      thumbnailUrl: state.thumbnailUrlByDocUrl.get(document.docUrl) ?? null,
    }));
    tileList.update(items);
  };

  const onBrowserPointerDown = (event: PointerEvent): void => {
    const target = event.target as {
      closest?: (selector: string) => Element | null;
    } | null;
    if (!target?.closest || event.pointerType === "mouse") {
      return;
    }
    const openEl = target.closest("[data-doc-browser-open]");
    if (!openEl) {
      return;
    }
    const docUrl = openEl.getAttribute("data-doc-browser-open");
    if (!docUrl) {
      return;
    }
    startLongPressPreview(docUrl);
  };

  const onBrowserPointerEnd = (): void => {
    cancelTouchHold();
  };

  const onBrowserClick = (event: MouseEvent): void => {
    const state = $state.get();
    const target = event.target as {
      closest?: (selector: string) => Element | null;
    } | null;
    if (!target?.closest) {
      return;
    }

    if (state.previewDocUrl !== null && target === preview) {
      closePreview();
      return;
    }

    const openEl = target.closest("[data-doc-browser-open]");
    if (openEl) {
      const docUrl = openEl.getAttribute("data-doc-browser-open");
      if (docUrl) {
        if (state.suppressNextOpenDocUrl === docUrl) {
          updateState((nextState) => ({
            ...nextState,
            suppressNextOpenDocUrl: null,
          }));
          return;
        }
        options.onOpenDocument(docUrl);
      }
      return;
    }

    const deleteEl = target.closest("[data-doc-browser-delete]");
    if (deleteEl) {
      const docUrl = deleteEl.getAttribute("data-doc-browser-delete");
      if (docUrl) {
        options.onDeleteDocument(docUrl);
      }
      return;
    }

    if (target === browserHost) {
      options.onClose();
    }
  };

  const onCreateClick = (event: MouseEvent): void => {
    const target = event.target as {
      closest?: (selector: string) => Element | null;
    } | null;
    if (!target?.closest) {
      return;
    }

    if (target === createHost || target.closest("[data-doc-create-close]")) {
      updateState((nextState) => ({
        ...nextState,
        createOpen: false,
        createVolumeId: null,
      }));
      return;
    }

    if (target.closest("[data-doc-create-back]")) {
      updateState((nextState) => ({ ...nextState, createVolumeId: null }));
      return;
    }

    if (target.closest('[data-doc-browser-create-normal="true"]')) {
      options.onNewDocument({ mode: "normal" });
      updateState((nextState) => ({
        ...nextState,
        createOpen: false,
        createVolumeId: null,
      }));
      return;
    }

    const volumeEl = target.closest("[data-doc-create-volume]");
    if (volumeEl) {
      const volumeId = volumeEl.getAttribute("data-doc-create-volume");
      if (volumeId === "pdr-v1" || volumeId === "pdr-v2") {
        updateState((nextState) => ({
          ...nextState,
          createVolumeId: volumeId,
        }));
      }
      return;
    }

    const pageEl = target.closest("[data-doc-create-page]");
    if (pageEl) {
      const coloringPageId = pageEl.getAttribute("data-doc-create-page");
      if (coloringPageId) {
        options.onNewDocument({
          mode: "coloring",
          coloringPageId,
        });
        updateState((nextState) => ({
          ...nextState,
          createOpen: false,
          createVolumeId: null,
        }));
      }
      return;
    }
  };

  closeButton.addEventListener("click", () => options.onClose());
  newButton.addEventListener("click", () => {
    updateState((state) => ({
      ...state,
      createOpen: true,
      createVolumeId: null,
    }));
  });
  browserHost.addEventListener("pointerdown", onBrowserPointerDown);
  browserHost.addEventListener("pointerup", onBrowserPointerEnd);
  browserHost.addEventListener("pointercancel", onBrowserPointerEnd);
  browserHost.addEventListener("pointerleave", onBrowserPointerEnd);
  browserHost.addEventListener("click", onBrowserClick);
  createHost.addEventListener("click", onCreateClick);
  bindAttrs($state, browserHost, (state) => ({ hidden: !state.open }));
  bindAttrs($state, createHost, (state) => ({ hidden: !state.createOpen }));
  bindAtom($state, (state) => {
    if (
      state.previewDocUrl &&
      !state.documents.some(
        (document) => document.docUrl === state.previewDocUrl,
      )
    ) {
      closePreview();
      return;
    }
    render();
  });

  return {
    el: root,
    setOpen(nextOpen) {
      if (!nextOpen) {
        clearLongPressTimeout();
      }
      updateState((nextState) => ({
        ...nextState,
        open: nextOpen,
        previewDocUrl: nextOpen ? nextState.previewDocUrl : null,
        touchPressDocUrl: nextOpen ? nextState.touchPressDocUrl : null,
      }));
    },
    isOpen() {
      return $state.get().open;
    },
    openCreateDialog() {
      updateState((state) => ({
        ...state,
        createOpen: true,
        createVolumeId: null,
      }));
    },
    closeCreateDialog() {
      updateState((state) => ({
        ...state,
        createOpen: false,
        createVolumeId: null,
      }));
    },
    isCreateDialogOpen() {
      return $state.get().createOpen;
    },
    setLoading(nextLoading) {
      updateState((state) => ({ ...state, loading: nextLoading }));
    },
    setDocuments(nextDocuments, nextCurrentDocUrl, nextThumbnailUrlByDocUrl) {
      updateState((state) => ({
        ...state,
        documents: [...nextDocuments],
        currentDocUrl: nextCurrentDocUrl,
        thumbnailUrlByDocUrl: new Map(nextThumbnailUrlByDocUrl),
      }));
    },
    setBusyDocument(docUrl) {
      updateState((state) => ({ ...state, busyDocUrl: docUrl }));
    },
  };
}

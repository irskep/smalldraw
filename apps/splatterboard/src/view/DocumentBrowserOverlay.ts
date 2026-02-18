import "./DocumentBrowserOverlay.css";

import { type IconNode, Trash2, X } from "lucide";
import { el, list, setChildren } from "redom";
import type { KidsDocumentSummary } from "../documents";

const LONG_PRESS_PREVIEW_MS = 320;
const SVG_NS = "http://www.w3.org/2000/svg";

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
  return `${toFallbackTitle(document)}\nLast opened: ${formatTimestamp(document.lastOpenedAt)}`;
}

export interface DocumentBrowserOverlay {
  readonly el: HTMLDivElement;
  setOpen(open: boolean): void;
  isOpen(): boolean;
  setLoading(loading: boolean): void;
  setDocuments(
    documents: KidsDocumentSummary[],
    currentDocUrl: string,
    thumbnailUrlByDocUrl: Map<string, string>,
  ): void;
  setBusyDocument(docUrl: string | null): void;
}

interface TileRenderContext {
  currentDocUrl: string;
  busyDocUrl: string | null;
  thumbnailUrlByDocUrl: Map<string, string>;
}

class DocumentTileView {
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

  update(document: KidsDocumentSummary, _: number, __: unknown, context: TileRenderContext): void {
    const isCurrent = document.docUrl === context.currentDocUrl;
    const busy = context.busyDocUrl === document.docUrl;
    const nextThumbnailUrl = context.thumbnailUrlByDocUrl.get(document.docUrl) ?? null;

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
  onNewDocument: () => void;
  onOpenDocument: (docUrl: string) => void;
  onDeleteDocument: (docUrl: string) => void;
}): DocumentBrowserOverlay {
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
  const host = el(
    "div.kids-draw-document-browser",
    panel,
    preview,
  ) as HTMLDivElement;

  let open = false;
  let loading = false;
  let busyDocUrl: string | null = null;
  let currentDocUrl = "";
  let documents: KidsDocumentSummary[] = [];
  let thumbnailUrlByDocUrl = new Map<string, string>();
  let previewDocUrl: string | null = null;
  let touchPressDocUrl: string | null = null;
  let suppressNextOpenDocUrl: string | null = null;
  let longPressTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
  let previewImageSrc: string | null = null;

  const clearLongPressTimeout = (): void => {
    if (longPressTimeoutHandle !== null) {
      clearTimeout(longPressTimeoutHandle);
      longPressTimeoutHandle = null;
    }
  };

  const closePreview = (): void => {
    previewDocUrl = null;
  };

  const showPreview = (docUrl: string): void => {
    previewDocUrl = docUrl;
    render();
  };

  const cancelTouchHold = (): void => {
    clearLongPressTimeout();
    touchPressDocUrl = null;
    if (!previewDocUrl) {
      return;
    }
    suppressNextOpenDocUrl = previewDocUrl;
    closePreview();
    render();
  };

  const render = (): void => {
    host.hidden = !open;
    if (!open) {
      closePreview();
      clearLongPressTimeout();
      touchPressDocUrl = null;
      return;
    }

    const previewDocument = previewDocUrl
      ? (documents.find((document) => document.docUrl === previewDocUrl) ??
        null)
      : null;
    preview.hidden = previewDocument === null;
    if (previewDocument) {
      const previewThumbnailUrl = thumbnailUrlByDocUrl.get(
        previewDocument.docUrl,
      );
      const nextPreviewImageSrc = previewThumbnailUrl ?? null;
      if (nextPreviewImageSrc !== previewImageSrc) {
        if (nextPreviewImageSrc) {
          previewImage.src = nextPreviewImageSrc;
        } else {
          previewImage.removeAttribute("src");
        }
        previewImageSrc = nextPreviewImageSrc;
      }
      previewImage.hidden = nextPreviewImageSrc === null;
      previewMetaTitle.textContent = toFallbackTitle(previewDocument);
      previewMetaTimestamp.textContent = `Last opened: ${formatTimestamp(previewDocument.lastOpenedAt)}`;
    }

    if (loading) {
      setChildren(grid, [loadingEl]);
      return;
    }

    if (documents.length === 0) {
      setChildren(grid, [emptyStateEl]);
      return;
    }

    tileList.update(documents, {
      currentDocUrl,
      busyDocUrl,
      thumbnailUrlByDocUrl,
    } satisfies TileRenderContext);
  };

  const onHostPointerDown = (event: PointerEvent): void => {
    const target = event.target as HTMLElement | null;
    if (!target || event.pointerType === "mouse") {
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
    clearLongPressTimeout();
    touchPressDocUrl = docUrl;
    longPressTimeoutHandle = setTimeout(() => {
      longPressTimeoutHandle = null;
      if (touchPressDocUrl !== docUrl) {
        return;
      }
      showPreview(docUrl);
    }, LONG_PRESS_PREVIEW_MS);
  };

  const onHostPointerEnd = (): void => {
    cancelTouchHold();
  };

  const onHostClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    if (previewDocUrl !== null && target === preview) {
      closePreview();
      render();
      return;
    }

    const openEl = target.closest("[data-doc-browser-open]");
    if (openEl) {
      const docUrl = openEl.getAttribute("data-doc-browser-open");
      if (docUrl) {
        if (suppressNextOpenDocUrl === docUrl) {
          suppressNextOpenDocUrl = null;
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

    if (target === host) {
      options.onClose();
    }
  };

  closeButton.addEventListener("click", () => options.onClose());
  newButton.addEventListener("click", () => options.onNewDocument());
  host.addEventListener("pointerdown", onHostPointerDown);
  host.addEventListener("pointerup", onHostPointerEnd);
  host.addEventListener("pointercancel", onHostPointerEnd);
  host.addEventListener("pointerleave", onHostPointerEnd);
  host.addEventListener("click", onHostClick);
  render();

  return {
    el: host,
    setOpen(nextOpen) {
      open = nextOpen;
      if (!nextOpen) {
        closePreview();
        clearLongPressTimeout();
        touchPressDocUrl = null;
      }
      render();
    },
    isOpen() {
      return open;
    },
    setLoading(nextLoading) {
      loading = nextLoading;
      render();
    },
    setDocuments(nextDocuments, nextCurrentDocUrl, nextThumbnailUrlByDocUrl) {
      documents = [...nextDocuments];
      currentDocUrl = nextCurrentDocUrl;
      thumbnailUrlByDocUrl = new Map(nextThumbnailUrlByDocUrl);
      if (
        previewDocUrl &&
        !documents.some((document) => document.docUrl === previewDocUrl)
      ) {
        closePreview();
      }
      render();
    },
    setBusyDocument(docUrl) {
      busyDocUrl = docUrl;
      render();
    },
  };
}

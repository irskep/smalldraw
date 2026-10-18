import "./NewDocumentDialogView.css";

import {
  Button,
  createCardGrid,
  createChoiceCard,
  createDialogScaffold,
  createPosterCard,
  createText,
} from "@smalldraw/design-system";
import { ArrowLeft, X } from "lucide";
import { atom } from "nanostores";
import { el, mount, setChildren } from "redom";
import { getColoringBooks } from "../coloring/books";
import type { NewDocumentRequest } from "../documents/newDocumentRequest";
import { bindAtom } from "./atomBindings";
import type { ReDomLike } from "./ReDomLike";

type NewDocumentDialogState = {
  open: boolean;
  busy: boolean;
  selectedVolumeId: string | null;
};

export interface NewDocumentDialogView extends ReDomLike<HTMLDivElement> {
  setOpen(open: boolean): void;
  isOpen(): boolean;
  setBusy(busy: boolean): void;
}

export function createNewDocumentDialogView(options: {
  onClose: () => void;
  onCreate: (request: NewDocumentRequest) => void;
  resolveAssetUrl?: (src: string) => string;
}): NewDocumentDialogView {
  const books = getColoringBooks();
  const bookById = new Map(books.map((book) => [book.id, book] as const));
  const resolveAssetUrl = options.resolveAssetUrl ?? ((src: string) => src);

  const scaffold = createDialogScaffold();
  scaffold.setDialogClassName("kids-draw-new-document-dialog");
  scaffold.setSurfaceClassName("kids-draw-new-document-dialog__card");
  scaffold.setTitleAlignment("center");
  scaffold.setOnDismiss(() => {
    options.onClose();
  });

  const backButton = new Button({
    label: "Back",
    tone: "neutral",
    icon: ArrowLeft,
  });
  backButton.setOnPress(() => {
    updateState((state) => ({ ...state, selectedVolumeId: null }));
  });

  const closeButton = new Button({
    label: "Close",
    tone: "neutral",
    icon: X,
  });
  closeButton.setOnPress(() => {
    options.onClose();
  });
  scaffold.setTrailing(closeButton);

  const body = document.createElement("div");
  body.className = "kids-draw-new-document-dialog__body";
  const rootChoices = document.createElement("section");
  rootChoices.className = "kids-draw-new-document-dialog__choices";
  const blankChoiceSlot = document.createElement("div");
  blankChoiceSlot.className = "kids-draw-new-document-dialog__blank-choice";
  const booksHeading = createText({
    tag: "h3",
    text: "Coloring books",
    kind: "title",
    className: "kids-draw-new-document-dialog__section-title",
  });
  const volumeGrid = createCardGrid({
    className: "kids-draw-new-document-dialog__volume-grid",
    itemMinWidth: "14.375rem",
    ariaLabel: "Coloring books",
  });
  const pageGrid = createCardGrid({
    className: "kids-draw-new-document-dialog__pages",
    itemMinWidth: "8.5rem",
    ariaLabel: "Coloring pages",
  });
  const pageSection = document.createElement("section");
  pageSection.className = "kids-draw-new-document-dialog__page-section";
  mount(pageSection, pageGrid);
  mount(rootChoices, blankChoiceSlot);
  mount(rootChoices, booksHeading);
  mount(rootChoices, volumeGrid);
  mount(body, rootChoices);
  mount(body, pageSection);
  scaffold.setBody(body);

  const $state = atom<NewDocumentDialogState>({
    open: false,
    busy: false,
    selectedVolumeId: null,
  });

  const updateState = (
    updater: (state: NewDocumentDialogState) => NewDocumentDialogState,
  ): void => {
    $state.set(updater($state.get()));
  };

  const renderRootChoices = (state: NewDocumentDialogState): void => {
    const blankChoice = createChoiceCard({
      title: "Blank page",
      className:
        "kids-draw-new-document-dialog__choice kids-draw-new-document-dialog__blank-button",
    });
    blankChoice.setMedia(
      el(
        "span.kids-draw-new-document-dialog__blank-paper",
        { "aria-hidden": "true" },
        "+",
      ),
    );
    blankChoice.setAttributes({
      "data-new-document-mode": "normal",
    });
    blankChoice.setDisabled(state.busy);
    blankChoice.setOnPress(() => {
      options.onCreate({ mode: "normal" });
    });

    const volumeCards = books.map((book) => {
      const card = createChoiceCard({
        title: book.title,
        className: "kids-draw-new-document-dialog__choice",
      });
      if (book.coverPageSrc) {
        const image = document.createElement("img");
        image.src = resolveAssetUrl(book.coverPageSrc);
        image.alt = `${book.title} cover preview`;
        image.loading = "eager";
        image.decoding = "async";
        image.draggable = false;
        card.setMedia(image);
      }
      card.setAttributes({
        "data-new-document-volume": book.id,
      });
      card.setDisabled(state.busy);
      card.setOnPress(() => {
        updateState((current) => ({ ...current, selectedVolumeId: book.id }));
      });
      return card;
    });

    setChildren(blankChoiceSlot, [blankChoice]);
    volumeGrid.setItems(volumeCards);
  };

  const renderPageGrid = (state: NewDocumentDialogState): void => {
    if (!state.selectedVolumeId) {
      pageGrid.setItems([]);
      return;
    }
    const book = bookById.get(state.selectedVolumeId) ?? null;
    if (!book) {
      pageGrid.setItems([]);
      return;
    }
    const cards = book.pages.map((page) => {
      const pageNum = String(page.pageNumber);
      const card = createPosterCard({
        label: `Page ${pageNum}`,
      });
      const image = document.createElement("img");
      image.src = resolveAssetUrl(page.src);
      image.alt = `${page.volumeLabel} Page ${pageNum}`;
      image.loading = "eager";
      image.decoding = "async";
      image.draggable = false;
      card.setMedia(image);
      card.setAttributes({
        "data-new-document-page": page.id,
      });
      card.setDisabled(state.busy);
      card.setOnPress(() => {
        options.onCreate({
          mode: "coloring",
          coloringPageId: page.id,
        });
      });
      return card;
    });
    pageGrid.setItems(cards);
  };

  bindAtom($state, (state) => {
    const selectedBook =
      state.selectedVolumeId === null
        ? null
        : (bookById.get(state.selectedVolumeId) ?? null);
    scaffold.setLeading(selectedBook === null ? null : backButton);
    scaffold.setTitle(selectedBook === null ? "New drawing" : "Pick a page");
    scaffold.setSubtitle(selectedBook?.title ?? null);
    closeButton.setDisabled(state.busy);
    backButton.setDisabled(state.busy);
    renderRootChoices(state);
    renderPageGrid(state);
    rootChoices.hidden = selectedBook !== null;
    pageSection.hidden = selectedBook === null;
  });

  return {
    el: scaffold.el,
    setOpen(open) {
      updateState((state) => ({
        ...state,
        open,
        selectedVolumeId: open ? state.selectedVolumeId : null,
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
    setBusy(busy) {
      updateState((state) => ({ ...state, busy }));
    },
  };
}

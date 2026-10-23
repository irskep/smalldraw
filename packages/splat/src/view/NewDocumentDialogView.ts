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

import { getColoringCategories } from "../coloring/categories";
import type { NewDocumentRequest } from "../documents/newDocumentRequest";
import { bindAtom } from "./atomBindings";
import type { ReDomLike } from "./ReDomLike";

type NewDocumentDialogState = {
  open: boolean;
  busy: boolean;
  selectedCategoryId: string | null;
  coloringOnly: boolean;
};

export interface NewDocumentDialogView extends ReDomLike<HTMLDivElement> {
  setOpen(open: boolean, mode?: "all" | "coloring"): void;
  isOpen(): boolean;
  setBusy(busy: boolean): void;
}

export function createNewDocumentDialogView(options: {
  onClose: () => void;
  onCreate: (request: NewDocumentRequest) => void;
  resolveAssetUrl?: (src: string) => string;
}): NewDocumentDialogView {
  const categories = getColoringCategories();
  const categoryById = new Map(
    categories.map((category) => [category.id, category] as const),
  );
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
    updateState((state) => ({ ...state, selectedCategoryId: null }));
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

  const body = el("div");
  body.className = "kids-draw-new-document-dialog__body";
  const rootChoices = el("section");
  rootChoices.className = "kids-draw-new-document-dialog__choices";
  const blankChoiceSlot = el("div");
  blankChoiceSlot.className = "kids-draw-new-document-dialog__blank-choice";
  const categoriesHeading = createText({
    tag: "h3",
    text: "Coloring pages",
    kind: "title",
    className: "kids-draw-new-document-dialog__section-title",
  });
  const categoryGrid = createCardGrid({
    className: "kids-draw-new-document-dialog__volume-grid",
    itemMinWidth: "14.375rem",
    ariaLabel: "Coloring pages",
  });
  const pageGrid = createCardGrid({
    className: "kids-draw-new-document-dialog__pages",
    itemMinWidth: "8.5rem",
    ariaLabel: "Coloring pages",
  });
  const pageSection = el("section");
  pageSection.className = "kids-draw-new-document-dialog__page-section";
  mount(pageSection, pageGrid);
  const credits = el(
    "a",
    { target: "_blank", rel: "noopener noreferrer" },
    "Artwork credits",
  );
  mount(pageSection, credits);
  mount(rootChoices, blankChoiceSlot);
  mount(rootChoices, categoriesHeading);
  mount(rootChoices, categoryGrid);
  mount(body, rootChoices);
  mount(body, pageSection);
  scaffold.setBody(body);

  const $state = atom<NewDocumentDialogState>({
    open: false,
    busy: false,
    selectedCategoryId: null,
    coloringOnly: false,
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

    const categoryCards = categories.map((category) => {
      const card = createChoiceCard({
        title: category.title,
        className: "kids-draw-new-document-dialog__choice",
      });
      const preview = category.pages[0];
      if (preview) {
        const image = document.createElement("img");
        image.src = resolveAssetUrl(preview.src);
        image.alt = category.title;
        image.loading = "lazy";
        image.decoding = "async";
        image.draggable = false;
        card.setMedia(image);
      }
      card.setAttributes({
        "data-new-document-category": category.id,
      });
      card.setDisabled(state.busy);
      card.setOnPress(() => {
        updateState((current) => ({
          ...current,
          selectedCategoryId: category.id,
        }));
      });
      return card;
    });

    setChildren(blankChoiceSlot, [blankChoice]);
    categoryGrid.setItems(categoryCards);
  };

  const renderPageGrid = (state: NewDocumentDialogState): void => {
    if (!state.selectedCategoryId) {
      pageGrid.setItems([]);
      return;
    }
    const category = categoryById.get(state.selectedCategoryId) ?? null;
    if (!category) {
      pageGrid.setItems([]);
      return;
    }
    const cards = category.pages.map((page, index) => {
      const label =
        page.volumeId !== "pdr-v1" && page.volumeId !== "pdr-v2"
          ? page.label
          : `Drawing ${index + 1}`;
      const card = createPosterCard({
        label,
      });
      const image = document.createElement("img");
      image.src = resolveAssetUrl(page.src);
      image.alt = label;
      image.loading = "lazy";
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
    const selectedCategory =
      state.selectedCategoryId === null
        ? null
        : (categoryById.get(state.selectedCategoryId) ?? null);
    scaffold.setLeading(selectedCategory === null ? null : backButton);
    scaffold.setTitle(
      selectedCategory === null
        ? state.coloringOnly
          ? "Pick something to color"
          : "New drawing"
        : "Pick a page",
    );
    blankChoiceSlot.hidden = state.coloringOnly;
    categoriesHeading.el.hidden = state.coloringOnly;
    scaffold.setSubtitle(selectedCategory?.title ?? null);
    credits.hidden = !selectedCategory?.creditsSrc;
    if (selectedCategory?.creditsSrc)
      credits.href = resolveAssetUrl(selectedCategory.creditsSrc);
    closeButton.setDisabled(state.busy);
    backButton.setDisabled(state.busy);
    renderRootChoices(state);
    renderPageGrid(state);
    rootChoices.hidden = selectedCategory !== null;
    pageSection.hidden = selectedCategory === null;
  });

  return {
    el: scaffold.el,
    setOpen(open, mode = "all") {
      updateState((state) => ({
        ...state,
        open,
        coloringOnly: mode === "coloring",
        selectedCategoryId: open ? state.selectedCategoryId : null,
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

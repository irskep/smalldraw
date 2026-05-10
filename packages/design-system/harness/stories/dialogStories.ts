import {
  AlertTriangle,
  ArrowLeft,
  KeyRound,
  Trash2,
  X,
} from "lucide";
import { el, mount } from "redom";
import {
  Button,
  createCardGrid,
  createChoiceCard,
  createDialogScaffold,
  createModalDialogView,
  createPosterCard,
  createPreviewCard,
  createShareQrDialog,
  createText,
  createThumbnailTile,
} from "../../src";
import type { HarnessStory } from "./types";

type MockColoringBook = {
  id: string;
  title: string;
  sourceLabel: string;
  pages: string[];
};

const MOCK_COLORING_BOOKS: readonly MockColoringBook[] = [
  {
    id: "pdr-v1",
    title: "PDR Volume 1",
    sourceLabel: "Built in",
    pages: ["001", "002", "003", "004", "005", "006"],
  },
  {
    id: "pdr-v2",
    title: "PDR Volume 2",
    sourceLabel: "Built in",
    pages: ["001", "002", "003", "004"],
  },
  {
    id: "nyam-lib-2024-v2",
    title: "Living Well in the 19th and 20th Century",
    sourceLabel: "NYAM ColorOurCollections",
    pages: ["002", "003", "004", "005"],
  },
];

function getBookSubtitle(book: MockColoringBook): string {
  return `${book.pages.length} pages · ${book.sourceLabel}`;
}

function getBookCoverLabel(book: MockColoringBook): string {
  return book.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export const dialogStories: HarnessStory[] = [
  {
    id: "modal-dialog",
    title: "Modal Dialog",
    description: "Confirm/cancel dialog with optional icon and danger tone.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const status = el(
        "output.ds-story-output",
        "No result yet.",
      ) as HTMLOutputElement;
      const dialog = createModalDialogView();

      const openDefault = el(
        "button",
        { type: "button" },
        "No icon",
      ) as HTMLButtonElement;
      openDefault.addEventListener("click", async () => {
        const result = await dialog.showConfirm({
          title: "Save changes?",
          message: "You have unsaved changes that will be lost.",
          confirmLabel: "Save",
          cancelLabel: "Discard",
        });
        status.textContent = result ? "Confirmed" : "Cancelled";
      });

      const openDanger = el(
        "button",
        { type: "button" },
        "Danger with icon",
      ) as HTMLButtonElement;
      openDanger.addEventListener("click", async () => {
        const result = await dialog.showConfirm({
          title: "Delete drawing?",
          message: "This action cannot be undone.",
          confirmLabel: "Delete",
          tone: "danger",
          icon: Trash2,
        });
        status.textContent = result
          ? "Confirmed (danger)"
          : "Cancelled (danger)";
      });

      const openIcon = el(
        "button",
        { type: "button" },
        "Default with icon",
      ) as HTMLButtonElement;
      openIcon.addEventListener("click", async () => {
        const result = await dialog.showConfirm({
          title: "Warning",
          message: "Something needs your attention.",
          confirmLabel: "OK",
          icon: AlertTriangle,
        });
        status.textContent = result ? "Confirmed (icon)" : "Cancelled (icon)";
      });

      const controls = el(
        "div.ds-story-row",
        openDefault,
        openDanger,
        openIcon,
      );
      canvas.append(controls, status);
      container.replaceChildren(canvas);
      mount(container, dialog);
    },
  },
  {
    id: "share-qr-dialog",
    title: "Share QR Dialog",
    description: "Dialog showing a QR code and copyable URL for sharing.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const status = el(
        "output.ds-story-output",
        "Dialog not opened yet.",
      ) as HTMLOutputElement;
      const dialog = createShareQrDialog();

      const placeholderQr =
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Crect width='256' height='256' fill='white'/%3E%3Ctext x='128' y='140' text-anchor='middle' font-size='24' fill='%23666'%3EQR placeholder%3C/text%3E%3C/svg%3E";

      const openButton = el(
        "button",
        { type: "button" },
        "Open share dialog",
      ) as HTMLButtonElement;
      openButton.addEventListener("click", async () => {
        status.textContent = "Dialog open…";
        await dialog.show({
          joinUrl: "https://example.com/join/abc123",
          qrDataUrl: placeholderQr,
        });
        status.textContent = "Dialog closed.";
      });

      const controls = el("div.ds-story-row", openButton);
      canvas.append(controls, status);
      container.replaceChildren(canvas);
      mount(container, dialog);
    },
  },
  {
    id: "dialog-scaffold",
    title: "Dialog Scaffold",
    description: "Shared dialog foundation with centered header and large body.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const status = el(
        "output.ds-story-output",
        "Scaffold closed.",
      ) as HTMLOutputElement;
      const scaffold = createDialogScaffold();
      scaffold.setDialogClassName("ds-harness-dialog-scaffold");
      scaffold.setSurfaceClassName("ds-harness-dialog-scaffold__surface");
      scaffold.setTitle("Dialog Scaffold");
      scaffold.setSubtitle("Centered header with composable body content");
      scaffold.setTitleAlignment("center");
      scaffold.setOnDismiss(() => {
        status.textContent = "Scaffold closed.";
        void scaffold.close({ animated: true });
      });
      const backButton = new Button({
        label: "Back",
        tone: "neutral",
        icon: ArrowLeft,
      });
      const closeButton = new Button({
        label: "Close",
        tone: "neutral",
        icon: X,
      });
      scaffold.setLeading(backButton);
      scaffold.setTrailing(closeButton);

      const grid = createCardGrid({ itemMinWidth: "14rem" });
      const cards = [
        { title: "Blank Drawing", subtitle: "Primary choice" },
        { title: "Coloring Book", subtitle: "Grouped choices" },
        { title: "Preview", subtitle: "Rich media body" },
        { title: "Actions", subtitle: "Header and footer slots" },
      ].map(({ title, subtitle }) => {
        const card = createChoiceCard({ title, subtitle });
        const media = el("div", title.slice(0, 1)) as HTMLDivElement;
        card.setMedia(media);
        return card;
      });
      grid.setItems(cards);
      scaffold.setBody(grid);

      const openButton = el(
        "button",
        { type: "button" },
        "Open scaffold",
      ) as HTMLButtonElement;
      openButton.addEventListener("click", () => {
        status.textContent = "Scaffold open.";
        scaffold.show();
      });
      backButton.setOnPress(() => {
        status.textContent = "Back pressed.";
      });
      closeButton.setOnPress(() => {
        status.textContent = "Scaffold closed.";
        void scaffold.close({ animated: true });
      });

      canvas.append(el("div.ds-story-row", openButton), status);
      container.replaceChildren(canvas);
      mount(container, scaffold);
    },
  },
  {
    id: "choice-card",
    title: "Choice Card",
    description: "Large horizontal card used for root create-flow choices.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const card = createChoiceCard({
        title: "Blank Drawing",
        subtitle: "Start with an empty page",
      });
      card.setMedia(el("div", "Blank"));
      const disabled = createChoiceCard({
        title: "Coloring Book 1",
        subtitle: "Choose a coloring book page",
      });
      disabled.setMedia(el("div", "V1"));
      disabled.setDisabled(true);
      canvas.append(card.el, disabled.el);
      container.replaceChildren(canvas);
    },
  },
  {
    id: "poster-card",
    title: "Poster Card",
    description: "Square image card used for page picking.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const grid = createCardGrid({ itemMinWidth: "8.5rem" });
      const cards = ["Page 001", "Page 002", "Page 003"].map((label) => {
        const card = createPosterCard({ label });
        const media = el("div", label.slice(-3)) as HTMLDivElement;
        card.setMedia(media);
        return card;
      });
      grid.setItems(cards);
      canvas.append(grid.el);
      container.replaceChildren(canvas);
    },
  },
  {
    id: "coloring-book-picker",
    title: "Coloring Book Picker",
    description: "Book-first flow for choosing a coloring book, then a page.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const status = el(
        "output.ds-story-output",
        "Flow closed.",
      ) as HTMLOutputElement;
      const scaffold = createDialogScaffold();
      scaffold.setDialogClassName("ds-harness-coloring-book-picker");
      scaffold.setSurfaceClassName("ds-harness-coloring-book-picker__surface");
      scaffold.setTitleAlignment("center");

      let selectedBookId: string | null = null;

      const backButton = new Button({
        label: "Back",
        tone: "neutral",
        icon: ArrowLeft,
      });
      const closeButton = new Button({
        label: "Close",
        tone: "neutral",
        icon: X,
      });
      closeButton.setOnPress(() => {
        status.textContent = "Flow closed.";
        void scaffold.close({ animated: true });
      });
      backButton.setOnPress(() => {
        selectedBookId = null;
        render();
      });
      scaffold.setTrailing(closeButton);

      const body = el(
        "div.ds-dialog-story__body.ds-dialog-story__body--compact",
      ) as HTMLDivElement;

      const rootView = el(
        "section.ds-dialog-story__section",
      ) as HTMLElement;
      const blankCard = createChoiceCard({
        title: "Blank Drawing",
        subtitle: "Start with an empty page",
      });
      blankCard.setMedia(el("div", "Blank"));
      const booksHeading = createText({
        tag: "h3",
        text: "Coloring Books",
        kind: "title",
      });
      const booksCopy = createText({
        tag: "p",
        text: "Choose a book, then pick a page to color.",
        kind: "body",
        tone: "secondary",
      });
      booksHeading.el.classList.add("ds-dialog-story__heading");
      booksCopy.el.classList.add("ds-dialog-story__copy");
      const bookGrid = createCardGrid({
        itemMinWidth: "14rem",
        ariaLabel: "Coloring books",
      });
      const bookCards = MOCK_COLORING_BOOKS.map((book) => {
        const card = createChoiceCard({
          title: book.title,
          subtitle: getBookSubtitle(book),
        });
        card.setMedia(
          el("div.ds-dialog-story__cover-token", getBookCoverLabel(book)),
        );
        card.setOnPress(() => {
          selectedBookId = book.id;
          render();
        });
        return card;
      });
      bookGrid.setItems(bookCards);
      rootView.append(blankCard.el, booksHeading.el, booksCopy.el, bookGrid.el);

      const pageView = el(
        "section.ds-dialog-story__section",
      ) as HTMLElement;
      const bookSummary = el("div.ds-dialog-story__summary") as HTMLDivElement;
      const bookSummaryCover = el(
        "div.ds-dialog-story__summary-cover",
      ) as HTMLDivElement;
      const bookSummaryMeta = el(
        "div.ds-dialog-story__summary-meta",
      ) as HTMLDivElement;
      const bookSummaryTitle = createText({
        tag: "h3",
        text: "",
        kind: "title",
      });
      const bookSummaryCopy = createText({
        tag: "p",
        text: "",
        kind: "body",
        tone: "secondary",
      });
      bookSummaryTitle.el.classList.add("ds-dialog-story__heading");
      bookSummaryCopy.el.classList.add("ds-dialog-story__copy");
      bookSummaryMeta.append(bookSummaryTitle.el, bookSummaryCopy.el);
      bookSummary.append(bookSummaryCover, bookSummaryMeta);
      const pagesHeading = createText({
        tag: "h3",
        text: "Choose a Page",
        kind: "title",
      });
      const pagesCopy = createText({
        tag: "p",
        text: "Pick the page you want to color.",
        kind: "body",
        tone: "secondary",
      });
      pagesHeading.el.classList.add("ds-dialog-story__heading");
      pagesCopy.el.classList.add("ds-dialog-story__copy");
      const pageGrid = createCardGrid({
        itemMinWidth: "8.5rem",
        ariaLabel: "Coloring pages",
      });
      pageView.append(
        bookSummary,
        pagesHeading.el,
        pagesCopy.el,
        pageGrid.el,
      );

      body.append(rootView, pageView);
      scaffold.setBody(body);

      const render = (): void => {
        const selectedBook =
          selectedBookId === null
            ? null
            : (MOCK_COLORING_BOOKS.find((book) => book.id === selectedBookId) ?? null);
        scaffold.setLeading(selectedBook ? backButton : null);
        scaffold.setTitle(selectedBook ? selectedBook.title : "New Drawing");
        scaffold.setSubtitle(
          selectedBook
            ? getBookSubtitle(selectedBook)
            : "Start blank or pick a page from a coloring book",
        );
        rootView.hidden = selectedBook !== null;
        pageView.hidden = selectedBook === null;
        if (!selectedBook) {
          return;
        }
        bookSummaryCover.textContent = getBookCoverLabel(selectedBook);
        bookSummaryTitle.setText(selectedBook.title);
        bookSummaryCopy.setText(getBookSubtitle(selectedBook));
        const pageCards = selectedBook.pages.map((pageLabel) => {
          const card = createPosterCard({
            label: `Page ${pageLabel}`,
          });
          card.setMedia(el("div", pageLabel));
          return card;
        });
        pageGrid.setItems(pageCards);
      };

      const openButton = el(
        "button",
        { type: "button" },
        "Open book picker",
      ) as HTMLButtonElement;
      openButton.addEventListener("click", () => {
        selectedBookId = null;
        render();
        status.textContent = "Flow open.";
        scaffold.show();
      });

      canvas.append(el("div.ds-story-row", openButton), status);
      container.replaceChildren(canvas);
      mount(container, scaffold);
      render();
    },
  },
  {
    id: "thumbnail-tile",
    title: "Thumbnail Tile",
    description: "Document browser tile with badge and overlay actions.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const grid = createCardGrid({ itemMinWidth: "12rem" });
      const shared = createThumbnailTile();
      shared.setOpenLabel("Shared drawing");
      shared.setCurrent(true);
      shared.setMedia(el("div", "Shared"));
      shared.setBadge({ label: "Shared", tone: "positive" });
      shared.setAction({
        label: "Delete drawing",
        icon: Trash2,
        onPress: () => {},
      });
      shared.setSecondaryAction({
        label: "Claim drawing",
        text: "Claim",
        icon: KeyRound,
        onPress: () => {},
      });
      const local = createThumbnailTile();
      local.setOpenLabel("Local drawing");
      local.setMedia(el("div", "Local"));
      local.setBadge({ label: "Local" });
      grid.setItems([shared, local]);
      canvas.append(grid.el);
      container.replaceChildren(canvas);
    },
  },
  {
    id: "preview-card",
    title: "Preview Card",
    description: "Large media preview card used for long-press document previews.",
    mount: (container) => {
      const canvas = el("div.ds-story-stack") as HTMLDivElement;
      const card = createPreviewCard();
      card.setImage({
        src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 192'%3E%3Crect width='256' height='192' fill='white'/%3E%3Ccircle cx='64' cy='64' r='28' fill='%2394a3b8'/%3E%3Cpath d='M24 156Q88 92 128 124T232 92v64H24Z' fill='%233b82f6'/%3E%3C/svg%3E",
      });
      card.setTitle("Drawing abc123");
      card.setSubtitle("Last opened: 1/1/2026, 12:00:00 AM");
      canvas.append(card.el);
      container.replaceChildren(canvas);
    },
  },
];

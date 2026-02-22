import { Download, FilePlus, FolderOpen, Redo2, Trash2, Undo2 } from "lucide";
import { el, mount } from "redom";
import type { UiIntentStore } from "../../controller/stores/createUiIntentStore";
import type { ReDomLike } from "../ReDomLike";
import {
  createSquareIconButton,
  type SquareIconButton,
} from "../SquareIconButton";

export class ToolbarActionPane
  implements
    ReDomLike<
      HTMLDivElement,
      { canUndo: boolean; canRedo: boolean; newDrawingPending: boolean }
    >
{
  readonly el: HTMLDivElement;
  private readonly undoButton: SquareIconButton;
  private readonly redoButton: SquareIconButton;
  private readonly clearButton: SquareIconButton;
  private readonly exportButton: SquareIconButton;
  private readonly newDrawingButton: SquareIconButton;
  private readonly browseButton: SquareIconButton;

  constructor(options: {
    uiIntentStore: Pick<UiIntentStore, "publish">;
  }) {
    this.el = el(
      "div.kids-draw-action-panel.kids-toolbar-grid-panel",
    ) as HTMLDivElement;

    this.undoButton = createSquareIconButton({
      className: "kids-draw-action-button kids-draw-action-undo",
      label: "Undo",
      icon: Undo2,
      attributes: {
        title: "Undo",
        "aria-label": "Undo",
        "data-action": "undo",
      },
    });
    this.redoButton = createSquareIconButton({
      className: "kids-draw-action-button kids-draw-action-redo",
      label: "Redo",
      icon: Redo2,
      attributes: {
        title: "Redo",
        "aria-label": "Redo",
        "data-action": "redo",
      },
    });
    this.clearButton = createSquareIconButton({
      className: "kids-draw-action-button kids-draw-action-clear",
      label: "Clear",
      icon: Trash2,
      attributes: {
        title: "Clear canvas",
        "aria-label": "Clear canvas",
        "data-action": "clear",
        layout: "row",
      },
    });
    this.exportButton = createSquareIconButton({
      className: "kids-draw-action-button kids-draw-action-export",
      label: "Export",
      icon: Download,
      attributes: {
        title: "Export PNG",
        "aria-label": "Export PNG",
        "data-action": "export",
        layout: "row",
      },
    });
    this.newDrawingButton = createSquareIconButton({
      className: "kids-draw-action-button kids-draw-action-new",
      label: "New",
      icon: FilePlus,
      attributes: {
        title: "New drawing",
        "aria-label": "New drawing",
        "data-action": "new-drawing",
        layout: "row",
      },
    });
    this.browseButton = createSquareIconButton({
      className: "kids-draw-action-button kids-draw-action-browse",
      label: "Browse",
      icon: FolderOpen,
      attributes: {
        title: "Browse drawings",
        "aria-label": "Browse drawings",
        "data-action": "browse",
        layout: "row",
      },
    });

    mount(this.el, this.undoButton);
    mount(this.el, this.redoButton);
    mount(
      this.el,
      el("div.kids-draw-action-spacer", {
        "aria-hidden": "true",
      }) as HTMLDivElement,
    );
    mount(this.el, this.clearButton);
    mount(this.el, this.exportButton);
    mount(this.el, this.newDrawingButton);
    mount(this.el, this.browseButton);
    this.undoButton.setOnPress(() =>
      options.uiIntentStore.publish({ type: "undo" }),
    );
    this.redoButton.setOnPress(() =>
      options.uiIntentStore.publish({ type: "redo" }),
    );
    this.clearButton.setOnPress(() =>
      options.uiIntentStore.publish({ type: "clear" }),
    );
    this.exportButton.setOnPress(() =>
      options.uiIntentStore.publish({ type: "export" }),
    );
    this.newDrawingButton.setOnPress(() =>
      options.uiIntentStore.publish({ type: "new_drawing" }),
    );
    this.browseButton.setOnPress(() =>
      options.uiIntentStore.publish({ type: "browse" }),
    );
  }

  update(options: {
    canUndo: boolean;
    canRedo: boolean;
    newDrawingPending: boolean;
  }): void {
    this.undoButton.setDisabled(!options.canUndo);
    this.redoButton.setDisabled(!options.canRedo);
    this.newDrawingButton.setDisabled(options.newDrawingPending);
  }

  destroy(): void {
    this.undoButton.setOnPress(null);
    this.redoButton.setOnPress(null);
    this.clearButton.setOnPress(null);
    this.exportButton.setOnPress(null);
    this.newDrawingButton.setOnPress(null);
    this.browseButton.setOnPress(null);
  }
}
